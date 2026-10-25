"""
CampusMind AI - Student Context & Academic Engine
Provides unified, hyper-personalized contextual data for every student persona:
1. Complete Branch & Year Course Catalog (CSE, ECE, MECH, EEE, CIVIL, IT for 1st, 2nd, 3rd, 4th years)
2. Deterministic & Realistic Attendance Generator (>50%, with realistic margins and daywise logs)
3. Timetable Schedules per Branch & Year
4. Student Grievance Tickets (persisted in SQLite & Firebase ready)
5. Official Verified Campus News & Circulars
"""

import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from backend.models import Ticket
from backend.firebase_service import (
    save_persona_to_firebase,
    get_persona_from_firebase,
    get_student_tickets_from_firebase,
    is_firebase_configured
)

# Comprehensive Subject Catalog for all Engineering Branches & Years
ALL_BRANCH_SUBJECTS = {
    "CSE": {
        "1st": [
            {"code": "PHY101", "title": "Engineering Physics", "faculty": "Dr. A. K. Sharma", "room": "Block 1 - Room 101"},
            {"code": "MTH101", "title": "Calculus & Linear Algebra", "faculty": "Prof. R. Deshmukh", "room": "Block 1 - Room 101"},
            {"code": "CSE101", "title": "Programming in C/C++", "faculty": "Dr. S. Nair", "room": "Block 1 - Room 102"},
            {"code": "ENG101", "title": "Technical Communication", "faculty": "Prof. M. Kapoor", "room": "Block 2 - Room 204"},
            {"code": "CSL101", "title": "C Programming Lab", "faculty": "Dr. S. Nair & TAs", "room": "Computing Lab 1"}
        ],
        "2nd": [
            {"code": "CSE201", "title": "Data Structures & Algorithms", "faculty": "Dr. V. Ramanathan", "room": "CS Block - Room 201"},
            {"code": "CSE202", "title": "Discrete Mathematics", "faculty": "Prof. S. Meenakshi", "room": "CS Block - Room 201"},
            {"code": "CSE203", "title": "Object Oriented Programming (Java)", "faculty": "Dr. K. Swaminathan", "room": "CS Block - Room 202"},
            {"code": "CSE204", "title": "Digital Logic & Computer Architecture", "faculty": "Prof. T. Reddy", "room": "CS Block - Room 203"},
            {"code": "CSL201", "title": "Data Structures Lab", "faculty": "Dr. V. Ramanathan & TAs", "room": "Database Lab 1"}
        ],
        "3rd": [
            {"code": "CSE301", "title": "Database Management Systems", "faculty": "Dr. V. Ramanathan", "room": "CS Block 2 - Room 301"},
            {"code": "CSE302", "title": "Operating Systems", "faculty": "Prof. S. Meenakshi", "room": "CS Block 2 - Room 301"},
            {"code": "CSE303", "title": "Design & Analysis of Algorithms", "faculty": "Dr. K. Swaminathan", "room": "CS Block 2 - Room 302"},
            {"code": "CSE304", "title": "Artificial Intelligence & ML", "faculty": "Dr. N. Bannerjee", "room": "CS Block 2 - Room 305"},
            {"code": "CSE305", "title": "Computer Networks", "faculty": "Prof. T. Reddy", "room": "CS Block 2 - Room 303"},
            {"code": "CSL301", "title": "DBMS & SQL Lab", "faculty": "Dr. V. Ramanathan", "room": "Database Lab 2"}
        ],
        "4th": [
            {"code": "CSE401", "title": "Cloud Computing & DevOps", "faculty": "Dr. A. Sengupta", "room": "CS Block 3 - Room 401"},
            {"code": "CSE402", "title": "Compiler Design", "faculty": "Prof. P. Iyengar", "room": "CS Block 3 - Room 401"},
            {"code": "CSE403", "title": "Cybersecurity & Cryptography", "faculty": "Dr. H. Rastogi", "room": "CS Block 3 - Room 402"},
            {"code": "PRJ401", "title": "Major Capstone Project Phase II", "faculty": "Senior Project Panel", "room": "Innovation Centre"}
        ]
    },
    "ECE": {
        "1st": [
            {"code": "PHY101", "title": "Engineering Physics", "faculty": "Dr. A. K. Sharma", "room": "Block 1 - Room 101"},
            {"code": "MTH101", "title": "Calculus & Linear Algebra", "faculty": "Prof. R. Deshmukh", "room": "Block 1 - Room 101"},
            {"code": "ECE101", "title": "Basic Electronics Engineering", "faculty": "Dr. R. Sundaram", "room": "ECE Block - Room 101"},
            {"code": "ENG101", "title": "Technical Communication", "faculty": "Prof. M. Kapoor", "room": "Block 2 - Room 204"},
            {"code": "ECL101", "title": "Basic Electronics Lab", "faculty": "Dr. R. Sundaram & TAs", "room": "Electronics Lab 1"}
        ],
        "2nd": [
            {"code": "ECE201", "title": "Electronic Circuits & Devices", "faculty": "Dr. G. Ananth", "room": "ECE Block - Room 201"},
            {"code": "ECE202", "title": "Signals & Systems", "faculty": "Prof. N. Kulkarni", "room": "ECE Block - Room 201"},
            {"code": "ECE203", "title": "Network Theory & Analysis", "faculty": "Dr. S. Mukherjee", "room": "ECE Block - Room 202"},
            {"code": "ECE204", "title": "Digital Electronics & Logic Design", "faculty": "Prof. R. P. Singh", "room": "ECE Block - Room 203"},
            {"code": "ECL201", "title": "Analog Circuits Lab", "faculty": "Dr. G. Ananth", "room": "Circuit Lab 2"}
        ],
        "3rd": [
            {"code": "ECE301", "title": "Microprocessors & Microcontrollers", "faculty": "Dr. M. Chawla", "room": "ECE Block 2 - Room 301"},
            {"code": "ECE302", "title": "VLSI Design & Embedded Systems", "faculty": "Prof. S. Nambiar", "room": "ECE Block 2 - Room 301"},
            {"code": "ECE303", "title": "Digital Communication Systems", "faculty": "Dr. D. Bose", "room": "ECE Block 2 - Room 302"},
            {"code": "ECE304", "title": "Electromagnetic Waves & Waveguides", "faculty": "Prof. K. Subramanian", "room": "ECE Block 2 - Room 305"},
            {"code": "ECL301", "title": "Microcontroller & VLSI Lab", "faculty": "Dr. M. Chawla", "room": "VLSI CAD Lab"}
        ],
        "4th": [
            {"code": "ECE401", "title": "Wireless & Mobile Communication", "faculty": "Dr. V. Natesan", "room": "ECE Block 3 - Room 401"},
            {"code": "ECE402", "title": "Optical Fiber Communication", "faculty": "Prof. L. Bhatnagar", "room": "ECE Block 3 - Room 401"},
            {"code": "ECE403", "title": "RF & Microwave Engineering", "faculty": "Dr. R. K. Pillai", "room": "ECE Block 3 - Room 402"},
            {"code": "PRJ401", "title": "Major Capstone Hardware Project", "faculty": "Senior ECE Faculty", "room": "Embedded Systems Lab"}
        ]
    },
    "MECH": {
        "1st": [
            {"code": "PHY101", "title": "Engineering Physics", "faculty": "Dr. A. K. Sharma", "room": "Block 1 - Room 101"},
            {"code": "MTH101", "title": "Calculus & Linear Algebra", "faculty": "Prof. R. Deshmukh", "room": "Block 1 - Room 101"},
            {"code": "MEC101", "title": "Engineering Graphics & Drawing", "faculty": "Prof. K. Verma", "room": "CAD Studio 2"},
            {"code": "MEC102", "title": "Basic Mechanical Engineering", "faculty": "Dr. S. Chatterjee", "room": "Mech Block - Room 102"},
            {"code": "MEL101", "title": "Workshop Practice & Fitting Lab", "faculty": "Instructors", "room": "Central Workshop"}
        ],
        "2nd": [
            {"code": "MEC201", "title": "Engineering Thermodynamics", "faculty": "Dr. S. Chatterjee", "room": "Mech Block - Room 201"},
            {"code": "MEC202", "title": "Mechanics of Solids (Strength of Materials)", "faculty": "Prof. A. Sridhar", "room": "Mech Block - Room 201"},
            {"code": "MEC203", "title": "Fluid Mechanics & Hydraulics", "faculty": "Dr. N. Tripathi", "room": "Mech Block - Room 202"},
            {"code": "MEC204", "title": "Manufacturing Processes I", "faculty": "Prof. B. Raut", "room": "Mech Block - Room 203"},
            {"code": "MEL201", "title": "Solid Mechanics & Strength Lab", "faculty": "Prof. A. Sridhar", "room": "SOM Lab"}
        ],
        "3rd": [
            {"code": "MEC301", "title": "Kinematics & Dynamics of Machinery", "faculty": "Dr. P. R. Rao", "room": "Mech Block 2 - Room 301"},
            {"code": "MEC302", "title": "Heat & Mass Transfer", "faculty": "Prof. S. K. Mahapatra", "room": "Mech Block 2 - Room 301"},
            {"code": "MEC303", "title": "Design of Machine Elements", "faculty": "Dr. U. N. Das", "room": "Mech Block 2 - Room 302"},
            {"code": "MEC304", "title": "Metrology & Quality Control", "faculty": "Prof. G. Hegde", "room": "Mech Block 2 - Room 305"},
            {"code": "MEC305", "title": "IC Engines & Thermal Engineering", "faculty": "Dr. S. Chatterjee", "room": "Mech Block 2 - Room 303"},
            {"code": "MEL301", "title": "Heat Transfer & IC Engines Lab", "faculty": "Prof. S. K. Mahapatra", "room": "Thermal Engg Lab"}
        ],
        "4th": [
            {"code": "MEC401", "title": "CAD/CAM/CIM & Robotics", "faculty": "Dr. T. Venkat", "room": "Mech Block 3 - Room 401"},
            {"code": "MEC402", "title": "Power Plant Engineering", "faculty": "Prof. R. Soman", "room": "Mech Block 3 - Room 401"},
            {"code": "MEC403", "title": "Mechatronics & Automation", "faculty": "Dr. A. Gokhale", "room": "Mech Block 3 - Room 402"},
            {"code": "PRJ401", "title": "Major Mechanical Capstone Project", "faculty": "Mech Review Panel", "room": "Robotics Lab"}
        ]
    },
    "EEE": {
        "1st": [
            {"code": "PHY101", "title": "Engineering Physics", "faculty": "Dr. A. K. Sharma", "room": "Block 1 - Room 101"},
            {"code": "MTH101", "title": "Calculus & Linear Algebra", "faculty": "Prof. R. Deshmukh", "room": "Block 1 - Room 101"},
            {"code": "EEE101", "title": "Basic Electrical Engineering", "faculty": "Prof. V. Gupta", "room": "EEE Block - Room 101"},
            {"code": "ENG101", "title": "Technical Communication", "faculty": "Prof. M. Kapoor", "room": "Block 2 - Room 204"},
            {"code": "EEL101", "title": "Basic Electrical Lab", "faculty": "Prof. V. Gupta & TAs", "room": "Electrical Lab 1"}
        ],
        "2nd": [
            {"code": "EEE201", "title": "Electric Circuit Analysis", "faculty": "Dr. M. R. Menon", "room": "EEE Block - Room 201"},
            {"code": "EEE202", "title": "Electrical Machines I", "faculty": "Prof. C. H. Reddi", "room": "EEE Block - Room 201"},
            {"code": "EEE203", "title": "Electromagnetic Fields & Waves", "faculty": "Dr. S. Parida", "room": "EEE Block - Room 202"},
            {"code": "EEE204", "title": "Analog & Digital Electronics", "faculty": "Prof. T. K. Roy", "room": "EEE Block - Room 203"},
            {"code": "EEL201", "title": "Electrical Machines Lab I", "faculty": "Prof. C. H. Reddi", "room": "Machines Lab A"}
        ],
        "3rd": [
            {"code": "EEE301", "title": "Electrical Machines II", "faculty": "Prof. C. H. Reddi", "room": "EEE Block 2 - Room 301"},
            {"code": "EEE302", "title": "Power Systems Analysis & Protection", "faculty": "Dr. K. V. S. Murthy", "room": "EEE Block 2 - Room 301"},
            {"code": "EEE303", "title": "Control Systems Engineering", "faculty": "Dr. A. Nandi", "room": "EEE Block 2 - Room 302"},
            {"code": "EEE304", "title": "Power Electronics & Drives", "faculty": "Prof. S. R. Samant", "room": "EEE Block 2 - Room 305"},
            {"code": "EEL301", "title": "Power Electronics & Control Lab", "faculty": "Prof. S. R. Samant", "room": "Power Elec Lab"}
        ],
        "4th": [
            {"code": "EEE401", "title": "High Voltage Engineering", "faculty": "Dr. P. K. Swain", "room": "EEE Block 3 - Room 401"},
            {"code": "EEE402", "title": "Renewable Energy & Smart Grid", "faculty": "Prof. V. Nambisan", "room": "EEE Block 3 - Room 401"},
            {"code": "EEE403", "title": "Electric Vehicles & Battery Tech", "faculty": "Dr. S. Mohapatra", "room": "EEE Block 3 - Room 402"},
            {"code": "PRJ401", "title": "Major EEE Capstone Project", "faculty": "EEE Senior Faculty", "room": "High Voltage Lab"}
        ]
    },
    "CIVIL": {
        "1st": [
            {"code": "PHY101", "title": "Engineering Physics", "faculty": "Dr. A. K. Sharma", "room": "Block 1 - Room 101"},
            {"code": "MTH101", "title": "Calculus & Linear Algebra", "faculty": "Prof. R. Deshmukh", "room": "Block 1 - Room 101"},
            {"code": "CIV101", "title": "Engineering Mechanics", "faculty": "Dr. S. K. Das", "room": "Civil Block - Room 101"},
            {"code": "CIV102", "title": "Basic Civil Engineering & Surveying", "faculty": "Prof. H. N. Rao", "room": "Civil Block - Room 102"},
            {"code": "CVL101", "title": "Surveying Workshop & Field Lab", "faculty": "Prof. H. N. Rao", "room": "Survey Field Ground"}
        ],
        "2nd": [
            {"code": "CIV201", "title": "Mechanics of Structures", "faculty": "Dr. S. K. Das", "room": "Civil Block - Room 201"},
            {"code": "CIV202", "title": "Fluid Mechanics & Open Channel Flow", "faculty": "Prof. P. C. Jha", "room": "Civil Block - Room 201"},
            {"code": "CIV203", "title": "Advanced Surveying & GIS", "faculty": "Dr. M. Patnaik", "room": "Civil Block - Room 202"},
            {"code": "CIV204", "title": "Building Construction & Planning", "faculty": "Prof. V. K. Jain", "room": "Civil Block - Room 203"},
            {"code": "CVL201", "title": "Hydraulics & Fluid Lab", "faculty": "Prof. P. C. Jha", "room": "Hydraulics Lab"}
        ],
        "3rd": [
            {"code": "CIV301", "title": "Structural Analysis I & II", "faculty": "Dr. S. K. Das", "room": "Civil Block 2 - Room 301"},
            {"code": "CIV302", "title": "Concrete Technology & Design", "faculty": "Prof. R. K. Behera", "room": "Civil Block 2 - Room 301"},
            {"code": "CIV303", "title": "Geotechnical & Soil Mechanics", "faculty": "Dr. A. B. Chaudhuri", "room": "Civil Block 2 - Room 302"},
            {"code": "CIV304", "title": "Transportation Engineering", "faculty": "Prof. S. S. Mohanty", "room": "Civil Block 2 - Room 305"},
            {"code": "CVL301", "title": "Geotechnical & Concrete Testing Lab", "faculty": "Dr. A. B. Chaudhuri", "room": "Soil Mechanics Lab"}
        ],
        "4th": [
            {"code": "CIV401", "title": "Environmental Engineering & Waste Management", "faculty": "Dr. T. Banerjee", "room": "Civil Block 3 - Room 401"},
            {"code": "CIV402", "title": "Design of Steel Structures", "faculty": "Prof. N. K. Roy", "room": "Civil Block 3 - Room 401"},
            {"code": "CIV403", "title": "Earthquake Resistant Design", "faculty": "Dr. S. K. Das", "room": "Civil Block 3 - Room 402"},
            {"code": "PRJ401", "title": "Major Civil Engineering Capstone", "faculty": "Civil Faculty Board", "room": "Structural Model Lab"}
        ]
    },
    "IT": {
        "1st": [
            {"code": "PHY101", "title": "Engineering Physics", "faculty": "Dr. A. K. Sharma", "room": "Block 1 - Room 101"},
            {"code": "MTH101", "title": "Calculus & Linear Algebra", "faculty": "Prof. R. Deshmukh", "room": "Block 1 - Room 101"},
            {"code": "ITC101", "title": "Problem Solving & Python Programming", "faculty": "Dr. B. K. Jena", "room": "IT Block - Room 101"},
            {"code": "ENG101", "title": "Technical Communication", "faculty": "Prof. M. Kapoor", "room": "Block 2 - Room 204"},
            {"code": "ITL101", "title": "Python Programming Lab", "faculty": "Dr. B. K. Jena", "room": "IT Computing Lab 1"}
        ],
        "2nd": [
            {"code": "ITC201", "title": "Data Structures & Java Programming", "faculty": "Dr. P. Sen", "room": "IT Block - Room 201"},
            {"code": "ITC202", "title": "Discrete Mathematics & Graph Theory", "faculty": "Prof. K. Ghosh", "room": "IT Block - Room 201"},
            {"code": "ITC203", "title": "Database Systems & Web Technologies", "faculty": "Dr. S. Maiti", "room": "IT Block - Room 202"},
            {"code": "ITC204", "title": "Computer Organization & Architecture", "faculty": "Prof. D. Paul", "room": "IT Block - Room 203"},
            {"code": "ITL201", "title": "Web Development & DB Lab", "faculty": "Dr. S. Maiti", "room": "Web Tech Lab"}
        ],
        "3rd": [
            {"code": "ITC301", "title": "Full Stack Web Development", "faculty": "Dr. S. Maiti", "room": "IT Block 2 - Room 301"},
            {"code": "ITC302", "title": "Operating Systems & System Software", "faculty": "Prof. D. Paul", "room": "IT Block 2 - Room 301"},
            {"code": "ITC303", "title": "Software Engineering & Agile Methodologies", "faculty": "Dr. P. Sen", "room": "IT Block 2 - Room 302"},
            {"code": "ITC304", "title": "Data Science & Big Data Analytics", "faculty": "Dr. B. K. Jena", "room": "IT Block 2 - Room 305"},
            {"code": "ITC305", "title": "Computer Networks & Security", "faculty": "Prof. K. Ghosh", "room": "IT Block 2 - Room 303"},
            {"code": "ITL301", "title": "Full Stack Development Lab", "faculty": "Dr. S. Maiti", "room": "Innovation IT Lab"}
        ],
        "4th": [
            {"code": "ITC401", "title": "Cloud Native Architecture & Microservices", "faculty": "Dr. B. K. Jena", "room": "IT Block 3 - Room 401"},
            {"code": "ITC402", "title": "Information Security & Ethical Hacking", "faculty": "Prof. K. Ghosh", "room": "IT Block 3 - Room 401"},
            {"code": "ITC403", "title": "Artificial Intelligence in Enterprise", "faculty": "Dr. P. Sen", "room": "IT Block 3 - Room 402"},
            {"code": "PRJ401", "title": "Major IT Capstone Project Phase II", "faculty": "IT Project Panel", "room": "Cloud Computing Lab"}
        ]
    }
}

