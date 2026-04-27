# WhosHere

WhosHere is a face-recognition attendance system built with FastAPI, PostgreSQL, and Next.js. It includes a public welcome flow, separate admin and student portals, live attendance capture, leave requests, student profile management, and admin tools for admin accounts, student records, attendance review, and leave approvals.

## Features

- Public-facing `Home`, `Features`, and `How It Works` pages with a separate `/login` route.
- Backend-backed admin login and student login.
- Split student portal with dedicated pages for dashboard, attendance capture, attendance history, leave requests, and profile.
- Split admin workspace with dedicated pages for dashboard, admin directory, student registration, student directory, attendance control, and leave requests.
- Student registration with live face capture and editable student records.
- Initial student password can default to the generated student ID when the admin leaves the password blank.
- Student self-service password changes from the profile page.
- Attendance marking by live camera capture and duplicate-attendance prevention.
- Attendance management APIs and admin tools for updating, filtering, exporting, and deleting attendance records.
- Leave request creation for students and leave request review for admins.
- Database configuration is PostgreSQL-only through `DATABASE_URL`.
- Admin accounts are stored in the `admin_users` table, and the protected `admin` account can manage other admin accounts.

## Tech Stack

- Frontend: Next.js 16, React 19, Tailwind CSS 4
- Backend: FastAPI, SQLAlchemy
- Face recognition: OpenCV YuNet face detection plus SFace embeddings
- Database: PostgreSQL through `DATABASE_URL`

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
|   |   |   |-- admin-directory/
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
- `/admin/admin-directory`
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

Before starting the backend, create a PostgreSQL database and set `DATABASE_URL` in `.env`.

The backend runs at `http://127.0.0.1:8000`.

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
DATABASE_URL=postgresql://whoshere_user:whoshere_password@127.0.0.1:5432/whoshere
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

## Login and Password Rules

- On first startup, the app bootstraps the first admin account from `ADMIN_USERNAME` and `ADMIN_PASSWORD`.
- After that, admin login is database-backed through the `admin_users` table.
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

## Demo Flow

1. Start the backend and frontend.
2. Open `http://127.0.0.1:3000` and move from the welcome page to `/login`.
3. Login as admin with `ADMIN_USERNAME` and `ADMIN_PASSWORD`.
4. Open the admin directory to manage admin accounts if needed.
5. Register a student and capture the face image.
6. Open the student directory and edit student details if needed.
7. Login as the student from `/login`.
8. Mark attendance from the student capture page.
9. Review attendance history or submit a leave request from the student portal.
10. Return to the admin pages to review attendance and approve or reject leave.

## Main API Routes

### Authentication

- `POST /login/admin`
- `POST /logout/admin`
- `POST /login/student`
- `POST /logout/student`

### Admin Users

- `GET /admin-users`
- `POST /admin-users`
- `POST /admin-users/change-password`
- `PUT /admin-users/{admin_user_id}`
- `DELETE /admin-users/{admin_user_id}`

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
- Admin directory with admin account controls
- Student registration with live capture
- Student directory or attendance control page
- Student dashboard
- Student live camera attendance capture page
- Leave request form and leave management table

## Notes

- Uploaded student images are served from the backend `uploads` directory.
- Newly saved student passwords are hashed before storage.
- Existing plain-text student passwords are still accepted so older demo data keeps working.
- The login flow now starts from the public welcome pages and continues through `/login`.
- The backend now requires PostgreSQL and will not start without a PostgreSQL `DATABASE_URL`.
- Existing uploaded images stay in `backend/uploads`.
