"""
CampusMind AI - FastAPI Backend Application
Hyper-personalized, Multilingual AI Assistant for College Students.
Includes JWT Authentication, Profile Management, SQLite Database, and Smart RAG Engine.
"""

import os
import sys
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any
from dotenv import load_dotenv

# Ensure proper encoding
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# 1. Load environment variables
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")
os.environ.pop("GEMINI_API_KEY", None)

# Demo evaluation mode configuration
DEMO_MODE: bool = os.getenv("DEMO_MODE", "false").strip().lower() in ("true", "1", "yes")
DEMO_ACCOUNTS = {
    "arjun.sharma@campus.edu",
    "priya.patel@campus.edu",
    "rahul.verma@campus.edu",
}
DEMO_ACCOUNT_DEFAULTS = {
    "arjun.sharma@campus.edu": {
        "current_year": "2nd",
        "batch": "2024-2028",
        "branch": "CSE",
        "student_id": "24CSE101"
    },
    "priya.patel@campus.edu": {
        "current_year": "3rd",
        "batch": "2023-2027",
        "branch": "ECE",
        "student_id": "23ECE044"
    },
    "rahul.verma@campus.edu": {
        "current_year": "4th",
        "batch": "2022-2026",
        "branch": "MECH",
        "student_id": "22MECH012"
    }
}

from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from fastapi.responses import HTMLResponse, StreamingResponse

# Local application imports
from backend.database import engine, Base, get_db, run_migrations
from backend.models import User, ChatMessage, Ticket, ChatSession
from backend.schemas import (
    UserRegisterRequest,
    UserLoginRequest,
    TokenResponse,
    UserProfileResponse,
    ChatRequest,
    ChatResponse,
    ChatMessageItem,
    ChatSessionResponse,
    ChatSessionCreateRequest,
    FirebaseStatusResponse,
    TicketCreateRequest,
    TicketResponse
)
from backend.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user
)
from backend.rag_engine import (
    generate_rag_response,
    generate_rag_stream,
    warm_up_chromadb,
    normalize_branch_code,
    normalize_year_code
)
from backend.context_cache import (
    get_cached_student_context,
    invalidate_user_tickets_cache,
    warm_student_context_cache
)
from backend.seed_users import seed_demo_accounts
from backend.student_context import (
    get_student_attendance_summary,
    get_student_tickets_summary,
    get_campus_news_summary,
    build_or_load_student_persona,
    get_student_courses,
    get_student_timetable_data
)
from backend.firebase_service import (
    init_firebase,
    is_firebase_configured,
    get_firebase_status,
    save_user_to_firebase,
    save_persona_to_firebase,
    save_ticket_to_firebase,
    save_chat_session_to_firebase,
    save_chat_message_to_firebase,
    get_chat_sessions_from_firebase,
    get_session_messages_from_firebase,
    delete_chat_session_from_firebase,
    get_user_by_email_from_firebase,
    track_user_login,
    track_user_activity,
    classify_intent
)

def sync_chat_interaction_to_firebase(
    session_dict: Dict[str, Any],
    user_msg_dict: Dict[str, Any],
    ai_msg_dict: Dict[str, Any],
    user_id: int
):
    """Synchronizes chat conversation and logs user activity to Firebase in the background."""
    try:
        save_chat_session_to_firebase(session_dict)
        save_chat_message_to_firebase(session_dict["id"], user_msg_dict)
        save_chat_message_to_firebase(session_dict["id"], ai_msg_dict)
        track_user_activity(user_id)
    except Exception as e:
        print(f"[Firebase Background Sync] Notice: {e}")

def build_persona_in_background(user_dict: Dict[str, Any]):
    """Safely builds or loads persona in a fresh background DB session."""
    try:
        from backend.database import SessionLocal
        bg_db = SessionLocal()
        try:
            build_or_load_student_persona(user_dict, bg_db)
        finally:
            bg_db.close()
    except Exception as e:
        print(f"[Auth] Background persona build notice: {e}")

# 2. Initialize Database tables & auto-seed demo accounts
Base.metadata.create_all(bind=engine)
try:
    run_migrations()
    if DEMO_MODE:
        seed_demo_accounts()
    else:
        print("[Database] DEMO_MODE is false: skipping demo account auto-seeding.")
except Exception as e:
    print(f"[Database] Startup seed/migration notice: {e}")

# Attempt Firebase connection on startup
init_firebase()

