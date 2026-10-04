# CampusMind AI
### Hyper-Personalized, Multilingual AI Copilot for College Students

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-Vector_Store-FF6F00?style=flat)](https://www.trychroma.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=flat&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Gemini](https://img.shields.io/badge/Google_Gemini-3.8_Flash-4285F4?style=flat&logo=google&logoColor=white)](https://ai.google.dev/)

---

## Overview

CampusMind AI is a production-ready, full-stack university copilot engineered to eliminate campus information fragmentation. Instead of functioning as a generic chatbot, CampusMind AI delivers zero-hallucination, 100% source-grounded answers tailored directly to each student's enrolled branch, academic year, admission batch, and residential status.

Every academic inquiry is dynamically mapped to institutional circulars, regulatory clauses, and curriculum blueprints with interactive citation badges and document viewing.

---

## Core Capabilities

### 1. Dual-Path Cognitive Engine
- **Instant Small-Talk Routing (<0.06s):** Standard greetings ("hi", "good morning", "who are you?"), gratitude, and basic conversational pleasantries execute immediately via regex/keyword routing without calling LLM APIs or vector stores.
- **Deep Institutional RAG:** Real campus questions dynamically invoke a metadata-filtered ChromaDB vector search against 199 institutional policy documents and syllabi.

### 2. Hyper-Personalized Zero-Shot Context Injection
- Automatically integrates 9 student attributes upon login:
  - **Full Name and Roll Number / Student ID**
  - **Branch:** Computer Science (CSE), Electronics (ECE), Mechanical (MECH), Electrical (EEE), Civil (CIVIL), Information Technology (IT)
  - **Academic Year:** 1st, 2nd, 3rd, 4th Year
  - **Admission Batch:** 2024-2028, 2023-2027, 2022-2026
  - **Residence:** Day Scholar, Hostel Block A, Hostel Block B
  - **Contact Details:** Email, Phone Number
- **Silent Persona Handshake:** Academic context is passed directly to the generation prompt, ensuring the copilot never asks repetitive intake questions.

### 3. Source-Backed Answers with Document Viewer
- Every institutional response includes grounded citations referencing official regulations.
- Interactive citation pills allow students to review exact clauses, issue dates, issuing authorities, and full markdown document source files directly inside the application.

### 4. Real-Time Student Analytics & Grievance Actions
- **Live Attendance Dashboard:** Displays subject-by-subject attendance percentages with immediate regulatory warnings (75% mandatory threshold, 65%-74% medical condonation).
- **Automated Grievance Management:** Generates formal academic and hostel support tickets with tracking IDs, category tagging, and severity escalation.
- **Official Campus Gazette:** Displays campus news, Wi-Fi maintenance alerts, exam circulars, and placement drives.

### 5. Multilingual Natural Language Support
- Native prompt parsing and response generation for English, Hindi, Telugu, Tamil, Spanish, French, and German.
- Queries submitted in regional languages are matched against institutional policies and translated back into the student's chosen language.

### 6. Resilient Model Fallback Architecture
- Primary generative model: **Google Gemini 3.8 Flash**.
- Resilient multi-tier failover (`gemini-3.8-flash` -> `gemini-3.7-flash` -> `gemini-3.6-flash` -> `gemini-3.5-flash-lite` -> `gemini-2.5-flash`) ensures uninterrupted uptime even during peak usage or API rate limits.

---

## System Architecture

```
                          +------------------------+
                          |   React + Vite UI      |
                          | (Modern Glassmorphic)  |
                          +-----------+------------+
                                      | HTTP / JSON (JWT Auth)
                                      v
                          +------------------------+
                          |    FastAPI Backend     |
                          +-----+------------+-----+
                                |            |
                Fast Route (<0.06s)          | Academic RAG
                                |            v
            +-------------------+--+  +------------------------+
            | Instant Response     |  | Metadata Filtered RAG  |
            | (Greetings & Casual) |  |  Branch + Year Filter  |
            +----------------------+  +-----------+------------+
                                                  |
                                      +-----------+------------+
                                      |  ChromaDB Vector Store |
                                      | 199 Docs / 958 Chunks  |
                                      +-----------+------------+
                                                  |
                                      +-----------v------------+
                                      | Google Gemini Flash    |
                                      | (Zero Hallucination)   |
                                      +------------------------+
```

The knowledge base is built from official institutional documents in `knowledge_base/`:
- **Examination Schedules:** Odd and Even semester schedules for all branches and academic years.
- **Curricula & Syllabi:** Course structures, credit allocations, and recommended textbooks.
- **Tuition & Hostel Fee Tables:** Differentiated fee schedules per branch, batch, and hostel block.
- **Academic & Attendance Policies:** 75% attendance rule, condonation procedures, and grading criteria.
- **Campus & Hostel Regulations:** Curfews, entry-exit timings, and Wi-Fi policies.
- **Placement & Internship Guidelines:** CGPA eligibility thresholds and company tier classifications.

---

## Universal Suggested Inquiries

Every student profile (new users, demo profiles, and custom accounts) is provided with 4 default inquiries:
1. Current attendance status of every subjects.
2. Provide syllabus of this sem of mine and a tailored roadmap to achieve 9+ gpa.
3. Any recent placement updates?
4. Hostel Wi-Fi high packet loss status and maintenance update

---

## Technology Stack

- **Frontend:** React 19, Vite 8, Tailwind CSS, Lucide React, Zustand, Framer Motion, React Markdown, Remark GFM
- **Backend:** FastAPI, Python 3.11+, SQLAlchemy, SQLite, Pydantic v2, Passlib (Bcrypt), PyJWT, Firebase Admin SDK
- **Vector Database:** ChromaDB (pre-indexed persistent SQLite store with 958 embeddings)
- **Cloud Infrastructure:** Render (FastAPI Backend), Vercel (React Frontend CDN), Firebase Firestore (Student Personas)

---

## Getting Started

### Prerequisites
- Node.js (v18 or higher) and npm
- Python (v3.10 or higher)
- Google Gemini API Key (available from Google AI Studio)

---

### Step 1: Clone Repository
```bash
git clone https://github.com/rohith-m06/campus-AI.git
cd campus-AI
```

---

### Step 2: Automated Launch (Local Development)

#### On Windows:
Double-click `run_app.bat` or run:
```bat
.\run_app.bat
```

#### On macOS / Linux:
```bash
chmod +x run_app.sh && ./run_app.sh
```

---

### Step 3: Manual Installation

#### Backend Configuration
1. Create and activate a Python virtual environment:
   ```bash
   python -m venv backend/venv
   
   # Windows:
   backend\venv\Scripts\activate
   # macOS / Linux:
   source backend/venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```

3. Configure environment variables in `.env` and `backend/.env`:
   ```env
   GOOGLE_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-3.8-flash
   JWT_SECRET=your_jwt_secret_key_here
   ACCESS_TOKEN_EXPIRE_MINUTES=1440
   ```

4. Start the FastAPI backend:
   ```bash
   python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
   ```
   Interactive Swagger documentation will be available at `http://127.0.0.1:8000/docs`.

#### Frontend Configuration
1. In a separate terminal, navigate to the frontend directory:
   ```bash
   cd frontend
   npm install
   ```

2. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:5173/`.

---

### Step 4: Verification Tests

Run the automated test suite to verify RAG grounding, routing, and document availability:
```bash
# Windows:
backend\venv\Scripts\python.exe tests/test_rag.py
backend\venv\Scripts\python.exe tests/test_e2e.py
backend\venv\Scripts\python.exe tests/test_docs_and_queries.py

# macOS / Linux:
python tests/test_rag.py
python tests/test_e2e.py
python tests/test_docs_and_queries.py
```

---

## Evaluator Profiles

Pre-configured demo profiles for testing role-based personalization:

| Profile | Academic Details | Focus Area |
| :--- | :--- | :--- |
| **Arjun Sharma** | CSE, 1st Year, Hostel Block A | First-year computer science syllabus, programming lab requirements, and hostel dining schedules. |
| **Priya Patel** | ECE, 2nd Year, Day Scholar | Core electronics curriculum, exam timetables, and off-campus commuter transport schedules. |
| **Rahul Verma** | MECH, 3rd Year, Hostel Block B | Capstone engineering projects, pre-placement eligibility, and industrial internship policies. |

---

## Deployment Architecture

### Backend (Render)
- Configured via `render.yaml`.
- The pre-indexed `chroma_db/` (8 MB SQLite database containing 958 chunks) is tracked in the repository to eliminate build-time ingestion memory overhead, keeping memory usage around 110 MB (safely within free-tier limits).

### Frontend (Vercel)
- Configured via `vercel.json` with API rewrite proxies pointing to `https://campus-ai-8t9z.onrender.com/api/:path*`.
- Production bundle includes dynamic client-side caching to guarantee sub-second cold starts.

---

## Repository Structure

```
campus-AI/
|-- .env.example                            # Root environment configuration template
|-- .gitignore                              # Git tracking rules (whitelists pre-built vector DB)
|-- README.md                               # System documentation
|-- render.yaml                             # Cloud deployment configuration for Render
|-- vercel.json                             # Production routing & proxy rules for Vercel
|-- ingest_data.py                          # Vector database ingestion engine
|
|-- backend/
|   |-- auth.py                             # JWT token generation & password encryption
|   |-- chroma_db/                          # Pre-built ChromaDB vector store (958 chunks)
|   |-- database.py                         # SQLAlchemy database initialization
|   |-- firebase_config.py                  # Firebase Firestore connection handler
|   |-- main.py                             # FastAPI endpoints & student routing
|   |-- models.py                           # Relational user & ticket models
|   |-- rag_engine.py                       # Zero-hallucination RAG & fallback logic
|   |-- requirements.txt                    # Python package dependencies
|   `-- schemas.py                          # Pydantic request & response validation
|
|-- frontend/
|   |-- index.html                          # Single-page application entry point
|   |-- package.json                        # Node dependencies & build scripts
|   |-- vite.config.js                      # Vite build configuration
|   `-- src/
|       |-- App.jsx                         # Main router & authentication gates
|       |-- components/
|       |   |-- CampusNewsModal.jsx         # Circulars & official gazette viewer
|       |   `-- DocumentModal.jsx           # Institutional policy clause inspector
|       |-- pages/
|       |   |-- AuthPage.jsx                # Onboarding & demo profile selector
|       |   `-- ChatPage.jsx                # Copilot interface & source citation panels
|       |-- services/
|       |   `-- api.js                      # API communication layer with timeout guards
|       `-- store/
|           `-- authStore.js                # State management for authenticated student
|
|-- knowledge_base/                         # 199 Institutional Policy & Curriculum Documents
`-- tests/                                  # Automated integration & verification tests
```

---

## License

Distributed under the [MIT License](LICENSE).
