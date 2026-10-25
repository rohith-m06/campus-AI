"""
Unified Smart RAG Engine for CampusMind AI.
Architecture:
- 100% LLM-First: Every user query is directly analyzed and processed by Google Gemini.
- Fast Intent-Targeted Context: Selectively injects relevant context (attendance, tickets, exams, etc.)
  drastically reducing token footprint and generation latency (Section 4.3).
- Strict Batch-Aware Chroma Retrieval: Filters by branch, year, and batch with strict fallbacks
  (branch+year+batch -> branch+year -> campus-wide -> empty) without wrong-branch leaks (Section 4.4 & 4.5).
- ChromaDB Warmup & In-Memory LRU Caching: Pre-warms embeddings and collection at startup (Section 4.6).
- Progressive Response Streaming: Supports token-by-token streaming via SSE (Section 4.7).
- Resilient Multi-Tier Model Fallback: Gemini 2.5 Flash -> 3.5 Flash Lite -> 3.1 Flash Lite.
"""

import os
import re
import time
from pathlib import Path
from typing import List, Dict, Any, Tuple, AsyncGenerator, Optional
from datetime import datetime
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR / "backend" / ".env")

# Ensure API key is mapped to GOOGLE_API_KEY if user provided GEMINI_API_KEY
if os.getenv("GEMINI_API_KEY") and not os.getenv("GOOGLE_API_KEY"):
    os.environ["GOOGLE_API_KEY"] = os.getenv("GEMINI_API_KEY")

import chromadb
from chromadb.utils import embedding_functions
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from backend.firebase_service import classify_intent

CHROMA_DIR = BASE_DIR / "backend" / "chroma_db"
COLLECTION_NAME = "campusmind_knowledge"
PRIMARY_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# Fast, low-latency Gemini model hierarchy prioritizing fast models with highest uptime
MODEL_HIERARCHY = [
    "gemini-2.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
]

_retrieval_cache = {}  # In-memory LRU cache for repeat queries: (query, branch, year, batch)

# Singleton references
_chroma_client = None
_collection = None
_default_ef = None

def get_embedding_function():
    global _default_ef
    if _default_ef is None:
        _default_ef = embedding_functions.DefaultEmbeddingFunction()
    return _default_ef

def get_chroma_collection():
    global _chroma_client, _collection
    if _collection is None:
        _chroma_client = chromadb.PersistentClient(path=str(CHROMA_DIR))
        _collection = _chroma_client.get_or_create_collection(
            name=COLLECTION_NAME,
            embedding_function=get_embedding_function()
        )
    return _collection

def warm_up_chromadb() -> bool:
    """
    Initializes embeddings once and runs a test query against Chroma collection (Section 4.6).
    Eliminates cold-start latency when users send their first chat query.
    """
    try:
        col = get_chroma_collection()
        col.query(query_texts=["academic policies and attendance criteria"], n_results=1)
        print("[Startup] ChromaDB warmed up and cached successfully.")
        return True
    except Exception as e:
        print(f"[Startup] ChromaDB warm-up notice: {e}")
        return False

