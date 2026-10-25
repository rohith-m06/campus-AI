"""
Unit and integration tests for DEMO_MODE configuration and password bypass logic.
Validates:
1. When DEMO_MODE=True:
   - Evaluator demo accounts allow instant password bypass with any password.
   - Non-demo accounts require correct password.
2. When DEMO_MODE=False:
   - Evaluator demo accounts CANNOT bypass password with wrong password.
   - Evaluator demo accounts CAN log in with valid password ('Campus@123').
   - Non-demo accounts require correct password.
"""

import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from backend.database import SessionLocal, Base, engine
from backend.models import User
from backend.auth import get_password_hash
from backend.schemas import UserLoginRequest
from backend import main

def setup_test_users():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Ensure demo user exists
    demo_email = "arjun.sharma@campus.edu"
    demo_user = db.query(User).filter(User.email == demo_email).first()
    if not demo_user:
        demo_user = User(
            full_name="Arjun Sharma",
            email=demo_email,
            hashed_password=get_password_hash("Campus@123"),
            student_id="24CSE101",
            branch="CSE",
            current_year="2nd",
            batch="2024-2028",
            hostel_status="Hostel Block B",
            phone_number="+91 98765 43210"
        )
        db.add(demo_user)
    else:
        demo_user.hashed_password = get_password_hash("Campus@123")
        demo_user.current_year = "2nd"

    # Ensure regular user exists
    reg_email = "regular.student@campus.edu"
    reg_user = db.query(User).filter(User.email == reg_email).first()
    if not reg_user:
        reg_user = User(
            full_name="Regular Student",
            email=reg_email,
            hashed_password=get_password_hash("SecretPassword!123"),
            student_id="24CSE999",
            branch="CSE",
            current_year="1st",
            batch="2024-2028",
            hostel_status="Day Scholar",
            phone_number="+91 99999 88888"
        )
        db.add(reg_user)
    else:
        reg_user.hashed_password = get_password_hash("SecretPassword!123")

    db.commit()
    db.close()

def test_demo_mode_true():
    print("\n--- Testing DEMO_MODE = True ---")
    main.DEMO_MODE = True
    db = SessionLocal()
    try:
        # 1. Demo user with wrong/arbitrary password -> should SUCCEED via bypass
        req = UserLoginRequest(email="arjun.sharma@campus.edu", password="arbitrary-bypass-test")
        res = main.login_user(req, db)
        assert res.access_token is not None
        assert res.user.email == "arjun.sharma@campus.edu"
        print("PASS: Demo account password bypass succeeded under DEMO_MODE=True.")

        # 2. Demo user with standard demo password -> should SUCCEED
        req2 = UserLoginRequest(email="arjun.sharma@campus.edu", password="Campus@123")
        res2 = main.login_user(req2, db)
        assert res2.access_token is not None
        print("PASS: Demo account standard login succeeded under DEMO_MODE=True.")

        # 3. Regular non-demo user with wrong password -> must FAIL (HTTP 401)
        req3 = UserLoginRequest(email="regular.student@campus.edu", password="wrongpassword")
        failed = False
        try:
            main.login_user(req3, db)
        except main.HTTPException as e:
            assert e.status_code == 401
            failed = True
        assert failed, "Regular user should fail with wrong password"
        print("PASS: Regular account wrong password properly rejected under DEMO_MODE=True.")
    finally:
        db.close()

def test_demo_mode_false():
    print("\n--- Testing DEMO_MODE = False ---")
    main.DEMO_MODE = False
    db = SessionLocal()
    try:
        # 1. Demo user with wrong password -> must FAIL under DEMO_MODE=False!
        req = UserLoginRequest(email="arjun.sharma@campus.edu", password="arbitrary-bypass-test")
        failed = False
        try:
            main.login_user(req, db)
        except main.HTTPException as e:
            assert e.status_code == 401
            assert "Campus@123" not in e.detail  # error message doesn't reveal demo password
            failed = True
        assert failed, "Demo user password bypass MUST be blocked when DEMO_MODE=False!"
        print("PASS: Demo account password bypass blocked under DEMO_MODE=False.")

        # 2. Demo user with correct password -> should SUCCEED
        req2 = UserLoginRequest(email="arjun.sharma@campus.edu", password="Campus@123")
        res2 = main.login_user(req2, db)
        assert res2.access_token is not None
        print("PASS: Demo account standard login with correct password succeeded under DEMO_MODE=False.")

        # 3. Regular user with wrong password -> must FAIL
        req3 = UserLoginRequest(email="regular.student@campus.edu", password="wrongpassword")
        failed = False
        try:
            main.login_user(req3, db)
        except main.HTTPException as e:
            assert e.status_code == 401
            failed = True
        assert failed, "Regular user should fail with wrong password"
        print("PASS: Regular account wrong password properly rejected under DEMO_MODE=False.")

        # 4. Regular user with correct password -> should SUCCEED
        req4 = UserLoginRequest(email="regular.student@campus.edu", password="SecretPassword!123")
        res4 = main.login_user(req4, db)
        assert res4.access_token is not None
        print("PASS: Regular account login with correct password succeeded under DEMO_MODE=False.")
    finally:
        db.close()

if __name__ == "__main__":
    setup_test_users()
    test_demo_mode_true()
    test_demo_mode_false()
    print("\nAll DEMO_MODE tests PASSED successfully!")
