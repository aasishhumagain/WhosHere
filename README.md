# WhosHere

WhosHere is a face-recognition attendance system built with FastAPI, SQLite or PostgreSQL, and Next.js. It includes student login, admin login, student registration with face images, attendance marking, duplicate-attendance prevention, leave requests, and admin dashboards for managing students, attendance, and leave records.

## Features

- Backend-backed admin login instead of a frontend-only hardcoded password.
- Student registration, editing, deletion, and photo preview support.
- Student directory sorting in ascending or descending order.
- Face-image preview while uploading and a student edit popup with the saved photo.
- Attendance marking by file upload or live camera capture.
- Duplicate attendance prevention so a student cannot be marked present multiple times in one day.
- Attendance management APIs and admin tools for updating or deleting attendance records.
- Leave request creation for students and leave request review for admins.
- Profile details for students including email, join date, and stored face image.
- Database configuration that supports SQLite by default and a real PostgreSQL migration path through environment variables and a copy script.

## Tech Stack

- Frontend: Next.js 16, React 19, Tailwind CSS 4
- Backend: FastAPI, SQLAlchemy
- Face recognition: OpenCV Haar cascade plus encoded grayscale comparison
- Database: SQLite by default, PostgreSQL support through `DATABASE_URL` and a migration script

## Project Structure

```text
WhosHere/
|-- backend/
|   |-- app/
|   |   |-- database.py
|   |   |-- face_utils.py
|   |   `-- models.py
|   |-- uploads/
|   |-- main.py
|   `-- requirements.txt
|-- frontend/
|   |-- app/
|   |   |-- admin/
|   |   |-- lib/
|   |   |-- student/
|   |   `-- page.js
|   `-- package.json
`-- README.md
```

## Setup

### 1. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

The backend runs by default at `http://127.0.0.1:8000`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs by default at `http://127.0.0.1:3000`.

## Environment Variables

You can place these in a root `.env` file or your shell environment. A ready-to-edit template is included in `.env.example`.

```env
DATABASE_URL=sqlite:///C:/path/to/whoshere.db
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

For PostgreSQL, use a connection string such as:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/whoshere
```

## PostgreSQL Setup

### Option A: Run PostgreSQL with Docker

If Docker Desktop is installed, start PostgreSQL with:

```bash
docker compose up -d postgres
```

This uses `docker-compose.yml` and creates:

- database: `whoshere`
- username: `whoshere_user`
- password: `whoshere_password`

Then set:

```env
DATABASE_URL=postgresql://whoshere_user:whoshere_password@127.0.0.1:5432/whoshere
```

### Option B: Use your own local PostgreSQL install

1. Create a database named `whoshere`.
2. Create or choose a PostgreSQL user that has access to it.
3. Put the matching connection string into `.env` as `DATABASE_URL`.

## Migrating Existing SQLite Data to PostgreSQL

If you already have student, attendance, or leave data in `backend/whoshere.db`, copy it into PostgreSQL with:

```bash
cd backend
venv\Scripts\python.exe scripts\migrate_sqlite_to_postgres.py --target-url postgresql://whoshere_user:whoshere_password@127.0.0.1:5432/whoshere
```

What this script does:

- creates the PostgreSQL tables if they do not exist
- copies students, attendance records, and leave requests
- preserves existing record IDs
- resets PostgreSQL sequences so new inserts continue from the right ID

If you want to migrate from a different SQLite file, pass `--source-url` too.

## Demo Flow

1. Start the backend and frontend.
2. Login as admin with `ADMIN_USERNAME` and `ADMIN_PASSWORD`.
3. Register a student and preview the uploaded face image.
4. Open the student directory and edit the student through the popup dialog.
5. Login as the student.
6. Mark attendance using either file upload or live camera capture.
7. Submit a leave request from the student dashboard.
8. Return to the admin dashboard to review attendance and approve or reject leave.

## Main API Routes

### Authentication

- `POST /login/admin`
- `POST /logout/admin`
- `POST /login/student`

### Students

- `POST /students/register`
- `GET /students`
- `GET /students/{student_id}`
- `PUT /students/{student_id}`
- `DELETE /students/{student_id}`

### Attendance

- `POST /attendance/mark`
- `GET /attendance`
- `GET /attendance/student/{student_id}`
- `PUT /attendance/{attendance_id}`
- `DELETE /attendance/{attendance_id}`

### Leave Requests

- `POST /leave-requests`
- `GET /leave-requests`
- `GET /leave-requests/student/{student_id}`
- `PUT /leave-requests/{leave_request_id}`
- `DELETE /leave-requests/{leave_request_id}`

## Report Screenshots

Recommended screenshots for your report:

- Landing page with student and admin login
- Admin dashboard overview
- Student registration with image preview
- Student edit popup showing saved image
- Student live camera attendance section
- Leave request form and leave management table

## Notes

- Uploaded student images are served from the backend `uploads` directory.
- Newly saved student passwords are hashed before storage.
- Existing plain-text student passwords are still accepted so older demo data keeps working.
- The backend still falls back to SQLite if `DATABASE_URL` is not set.
- PostgreSQL migration copies database records only, so your existing uploaded images should stay in `backend/uploads`.
