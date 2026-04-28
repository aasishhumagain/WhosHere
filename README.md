# WhosHere

WhosHere is a smart attendance system built with FastAPI, Next.js, and PostgreSQL. The idea is simple: admins register students, save their face photos, and students can later mark attendance from the camera page. The project also includes leave requests, attendance reports, CSV export, audit logs, and separate student/admin portals.

## What the project does

- admin login and student login
- student registration with left, center, and right face photos
- face-based attendance marking
- duplicate attendance prevention for the same day
- student attendance history
- leave request submission and approval
- attendance filtering and CSV export
- admin account management
- audit logs for logins and important actions

## Stack

- Frontend: Next.js 16, React 19, Tailwind CSS 4
- Backend: FastAPI, SQLAlchemy
- Database: PostgreSQL
- Face recognition: OpenCV YuNet + SFace

## Main pages

### Public

- `/`
- `/features`
- `/how-it-works`
- `/login`

### Student

- `/student`
- `/student/capture`
- `/student/history`
- `/student/leave`
- `/student/profile`

### Admin

- `/admin`
- `/admin/register`
- `/admin/directory`
- `/admin/attendance`
- `/admin/leave`
- `/admin/logs`
- `/admin/admin-directory`

## Before you run it

This project now uses PostgreSQL only. It will not start without a valid `DATABASE_URL`.

Create a root `.env` file from [.env.example](/C:/Users/aasis/OneDrive/Desktop/WhosHere/.env.example) and set your values:

```env
DATABASE_URL=postgresql://whoshere_user:whoshere_password@127.0.0.1:5432/whoshere
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

`ADMIN_USERNAME` and `ADMIN_PASSWORD` are used to create the first admin account. After that, admin accounts are stored in the database.

## How to run it

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend URL:

```text
http://127.0.0.1:8000
```

API docs:

```text
http://127.0.0.1:8000/docs
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:

```text
http://127.0.0.1:3000
```

## Login notes

- The first admin account comes from `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `.env`.
- Admin accounts are database-backed after startup.
- Student login uses the generated student ID.
- If the admin leaves the student password blank during registration, the initial password becomes the student ID.
- Student passwords are hashed before storage.
- Students can change their own password from the profile page.

## Normal flow

1. Start PostgreSQL, backend, and frontend.
2. Open the app and go to `Get Started`.
3. Log in as admin.
4. Register a student and capture the three face photos.
5. Log out and sign in as that student.
6. Mark attendance from the camera page.
7. Check attendance history or submit a leave request.
8. Go back to admin pages to review attendance, approve leave, export CSV, or check logs.

## Useful project notes

- Student images are stored in `backend/uploads`.
- The backend serves uploaded images directly from there.
- Attendance reports can be exported as CSV from the admin attendance page.
- Audit logs are available from the admin logs page.
- The protected main `admin` account can manage other admin accounts.

## Good screenshots for the report

- home page
- login page
- admin dashboard
- student registration with live capture
- student directory edit popup
- attendance control page
- student dashboard
- student attendance capture page
- leave request page
- audit logs page

## Final note

This was built as a full smart attendance project with separate admin and student workflows, not just a face-recognition demo. The main focus is attendance marking, record management, and keeping the day-to-day flow simple enough to use in a real classroom setup.