# 2.5 Verify ChromaDB knowledge base on startup (chroma_db is committed to git, always present)
try:
    from backend.rag_engine import get_chroma_collection
    collection = get_chroma_collection()
    count = collection.count()
    if count > 0:
        print(f"[Startup] Chroma knowledge base ready: {count} indexed chunks.")
        warm_up_chromadb()
    else:
        print("[Startup] WARNING: Chroma collection is empty. RAG will use keyword-based source fallback.")
except Exception as e:
    print(f"[Startup] Chroma verification notice: {e}")

# 3. Create FastAPI application
app = FastAPI(
    title="CampusMind AI API",
    description="Hyper-personalized, multilingual AI assistant for college students",
    version="2.0.0"
)

# 4. Configure CORS for frontend access (supports local dev, Vercel deployments, Render previews)
default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
]
custom_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=default_origins + custom_origins,
    allow_origin_regex=r"^https?://.*$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------
# AUTHENTICATION & PERSONA ENDPOINTS
# -------------------------------------------------------------

@app.post("/api/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_user(
    req: UserRegisterRequest,
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = None
):
    """Registers a new student, creates structured persona (courses & attendance), and syncs with Firebase."""
    clean_email = req.email.lower().strip()
    clean_sid = req.student_id.upper().strip()

    # Check if email is already registered
    existing_email = db.query(User).filter(User.email == clean_email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists. Please sign in instead."
        )

    # Check if student ID / Roll Number is already registered
    existing_sid = db.query(User).filter(User.student_id == clean_sid).first()
    if existing_sid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this Student ID / Roll Number already exists."
        )

    hashed_pw = get_password_hash(req.password.strip())
    clean_branch = normalize_branch_code(req.branch)
    clean_year = normalize_year_code(req.current_year)
    user = User(
        full_name=req.full_name.strip(),
        email=clean_email,
        hashed_password=hashed_pw,
        student_id=clean_sid,
        branch=clean_branch,
        current_year=clean_year,
        batch=req.batch.strip(),
        hostel_status=req.hostel_status.strip(),
        phone_number=req.phone_number.strip() if req.phone_number else None
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Build and persist structured student persona to Firebase Firestore in background
    try:
        user_dict = {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "student_id": user.student_id,
            "branch": user.branch,
            "current_year": user.current_year,
            "batch": user.batch,
            "hostel_status": user.hostel_status,
            "phone_number": user.phone_number
        }
        if background_tasks:
            background_tasks.add_task(save_user_to_firebase, user_dict)
            background_tasks.add_task(build_persona_in_background, user_dict)
            background_tasks.add_task(track_user_login, user.id, user.email)
    except Exception as e:
        print(f"[Auth] Firebase persona sync notice: {e}")

    access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserProfileResponse.model_validate(user)
    )

@app.post("/api/auth/login", response_model=TokenResponse)
def login_user(
    req: UserLoginRequest,
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = None
):
    """Authenticates student credentials, loads persona memory, and returns JWT."""
    clean_email = req.email.lower().strip()
    clean_password = req.password.strip()

    # Auto-seed demo accounts if missing in DEMO_MODE
    if DEMO_MODE and clean_email in DEMO_ACCOUNTS:
        existing_demo = db.query(User).filter(User.email == clean_email).first()
        if not existing_demo:
            try:
                seed_demo_accounts()
            except Exception as se:
                print(f"[Auth] Demo account auto-seed notice: {se}")

    user = db.query(User).filter(User.email == clean_email).first()

    # If user not found in SQLite, check Firestore for multi-client / persistence sync
    if not user:
        try:
            fb_user = get_user_by_email_from_firebase(clean_email)
            if fb_user:
                user = User(
                    full_name=fb_user.get("full_name", "Student"),
                    email=clean_email,
                    hashed_password=get_password_hash(clean_password),
                    student_id=fb_user.get("student_id", "STU" + str(uuid.uuid4().hex[:6])),
                    branch=fb_user.get("branch", "CSE"),
                    current_year=fb_user.get("current_year", "1st"),
                    batch=fb_user.get("batch", "2024-2028"),
                    hostel_status=fb_user.get("hostel_status", "Day Scholar"),
                    phone_number=fb_user.get("phone_number")
                )
                db.add(user)
                db.commit()
                db.refresh(user)
        except Exception as e:
            print(f"[Auth] Firestore user restore notice: {e}")

    # Check password: bcrypt verification for all regular users; demo bypass controlled strictly by DEMO_MODE
    is_valid = False
    if user:
        if DEMO_MODE and clean_email in DEMO_ACCOUNTS:
            # Demo evaluator 1-click accounts bypass password only when DEMO_MODE=true
            is_valid = True
        elif verify_password(clean_password, user.hashed_password):
            is_valid = True

    if not user or not is_valid:
        error_detail = "Incorrect email or password."
        if DEMO_MODE:
            error_detail += " For demo accounts use password 'Campus@123'."
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_detail
        )

    # Auto-align demo account academic profiles to 2026 academic calendar
    if DEMO_MODE and clean_email in DEMO_ACCOUNT_DEFAULTS:
        d = DEMO_ACCOUNT_DEFAULTS[clean_email]
        if user.current_year != d["current_year"] or user.batch != d["batch"]:
            user.current_year = d["current_year"]
            user.batch = d["batch"]
            user.branch = d["branch"]
            user.student_id = d["student_id"]
            db.commit()
            db.refresh(user)

    # Offload Firebase sync and caching to background tasks so response is instantaneous
    try:
        user_dict = {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "student_id": user.student_id,
            "branch": user.branch,
            "current_year": user.current_year,
            "batch": user.batch,
            "hostel_status": user.hostel_status,
            "phone_number": user.phone_number
        }
        if background_tasks:
            background_tasks.add_task(save_user_to_firebase, user_dict)
            background_tasks.add_task(warm_student_context_cache, user_dict)
            background_tasks.add_task(track_user_login, user.id, user.email)
    except Exception as e:
        print(f"[Auth] Firebase login persona notice: {e}")

    access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserProfileResponse.model_validate(user)
    )

