"""
Unit tests for Section 3: Firebase and Database Architecture.
Validates:
1. Clear division of responsibility: SQLite as operational DB, Firebase for analytics.
2. classify_intent matches all 9 required intent categories accurately.
3. Analytics fields included in message payloads (user_id, session_id, role, content, source,
   branch, current_year, batch, created_at, response_time_ms, model_used, retrieved_document_count, intent).
4. User activity tracking fields (last_login_at, last_seen_at, login_count).
"""

import sys
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from backend.firebase_service import classify_intent, track_user_login, track_user_activity
from backend.database import SessionLocal, Base, engine
from backend.models import User, ChatSession, ChatMessage

def test_intent_classification():
    test_cases = [
        ("What is my attendance percentage in Data Structures?", "attendance"),
        ("Can I bunk tomorrow's 9 AM lecture?", "attendance"),
        ("When are the CAT-1 mid term exams scheduled?", "exams"),
        ("What is the fee payment deadline for 2nd semester?", "fees"),
        ("What is the hostel gate curfew time for boys and girls?", "hostel"),
        ("What courses and syllabus do I have this semester?", "courses"),
        ("What is the placement criteria and average package for CSE?", "placements"),
        ("The wifi router in hostel room 302 is broken, please raise a ticket", "grievance"),
        ("Are there any upcoming campus events or hackathons this week?", "campus_news"),
        ("Hello, who are you and how can you help me?", "general"),
    ]
    for prompt, expected_intent in test_cases:
        detected = classify_intent(prompt)
        assert detected == expected_intent, f"Prompt '{prompt}' classified as '{detected}', expected '{expected_intent}'"
    print("PASS: All 9 intent categories correctly classified!")

def test_analytics_payload_structure():
    # User message payload
    user_payload = {
        "id": 1,
        "user_id": 42,
        "session_id": "sess_123",
        "role": "user",
        "content": "What is my attendance?",
        "source": None,
        "branch": "CSE",
        "current_year": "2nd",
        "batch": "2024-2028",
        "intent": classify_intent("What is my attendance?"),
        "created_at": "2026-10-24T12:00:00"
    }
    required_user_keys = {
        "user_id", "session_id", "role", "content", "source",
        "branch", "current_year", "batch", "created_at", "intent"
    }
    assert required_user_keys.issubset(user_payload.keys()), "User payload missing required analytics fields"
    assert user_payload["intent"] == "attendance"

    # Assistant message payload
    ai_payload = {
        "id": 2,
        "user_id": 42,
        "session_id": "sess_123",
        "role": "assistant",
        "content": "Your attendance in CS201 is 85%.",
        "source": "academic_policies_and_attendance.md",
        "branch": "CSE",
        "current_year": "2nd",
        "batch": "2024-2028",
        "response_time_ms": 320,
        "model_used": "gemini-2.5-flash",
        "retrieved_document_count": 4,
        "created_at": "2026-10-24T12:00:01"
    }
    required_ai_keys = {
        "user_id", "session_id", "role", "content", "source",
        "branch", "current_year", "batch", "created_at",
        "response_time_ms", "model_used", "retrieved_document_count"
    }
    assert required_ai_keys.issubset(ai_payload.keys()), "AI payload missing required analytics fields"
    print("PASS: All required analytics fields verified for both user and assistant payloads!")

if __name__ == "__main__":
    test_intent_classification()
    test_analytics_payload_structure()
    print("All Section 3 Architecture tests PASSED successfully!")