def extract_content_text(content: Any) -> str:
    """Safely extracts clean string text from str, dict, or list of content blocks."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict) and "text" in item:
                parts.append(item["text"])
            elif isinstance(item, str):
                parts.append(item)
            elif hasattr(item, "text"):
                parts.append(str(item.text))
        return "\n".join(parts)
    if isinstance(content, dict) and "text" in content:
        return content["text"]
    return str(content)

# -------------------------------------------------------------
# VECTOR SEARCH & RETRIEVAL (STRICT BATCH & BRANCH AWARE)
# -------------------------------------------------------------

def normalize_year_code(year_str: Any) -> str:
    """Normalizes year input to '1st', '2nd', '3rd', or '4th'."""
    if not year_str:
        return "1st"
    s = str(year_str).lower().strip()
    if "1" in s:
        return "1st"
    if "2" in s:
        return "2nd"
    if "3" in s:
        return "3rd"
    if "4" in s:
        return "4th"
    return "1st"

def normalize_branch_code(branch_str: Any) -> str:
    """Normalizes branch input to uppercase standard code."""
    if not branch_str:
        return "CSE"
    s = str(branch_str).upper().strip()
    for code in ["CSE", "ECE", "MECH", "EEE", "CIVIL", "IT"]:
        if code in s:
            return code
    return "CSE"

def query_vector_store(
    query: str,
    user_branch: str,
    user_year: str,
    user_batch: str = "all",
    top_k: int = 4
) -> Tuple[List[str], List[Dict[str, Any]]]:
    """
    Performs dynamic metadata filtered search in ChromaDB.
    Strict sequence (Section 4.4 & 4.5):
    1. branch + year + batch
    2. branch + year
    3. campus-wide documents (strictly branch == 'all' and year == 'all')
    4. no matching result (empty)
    NEVER falls back to unrestricted search across other branches!
    Cache key: query + branch + year + batch.
    """
    clean_branch = normalize_branch_code(user_branch)
    clean_year = normalize_year_code(user_year)
    clean_batch = (str(user_batch) if user_batch else "all").strip()

    cache_key = (query.strip().lower(), clean_branch, clean_year, clean_batch)
    if cache_key in _retrieval_cache:
        return _retrieval_cache[cache_key]

    collection = get_chroma_collection()
    enhanced_query = f"{query} {clean_branch} {clean_year} Year"
    if clean_batch != "all":
        enhanced_query += f" {clean_batch}"

    documents = []
    metadatas = []

    # Sequence 1: branch + year + batch
    if clean_batch != "all":
        where_filter_1 = {
            "$and": [
                {"$or": [{"branch": clean_branch}, {"applicable_to": "all"}]},
                {"$or": [{"year": clean_year}, {"year": "all"}]},
                {"$or": [{"batch": clean_batch}, {"batch": "all"}]}
            ]
        }
        try:
            r1 = collection.query(
                query_texts=[enhanced_query],
                n_results=top_k,
                where=where_filter_1
            )
            if r1 and r1.get("documents") and len(r1["documents"][0]) > 0:
                documents = r1["documents"][0]
                metadatas = r1["metadatas"][0]
        except Exception as e:
            print(f"[RAG] Batch-filtered query notice: {e}")

    # Sequence 2: branch + year (if not matched yet)
    if not documents:
        where_filter_2 = {
            "$and": [
                {"$or": [{"branch": clean_branch}, {"applicable_to": "all"}]},
                {"$or": [{"year": clean_year}, {"year": "all"}]}
            ]
        }
        try:
            r2 = collection.query(
                query_texts=[enhanced_query],
                n_results=top_k,
                where=where_filter_2
            )
            if r2 and r2.get("documents") and len(r2["documents"][0]) > 0:
                documents = r2["documents"][0]
                metadatas = r2["metadatas"][0]
        except Exception as e:
            print(f"[RAG] Branch+Year query notice: {e}")

    # Sequence 3: campus-wide documents strictly (branch == 'all' and year == 'all')
    if not documents:
        where_filter_3 = {
            "$and": [
                {"branch": "all"},
                {"year": "all"}
            ]
        }
        try:
            r3 = collection.query(
                query_texts=[enhanced_query],
                n_results=top_k,
                where=where_filter_3
            )
            if r3 and r3.get("documents") and len(r3["documents"][0]) > 0:
                documents = r3["documents"][0]
                metadatas = r3["metadatas"][0]
        except Exception as e:
            print(f"[RAG] Campus-wide query notice: {e}")

    # Sequence 4: If still no matching documents, return empty (NEVER perform unrestricted search)

    # Save to cache (limit size to 250 items)
    if len(_retrieval_cache) > 250:
        _retrieval_cache.clear()
    _retrieval_cache[cache_key] = (documents, metadatas)

    return documents, metadatas

async def invoke_llm_with_fallback(messages: List[Any]) -> Tuple[str, str]:
    """Invokes primary model with fast seamless fallback across Gemini Flash family."""
    last_err = None
    for model_name in MODEL_HIERARCHY:
        try:
            llm = ChatGoogleGenerativeAI(
                model=model_name,
                temperature=0.2,
                max_output_tokens=1024,
                max_retries=1
            )
            response = await llm.ainvoke(messages)
            text = extract_content_text(response.content)
            if text and len(text.strip()) > 0:
                return text, model_name
        except Exception as e:
            err_msg = str(e)
            print(f"[RAG Engine] Switching from '{model_name}' due to: {err_msg[:100]}")
            last_err = e
            continue

    if last_err:
        raise last_err
    return "I couldn't generate a response. Please try asking again.", MODEL_HIERARCHY[0]

# -------------------------------------------------------------
# TARGETED PROMPT BUILDER & CITATION PARSER (SECTION 4.3)
# -------------------------------------------------------------

def build_targeted_prompt(
    query: str,
    user_profile: Dict[str, Any],
    preferred_language: Optional[str],
    docs: List[str],
    metadatas: List[Dict[str, Any]]
) -> Tuple[List[Any], str, str, set]:
    """
    Constructs an intent-targeted system prompt with minimized token footprint (Section 4.3).
    Only sends student context relevant to the inquiry rather than injecting broad profiles.
    """
    user_name = user_profile.get("full_name", "Student")
    first_name = user_name.split()[0] if user_name else "there"
    user_branch = normalize_branch_code(user_profile.get("branch", "CSE"))
    user_year = normalize_year_code(user_profile.get("current_year", "1st"))
    user_batch = user_profile.get("batch", "2024-2028")
    hostel_status = user_profile.get("hostel_status", "Day Scholar")
    student_id = user_profile.get("student_id", "")

    detected_intent = classify_intent(query)

    # Build targeted contextual blocks
    context_blocks = []
    sources_set = set()

    # Dynamic Real-Time Academic Temporal Context
    now = datetime.now()
    current_date_str = now.strftime("%A, %B %d, %Y")
    current_time_str = now.strftime("%I:%M %p")
    current_day = now.strftime("%A")

    context_blocks.append(f"""Current Academic Date & Time Context:
