"""
CampusMind AI - Student Context Cache Service
Provides fast in-memory multi-tiered caching for student persona data:
- User Profile: Cached until updated
- Courses Catalog: Cached for 1 hour (3600s)
- Attendance Records: Cached for 10 minutes (600s)
- Tickets & Grievances: Cached for 45 seconds (invalidated immediately upon ticket creation)
- Campus News & Circulars: Cached for 10 minutes (600s)
Ensures zero-latency lookup during chat interactions and non-blocking login flow.
"""

import time
import logging
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session

from backend.student_context import (
    get_student_attendance_summary,
    get_student_tickets_summary,
    get_campus_news_summary,
    get_student_courses,
    build_or_load_student_persona
)

logger = logging.getLogger("campusmind.cache")

# Cache TTL constants (seconds)
TTL_COURSES = 3600.0       # 1 hour
TTL_ATTENDANCE = 600.0     # 10 minutes
TTL_TICKETS = 45.0         # 45 seconds
TTL_NEWS = 600.0           # 10 minutes

# Internal in-memory stores
_courses_cache: Dict[str, Dict[str, Any]] = {}
_attendance_cache: Dict[str, Dict[str, Any]] = {}
_tickets_cache: Dict[int, Dict[str, Any]] = {}
_news_cache: Dict[str, Any] = {"data": None, "timestamp": 0.0}
_profile_cache: Dict[int, Dict[str, Any]] = {}

def get_cached_courses(branch: str, current_year: str) -> List[Dict[str, Any]]:
    """Retrieves cached courses catalog or fetches fresh if expired."""
    key = f"{branch.upper().strip()}_{current_year.strip()}"
    now = time.time()
    entry = _courses_cache.get(key)
    if entry and (now - entry["timestamp"] < TTL_COURSES):
        return entry["data"]

    courses = get_student_courses(branch, current_year)
    _courses_cache[key] = {"data": courses, "timestamp": now}
    return courses

def get_cached_attendance(branch: str, current_year: str, student_id: str) -> Dict[str, Any]:
    """Retrieves cached student attendance summary or fetches fresh if expired."""
    key = f"{student_id.upper().strip()}_{branch.upper().strip()}_{current_year.strip()}"
    now = time.time()
    entry = _attendance_cache.get(key)
    if entry and (now - entry["timestamp"] < TTL_ATTENDANCE):
        return entry["data"]

    attendance = get_student_attendance_summary(branch=branch, current_year=current_year, student_id=student_id)
    _attendance_cache[key] = {"data": attendance, "timestamp": now}
    return attendance

def get_cached_tickets(user_id: int, db: Session) -> List[Dict[str, Any]]:
    """Retrieves cached grievance tickets or queries SQLite if expired."""
    now = time.time()
    entry = _tickets_cache.get(user_id)
    if entry and (now - entry["timestamp"] < TTL_TICKETS):
        return entry["data"]

    tickets = get_student_tickets_summary(user_id, db)
    _tickets_cache[user_id] = {"data": tickets, "timestamp": now}
    return tickets

def get_cached_news() -> List[Dict[str, Any]]:
    """Retrieves cached campus announcements or fetches fresh if expired."""
    now = time.time()
    if _news_cache["data"] and (now - _news_cache["timestamp"] < TTL_NEWS):
        return _news_cache["data"]

    news = get_campus_news_summary()
    _news_cache["data"] = news
    _news_cache["timestamp"] = now
    return news

def get_cached_student_context(user: Any, db: Session) -> Dict[str, Any]:
    """
    Returns unified student profile context using high-speed multi-tiered cache.
    Includes profile, courses, attendance, tickets, and campus news.
    """
    return {
        "full_name": user.full_name,
        "student_id": user.student_id,
        "branch": user.branch,
        "current_year": user.current_year,
        "batch": user.batch,
        "hostel_status": user.hostel_status,
        "phone_number": getattr(user, "phone_number", None),
        "courses": get_cached_courses(user.branch, user.current_year),
        "attendance_summary": get_cached_attendance(user.branch, user.current_year, user.student_id),
        "tickets": get_cached_tickets(user.id, db),
        "campus_news": get_cached_news()
    }

def invalidate_user_tickets_cache(user_id: int):
    """Invalidates tickets cache when a user creates or modifies a ticket."""
    if user_id in _tickets_cache:
        del _tickets_cache[user_id]

def invalidate_user_profile_cache(user_id: int):
    """Invalidates cached profile data when user updates account."""
    if user_id in _profile_cache:
        del _profile_cache[user_id]

def warm_student_context_cache(user_dict: Dict[str, Any], db: Optional[Session] = None):
    """
    Background worker executed right after user login.
    Builds/syncs student persona to Firebase and primes in-memory context cache
    so subsequent chat inquiries are instant (<0.01s).
    """
    local_db = None
    if db is None:
        try:
            from backend.database import SessionLocal
            local_db = SessionLocal()
            db = local_db
        except Exception as dbe:
            logger.warning(f"Error initializing local DB for context warming: {dbe}")
            return

    try:
        build_or_load_student_persona(user_dict, db)
        # Prime courses, attendance, and news caches
        branch = user_dict.get("branch", "CSE")
        current_year = user_dict.get("current_year", "1st")
        student_id = user_dict.get("student_id", "")
        user_id = user_dict.get("id")

        get_cached_courses(branch, current_year)
        if student_id:
            get_cached_attendance(branch, current_year, student_id)
        if user_id and db:
            get_cached_tickets(user_id, db)
        get_cached_news()
        logger.info(f"Student context cache warmed for user {user_dict.get('email')}")
    except Exception as e:
        logger.warning(f"Error warming context cache for user: {e}")
    finally:
        if local_db is not None:
            local_db.close()