@app.get("/api/user/profile", response_model=UserProfileResponse)
def get_user_profile(current_user: User = Depends(get_current_user)):
    """Fetches full profile context of the logged-in student."""
    return UserProfileResponse.model_validate(current_user)

@app.get("/api/firebase/status", response_model=FirebaseStatusResponse)
def check_firebase_status():
    """Returns the current Firebase connection & Firestore status."""
    return get_firebase_status()

# -------------------------------------------------------------
# CHAT SESSIONS & RAG ENDPOINTS
# -------------------------------------------------------------

def get_or_create_chat_session(user_id: int, session_id: Optional[str], initial_title: str, db: Session) -> ChatSession:
    """Helper to retrieve existing session or generate a new unique session."""
    if session_id:
        existing = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == user_id).first()
        if existing:
            return existing

    # Create new session with smart title extraction
    new_id = f"sess_{uuid.uuid4().hex[:12]}"
    raw_prompt = " ".join((initial_title or "New Chat").strip().split())
    clean_p = raw_prompt
    for prefix in ["can you tell me about ", "tell me about ", "what is ", "what are ", "how to ", "how can i ", "can you please ", "please "]:
        if clean_p.lower().startswith(prefix) and len(clean_p) > len(prefix):
            clean_p = clean_p[len(prefix):]
            break
    clean_title = (clean_p[:36] + "...") if len(clean_p) > 36 else (clean_p or "New Chat")
    clean_title = clean_title[0].upper() + clean_title[1:] if len(clean_title) > 0 else "New Chat"

    new_sess = ChatSession(
        id=new_id,
        user_id=user_id,
        title=clean_title
    )
    db.add(new_sess)
    db.commit()
    db.refresh(new_sess)

    # Sync session to Firebase Firestore
    save_chat_session_to_firebase({
        "id": new_id,
        "user_id": user_id,
        "title": clean_title,
        "created_at": new_sess.created_at.isoformat(),
        "updated_at": new_sess.updated_at.isoformat()
    })
    return new_sess

@app.get("/api/chat/sessions", response_model=List[ChatSessionResponse])
def get_chat_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves all chat sessions for the logged in student (for navbar history dropdown)."""
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
        .all()
    )
    results = []
    for s in sessions:
        last_msg = (
            db.query(ChatMessage)
            .filter(ChatMessage.session_id == s.id)
            .order_by(ChatMessage.created_at.desc())
            .first()
        )
        msg_count = db.query(ChatMessage).filter(ChatMessage.session_id == s.id).count()
        results.append(ChatSessionResponse(
            id=s.id,
            user_id=s.user_id,
            title=s.title,
            created_at=s.created_at,
            updated_at=s.updated_at,
            last_message=last_msg.content[:60] if last_msg else None,
            message_count=msg_count
        ))
    return results

@app.post("/api/chat/sessions", response_model=ChatSessionResponse)
def create_new_chat_session(
    req: ChatSessionCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Explicitly initializes a new blank chat session."""
    session = get_or_create_chat_session(current_user.id, None, req.title or "New Chat", db)
    return ChatSessionResponse(
        id=session.id,
        user_id=session.user_id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        last_message=None,
        message_count=0
    )