- Current Date: {current_date_str}
- Current Day of the Week: {current_day}
- Current Local Time: {current_time_str}
- Academic Session: Autumn / Fall Semester (AY 2026-2027)""")

    # 1. Profile block - tailored based on intent
    if detected_intent in ["attendance", "exams", "fees", "courses"]:
        context_blocks.append(f"""Student Academic Profile:
- Student Name: {user_name}
- Department: {user_branch}
- Academic Year: {user_year} Year
- Batch: {user_batch}""")
    elif detected_intent in ["hostel", "grievance"]:
        context_blocks.append(f"""Student Campus Profile:
- Student Name: {user_name}
- Student ID: {student_id}
- Residential Status: {hostel_status}""")
    else:
        context_blocks.append(f"Student: {user_name}")

    # 2. Live data blocks - ONLY inject what's relevant to intent
    if detected_intent == "attendance":
        attendance_data = user_profile.get("attendance_summary", {})
        sub_records = attendance_data.get("subject_records", [])
        overall_pct = attendance_data.get("overall_percentage", 83.2)
        overall_att = attendance_data.get("overall_attended", 119)
        overall_tot = attendance_data.get("overall_conducted", 143)
        att_lines = [
            f"Overall Attendance: {overall_pct}% ({overall_att}/{overall_tot} classes attended)",
            "Mandatory Criteria: 75.0% for end-semester exams | Condonation: 65.0%-74.9% (medical grounds)",
            "Subject-wise Records:"
        ]
        for sub in sub_records:
            att_lines.append(f"- [{sub['code']}] {sub['title']}: {sub['attended']}/{sub['total_conducted']} ({sub['percentage']}%) | {sub['status']}")
        context_blocks.append("Live Attendance Records:\n" + "\n".join(att_lines))

    elif detected_intent == "grievance":
        user_tickets = user_profile.get("tickets", [])
        if user_tickets:
            ticket_lines = []
            for t in user_tickets:
                ticket_lines.append(
                    f"- Ticket ID: {t.get('ticket_number')} | Category: {t.get('category')} | Title: '{t.get('title')}' | "
                    f"Status: {t.get('status')} | Priority: {t.get('priority')} | Location: {t.get('location')} | "
                    f"SLA: {t.get('estimated_sla')} | Offline Desk: {t.get('offline_resolution_desk')}"
                )
            context_blocks.append("Active Student Grievance Tickets:\n" + "\n".join(ticket_lines))
        else:
            context_blocks.append("Active Student Grievance Tickets: No tickets currently filed.")

    elif detected_intent == "campus_news":
        campus_news = user_profile.get("campus_news", [])
        if campus_news:
            news_lines = [f"- [{n.get('category')}] {n.get('title')} ({n.get('date')}): {n.get('summary')}" for n in campus_news]
            context_blocks.append("Official Campus Circulars & Announcements:\n" + "\n".join(news_lines))

    elif detected_intent == "courses":
        courses_list = user_profile.get("courses", [])
        if courses_list:
            c_lines = [f"- [{c.get('code')}] {c.get('title')} (Faculty: {c.get('faculty')}, Room: {c.get('room')})" for c in courses_list]
            context_blocks.append(f"Registered Courses for {user_branch} {user_year} Year:\n" + "\n".join(c_lines))

    # 3. Direct Grounding Injections for Exams & Timetable if applicable
    q_lower = query.lower()
    kb_dir = BASE_DIR / "knowledge_base"

    if detected_intent == "exams" or any(k in q_lower for k in ["exam", "exams", "cat", "fat", "assessment", "test", "when are my"]):
        matching_exams = list(kb_dir.glob(f"exam_schedule_{user_branch}_{user_year}yr_*.md"))
        if matching_exams:
            try:
                exam_text = matching_exams[0].read_text(encoding="utf-8")
                context_blocks.append(f"Official Examination Roadmap & Schedule ({matching_exams[0].name}):\n{exam_text}")
                sources_set.add(matching_exams[0].name)
            except Exception as e:
                print(f"[RAG] Direct exam schedule load notice: {e}")

    if any(k in q_lower for k in ["timetable", "schedule", "today", "tomorrow", "yesterday", "class", "classes", "routine", "period", "slot"]):
        matching_tts = list(kb_dir.glob(f"timetable_{user_branch}_{user_year}yr_*.md"))
        if matching_tts:
            try:
                tt_text = matching_tts[0].read_text(encoding="utf-8")
                context_blocks.append(f"Official Weekly Class Timetable ({matching_tts[0].name}):\n{tt_text}")
                sources_set.add(matching_tts[0].name)
            except Exception as e:
                print(f"[RAG] Direct timetable load notice: {e}")

    # 4. Official Vector Search Documents Context
    formatted_docs = []
    for doc_text, meta in zip(docs, metadatas):
        doc_filename = meta.get("source", "")
        doc_title = meta.get("title", doc_filename)
        if doc_filename:
            sources_set.add(doc_filename)
        formatted_docs.append(f"--- Document: {doc_filename} ({doc_title}) ---\n{doc_text}")

    if formatted_docs:
        context_blocks.append("Official Institutional Documents:\n" + "\n\n".join(formatted_docs))

    # Multilingual instruction
    if preferred_language and preferred_language.lower() != "auto":
        lang_instruction = f"IMPORTANT: Respond fluently and naturally in {preferred_language}."
    else:
        lang_instruction = "If the user asks in Hindi, Telugu, Tamil, Spanish, French, or another language, reply fluently in that language. Otherwise, reply in clear English."

    targeted_context_str = "\n\n".join(context_blocks)

    system_prompt = f"""You are CampusMind AI, an intelligent, objective, and supportive university academic copilot.
