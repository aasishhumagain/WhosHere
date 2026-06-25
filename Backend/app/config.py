import hashlib
import os


def parse_optional_float_env(name: str):
    raw_value = os.getenv(name)

    if raw_value is None or not raw_value.strip():
        return None

    try:
        return float(raw_value)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be a valid number.") from exc


ATTENDANCE_STATUSES = {"present", "absent", "late", "excused"}
LEAVE_REQUEST_STATUSES = {"pending", "approved", "rejected"}
STUDENT_ACCOUNT_ROLES = {"Student", "Staff"}

ADMIN_BOOTSTRAP_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_BOOTSTRAP_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

ATTENDANCE_MIN_CAPTURE_SECONDS = max(
    0.0,
    float(os.getenv("ATTENDANCE_CAPTURE_MIN_HOLD_SECONDS", "5")),
)
ATTENDANCE_GEOFENCE_LATITUDE = parse_optional_float_env("ATTENDANCE_GEOFENCE_LATITUDE")
ATTENDANCE_GEOFENCE_LONGITUDE = parse_optional_float_env("ATTENDANCE_GEOFENCE_LONGITUDE")
ATTENDANCE_GEOFENCE_RADIUS_METERS = max(
    1.0,
    float(os.getenv("ATTENDANCE_GEOFENCE_RADIUS_METERS", "150")),
)
ATTENDANCE_GEOFENCE_MAX_ACCURACY_METERS = max(
    0.0,
    float(os.getenv("ATTENDANCE_GEOFENCE_MAX_ACCURACY_METERS", "100")),
)

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BACKEND_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

SESSION_SECRET = os.getenv("SESSION_SECRET") or hashlib.sha256(
    f"whoshere:{BACKEND_DIR}".encode("utf-8")
).hexdigest()
ADMIN_SESSION_TTL_SECONDS = int(os.getenv("ADMIN_SESSION_TTL_SECONDS", "43200"))
STUDENT_SESSION_TTL_SECONDS = int(os.getenv("STUDENT_SESSION_TTL_SECONDS", "43200"))
REVOKED_SESSION_TOKENS = set()

STUDENT_CODE_SEQUENCE_WIDTH = 5
STUDENT_CODE_YEAR_PREFIX_WIDTH = 3
LEGACY_STUDENT_CODE_YEAR_PREFIX_WIDTH = 2
FACE_POSES = ("left", "center", "right")
PRIMARY_FACE_POSE = "center"