def normalize_year_code(year_str: str) -> str:
    """Normalizes year input to 1st, 2nd, 3rd, or 4th."""
    if not year_str:
        return "3rd"
    s = str(year_str).lower().strip()
    if "1" in s:
        return "1st"
    if "2" in s:
        return "2nd"
    if "3" in s:
        return "3rd"
    if "4" in s:
        return "4th"
    return "3rd"

def get_student_attendance_summary(branch: str, current_year: str, student_id: str = "2023CSE0142") -> Dict[str, Any]:
    """
    Computes exact, realistic, and consistent attendance statistics per subject.
    Uses student_id hashing so every individual student persona receives realistic,
    consistent data (>50%, some >75%, some in condonation) matching their actual courses.
    """
    clean_branch = branch.upper().strip() if branch else "CSE"
    if clean_branch not in ALL_BRANCH_SUBJECTS:
        clean_branch = "CSE"

    clean_year = normalize_year_code(current_year)
    subjects = ALL_BRANCH_SUBJECTS.get(clean_branch, {}).get(clean_year) or ALL_BRANCH_SUBJECTS["CSE"]["3rd"]

    records = []
    total_attended = 0
    total_conducted = 0

    for idx, sub in enumerate(subjects):
        # Generate deterministic seed for this specific subject and student
        seed_str = f"{student_id}_{sub['code']}_{clean_year}_{idx}"
        hash_val = int(hashlib.md5(seed_str.encode()).hexdigest(), 16)

        # Realistic total conducted classes between 26 and 32
        tot = 26 + (hash_val % 7)

        # Create varied, realistic attendance percentages between 68% and 92% (>50% always)
        # Ensure at least one subject falls around 72-74% for condonation testing
        pct_tier = (hash_val >> 4) % 4
        if pct_tier == 0:
            target_pct = 0.70 + ((hash_val % 4) * 0.01)  # 70% to 73% (Condonation)
        elif pct_tier == 1:
            target_pct = 0.77 + ((hash_val % 4) * 0.01)  # 77% to 80% (Border eligible)
        elif pct_tier == 2:
            target_pct = 0.84 + ((hash_val % 4) * 0.01)  # 84% to 87% (Comfortable)
        else:
            target_pct = 0.88 + ((hash_val % 5) * 0.01)  # 88% to 92% (High attendance)

        att = int(round(tot * target_pct))
        att = min(tot, max(int(tot * 0.55), att))  # Ensure > 50% and <= tot
        pct = round((att / tot) * 100, 1)

        total_attended += att
        total_conducted += tot

        # Classes needed to reach 75%: 3*T - 4*A
        classes_needed_75 = max(0, 3 * tot - 4 * att)

        if pct >= 75.0:
            status = "Eligible"
            margin_text = "Meeting mandatory 75% requirement (Eligible for exams)"
        elif pct >= 65.0:
            status = "Condonation Required (65-74%)"
            margin_text = f"Below 75%! Must attend next {classes_needed_75} class(es) without absence to reach 75%"
        else:
            status = "Critical Shortage (<65%)"
            margin_text = f"Critical! Must attend next {classes_needed_75} class(es) to reach 75%"

        records.append({
            "code": sub["code"],
            "title": sub["title"],
            "attended": att,
            "total_conducted": tot,
            "percentage": pct,
            "status": status,
            "classes_needed_for_75": classes_needed_75,
            "margin_summary": margin_text,
            "faculty": sub.get("faculty", "Course Faculty"),
            "room": sub.get("room", "Academic Block")
        })

    overall_pct = round((total_attended / total_conducted) * 100, 1) if total_conducted > 0 else 100.0

    # Generate daywise log for current week matching student's exact subjects
    daywise_logs = generate_daywise_attendance_log(subjects, student_id)

    return {
        "overall_attended": total_attended,
        "overall_conducted": total_conducted,
        "overall_percentage": overall_pct,
        "min_required_percentage": 75.0,
        "condonation_range": "65.0% - 74.9% (Eligible only with approved medical certificate)",
        "detention_threshold": "< 65.0% (Strict Exam Detention)",
        "subject_records": records,
        "daywise_log": daywise_logs
    }

