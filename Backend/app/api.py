from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.bootstrap import initialize_application
from app.config import UPLOAD_DIR
from app.routers.admin_users import router as admin_users_router
from app.routers.attendance import router as attendance_router
from app.routers.audit_logs import router as audit_logs_router
from app.routers.auth import router as auth_router
from app.routers.leave_requests import router as leave_requests_router
from app.routers.students import router as students_router
from app.routers.system import router as system_router

OPENAPI_TAGS = [
    {
        "name": "Authentication",
        "description": "Admin and student login/logout endpoints.",
    },
    {
        "name": "Admin Users",
        "description": "Admin account directory and password management.",
    },
    {
        "name": "Students",
        "description": "Student registration, lookup, update, and deletion.",
    },
    {
        "name": "Attendance",
        "description": "Attendance marking, listing, updating, and deletion.",
    },
    {
        "name": "Leave Requests",
        "description": "Student leave submission and admin leave management.",
    },
    {
        "name": "Audit Logs",
        "description": "Admin-only audit trail for logins, logouts, and system actions.",
    },
]

app = FastAPI(
    title="WhosHere API",
    description="Face-recognition attendance system for student and admin workflows.",
    version="1.0.0",
    openapi_tags=OPENAPI_TAGS,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

initialize_application()

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.include_router(system_router)
app.include_router(audit_logs_router)
app.include_router(auth_router)
app.include_router(admin_users_router)
app.include_router(students_router)
app.include_router(attendance_router)
app.include_router(leave_requests_router)