@app.get("/api/chat/sessions/{session_id}/messages", response_model=List[ChatMessageItem])
def get_session_messages(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves all conversation messages for a specific session."""
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == current_user.id, ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    items = []
    for m in messages:
        item = ChatMessageItem.model_validate(m)
        if item.role == "assistant" and (not item.source or not item.source.strip()):
            item.source = None
        items.append(item)
    return items

@app.delete("/api/chat/sessions/{session_id}")
def delete_chat_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Deletes a specific chat session and its associated messages."""
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if session:
        # Explicitly delete any messages under this session
        db.query(ChatMessage).filter(ChatMessage.session_id == session_id).delete()
        db.delete(session)
        db.commit()
    
    try:
        delete_chat_session_from_firebase(session_id)
    except Exception as e:
        print(f"[Chat] Firebase session delete notice: {e}")

    return {"message": "Chat session deleted successfully."}

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(
    req: ChatRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Core RAG Endpoint:
    Preferred flow:
    1. Save locally (SQLite)
    2. Generate AI response (Smart RAG Engine)
    3. Save answer locally (SQLite)
    4. Return answer immediately
    5. Synchronize Firebase in background (chat session, messages, analytics, user activity)
    """
    session = get_or_create_chat_session(current_user.id, req.session_id, req.message, db)

    # Automatically rename session if it's currently generic ("New Chat", "New Copilot Chat", etc.)
    generic_titles = ["new chat", "new copilot chat", "new conversation", "copilot chat"]
    current_title_lower = (session.title or "").strip().lower()
    if current_title_lower in generic_titles or current_title_lower.startswith("new "):
        clean_prompt = " ".join(req.message.strip().split())
        lower_prompt = clean_prompt.lower()
        for prefix in ["can you tell me about ", "tell me about ", "what is ", "what are ", "how to ", "how can i ", "can you please ", "please "]:
            if lower_prompt.startswith(prefix) and len(clean_prompt) > len(prefix):
                clean_prompt = clean_prompt[len(prefix):]
                break

        new_title = clean_prompt[:36].strip()
        if len(clean_prompt) > 36:
            new_title += "..."
        new_title = new_title[0].upper() + new_title[1:] if len(new_title) > 0 else "New Chat"

        session.title = new_title
        db.add(session)
        db.commit()
        db.refresh(session)

    # 1. Save student's user message locally
    user_msg = ChatMessage(
        session_id=session.id,
        user_id=current_user.id,
        role="user",
        content=req.message
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    # 2. Retrieve student context from high-speed multi-tiered cache (Section 4.2)
    profile_dict = get_cached_student_context(current_user, db)

    # 3. Generate response using Smart RAG Engine (with targeted prompt reduction, Section 4.3)
    rag_result = await generate_rag_response(
        query=req.message,
        user_profile=profile_dict,
        preferred_language=req.preferred_language
    )

    # 4. Save AI assistant message locally
    ai_msg = ChatMessage(
        session_id=session.id,
        user_id=current_user.id,
        role="assistant",
        content=rag_result["answer"],
        source=rag_result["source"]
    )
    session.updated_at = datetime.utcnow()
    db.add(ai_msg)
    db.commit()
    db.refresh(ai_msg)

    # 5. Classify intent and prepare analytics payloads for Firebase background sync
    detected_intent = classify_intent(req.message)

    user_msg_sync = {
        "id": user_msg.id,
        "user_id": current_user.id,
        "session_id": session.id,
        "role": "user",
        "content": req.message,
        "source": None,
        "branch": current_user.branch,
        "current_year": current_user.current_year,
        "batch": current_user.batch,
        "intent": detected_intent,
        "created_at": user_msg.created_at.isoformat()
    }

    ai_msg_sync = {
        "id": ai_msg.id,
        "user_id": current_user.id,
        "session_id": session.id,
        "role": "assistant",
        "content": rag_result["answer"],
        "source": rag_result["source"],
        "branch": current_user.branch,
        "current_year": current_user.current_year,
        "batch": current_user.batch,
        "response_time_ms": rag_result.get("response_time_ms", 0),
        "model_used": rag_result.get("model_used", "gemini-2.5-flash"),
        "retrieved_document_count": rag_result.get("retrieved_document_count", 0),
        "created_at": ai_msg.created_at.isoformat()
    }

    session_sync = {
        "id": session.id,
        "user_id": current_user.id,
        "title": session.title,
        "created_at": session.created_at.isoformat(),
        "updated_at": session.updated_at.isoformat()
    }

    # 6. Synchronize Firebase in background (Zero blocking latency on response)
    background_tasks.add_task(
        sync_chat_interaction_to_firebase,
        session_dict=session_sync,
        user_msg_dict=user_msg_sync,
        ai_msg_dict=ai_msg_sync,
        user_id=current_user.id
    )

    # 7. Return answer immediately
    return ChatResponse(
        answer=rag_result["answer"],
        source=rag_result["source"],
        branch=current_user.branch,
        year=current_user.current_year,
        session_id=session.id,
        session_title=session.title
    )

@app.post("/api/chat/stream")
async def chat_stream_endpoint(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Streaming RAG Endpoint (Section 4.7):
    Streams generated tokens progressively using Server-Sent Events (SSE).
    Substantially improves perceived latency for the student.
    Persists conversation locally in SQLite and synchronizes Firebase in background.
    """
    session = get_or_create_chat_session(current_user.id, req.session_id, req.message, db)

    # Auto-rename generic session title
    generic_titles = ["new chat", "new copilot chat", "new conversation", "copilot chat"]
    current_title_lower = (session.title or "").strip().lower()
    if current_title_lower in generic_titles or current_title_lower.startswith("new "):
        clean_prompt = " ".join(req.message.strip().split())
        lower_prompt = clean_prompt.lower()
        for prefix in ["can you tell me about ", "tell me about ", "what is ", "what are ", "how to ", "how can i ", "can you please ", "please "]:
            if lower_prompt.startswith(prefix) and len(clean_prompt) > len(prefix):
                clean_prompt = clean_prompt[len(prefix):]
                break
        new_title = clean_prompt[:36].strip()
        if len(clean_prompt) > 36:
            new_title += "..."
        new_title = new_title[0].upper() + new_title[1:] if len(new_title) > 0 else "New Chat"
        session.title = new_title
        db.add(session)
        db.commit()
        db.refresh(session)

    # 1. Save student's user message locally in SQLite
    user_msg = ChatMessage(
        session_id=session.id,
        user_id=current_user.id,
        role="user",
        content=req.message
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    # 2. Retrieve student context from high-speed cache
    profile_dict = get_cached_student_context(current_user, db)

    async def event_generator():
        final_data = None
        try:
            async for event in generate_rag_stream(
                query=req.message,
                user_profile=profile_dict,
                preferred_language=req.preferred_language
            ):
                if event["type"] == "token":
                    yield f"data: {json.dumps(event)}\n\n"
                elif event["type"] == "done":
                    final_data = event
                    event["session_id"] = session.id
                    event["session_title"] = session.title
                    yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            err_event = {
                "type": "error",
                "detail": str(e)
            }
            yield f"data: {json.dumps(err_event)}\n\n"

        # After stream completes: Save AI assistant message locally
        if final_data:
            try:
                ai_msg = ChatMessage(
                    session_id=session.id,
                    user_id=current_user.id,
                    role="assistant",
                    content=final_data["answer"],
                    source=final_data["source"]
                )
                session.updated_at = datetime.utcnow()
                db.add(ai_msg)
                db.commit()
                db.refresh(ai_msg)

                # Background Firebase sync (zero latency impact)
                detected_intent = classify_intent(req.message)
                user_msg_sync = {
                    "id": user_msg.id,
                    "user_id": current_user.id,
                    "session_id": session.id,
                    "role": "user",
                    "content": req.message,
                    "source": None,
                    "branch": current_user.branch,
                    "current_year": current_user.current_year,
                    "batch": current_user.batch,
                    "intent": detected_intent,
                    "created_at": user_msg.created_at.isoformat()
                }
                ai_msg_sync = {
                    "id": ai_msg.id,
                    "user_id": current_user.id,
                    "session_id": session.id,
                    "role": "assistant",
                    "content": final_data["answer"],
                    "source": final_data["source"],
                    "branch": current_user.branch,
                    "current_year": current_user.current_year,
                    "batch": current_user.batch,
                    "response_time_ms": final_data.get("response_time_ms", 0),
                    "model_used": final_data.get("model_used", "gemini-2.5-flash"),
                    "retrieved_document_count": final_data.get("retrieved_document_count", 0),
                    "created_at": ai_msg.created_at.isoformat()
                }
                session_sync = {
                    "id": session.id,
                    "user_id": current_user.id,
                    "title": session.title,
                    "created_at": session.created_at.isoformat(),
                    "updated_at": session.updated_at.isoformat()
                }
                sync_chat_interaction_to_firebase(session_sync, user_msg_sync, ai_msg_sync, current_user.id)
            except Exception as se:
                print(f"[Chat Stream Sync] Error saving completion: {se}")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@app.get("/api/chat/history", response_model=List[ChatMessageItem])
def get_chat_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves recent chat messages across active sessions for current student."""
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == current_user.id)
        .order_by(ChatMessage.created_at.asc())
        .limit(50)
        .all()
    )
    items = []
    for m in messages:
        item = ChatMessageItem.model_validate(m)
        if item.role == "assistant" and (not item.source or not item.source.strip()):
            item.source = "academic_policies_and_attendance.md"
        items.append(item)
    return items

@app.delete("/api/chat/history")
def clear_chat_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Clears conversation history for 'New Chat' functionality."""
    db.query(ChatMessage).filter(ChatMessage.user_id == current_user.id).delete()
    db.query(ChatSession).filter(ChatSession.user_id == current_user.id).delete()
    db.commit()
    return {"message": "Chat history cleared successfully."}

@app.get("/api/student/attendance")
def get_student_attendance(current_user: User = Depends(get_current_user)):
    """Returns dynamic subject attendance, percentages, and eligibility status for logged in student."""
    return get_student_attendance_summary(
        branch=current_user.branch,
        current_year=current_user.current_year,
        student_id=current_user.student_id
    )

@app.get("/api/student/courses")
def get_student_course_catalog(current_user: User = Depends(get_current_user)):
    """Returns official course catalog for the student's branch and year."""
    return get_student_courses(current_user.branch, current_user.current_year)

@app.get("/api/student/news")
def get_student_news():
    """Returns active verified university announcements and circulars."""
    return get_campus_news_summary()

@app.get("/api/student/timetable")
def get_student_timetable(current_user: User = Depends(get_current_user)):
    """Returns structured weekly timetable schedule for logged in student."""
    return get_student_timetable_data(
        branch=current_user.branch,
        current_year=current_user.current_year,
        user_batch=current_user.batch
    )

# -------------------------------------------------------------
# STUDENT GRIEVANCE & COMPLAINT TICKET ENDPOINTS
# -------------------------------------------------------------

@app.post("/api/tickets/create", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
def create_ticket(
    req: TicketCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = None
):
    """
    Submits an official student grievance / maintenance ticket directly from chat.
    Auto-assigns tracking ID, SLA turnaround, and offline office location.
    Persists to SQLite and Firebase Firestore (background task).
    """
    import random
    import time
    
    ticket_seq = int(time.time()) % 100000 + random.randint(100, 999)
    prefix = "HSTL" if "hostel" in req.category.lower() else ("MESS" if "mess" in req.category.lower() else "ACAD")
    ticket_number = f"#{prefix}-{ticket_seq}"
    
    # Auto-assign SLA & Offline resolution desk based on category
    sla = "24 Hours" if "hostel" in req.category.lower() or "electrical" in req.category.lower() else "48 Hours"
    offline_desk = (
        "Hostel Caretaker Desk (Ground Floor Block B, 9 AM - 6 PM)"
        if "hostel" in req.category.lower()
        else ("Chief Warden Office (Admin Block Room 104)" if "mess" in req.category.lower() else "Dean of Academics Office (Block 1, 2nd Floor)")
    )
    
    resolved_loc = req.location or current_user.hostel_status

    ticket = Ticket(
        ticket_number=ticket_number,
        user_id=current_user.id,
        category=req.category,
        title=req.title,
        description=req.description,
        location=resolved_loc,
        priority=req.priority or "Medium",
        status="Submitted",
        estimated_sla=sla,
        offline_option=offline_desk
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    # Sync ticket to Firebase Firestore in background
    ticket_dict = {
        "id": ticket.id,
        "ticket_number": ticket.ticket_number,
        "user_id": current_user.id,
        "student_id": current_user.student_id,
        "student_name": current_user.full_name,
        "category": ticket.category,
        "title": ticket.title,
        "description": ticket.description,
        "location": ticket.location,
        "priority": ticket.priority,
        "status": ticket.status,
        "estimated_sla": ticket.estimated_sla,
        "offline_option": ticket.offline_option,
        "created_at": ticket.created_at.isoformat()
    }
    # Invalidate user tickets context cache immediately (Section 4.2)
    invalidate_user_tickets_cache(current_user.id)

    if background_tasks:
        background_tasks.add_task(save_ticket_to_firebase, ticket_dict)
    else:
        save_ticket_to_firebase(ticket_dict)

    return ticket

@app.get("/api/tickets/my-tickets", response_model=List[TicketResponse])
def get_my_tickets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves all tickets raised by the current student."""
    return (
        db.query(Ticket)
        .filter(Ticket.user_id == current_user.id)
        .order_by(Ticket.created_at.desc())
        .all()
    )

# -------------------------------------------------------------
# DOCUMENT & CITATION VIEWER ENDPOINT (PDF PRINT / HTML VIEW)
# -------------------------------------------------------------

from fastapi.responses import HTMLResponse

def get_knowledge_base_dir() -> Path:
    for candidate in [
        BASE_DIR.parent / "knowledge_base",
        BASE_DIR / "knowledge_base",
        Path.cwd() / "knowledge_base",
        Path.cwd().parent / "knowledge_base",
    ]:
        if candidate.exists() and candidate.is_dir():
            return candidate
    return BASE_DIR.parent / "knowledge_base"

def resolve_knowledge_base_doc(document_name: str):
    import urllib.parse
    kb_dir = get_knowledge_base_dir()
    
    # 1. Clean document name
    decoded = urllib.parse.unquote(document_name).strip()
    clean_name = decoded.strip("[]*`\"'").replace("\\", "/")
    clean_name = Path(clean_name).name.strip()
    
    target_name = clean_name if clean_name.endswith(".md") else f"{clean_name}.md"
    target_file = kb_dir / target_name
    
    doc_path = None
    if target_file.exists():
        doc_path = target_file
    else:
        # Case-insensitive direct check
        all_mds = list(kb_dir.glob("*.md"))
        target_lower = target_name.lower()
        for md_file in all_mds:
            if md_file.name.lower() == target_lower or md_file.stem.lower() == target_name.removesuffix(".md").lower():
                doc_path = md_file
                break
                
        if not doc_path:
            # Keyword / token matching
            search_terms = target_name.removesuffix(".md").replace("_", " ").replace("-", " ").lower().split()
            best_match = None
            highest_score = 0
            for md_file in all_mds:
                fname_lower = md_file.stem.lower()
                score = sum(1 for term in search_terms if term in fname_lower)
                if score > highest_score:
                    highest_score = score
                    best_match = md_file
            if best_match and highest_score > 0:
                doc_path = best_match
            elif all_mds:
                doc_path = all_mds[0]
                
    if not doc_path or not doc_path.exists():
        fallback_path = kb_dir / "academic_policies_and_attendance.md"
        if fallback_path.exists():
            doc_path = fallback_path
        elif list(kb_dir.glob("*.md")):
            doc_path = list(kb_dir.glob("*.md"))[0]
        else:
            raise HTTPException(status_code=404, detail="Institutional document not found.")

    raw_content = doc_path.read_text(encoding="utf-8")
    doc_content = raw_content
    if raw_content.startswith("---"):
        parts = raw_content.split("---", 2)
        if len(parts) >= 3:
            doc_content = parts[2].strip()

    title_line = doc_path.stem.replace("_", " ").title()
    return doc_path, title_line, doc_content

@app.get("/api/documents/content/{document_name:path}")
def get_document_content(document_name: str):
    """
    Returns verified institutional document text and metadata as JSON.
    """
    doc_path, title_line, doc_content = resolve_knowledge_base_doc(document_name)
    return {
        "title": title_line,
        "source": doc_path.name,
        "content": doc_content,
        "clause": "Official Institutional Record"
    }

@app.get("/api/documents/view/{document_name:path}", response_class=HTMLResponse)
def view_document(document_name: str):
    """
    Renders official institutional documents from knowledge_base as a clean printable PDF / HTML page.
    """
    import html
    doc_path, title_line, doc_content = resolve_knowledge_base_doc(document_name)

    # Convert basic markdown tables and headers to clean HTML
    lines = doc_content.split("\n")
    html_body = []
    in_table = False
    
    for line in lines:
        line_str = line.strip()
        if line_str.startswith("# "):
            html_body.append(f"<h1 class='text-2xl font-bold text-slate-900 mt-6 mb-3 border-b pb-2 border-slate-200'>{html.escape(line_str[2:])}</h1>")
        elif line_str.startswith("## "):
            html_body.append(f"<h2 class='text-xl font-bold text-indigo-700 mt-5 mb-2.5'>{html.escape(line_str[3:])}</h2>")
        elif line_str.startswith("### "):
            html_body.append(f"<h3 class='text-lg font-semibold text-slate-800 mt-4 mb-2'>{html.escape(line_str[4:])}</h3>")
        elif line_str.startswith("|") and "|" in line_str[1:]:
            if "---" in line_str:
                continue
            cols = [c.strip() for c in line_str.split("|")[1:-1]]
            if not in_table:
                in_table = True
                html_body.append("<div class='overflow-x-auto my-4'><table class='w-full text-left border-collapse border border-slate-200 text-sm'><thead><tr class='bg-slate-100 text-slate-700 font-semibold'>")
                for c in cols:
                    html_body.append(f"<th class='border border-slate-200 px-3 py-2'>{html.escape(c)}</th>")
                html_body.append("</tr></thead><tbody>")
            else:
                html_body.append("<tr class='hover:bg-slate-50 text-slate-800'>")
                for c in cols:
                    html_body.append(f"<td class='border border-slate-200 px-3 py-2'>{html.escape(c)}</td>")
                html_body.append("</tr>")
        else:
            if in_table:
                in_table = False
                html_body.append("</tbody></table></div>")
            if line_str.startswith("- "):
                html_body.append(f"<li class='ml-6 list-disc text-slate-700 my-1'>{html.escape(line_str[2:])}</li>")
            elif line_str:
                html_body.append(f"<p class='text-slate-700 my-2 leading-relaxed'>{html.escape(line_str)}</p>")

    if in_table:
        html_body.append("</tbody></table></div>")

    rendered_content = "\n".join(html_body)

    full_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title_line} - CampusMind Document Archive</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @media print {{
            .no-print {{ display: none !important; }}
            body {{ background: white !important; padding: 0 !important; }}
            .paper {{ shadow: none !important; border: none !important; padding: 0 !important; }}
        }}
    </style>
</head>
<body class="bg-slate-100 min-h-screen text-slate-800 py-8 px-4 font-sans">
    <div class="max-w-4xl mx-auto">
        <!-- Print Header & Controls -->
        <div class="no-print flex items-center justify-between mb-6 bg-white p-4 rounded-xl shadow-xs border border-slate-200">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                    🎓
                </div>
                <div>
                    <h2 class="font-bold text-slate-900 text-sm">CampusMind Institutional Repository</h2>
                    <p class="text-xs text-slate-500">Official Verified Circular & Academic Regulation</p>
                </div>
            </div>
            <button onclick="window.print()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer flex items-center gap-2">
                🖨️ Print / Save as PDF
            </button>
        </div>

        <!-- Document Paper View -->
        <div class="paper bg-white p-8 sm:p-12 rounded-2xl shadow-md border border-slate-200">
            <!-- Header Stamp -->
            <div class="border-b-2 border-indigo-600 pb-4 mb-6 flex justify-between items-end">
                <div>
                    <div class="text-xs font-bold text-indigo-600 uppercase tracking-widest">CampusMind University Records</div>
                    <h1 class="text-2xl font-extrabold text-slate-900 mt-1">{title_line}</h1>
                </div>
                <div class="text-right text-xs text-slate-400 font-mono">
                    REF: {doc_path.name}<br>
                    VERIFIED & APPROVED
                </div>
            </div>

            <!-- Content -->
            <div class="prose max-w-none">
                {rendered_content}
            </div>

            <!-- Document Footer -->
            <div class="mt-12 pt-4 border-t border-slate-200 text-xs text-slate-400 flex justify-between items-center">
                <span>Official Institutional Record • CampusMind AI Platform</span>
                <span>University Academic Archive</span>
            </div>
        </div>
    </div>
</body>
</html>"""
    return HTMLResponse(content=full_html)

@app.get("/")
def health_check():
    return {
        "status": "healthy",
        "app": "CampusMind AI Backend",
        "version": "2.0.0",
        "ai_model": os.getenv("GEMINI_MODEL", "gemini-3.8-flash"),
        "demo_mode": DEMO_MODE
    }