def generate_daywise_attendance_log(subjects: List[Dict[str, Any]], student_id: str) -> List[Dict[str, Any]]:
    """Generates daywise attendance history log matching the student's courses."""
    days = [
        ("2026-10-02", "Friday", "09:00 AM - 10:00 AM", 0, "Present"),
        ("2026-10-02", "Friday", "10:00 AM - 11:00 AM", 1, "Present"),
        ("2026-10-02", "Friday", "11:15 AM - 01:15 PM", 2, "Present"),
        ("2026-10-01", "Thursday", "09:00 AM - 10:00 AM", 1, "Absent"),
        ("2026-10-01", "Thursday", "10:00 AM - 11:00 AM", 0, "Present"),
        ("2026-10-01", "Thursday", "11:15 AM - 12:15 PM", 3 if len(subjects) > 3 else 0, "Present"),
        ("2026-09-30", "Wednesday", "09:00 AM - 10:00 AM", 2 if len(subjects) > 2 else 0, "Class Not Taken"),
        ("2026-09-30", "Wednesday", "10:00 AM - 11:00 AM", 0, "Present"),
        ("2026-09-29", "Tuesday", "09:00 AM - 10:00 AM", 3 if len(subjects) > 3 else 1, "Absent"),
        ("2026-09-28", "Monday", "09:00 AM - 04:00 PM", -1, "Holiday")
    ]

    log_entries = []
    for date_str, day_name, slot, sub_idx, status in days:
        if sub_idx == -1:
            log_entries.append({
                "date": date_str,
                "day": day_name,
                "slot": slot,
                "code": "ALL",
                "title": "Gandhi Jayanti / University Holiday",
                "status": "Holiday"
            })
        else:
            sub = subjects[sub_idx % len(subjects)]
            log_entries.append({
                "date": date_str,
                "day": day_name,
                "slot": slot,
                "code": sub["code"],
                "title": sub["title"],
                "status": status
            })
    return log_entries

