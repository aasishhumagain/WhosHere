# WhosHere

WhosHere is a face-recognition attendance system built with FastAPI, PostgreSQL or SQLite, and Next.js. It includes a public welcome flow, separate admin and student portals, live attendance capture, leave requests, student profile management, and admin tools for student records, attendance review, and leave approvals.

## Features

- Public-facing `Home`, `Features`, and `How It Works` pages with a separate `/login` route.
- Backend-backed admin login and student login.
- Split student portal with dedicated pages for dashboard, attendance capture, attendance history, leave requests, and profile.
- Split admin workspace with dedicated pages for dashboard, student registration, directory, attendance control, and leave requests.
- Student registration with live face capture, uploaded image preview, and editable student records.
- Initial student password can default to the generated student ID when the admin leaves the password blank.
- Student self-service password changes from the profile page.
- Attendance marking by live camera capture and duplicate-attendance prevention.
- Attendance management APIs and admin tools for updating, filtering, exporting, and deleting attendance records.
- Leave request creation for students and leave request review for admins.
- Database configuration that supports SQLite by default and a PostgreSQL migration path through environment variables and a copy script.

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
|   |   |-- _components/
|   |   |-- admin/
|   |   |   |-- attendance/
|   |   |   |-- directory/
|   |   |   |-- leave/
|   |   |   |-- register/
|   |   |   |-- _components/
|   |   |   |-- _lib/
|   |   |   `-- page.js
|   |   |-- features/
|   |   |-- lib/
|   |   |-- how-it-works/
|   |   |-- login/
|   |   |-- student/
|   |   |   |-- capture/
|   |   |   |-- history/
|   |   |   |-- leave/
|   |   |   |-- profile/
|   |   |   |-- _components/
|   |   |   |-- _lib/
|   |   |   `-- page.js
|   |   `-- page.js
|   `-- package.json
`-- README.md
```

## Frontend Routes

### Public

- `/` welcome page
- `/features`
- `/how-it-works`
- `/login`

### Student

- `/student` dashboard
- `/student/capture`
- `/student/history`
- `/student/leave`
- `/student/profile`

### Admin

- `/admin` dashboard
- `/admin/register`
- `/admin/directory`
- `/admin/attendance`
- `/admin/leave`

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

## Login and Password Rules

- Admin login uses `ADMIN_USERNAME` and `ADMIN_PASSWORD` from the environment.
- Student login uses the generated student ID and the student password stored in the database.
- When the admin registers a student and leaves the password blank, the student's initial password becomes their student ID.
- Students can later change their own password from the profile page.
- Passwords are hashed before storage.

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
2. Open `http://127.0.0.1:3000` and move from the welcome page to `/login`.
3. Login as admin with `ADMIN_USERNAME` and `ADMIN_PASSWORD`.
4. Register a student and capture or upload the face image.
5. Open the student directory and edit student details if needed.
6. Login as the student from `/login`.
7. Mark attendance from the student capture page.
8. Review attendance history or submit a leave request from the student portal.
9. Return to the admin pages to review attendance and approve or reject leave.

## Main API Routes

### Authentication

- `POST /login/admin`
- `POST /logout/admin`
- `POST /login/student`
- `POST /logout/student`

### Students

- `POST /students/register`
- `GET /students`
- `GET /students/{student_id}`
- `POST /students/{student_id}/change-password`
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

- Welcome page
- Login page
- Admin dashboard overview
- Student registration with image preview
- Student directory or attendance control page
- Student dashboard
- Student live camera attendance capture page
- Leave request form and leave management table

## Notes

- Uploaded student images are served from the backend `uploads` directory.
- Newly saved student passwords are hashed before storage.
- Existing plain-text student passwords are still accepted so older demo data keeps working.
- The login flow now starts from the public welcome pages and continues through `/login`.
- The backend still falls back to SQLite if `DATABASE_URL` is not set.
- PostgreSQL migration copies database records only, so your existing uploaded images should stay in `backend/uploads`.
