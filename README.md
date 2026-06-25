# WhosHere

WhosHere is a face-verified attendance platform built for day-to-day academic operations. It combines a FastAPI backend, a Next.js frontend, and PostgreSQL storage to support student onboarding, live attendance capture, admin review workflows, leave handling, and operational audit trails.

The project is designed around a simple rule: attendance should be easy to use, but difficult to fake. Student check-in uses live camera capture, location verification, duplicate protection, and an admin-reviewed fallback flow when automated verification cannot complete.

## Core features

- Separate admin and student portals
- Student onboarding with generated student IDs and three-pose face enrollment
- Face profile completeness tracking for left, center, and right poses
- Live attendance capture with:
  - automatic front-camera start
  - five-second hold before capture
  - geofence validation
  - location accuracy checks
  - same-day duplicate prevention
- Fallback attendance request flow for camera, location, recognition, or device issues
- Admin review queue for fallback requests
- Attendance review trail with required review notes for admin changes
- Attendance filtering, status updates, deletion controls, and CSV export
- Leave request submission and approval
- Admin dashboard with summary metrics and follow-up queues
- Audit logs for authentication and operational actions
- Admin account management

## Attendance integrity controls

WhosHere currently enforces several checks during student check-in:

- The camera opens automatically on the attendance page.
- The student must stay in frame for a minimum live hold period before capture.
- The backend validates the submitted location against a configured geofence.
- Poor GPS accuracy is rejected before attendance is marked.
- Attendance is tied to the authenticated student session.
- If the live check fails, the student can submit a fallback request for manual review instead of bypassing the workflow.

## Tech stack

- Frontend: Next.js 16, React 19, Tailwind CSS 4
- Backend: FastAPI, SQLAlchemy
- Database: PostgreSQL
- Face recognition: OpenCV YuNet + SFace

## Product areas

### Public pages

- `/`
- `/features`
- `/how-it-works`
- `/login`

### Student portal

- `/student`
- `/student/capture`
- `/student/history`
- `/student/leave`
- `/student/profile`

### Admin portal

- `/admin`
- `/admin/register`
- `/admin/directory`
- `/admin/attendance`
- `/admin/leave`
- `/admin/logs`
- `/admin/admin-directory`

## Project structure

```text
WhosHere/
|-- backend/
|   |-- app/
|   |   |-- routers/                 # API route modules
|   |   |-- attendance.py            # attendance rules and filtering
|   |   |-- attendance_reviews.py    # review-trail helpers
|   |   |-- fallback_requests.py     # fallback attendance helpers
|   |   |-- face_profiles.py         # multi-pose face profile handling
|   |   |-- models.py                # SQLAlchemy models
|   |   |-- students.py              # student serialization and helpers
|   |   `-- ...
|   |-- uploads/                     # stored face images
|   |-- main.py                      # backend entrypoint
|   `-- requirements.txt
|-- frontend/
|   |-- app/
|   |   |-- admin/                   # admin pages and helpers
|   |   |-- student/                 # student pages and helpers
|   |   `-- ...
|   `-- package.json
`-- README.md
```

## Environment setup

This project uses PostgreSQL only. The backend will not start without a valid `DATABASE_URL`.

Create a root `.env` file from `.env.example` and set values for your environment:

```env
# Backend
DATABASE_URL=postgresql://whoshere_user:whoshere_password@127.0.0.1:5432/whoshere
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ATTENDANCE_CAPTURE_MIN_HOLD_SECONDS=5
ATTENDANCE_GEOFENCE_LATITUDE=
ATTENDANCE_GEOFENCE_LONGITUDE=
ATTENDANCE_GEOFENCE_RADIUS_METERS=150
ATTENDANCE_GEOFENCE_MAX_ACCURACY_METERS=100

# Frontend
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

Notes:

- `ADMIN_USERNAME` and `ADMIN_PASSWORD` are used to bootstrap the first admin account.
- Geofence latitude and longitude must be configured for live attendance marking to work.
- The frontend reads `NEXT_PUBLIC_API_BASE_URL` to connect to the backend API.

## Running the project locally

### 1) Start PostgreSQL

Create a database that matches `DATABASE_URL`.

### 2) Start the backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend URLs:

- API: `http://127.0.0.1:8000`
- Swagger docs: `http://127.0.0.1:8000/docs`

### 3) Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:

- App: `http://127.0.0.1:3000`

## Bootstrap and schema behavior

On backend startup, the application:

- creates missing tables
- ensures required student schema fields exist
- backfills student codes when needed
- bootstraps the first admin account
- backfills legacy student face data into the multi-pose face profile model

At the moment, the project initializes schema directly at startup instead of using a separate migration tool. If you pull new backend changes into an existing environment, restart the backend so new tables and backfills can run.

## Login behavior

- Admins sign in with admin credentials.
- Students sign in with their generated student ID and password.
- If the admin leaves the password blank during registration, the initial student password becomes the student ID.
- Student passwords are hashed before storage.
- Students can update their own password from the profile page.

## Typical workflow

1. Start PostgreSQL, the backend, and the frontend.
2. Sign in as an admin.
3. Register a student with left, center, and right face images.
4. Review the student directory to confirm the face set is complete.
5. Sign in as the student and open the attendance capture page.
6. Allow camera and location access.
7. Hold steady for the live capture and let the system submit attendance automatically.
8. If live verification fails, submit a fallback attendance request.
9. Return to the admin portal to review attendance, leave requests, fallback requests, and logs.

## Admin capabilities at a glance

- Dashboard metrics and follow-up lists
- Student registration and profile updates
- Face profile removal by pose
- Attendance review, correction, deletion, and export
- Review trail visibility for attendance decisions
- Leave request approval and rejection
- Audit log review
- Admin account directory and password management

## Student capabilities at a glance

- Live attendance capture
- Attendance history
- Leave request submission
- Fallback attendance request submission and status tracking
- Profile review and password change

## Development checks

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

Backend syntax check:

```bash
Get-ChildItem backend\app,backend\scripts -Recurse -Filter *.py | ForEach-Object { python -m py_compile $_.FullName }
```

## Storage notes

- Uploaded face images are stored in `backend/uploads`.
- The backend serves uploaded files from `/uploads`.
- Attendance exports are generated as CSV from the admin attendance page.

## Current scope

WhosHere is already usable as an internal attendance system, but it still follows a straightforward local-deployment model. It is best suited for classroom, lab, training, or pilot deployments where the team wants face-based attendance, reviewable admin workflows, and a simple operational setup without a large infrastructure footprint.