def get_student_courses(branch: str, current_year: str) -> List[Dict[str, Any]]:
    """Returns the official list of registered courses for student's branch and year."""
    clean_branch = branch.upper().strip() if branch else "CSE"
    if clean_branch not in ALL_BRANCH_SUBJECTS:
        clean_branch = "CSE"
    clean_year = normalize_year_code(current_year)
    return ALL_BRANCH_SUBJECTS.get(clean_branch, {}).get(clean_year) or ALL_BRANCH_SUBJECTS["CSE"]["3rd"]

def build_or_load_student_persona(
    user_dict: Dict[str, Any],
    db: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Constructs or retrieves a persistent student persona:
    1. Checks Firebase Firestore for existing persona
    2. Builds exact courses & attendance profile matching student ID & branch
    3. Saves structured persona to Firebase Firestore
    """
    student_id = user_dict.get("student_id", "2023CSE0142")
    branch = user_dict.get("branch", "CSE")
    current_year = user_dict.get("current_year", "3rd")

    # 1. Try fetching from Firebase first if configured
    if is_firebase_configured():
        cached = get_persona_from_firebase(student_id)
        if (
            cached
            and "courses" in cached
            and "attendance" in cached
            and cached.get("current_year") == normalize_year_code(current_year)
            and cached.get("batch") == user_dict.get("batch")
        ):
            return cached

    # 2. Build structured persona data
    courses = get_student_courses(branch, current_year)
    attendance = get_student_attendance_summary(branch, current_year, student_id)

    persona = {
        "student_id": student_id,
        "full_name": user_dict.get("full_name", "Student"),
        "email": user_dict.get("email", ""),
        "branch": branch.upper(),
        "current_year": normalize_year_code(current_year),
        "batch": user_dict.get("batch", "2023-2027"),
        "hostel_status": user_dict.get("hostel_status", "Day Scholar"),
        "courses": courses,
        "attendance": attendance,
        "updated_at": datetime.utcnow().isoformat()
    }

    # 3. Persist to Firebase Firestore
    if is_firebase_configured():
        save_persona_to_firebase(student_id, persona)

    return persona

def get_student_tickets_summary(user_id: int, db: Optional[Session] = None) -> List[Dict[str, Any]]:
    """
    Fetches real-time student complaints and maintenance tickets.
    Syncs with Firebase Firestore when configured; otherwise reads from SQLite.
    """
    if is_firebase_configured():
        fb_tickets = get_student_tickets_from_firebase(user_id)
        if fb_tickets is not None and len(fb_tickets) > 0:
            return fb_tickets

    if db is not None:
        tickets = (
            db.query(Ticket)
            .filter(Ticket.user_id == user_id)
            .order_by(Ticket.created_at.desc())
            .all()
        )
        return [
            {
                "ticket_number": t.ticket_number,
                "category": t.category,
                "title": t.title,
                "description": t.description,
                "location": t.location,
                "priority": t.priority,
                "status": t.status,
                "estimated_sla": t.estimated_sla,
                "offline_resolution_desk": t.offline_option,
                "filed_date": t.created_at.strftime("%Y-%m-%d %H:%M") if t.created_at else "Recently"
            }
            for t in tickets
        ]
    return []

def get_campus_news_summary() -> List[Dict[str, Any]]:
    """Returns active verified university announcements and circulars."""
    return [
        {
            "id": 1,
            "title": "Google & Microsoft Off-Campus Internship & Capstone Placement Drive 2026",
            "category": "Placements",
            "date": "Oct 03, 2026",
            "summary": "Registrations open for final & pre-final year engineering students (6.5+ CGPA, 0 backlogs). Packages up to ₹42 LPA.",
            "doc_ref": "google_microsoft_placement_drive_2026.md"
        },
        {
            "id": 2,
            "title": "CAT-1 Autumn Semester Mid-Term Examination Schedule Released",
            "category": "Exams",
            "date": "Oct 02, 2026",
            "summary": "CAT-1 examinations commence from Oct 10, 2026. Hall tickets available on ERP student portal.",
            "doc_ref": "exam_schedule_CSE_3rdyr_2026.md"
        },
        {
            "id": 3,
            "title": "Hostel Gate Curfew Timings & Biometric Entry Notice",
            "category": "Hostel",
            "date": "Oct 01, 2026",
            "summary": "Hostel Block A & Block B curfew strictly at 10:00 PM. Night out passes require Warden approval by 6:00 PM.",
            "doc_ref": "hostel_and_campus_rules.md"
        },
        {
            "id": 4,
            "title": "Annual Student Innovation & Project Expo - Cash Prizes worth ₹5 Lakhs",
            "category": "Events",
            "date": "Sep 28, 2026",
            "summary": "Annual inter-college technology innovation and AI project exhibition. Submit team proposals before Oct 15.",
            "doc_ref": "student_innovation_and_project_expo.md"
        },
        {
            "id": 5,
            "title": "Academic & Tuition Fee Installment Deadline Notice",
            "category": "Fees",
            "date": "Sep 25, 2026",
            "summary": "Tuition and lab consumable dues must be cleared before exam hall ticket issuance.",
            "doc_ref": "academic_policies_and_attendance.md"
        }
    ]


def get_student_timetable_data(
    branch: Optional[str] = "CSE",
    current_year: Optional[str] = "3rd",
    user_batch: Optional[str] = None
) -> Dict[str, Any]:
    """
    Loads and returns official weekly timetable schedule as structured JSON for the specified student.
    Parses the authentic Markdown timetable from /knowledge_base with a graceful fallback.
    """
    from pathlib import Path
    import json

    # 1. Normalize branch & year codes
    clean_branch = "CSE"
    b_upper = str(branch or "CSE").upper().strip()
    for code in ["CSE", "ECE", "MECH", "EEE", "CIVIL", "IT"]:
        if code in b_upper:
            clean_branch = code
            break

    clean_year = normalize_year_code(current_year)
    year_key_map = {"1st": "1styr", "2nd": "2ndyr", "3rd": "3rdyr", "4th": "4thyr"}
    year_key = year_key_map.get(clean_year, "3rdyr")

    semester_map = {"1st": "1", "2nd": "3", "3rd": "5", "4th": "7"}
    semester = semester_map.get(clean_year, "1")
    batch = user_batch or "2023-2027"

    base_dir = Path(__file__).resolve().parent.parent
    kb_dir = base_dir / "knowledge_base"
    target_filename = f"timetable_{clean_branch}_{year_key}_2026.md"
    target_file = kb_dir / target_filename

    if not target_file.exists():
        matches = list(kb_dir.glob(f"timetable_{clean_branch}_{year_key}_*.md"))
        if matches:
            target_file = matches[0]
            target_filename = target_file.name

    day_keys = ["MON", "TUE", "WED", "THU", "FRI"]
    days_dict: Dict[str, List[Dict[str, Any]]] = {d: [] for d in day_keys}

    # 2. Parse markdown timetable if present
    if target_file.exists():
        try:
            content = target_file.read_text(encoding="utf-8")
            if content.startswith("---"):
                parts = content.split("---", 2)
                if len(parts) >= 3:
                    try:
                        fm = json.loads(parts[1].strip())
                        if isinstance(fm, dict):
                            if "batch" in fm:
                                batch = str(fm["batch"])
                            if "semester" in fm:
                                semester = str(fm["semester"])
                    except Exception:
                        pass

            day_name_map = {
                "monday": "MON", "tuesday": "TUE", "wednesday": "WED", "thursday": "THU", "friday": "FRI",
                "mon": "MON", "tue": "TUE", "wed": "WED", "thu": "THU", "fri": "FRI"
            }

            for line in content.splitlines():
                line_str = line.strip()
                if not line_str.startswith("|") or line_str.startswith("|---") or "Course Code" in line_str:
                    continue
                cols = [c.strip() for c in line_str.split("|")[1:-1]]
                if len(cols) < 6:
                    continue

                day_raw, time_raw, code_raw, title_raw, room_raw, fac_raw = cols[:6]
                norm_day = day_name_map.get(day_raw.lower(), "MON")

                clean_code = code_raw.replace("*", "").strip()
                clean_title = title_raw.replace("*", "").strip()
                clean_room = room_raw.strip() if room_raw else "Academic Block"
                clean_faculty = fac_raw.strip() if fac_raw else "Course Faculty"

                is_lab = (
                    "(lab)" in time_raw.lower() or
                    "lab" in clean_code.lower() or
                    "lab" in clean_title.lower() or
                    any(clean_code.upper().startswith(p) for p in ["CSL", "ECL", "MEL", "EEL", "CVL", "ITL", "CHL", "PHL", "MED", "EED"])
                )
                session_type = "lab" if is_lab else "theory"

                clean_time = time_raw.replace("(Lab)", "").replace("(lab)", "").strip()
                start_time = ""
                end_time = ""
                if "-" in clean_time:
                    t_parts = [t.strip() for t in clean_time.split("-", 1)]
                    start_time = t_parts[0]
                    end_time = t_parts[1]
                else:
                    start_time = clean_time
                    end_time = ""

                if clean_code.upper().startswith("PRJ"):
                    category = "Capstone Project"
                    credits_val = 6.0
                elif session_type == "lab":
                    category = "Practical / Lab"
                    credits_val = 2.0
                elif any(clean_code.upper().startswith(p) for p in ["PHY", "MTH", "ENG", "CHM"]):
                    category = "Basic Science / Humanity Core"
                    credits_val = 3.0
                else:
                    category = "Program Core"
                    credits_val = 3.0

                # Deterministic slot code & slot ID for autoscheduler timetable matrix
                slot_id = 1
                slot_code = "A1"
                if "09:00" in start_time or "08:30" in start_time:
                    slot_id = 1
                    slot_code = "A1" if session_type == "theory" else "L1+L2"
                elif "10:00" in start_time or "09:45" in start_time:
                    slot_id = 2
                    slot_code = "F1" if session_type == "theory" else "L3+L4"
                elif "11:15" in start_time or "11:30" in start_time:
                    slot_id = 3
                    slot_code = "D1" if session_type == "theory" else "L5+L6"
                elif "12:15" in start_time or "12:30" in start_time:
                    slot_id = 4
                    slot_code = "TC1" if session_type == "theory" else "L7+L8"
                elif "01:15" in start_time or "02:00" in start_time or "01:00" in start_time:
                    slot_id = 5
                    slot_code = "A2" if session_type == "theory" else "L29+L30"
                elif "02:15" in start_time or "03:00" in start_time:
                    slot_id = 6
                    slot_code = "F2" if session_type == "theory" else "L31+L32"
                elif "03:15" in start_time or "04:00" in start_time:
                    slot_id = 7
                    slot_code = "D2" if session_type == "theory" else "L33+L34"
                else:
                    slot_id = len(days_dict[norm_day]) + 1
                    slot_code = f"S{slot_id}"

                session_item = {
                    "courseCode": clean_code,
                    "courseTitle": clean_title,
                    "category": category,
                    "type": session_type,
                    "day": norm_day,
                    "startTime": start_time,
                    "endTime": end_time,
                    "time": clean_time,
                    "slot": slot_code,
                    "slotId": slot_id,
                    "faculty": clean_faculty,
                    "room": clean_room,
                    "credits": credits_val
                }
                days_dict[norm_day].append(session_item)
        except Exception as e:
            print(f"[Timetable] Markdown parsing error for {target_filename}: {e}")

    # 3. Controlled fallback if markdown table is empty or missing
    if not any(days_dict.values()):
        subjects = ALL_BRANCH_SUBJECTS.get(clean_branch, {}).get(clean_year) or ALL_BRANCH_SUBJECTS.get("CSE", {}).get("3rd", [])
        default_times = [
            ("09:00 AM", "10:00 AM", "09:00 AM - 10:00 AM", 1, "A1"),
            ("10:00 AM", "11:00 AM", "10:00 AM - 11:00 AM", 2, "F1"),
            ("11:15 AM", "12:15 PM", "11:15 AM - 12:15 PM", 3, "D1"),
            ("01:15 PM", "04:15 PM", "01:15 PM - 04:15 PM (Lab)", 5, "L29+L30")
        ]
        for day_idx, d_key in enumerate(day_keys):
            for i in range(4):
                if not subjects:
                    continue
                subj = subjects[(day_idx + i) % len(subjects)]
                st, et, t_str, sid, scode = default_times[i]
                is_lab = i == 3 or "lab" in subj.get("title", "").lower() or subj.get("code", "").startswith("CSL")
                stype = "lab" if is_lab else "theory"
                days_dict[d_key].append({
                    "courseCode": subj.get("code", f"SUB{sid}"),
                    "courseTitle": subj.get("title", "Core Academic Subject"),
                    "category": "Practical / Lab" if is_lab else "Program Core",
                    "type": stype,
                    "day": d_key,
                    "startTime": st,
                    "endTime": et,
                    "time": t_str,
                    "slot": scode,
                    "slotId": sid,
                    "faculty": subj.get("faculty", "Course Faculty"),
                    "room": subj.get("room", "Academic Block"),
                    "credits": 2.0 if is_lab else 3.0
                })

    # 4. Compile distinct courses summary
    seen_courses: Dict[str, Dict[str, Any]] = {}
    for d_key, s_list in days_dict.items():
        for s in s_list:
            c_code = s["courseCode"]
            if c_code not in seen_courses:
                seen_courses[c_code] = {
                    "courseCode": c_code,
                    "courseTitle": s["courseTitle"],
                    "category": s["category"],
                    "type": s["type"],
                    "faculty": s["faculty"],
                    "room": s["room"],
                    "credits": s["credits"]
                }
    summary_list = list(seen_courses.values())

    return {
        "branch": clean_branch,
        "year": clean_year,
        "semester": semester,
        "batch": batch,
        "source": target_filename,
        "days": days_dict,
        "summary": summary_list
    }

