"""
CampusMind AI - Firebase Integration Service
Provides Firestore persistence and synchronization for:
1. User Profiles & Authentication records
2. Student Personas (Branch, Year, Courses, Attendance stats, Timetable)
3. Student Grievances & Maintenance Tickets
4. Chat Sessions & Conversation History

Automatically detects Firebase credentials from:
- `backend/serviceAccountKey.json` or `serviceAccountKey.json` in workspace root
- `FIREBASE_CREDENTIALS_PATH` env variable
- `FIREBASE_SERVICE_ACCOUNT_JSON` env variable
- Individual FIREBASE_* env variables
Falls back cleanly to local database if credentials are not yet placed.
"""

import os
import json
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
from google.cloud.firestore_v1.base_query import FieldFilter

logger = logging.getLogger("campusmind.firebase")

_firebase_app = None
_firestore_db = None
_firebase_initialized = False
_init_error = None

BASE_DIR = Path(__file__).resolve().parent

def init_firebase() -> bool:
    """Initializes Firebase Admin SDK if credentials are available."""
    global _firebase_app, _firestore_db, _firebase_initialized, _init_error

    if _firebase_initialized:
        return _firestore_db is not None

    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
    except ImportError:
        _init_error = "firebase-admin package not installed"
        logger.warning(_init_error)
        return False

    # Check for existing default app
    if firebase_admin._apps:
        try:
            _firebase_app = firebase_admin.get_app()
            _firestore_db = firestore.client()
            _firebase_initialized = True
            logger.info("Firebase Admin already initialized.")
            return True
        except Exception as e:
            logger.warning(f"Error attaching to existing Firebase app: {e}")

    cred = None

    # 1. Search for serviceAccountKey.json in backend/ or project root
    candidate_paths = [
        BASE_DIR / "serviceAccountKey.json",
        BASE_DIR.parent / "serviceAccountKey.json",
        Path(os.getenv("FIREBASE_CREDENTIALS_PATH", "")) if os.getenv("FIREBASE_CREDENTIALS_PATH") else None,
    ]

    for p in candidate_paths:
        if p and p.exists() and p.is_file():
            try:
                cred = credentials.Certificate(str(p))
                logger.info(f"Loaded Firebase credentials from file: {p}")
                break
            except Exception as e:
                logger.warning(f"Failed to load credentials from {p}: {e}")

    # 2. Check for JSON string in env
    if not cred and os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON"):
        try:
            cert_dict = json.loads(os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON"))
            cred = credentials.Certificate(cert_dict)
            logger.info("Loaded Firebase credentials from FIREBASE_SERVICE_ACCOUNT_JSON env.")
        except Exception as e:
            logger.warning(f"Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON: {e}")

    # 3. Check for individual env vars
    if not cred and os.getenv("FIREBASE_PROJECT_ID") and os.getenv("FIREBASE_PRIVATE_KEY") and os.getenv("FIREBASE_CLIENT_EMAIL"):
        try:
            cert_dict = {
                "type": "service_account",
                "project_id": os.getenv("FIREBASE_PROJECT_ID"),
                "private_key": os.getenv("FIREBASE_PRIVATE_KEY").replace("\\n", "\n"),
                "client_email": os.getenv("FIREBASE_CLIENT_EMAIL"),
                "token_uri": "https://oauth2.googleapis.com/token",
            }
            cred = credentials.Certificate(cert_dict)
            logger.info("Loaded Firebase credentials from individual environment variables.")
        except Exception as e:
            logger.warning(f"Failed to build credentials from FIREBASE_* env vars: {e}")

    if cred:
        try:
            _firebase_app = firebase_admin.initialize_app(cred)
            _firestore_db = firestore.client()
            _firebase_initialized = True
            logger.info("Firebase Firestore initialized successfully!")
            return True
        except Exception as e:
            _init_error = f"Firebase initialization failed: {e}"
            logger.error(_init_error)
            return False
    else:
        _init_error = "No Firebase service account credentials found. (Awaiting serviceAccountKey.json)"
        logger.info(_init_error)
        return False

def get_firestore_client():
    """Returns Firestore client if available, else None."""
    init_firebase()
    return _firestore_db

def is_firebase_configured() -> bool:
    """Returns True if Firebase is successfully configured and reachable."""
    return get_firestore_client() is not None

def get_firebase_status() -> Dict[str, Any]:
    """Returns status information about Firebase connection."""
    configured = is_firebase_configured()
    project_id = None
    if configured and _firebase_app:
        try:
            project_id = _firebase_app.project_id
        except Exception:
            project_id = "Connected"
    return {
        "configured": configured,
        "project_id": project_id,
        "message": "Firebase Firestore is active" if configured else (_init_error or "Awaiting Firebase credentials")
    }

# -------------------------------------------------------------
# USER & STUDENT PERSONA FIRESTORE OPERATIONS
# -------------------------------------------------------------

def save_user_to_firebase(user_dict: Dict[str, Any]) -> bool:
    """Saves or updates user profile in Firestore `users` collection."""
    db = get_firestore_client()
    if not db:
        return False
    try:
        user_id = str(user_dict.get("id") or user_dict.get("student_id"))
        doc_ref = db.collection("users").document(user_id)
        now_iso = datetime.utcnow().isoformat()
        data_to_save = {
            "id": user_dict.get("id"),
            "full_name": user_dict.get("full_name"),
            "email": user_dict.get("email"),
            "student_id": user_dict.get("student_id"),
            "branch": user_dict.get("branch"),
            "current_year": user_dict.get("current_year"),
            "batch": user_dict.get("batch"),
            "hostel_status": user_dict.get("hostel_status"),
            "phone_number": user_dict.get("phone_number"),
            "last_login_at": user_dict.get("last_login_at", now_iso),
            "last_seen_at": user_dict.get("last_seen_at", now_iso),
            "login_count": user_dict.get("login_count", 1),
            "updated_at": now_iso
        }
        doc_ref.set(data_to_save, merge=True)
        return True
    except Exception as e:
        logger.error(f"Error saving user to Firebase: {e}")
        return False

def track_user_login(user_id: Any, email: Optional[str] = None) -> bool:
    """
    Tracks user login activity in Firebase Firestore:
    - Sets last_login_at
    - Sets last_seen_at
    - Increments login_count
    Allows reviewing total registered, new, returning, and active users.
    """
    db = get_firestore_client()
    if not db:
        return False
    try:
        user_str_id = str(user_id)
        doc_ref = db.collection("users").document(user_str_id)
        now_iso = datetime.utcnow().isoformat()

        # Fetch current record to safely increment login_count
        doc = doc_ref.get()
        new_count = 1
        if doc.exists:
            current_count = doc.to_dict().get("login_count", 0)
            new_count = current_count + 1

        update_data = {
            "last_login_at": now_iso,
            "last_seen_at": now_iso,
            "login_count": new_count,
            "updated_at": now_iso
        }
        if email:
            update_data["email"] = email.lower().strip()

        doc_ref.set(update_data, merge=True)
        return True
    except Exception as e:
        logger.error(f"Error tracking user login in Firebase: {e}")
        return False

def track_user_activity(user_id: Any) -> bool:
    """Updates user document with last_seen_at timestamp."""
    db = get_firestore_client()
    if not db:
        return False
    try:
        user_str_id = str(user_id)
        doc_ref = db.collection("users").document(user_str_id)
        now_iso = datetime.utcnow().isoformat()
        doc_ref.set({
            "last_seen_at": now_iso,
            "updated_at": now_iso
        }, merge=True)
        return True
    except Exception as e:
        logger.error(f"Error tracking user activity in Firebase: {e}")
        return False

def classify_intent(query: str) -> str:
    """
    Classifies student inquiry into one of the 9 required hackathon intent categories:
    attendance, exams, fees, hostel, courses, placements, grievance, campus_news, general
    """
    if not query:
        return "general"
    q = query.lower().strip()

    if any(k in q for k in ["grievance", "complaint", "ticket", "issue", "broken", "wifi", "water", "plumbing", "harassment", "ragging", "resolve", "repair", "not working"]):
        return "grievance"
    if any(k in q for k in ["attendance", "bunk", "percentage", "present", "absent", "condonation", "detained", "detention", "margin", "shortage"]):
        return "attendance"
    if any(k in q for k in ["exam", "cat-1", "cat-2", "cat 1", "cat 2", "fat", "assessment", "test", "hall ticket", "re-eval", "backlog", "date sheet", "marks", "grades"]):
        return "exams"
    if any(k in q for k in ["fee", "tuition", "payment", "installment", "due", "cost", "fine", "receipt", "penalty", "scholarship"]):
        return "fees"
    if any(k in q for k in ["hostel", "curfew", "warden", "room", "mess", "gate", "night out", "in-time", "out-time", "visitor", "laundry"]):
        return "hostel"
    if any(k in q for k in ["course", "subject", "syllabus", "credit", "elective", "curriculum", "faculty", "professor", "timetable", "routine", "slot", "lab"]):
        return "courses"
    if any(k in q for k in ["placement", "internship", "job", "career", "company", "recruit", "package", "ctc", "interview", "drive", "hire"]):
        return "placements"
    if any(k in q for k in ["news", "announcement", "circular", "event", "fest", "holiday", "seminar", "workshop", "update", "hackathon"]):
        return "campus_news"
    return "general"

def get_user_by_email_from_firebase(email: str) -> Optional[Dict[str, Any]]:
    """Fetches user document from Firestore by email."""
    db = get_firestore_client()
    if not db:
        return None
    try:
        clean_email = email.lower().strip()
        docs = db.collection("users").where(filter=FieldFilter("email", "==", clean_email)).limit(1).get()
        for doc in docs:
            return doc.to_dict()
        return None
    except Exception as e:
        logger.error(f"Error fetching user by email from Firebase: {e}")
        return None


def save_persona_to_firebase(student_id: str, persona_dict: Dict[str, Any]) -> bool:
    """
    Saves student persona including:
    - Structured branch courses
    - Live attendance records & margins
    - Timetable schedules
    - Metadata
    to Firestore `student_personas/{student_id}`.
    """
    db = get_firestore_client()
    if not db:
        return False
    try:
        clean_sid = str(student_id).upper().strip()
        doc_ref = db.collection("student_personas").document(clean_sid)
        persona_dict["updated_at"] = datetime.utcnow().isoformat()
        doc_ref.set(persona_dict, merge=True)
        return True
    except Exception as e:
        logger.error(f"Error saving student persona to Firebase: {e}")
        return False

def get_persona_from_firebase(student_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves student persona from Firestore if available."""
    db = get_firestore_client()
    if not db:
        return None
    try:
        clean_sid = str(student_id).upper().strip()
        doc = db.collection("student_personas").document(clean_sid).get()
        if doc.exists:
            return doc.to_dict()
        return None
    except Exception as e:
        logger.error(f"Error reading persona from Firebase: {e}")
        return None

# -------------------------------------------------------------
# GRIEVANCES & TICKETS FIRESTORE OPERATIONS
# -------------------------------------------------------------

def save_ticket_to_firebase(ticket_dict: Dict[str, Any]) -> bool:
    """Saves grievance / ticket to Firestore `tickets` collection."""
    db = get_firestore_client()
    if not db:
        return False
    try:
        ticket_number = ticket_dict.get("ticket_number")
        if not ticket_number:
            ticket_number = f"TICK-{int(datetime.utcnow().timestamp())}"
        
        doc_ref = db.collection("tickets").document(ticket_number)
        doc_ref.set(ticket_dict, merge=True)
        return True
    except Exception as e:
        logger.error(f"Error saving ticket to Firebase: {e}")
        return False

def get_student_tickets_from_firebase(user_id: int) -> Optional[List[Dict[str, Any]]]:
    """Fetches tickets filed by student from Firestore."""
    db = get_firestore_client()
    if not db:
        return None
    try:
        docs = (
            db.collection("tickets")
            .where(filter=FieldFilter("user_id", "==", user_id))
            .stream()
        )
        tickets = [doc.to_dict() for doc in docs]
        tickets.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return tickets
    except Exception as e:
        logger.error(f"Error fetching tickets from Firebase: {e}")
        return None

# -------------------------------------------------------------
# CHAT SESSIONS & MESSAGES FIRESTORE OPERATIONS
# -------------------------------------------------------------

def save_chat_session_to_firebase(session_dict: Dict[str, Any]) -> bool:
    """Saves or updates a chat session in Firestore."""
    db = get_firestore_client()
    if not db:
        return False
    try:
        session_id = session_dict.get("id")
        if not session_id:
            return False
        doc_ref = db.collection("chat_sessions").document(session_id)
        doc_ref.set(session_dict, merge=True)
        return True
    except Exception as e:
        logger.error(f"Error saving chat session to Firebase: {e}")
        return False

def save_chat_message_to_firebase(session_id: str, message_dict: Dict[str, Any]) -> bool:
    """
    Saves a message inside `chat_sessions/{session_id}/messages/{msg_id}`
    and logs it in `chat_analytics/{session_id}_{msg_id}` for aggregated analytics.
    Preserves all required fields:
    user_id, session_id, role, content, source, branch, current_year, batch, created_at,
    response_time_ms, model_used, retrieved_document_count, intent.
    """
    db = get_firestore_client()
    if not db:
        return False
    try:
        msg_id = str(message_dict.get("id") or int(datetime.utcnow().timestamp() * 1000))
        doc_ref = (
            db.collection("chat_sessions")
            .document(session_id)
            .collection("messages")
            .document(msg_id)
        )
        doc_ref.set(message_dict, merge=True)
        
        # Update session timestamp & preview
        db.collection("chat_sessions").document(session_id).set({
            "updated_at": datetime.utcnow().isoformat(),
            "last_message": message_dict.get("content", "")[:80]
        }, merge=True)

        # Store in flat chat_analytics collection for quick review by hackathon evaluators
        try:
            analytics_ref = db.collection("chat_analytics").document(f"{session_id}_{msg_id}")
            analytics_ref.set(message_dict, merge=True)
        except Exception as ae:
            logger.debug(f"Analytics logging notice: {ae}")

        return True
    except Exception as e:
        logger.error(f"Error saving chat message to Firebase: {e}")
        return False

def get_chat_sessions_from_firebase(user_id: int) -> Optional[List[Dict[str, Any]]]:
    """Fetches all chat sessions for a user from Firestore."""
    db = get_firestore_client()
    if not db:
        return None
    try:
        docs = (
            db.collection("chat_sessions")
            .where(filter=FieldFilter("user_id", "==", user_id))
            .stream()
        )
        sessions = [doc.to_dict() for doc in docs]
        sessions.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
        return sessions
    except Exception as e:
        logger.error(f"Error fetching chat sessions from Firebase: {e}")
        return None

def get_session_messages_from_firebase(session_id: str) -> Optional[List[Dict[str, Any]]]:
    """Fetches messages for a chat session from Firestore."""
    db = get_firestore_client()
    if not db:
        return None
    try:
        docs = (
            db.collection("chat_sessions")
            .document(session_id)
            .collection("messages")
            .stream()
        )
        msgs = [doc.to_dict() for doc in docs]
        msgs.sort(key=lambda x: x.get("created_at", ""))
        return msgs
    except Exception as e:
        logger.error(f"Error fetching session messages from Firebase: {e}")
        return None

def delete_chat_session_from_firebase(session_id: str) -> bool:
    """Deletes a chat session and its subcollection messages in Firestore."""
    db = get_firestore_client()
    if not db:
        return False
    try:
        session_ref = db.collection("chat_sessions").document(session_id)
        # Delete submessages
        msgs = session_ref.collection("messages").stream()
        for m in msgs:
            m.reference.delete()
        session_ref.delete()
        return True
    except Exception as e:
        logger.error(f"Error deleting chat session from Firebase: {e}")
        return False
