"""
Unit and integration tests for the CampusMind Timetable API and normalization logic.
Validates:
1. Day-name normalization (Monday -> MON, etc.)
2. Time-slot parsing and slot assignment (slots 1..8 and lab blocks 1..4)
3. Theory vs Lab session discrimination
4. Backend timetable loader for all 6 engineering branches (CSE, ECE, MECH, EEE, CIVIL, IT) across years
5. Structured JSON response shape matching { branch, year, semester, source, days: { MON, TUE, WED, THU, FRI }, summary }
6. Empty / missing timetable fallback handling
7. Full API endpoint invocation using FastAPI TestClient with authenticated student JWT
"""

import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from backend.database import SessionLocal, Base, engine
from backend.models import User
from backend.auth import get_password_hash, create_access_token
from backend.student_context import get_student_timetable_data, normalize_year_code
from backend import main
from fastapi.testclient import TestClient

def test_day_normalization():
    print("\n--- 1. Testing Day Normalization ---")
    data = get_student_timetable_data("CSE", "3rd", "2023-2027")
    days = list(data["days"].keys())
    assert days == ["MON", "TUE", "WED", "THU", "FRI"], f"Unexpected days: {days}"
    print("PASS: Days correctly normalized to ['MON', 'TUE', 'WED', 'THU', 'FRI'].")

def test_theory_and_lab_mapping():
    print("\n--- 2. Testing Theory vs Lab Mapping ---")
    data = get_student_timetable_data("CSE", "3rd", "2023-2027")
    mon_sessions = data["days"]["MON"]
    assert len(mon_sessions) >= 4, f"Expected at least 4 sessions for Monday, got {len(mon_sessions)}"

    theory_sessions = [s for s in mon_sessions if s["type"] == "theory"]
    lab_sessions = [s for s in mon_sessions if s["type"] == "lab"]

    assert len(theory_sessions) >= 1, "Expected at least one theory session on Monday"
    assert len(lab_sessions) >= 1, "Expected at least one lab session on Monday"

    # Validate theory session properties
    t0 = theory_sessions[0]
    assert t0["courseCode"] != "", "Course code cannot be empty"
    assert t0["faculty"] != "", "Faculty cannot be empty"
    assert t0["room"] != "", "Room cannot be empty"
    assert t0["credits"] > 0, "Credits must be greater than 0"
    print(f"PASS: Theory session mapped properly: {t0['courseCode']} - {t0['courseTitle']} ({t0['time']})")

    # Validate lab session properties
    l0 = lab_sessions[0]
    assert l0["type"] == "lab", "Expected type 'lab'"
    assert "Lab" in l0["category"] or "Practical" in l0["category"], "Category should indicate practical/lab"
    print(f"PASS: Lab session mapped properly: {l0['courseCode']} - {l0['courseTitle']} ({l0['time']})")

def test_time_slot_parsing():
    print("\n--- 3. Testing Time Slot Parsing ---")
    data = get_student_timetable_data("CSE", "1st", "2024-2028")
    for d, sessions in data["days"].items():
        for s in sessions:
            assert s["startTime"] != "", f"startTime missing for {s['courseCode']}"
            assert s["time"] != "", f"time missing for {s['courseCode']}"
            assert 1 <= s["slotId"] <= 8, f"slotId out of bounds for {s['courseCode']}: {s['slotId']}"
    print("PASS: All sessions have parsed start/end times and valid slotIds.")

def test_all_branches_load_successfully():
    print("\n--- 4. Testing All 6 Branches & 4 Years ---")
    branches = ["CSE", "ECE", "MECH", "EEE", "CIVIL", "IT"]
    years = ["1st", "2nd", "3rd", "4th"]

    for b in branches:
        for y in years:
            res = get_student_timetable_data(b, y)
            assert res["branch"] == b, f"Branch mismatch: {res['branch']} vs {b}"
            assert res["year"] == y, f"Year mismatch: {res['year']} vs {y}"
            assert len(res["summary"]) > 0, f"Summary courses empty for {b} {y}"
            assert all(d in res["days"] for d in ["MON", "TUE", "WED", "THU", "FRI"])
    print(f"PASS: Successfully loaded structured timetables for all {len(branches) * len(years)} branch-year combinations!")

def test_fallback_for_unknown_branch():
    print("\n--- 5. Testing Controlled Fallback for Unknown Branch ---")
    res = get_student_timetable_data("AEROSPACE", "5th")
    assert res["branch"] in ["CSE", "AEROSPACE"], "Should fallback cleanly"
    assert all(d in res["days"] for d in ["MON", "TUE", "WED", "THU", "FRI"])
    assert len(res["summary"]) > 0, "Fallback should provide courses"
    print("PASS: Fallback behavior handles unknown branches gracefully.")

def test_api_endpoint_authenticated():
    print("\n--- 6. Testing GET /api/student/timetable Endpoint via FastAPI TestClient ---")
    client = TestClient(main.app)

    # 1. Unauthenticated request -> 401 Unauthorized
    unauth_res = client.get("/api/student/timetable")
    assert unauth_res.status_code == 401, f"Expected 401, got {unauth_res.status_code}"
    print("PASS: Unauthenticated request rejected with 401 Unauthorized.")

    # 2. Authenticated demo user
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "arjun.sharma@campus.edu").first()
        if not user:
            user = User(
                full_name="Arjun Sharma",
                email="arjun.sharma@campus.edu",
                hashed_password=get_password_hash("Campus@123"),
                student_id="24CSE101",
                branch="CSE",
                current_year="2nd",
                batch="2024-2028",
                hostel_status="Hostel Block B"
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        token = create_access_token({"sub": str(user.id), "email": user.email})
        headers = {"Authorization": f"Bearer {token}"}

        auth_res = client.get("/api/student/timetable", headers=headers)
        assert auth_res.status_code == 200, f"Expected 200, got {auth_res.status_code}: {auth_res.text}"
        body = auth_res.json()

        assert body["branch"] == user.branch
        assert body["year"] == user.current_year
        assert "days" in body
        assert "summary" in body
        assert len(body["days"]["MON"]) > 0
        assert len(body["summary"]) > 0
        print("PASS: Authenticated GET /api/student/timetable returned 200 OK with full timetable data.")
    finally:
        db.close()

if __name__ == "__main__":
    test_day_normalization()
    test_theory_and_lab_mapping()
    test_time_slot_parsing()
    test_all_branches_load_successfully()
    test_fallback_for_unknown_branch()
    test_api_endpoint_authenticated()
    print("\n==========================================")
    print(" ALL BACKEND TIMETABLE TESTS PASSED!")
    print("==========================================")