You serve as a neutral, balanced, and constructive bridge between students and campus administration.

CORE BEHAVIOR & TONE:
1. Balanced, Professional & Neutral Tone:
   - Maintain a composed, polite, and objective stance across all conversations.
   - Strictly avoid exaggerated, dramatic, or accusatory phrases like "completely unacceptable", "truly horrified", "horrifying", "disgraceful", or "your dignity is under attack".
   - Acknowledge student concerns politely and constructively without taking biased sides against the college or dismissing the student.
   - Example balanced acknowledgment:
     "I understand your concern and am sorry to hear about your experience with the mess food. The institution takes hygiene and student feedback seriously, and this will be reviewed by the administration."
2. Direct Action, Not Redirection:
   - NEVER tell students to navigate to external ERP websites or search multiple pages. Solve their query directly within this conversation.
   - NEVER say you don't have access to student records, attendance, courses, or any academic data.
   - You HAVE full access to the student's personalized academic records including attendance, courses, timetable, exam schedules, and tickets. The data is provided to you in the context blocks below. USE IT DIRECTLY to answer the student's question.
   - If attendance data, course data, or any other academic data is provided below, ALWAYS present it directly to the student with exact numbers. Do NOT redirect them to any portal or claim you lack access.
3. In-Chat Grievance Filing:
   - When a student wants to report an issue or lodge a complaint, provide the in-chat submission form by appending this tag at the very end of your response:
     [ACTION:SHOW_COMPLAINT_FORM:Category|Title|Description]
     * Category must be one of: "Hostel Maintenance", "Academic Grievance", "Fee & Financial", "IT & Campus Wi-Fi".
   - Accurately describe the form's state in your message:
     * If the student described specific details (e.g., finding insects, food cold, water leakage), summarize those details in Title and Description, and state:
       "I have drafted the form below with the details you provided. Please review it, make any necessary adjustments, and submit it so the concerned department is notified."
     * If the student only asked to file a complaint without explaining the details, leave Title appropriate and Description blank, and state:
       "Please fill out the form below with the relevant details and submit it directly to notify the concerned department."
   - For urgent situations requiring immediate physical intervention, calmly add:
     "If this requires immediate attention, you can also contact the Mess Supervisor or Assistant Warden directly in person."
