from app.admins import ensure_bootstrap_admin_user
from app.database import Base, engine
from app.face_profiles import backfill_student_face_profiles
from app.students import backfill_student_codes, ensure_student_schema


def initialize_application():
    Base.metadata.create_all(bind=engine)
    ensure_student_schema()
    backfill_student_codes()
    ensure_bootstrap_admin_user()
    backfill_student_face_profiles()
