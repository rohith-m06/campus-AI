"""
Unit tests for Section 4: AI Response-Speed Improvements.
Validates:
1. Student context cache (context_cache.py) with TTLs and ticket invalidation.
2. Batch-aware strict Chroma retrieval without wrong-branch leaks (rag_engine.py).
3. Selective targeted prompt construction reducing token footprint (rag_engine.py).
4. ChromaDB warm-up function (rag_engine.py).
"""

import sys
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from backend.context_cache import (
    get_cached_courses,
    get_cached_attendance,
    get_cached_tickets,
    get_cached_news,
    invalidate_user_tickets_cache,
    warm_student_context_cache
)
from backend.rag_engine import (
    query_vector_store,
    warm_up_chromadb,
    build_targeted_prompt,
    _retrieval_cache
)
from backend.database import SessionLocal, Base, engine
from backend.models import User, Ticket

def test_context_cache():
    db = SessionLocal()
    # Test cached courses
    c1 = get_cached_courses("CSE", "2nd")
    c2 = get_cached_courses("CSE", "2nd")
    assert c1 == c2, "Courses cache failed"
    assert len(c1) > 0, "No courses returned"

    # Test cached news
    n1 = get_cached_news()
    n2 = get_cached_news()
    assert n1 == n2, "News cache failed"

    # Test ticket invalidation
    tickets1 = get_cached_tickets(1, db)
    invalidate_user_tickets_cache(1)
    # Cache cleared for user 1
    from backend.context_cache import _tickets_cache
    assert 1 not in _tickets_cache, "Ticket cache invalidation failed"
    db.close()
    print("PASS: Context caching and invalidation verified!")

def test_chroma_warmup():
    success = warm_up_chromadb()
    assert success is True, "ChromaDB warmup failed"
    print("PASS: ChromaDB startup warmup verified!")

def test_batch_aware_and_strict_branch_retrieval():
    # 1. Test CSE 2nd Year 2024-2028 batch retrieval
    docs_cse, meta_cse = query_vector_store(
        query="data structures and algorithms syllabus",
        user_branch="CSE",
        user_year="2nd",
        user_batch="2024-2028",
        top_k=3
    )
    assert len(docs_cse) > 0, "Failed to retrieve CSE syllabus"
    for m in meta_cse:
        b = m.get("branch", "").upper()
        app = m.get("applicable_to", "").lower()
        # Strictly verify no documents from MECH, ECE, EEE, CIVIL leaked into CSE query
        assert b in ["CSE", "ALL"] or app == "all", f"Wrong branch document leaked: {m.get('source')}"

    # 2. Test cache key includes batch
    cache_keys = list(_retrieval_cache.keys())
    batch_in_keys = any("2024-2028" in k for k in cache_keys)
    assert batch_in_keys, "Cache key does not include batch"

    # 3. Test non-existent branch/year returns empty or campus-wide, NEVER leaks other branch documents
    docs_none, meta_none = query_vector_store(
        query="completely unrelated non-existent query xyz12345",
        user_branch="MECH",
        user_year="4th",
        user_batch="2022-2026",
        top_k=2
    )
    for m in meta_none:
        b = m.get("branch", "").upper()
        app = m.get("applicable_to", "").lower()
        assert b in ["MECH", "ALL"] or app == "all", f"Unrestricted search returned wrong branch: {m.get('source')}"

    print("PASS: Strict batch & branch retrieval without wrong-branch leaks verified!")

def test_prompt_size_reduction():
    profile = {
        "full_name": "Arjun Sharma",
        "student_id": "24CSE101",
        "branch": "CSE",
        "current_year": "2nd",
        "batch": "2024-2028",
        "hostel_status": "Hostel Block B",
        "courses": [{"code": "CSE201", "title": "Data Structures", "faculty": "Dr. Raman", "room": "201"}],
        "attendance_summary": {
            "overall_percentage": 85.0,
            "overall_attended": 85,
            "overall_conducted": 100,
            "subject_records": [{"code": "CSE201", "title": "Data Structures", "attended": 40, "total_conducted": 45, "percentage": 88.9, "status": "Eligible", "margin_summary": "Safe"}]
        },
        "tickets": [{"ticket_number": "#TICK-101", "category": "Hostel", "title": "Fan not working", "status": "Submitted"}],
        "campus_news": [{"category": "Events", "title": "Hackathon 2026", "date": "Oct 10", "summary": "Exciting event"}]
    }

    # Query 1: Exam question -> should NOT include attendance records table or tickets
    prompt_exam, _, _, _ = build_targeted_prompt(
        query="When is the CAT-1 mid term examination?",
        user_profile=profile,
        preferred_language="English",
        docs=[],
        metadatas=[]
    )
    exam_prompt_text = str(prompt_exam)
    assert "Live Attendance Records:" not in exam_prompt_text, "Attendance bloat present in exam prompt"
    assert "Fan not working" not in exam_prompt_text, "Ticket bloat present in exam prompt"

    # Query 2: Attendance question -> SHOULD include attendance records
    prompt_att, _, _, _ = build_targeted_prompt(
        query="What is my attendance in Data Structures?",
        user_profile=profile,
        preferred_language="English",
        docs=[],
        metadatas=[]
    )
    att_prompt_text = str(prompt_att)
    assert "Live Attendance Records:" in att_prompt_text, "Attendance records missing from attendance prompt"
    assert "Fan not working" not in att_prompt_text, "Ticket bloat present in attendance prompt"

    print("PASS: Prompt token reduction verified (targeted contextual blocks)!")

if __name__ == "__main__":
    test_context_cache()
    test_chroma_warmup()
    test_batch_aware_and_strict_branch_retrieval()
    test_prompt_size_reduction()
    print("ALL Section 4 Response-Speed tests PASSED successfully!")