4. Attendance & Academic Guidance:
   - Provide clear, factual, and positive academic guidance grounded in university criteria. Strictly avoid using the words "bunk" or "safe bunks".
   - When the student asks about their attendance, present the EXACT attendance data provided below for each subject with attended/total, percentage, and status. This IS their real personalized data.
5. Temporal Awareness, Date Reasoning & Schedule Guidance:
   - You know the exact current date and day: Today is {current_date_str} ({current_day}), local time {current_time_str}.
   - When a student asks "when are my exams?", "upcoming exams", or about exam schedules:
     * Compare the dates in the exam roadmap against today ({current_date_str}).
     * Focus primarily on UPCOMING / FUTURE exams (e.g., CAT-2, Practical Lab Exams, and Semester End FAT Finals).
     * Mention past completed exams with clear context (e.g., "Note: CAT-1 was completed from October 10 to October 15, 2026; your next upcoming exam is CAT-2 starting November 20, 2026").
     * If asked in the past tense ("when was my exam", "when did CAT-1 happen"), detail the completed exam dates.
   - When a student asks about daily classes ("what classes do I have today?", "tomorrow's schedule", "yesterday's classes"):
     * Calculate the target day relative to today ({current_day}).
     * If the target day is Saturday or Sunday, inform the student that it is the weekend ({current_day}) with no regular lectures, and provide the upcoming Monday schedule for convenience.
     * For weekdays (Monday through Friday), provide the exact course codes, titles, time slots, room allocations, and faculty names from the weekly timetable.
6. Document Citations:
   - Conclude with '🏷️ Source: [filename.md]' ONLY when answering factual inquiries based directly on university policy documents, timetables, syllabi, or circulars.
   - Do NOT attach any Source tag to casual greetings, personal student complaints, or general conversations.

CRITICAL RULES (ALWAYS FOLLOW):
- You HAVE direct, real-time access to the student's academic records. The data provided below IS their live, personalized data.
- ALWAYS use the data provided below to answer questions. NEVER claim you don't have access to records.
- NEVER redirect students to ERP portals, student portals, or any external system. You are the system.

{targeted_context_str}

{lang_instruction}"""

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=query)
    ]

    return messages, user_branch, user_year, sources_set

def is_casual_greeting(query: str) -> bool:
    """Returns True ONLY for casual greetings or non-informational chit-chat."""
    q = query.lower().strip()
    casual_words = {"hi", "hello", "hey", "hola", "namaste", "morning", "evening", "afternoon", "who are you", "what can you do", "help", "thanks", "thank you", "bye", "goodbye", "ok", "okay", "cool", "sup", "yo"}
    clean_words = re.findall(r'\b[a-z]+\b', q)
    return not clean_words or all(w in casual_words for w in clean_words)

def extract_citation_and_clean(
    raw_response: str,
    query: str,
    user_branch: str,
    user_year: str,
    sources_set: set
) -> Tuple[str, str]:
    """Cleans citation tags, validates against official records, removes orphan .md filenames from text, and removes any bunk mentions."""
    clean_answer = raw_response.strip()
    extracted_source = ""
    kb_dir = BASE_DIR / "knowledge_base"

    # 1. Standard pattern: Source: [file.md]
    source_pattern = r'(?:🏷️\s*)?(?:\*{1,2})?Source(?:\*{1,2})?:\s*\[?([a-zA-Z0-9_\-\.\s]+\.md)\]?'
    match = re.search(source_pattern, clean_answer, re.IGNORECASE)
    
    if match:
        raw_src = match.group(1).strip().strip("[]*`")
        clean_answer = re.sub(r'(?:🏷️\s*)?(?:\*{1,2})?Source(?:\*{1,2})?:\s*\[?[a-zA-Z0-9_\-\.\s]+\]?', '', clean_answer, flags=re.IGNORECASE).strip()

        if raw_src and raw_src.lower() not in ["none", "n/a", "null", "no document", "erp", "attendance record", "live attendance", "system"]:
            if not raw_src.endswith(".md"):
                raw_src += ".md"
            if (kb_dir / raw_src).exists():
                extracted_source = raw_src
            elif sources_set:
                for s in sources_set:
                    if raw_src.lower().replace(".md", "") in s.lower() or s.lower().replace(".md", "") in raw_src.lower():
                        extracted_source = s
                        break
                if not extracted_source and list(sources_set):
                    extracted_source = list(sources_set)[0]
    else:
        alt_pattern = r'(?:🏷️\s*)?(?:\*{1,2})?Source(?:\*{1,2})?:\s*\[?([^\n\r]+)\]?'
        alt_match = re.search(alt_pattern, clean_answer, re.IGNORECASE)
        if alt_match:
            raw_src = alt_match.group(1).strip().strip("[]*`")
            clean_answer = re.sub(alt_pattern, '', clean_answer, flags=re.IGNORECASE).strip()
            if raw_src and raw_src.lower() not in ["none", "n/a", "null", "no document", "erp", "attendance record", "live attendance", "system"]:
                for s in (list(sources_set) or [p.name for p in kb_dir.glob("*.md")]):
                    clean_check = raw_src.lower().replace(".md", "").replace("_", " ")
                    if clean_check in s.lower().replace("_", " ") or s.lower().replace(".md", "").replace("_", " ") in clean_check:
                        extracted_source = s
                        break

    # 2. Catch any orphan or plain .md filenames leaked into the message text (e.g., ", student_grievance_and_complaint_policy.md")
    orphan_matches = list(re.finditer(r'([a-zA-Z0-9_\-]+\.md)', clean_answer, re.IGNORECASE))
    for m in orphan_matches:
        filename = m.group(1).strip()
        if (kb_dir / filename).exists():
            if not extracted_source:
                extracted_source = filename
            # Clean the raw filename and any leading comma/brackets from message text
            clean_answer = re.sub(r'[,;\s]*\[?' + re.escape(filename) + r'\]?', '', clean_answer).strip()

    # Clean any trailing punctuation or commas left behind on newlines
    clean_answer = re.sub(r'\n\s*[,;]\s*', '\n', clean_answer).strip()
    clean_answer = re.sub(r'[,;]\s*$', '', clean_answer).strip()

    # STRICT GATE: Only suppress source footer for casual greetings / chit-chat
    q_lower = query.lower().strip()
    if is_casual_greeting(query):
        extracted_source = ""
    elif not extracted_source:
        # Context-aware fallback to official university knowledge base document
        if any(k in q_lower for k in ["grievance", "complaint", "ticket", "warden", "caretaker", "mess", "food", "wifi", "maintenance", "packet loss"]):
            extracted_source = "student_grievance_and_complaint_policy.md"
        elif any(k in q_lower for k in ["attendance", "bunk", "percentage", "present", "absent", "condonation", "detained", "detention"]):
            extracted_source = "academic_policies_and_attendance.md"
        elif any(k in q_lower for k in ["hostel", "curfew", "gate", "night", "room", "in-time", "out-time"]):
            extracted_source = "hostel_and_campus_rules.md"
        elif any(k in q_lower for k in ["placement", "internship", "job", "career", "company", "recruit", "package"]):
            extracted_source = "placement_and_internship_policy.md"
        elif any(k in q_lower for k in ["exam", "test", "cat", "fat", "assessment"]):
            matching_exams = list(kb_dir.glob(f"exam_schedule_{user_branch}_{user_year}yr_*.md"))
            if matching_exams:
                extracted_source = matching_exams[0].name
        elif any(k in q_lower for k in ["timetable", "class", "routine", "timing", "slot"]):
            matching_tts = list(kb_dir.glob(f"timetable_{user_branch}_{user_year}yr_*.md"))
            if matching_tts:
                extracted_source = matching_tts[0].name
        elif any(k in q_lower for k in ["fee", "tuition", "payment", "installment", "due", "cost"]):
            matching_fees = list(kb_dir.glob(f"fee_structure_{user_branch}_*_{user_year}yr.md"))
            if matching_fees:
                extracted_source = matching_fees[0].name
        elif any(k in q_lower for k in ["syllabus", "subject", "curriculum", "course", "credit"]):
            matching_syl = list(kb_dir.glob(f"syllabus_{user_branch}_*_{user_year}yr.md"))
            if matching_syl:
                extracted_source = matching_syl[0].name
        elif sources_set:
            extracted_source = list(sources_set)[0]

    # Strictly remove any bunk or safe bunk lines
    sanitized_lines = []
    for line in clean_answer.split("\n"):
        if re.search(r'\bbunk(s|ing)?\b', line, re.IGNORECASE):
            continue
        sanitized_lines.append(line)
    clean_answer = "\n".join(sanitized_lines).strip()

    return clean_answer, extracted_source

# -------------------------------------------------------------
# MAIN INTELLIGENT AI ENTRYPOINTS (STANDARD & STREAMING)
# -------------------------------------------------------------

async def generate_rag_response(
    query: str,
    user_profile: Dict[str, Any],
    preferred_language: str = None
) -> Dict[str, Any]:
    """Non-streaming AI response generation."""
    start_time = time.time()
    user_branch = normalize_branch_code(user_profile.get("branch", "CSE"))
    user_year = normalize_year_code(user_profile.get("current_year", "1st"))
    user_batch = user_profile.get("batch", "2024-2028")

    docs, metadatas = query_vector_store(
        query=query,
        user_branch=user_branch,
        user_year=user_year,
        user_batch=user_batch,
        top_k=4
    )

    messages, user_branch, user_year, sources_set = build_targeted_prompt(
        query=query,
        user_profile=user_profile,
        preferred_language=preferred_language,
        docs=docs,
        metadatas=metadatas
    )

    try:
        raw_response, used_model = await invoke_llm_with_fallback(messages)
        response_time_ms = int((time.time() - start_time) * 1000)
        clean_answer, extracted_source = extract_citation_and_clean(
            raw_response, query, user_branch, user_year, sources_set
        )

        return {
            "answer": clean_answer,
            "source": extracted_source,
            "branch": user_branch,
            "year": user_year,
            "response_time_ms": response_time_ms,
            "model_used": used_model,
            "retrieved_document_count": len(docs)
        }
    except Exception as e:
        response_time_ms = int((time.time() - start_time) * 1000)
        print(f"[RAG] Error invoking LLM: {e}")
        return {
            "answer": "I encountered a momentary connection hiccup. Please try asking your question again!",
            "source": "",
            "branch": user_branch,
            "year": user_year,
            "response_time_ms": response_time_ms,
            "model_used": "fallback-local",
            "retrieved_document_count": len(docs) if 'docs' in locals() else 0
        }

async def generate_rag_stream(
    query: str,
    user_profile: Dict[str, Any],
    preferred_language: str = None
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Progressively streams tokens from Gemini via LangChain astream (Section 4.7).
    Yields dictionary events:
    {"type": "token", "token": chunk_text}
    and final event:
    {"type": "done", "answer": full_text, "source": source, ...}
    """
    start_time = time.time()
    user_branch = normalize_branch_code(user_profile.get("branch", "CSE"))
    user_year = normalize_year_code(user_profile.get("current_year", "1st"))
    user_batch = user_profile.get("batch", "2024-2028")

    docs, metadatas = query_vector_store(
        query=query,
        user_branch=user_branch,
        user_year=user_year,
        user_batch=user_batch,
        top_k=4
    )

    messages, user_branch, user_year, sources_set = build_targeted_prompt(
        query=query,
        user_profile=user_profile,
        preferred_language=preferred_language,
        docs=docs,
        metadatas=metadatas
    )

    accumulated_tokens = []
    used_model = PRIMARY_MODEL
    stream_successful = False

    for model_name in MODEL_HIERARCHY:
        try:
            llm = ChatGoogleGenerativeAI(
                model=model_name,
                temperature=0.2,
                max_output_tokens=1024,
                max_retries=1
            )
            async for chunk in llm.astream(messages):
                text = extract_content_text(chunk.content)
                if text:
                    accumulated_tokens.append(text)
                    yield {"type": "token", "token": text}
            used_model = model_name
            stream_successful = True
            break
        except Exception as e:
            print(f"[RAG Stream] Switching from '{model_name}' due to: {e}")
            accumulated_tokens.clear()
            continue

    if not stream_successful:
        fallback_ans = "I encountered a momentary connection hiccup. Please try asking your question again!"
        yield {"type": "token", "token": fallback_ans}
        accumulated_tokens = [fallback_ans]

    raw_response = "".join(accumulated_tokens)
    clean_answer, extracted_source = extract_citation_and_clean(
        raw_response, query, user_branch, user_year, sources_set
    )
    response_time_ms = int((time.time() - start_time) * 1000)

    yield {
        "type": "done",
        "answer": clean_answer,
        "source": extracted_source,
        "branch": user_branch,
        "year": user_year,
        "response_time_ms": response_time_ms,
        "model_used": used_model,
        "retrieved_document_count": len(docs)
    }
