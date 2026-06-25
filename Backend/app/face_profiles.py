import os
from datetime import datetime

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session, joinedload

from app.config import FACE_POSES, PRIMARY_FACE_POSE
from app.database import SessionLocal
from app.face_utils import generate_face_encoding, is_current_face_encoding
from app.models import Student, StudentFaceProfile
from app.storage import build_upload_url, remove_file, resolve_storage_path, save_face_image


def normalize_face_pose(pose: str):
    cleaned_pose = pose.strip().lower()

    if cleaned_pose not in FACE_POSES:
        raise HTTPException(
            status_code=400,
            detail=f"Face pose must be one of: {', '.join(FACE_POSES)}.",
        )

    return cleaned_pose


def get_face_pose_sort_key(pose: str):
    normalized_pose = (pose or "").strip().lower()

    if normalized_pose in FACE_POSES:
        return FACE_POSES.index(normalized_pose)

    return len(FACE_POSES)


def get_sorted_face_profiles(student: Student):
    return sorted(
        list(student.face_profiles or []),
        key=lambda profile: (get_face_pose_sort_key(profile.pose), profile.id or 0),
    )


def get_face_profile_by_pose(student: Student, pose: str):
    normalized_pose = pose.strip().lower()

    for profile in student.face_profiles or []:
        if profile.pose == normalized_pose:
            return profile

    return None


def get_primary_face_profile(student: Student):
    center_profile = get_face_profile_by_pose(student, PRIMARY_FACE_POSE)

    if center_profile:
        return center_profile

    profiles = get_sorted_face_profiles(student)
    return profiles[0] if profiles else None


def sync_student_primary_face(student: Student):
    primary_face_profile = get_primary_face_profile(student)

    if primary_face_profile:
        student.face_image_path = primary_face_profile.image_path
        student.face_encoding = primary_face_profile.face_encoding
    elif not student.face_profiles:
        student.face_image_path = None
        student.face_encoding = None


def serialize_face_profile(profile: StudentFaceProfile):
    return {
        "id": profile.id,
        "pose": profile.pose,
        "image_path": profile.image_path,
        "image_url": build_upload_url(profile.image_path),
        "created_at": profile.created_at,
    }


def get_student_face_profiles_payload(student: Student):
    profiles = get_sorted_face_profiles(student)

    if profiles:
        return [serialize_face_profile(profile) for profile in profiles]

    if student.face_image_path:
        return [
            {
                "id": None,
                "pose": PRIMARY_FACE_POSE,
                "image_path": student.face_image_path,
                "image_url": build_upload_url(student.face_image_path),
                "created_at": student.created_at,
            }
        ]

    return []


def ensure_student_face_profiles(student: Student, refresh_encodings: bool = True):
    has_changes = False

    if not student.face_profiles and student.face_image_path:
        student.face_profiles.append(
            StudentFaceProfile(
                pose=PRIMARY_FACE_POSE,
                image_path=student.face_image_path,
                face_encoding=student.face_encoding or "",
                created_at=student.created_at or datetime.utcnow(),
            )
        )
        has_changes = True

    if refresh_encodings:
        for profile in list(student.face_profiles or []):
            if is_current_face_encoding(profile.face_encoding):
                continue

            image_path = resolve_storage_path(profile.image_path)

            if not image_path or not os.path.exists(image_path):
                continue

            profile.face_encoding = generate_face_encoding(image_path)
            has_changes = True

    sync_student_primary_face(student)
    return has_changes


def backfill_student_face_profiles():
    db = SessionLocal()

    try:
        students = db.query(Student).options(joinedload(Student.face_profiles)).all()
        has_changes = False

        for student in students:
            if ensure_student_face_profiles(student, refresh_encodings=False):
                has_changes = True

        if has_changes:
            db.commit()
    finally:
        db.close()


def get_uploaded_face_images(
    face_image_left: UploadFile | None = None,
    face_image_center: UploadFile | None = None,
    face_image_right: UploadFile | None = None,
    face_image: UploadFile | None = None,
):
    uploaded_face_images = {}

    for pose, upload in (
        ("left", face_image_left),
        ("center", face_image_center),
        ("right", face_image_right),
    ):
        if upload and upload.filename:
            uploaded_face_images[pose] = upload

    if face_image and face_image.filename and PRIMARY_FACE_POSE not in uploaded_face_images:
        uploaded_face_images[PRIMARY_FACE_POSE] = face_image

    return uploaded_face_images


def validate_required_face_images(face_images_by_pose: dict[str, UploadFile]):
    missing_poses = [pose for pose in FACE_POSES if pose not in face_images_by_pose]

    if missing_poses:
        raise HTTPException(
            status_code=400,
            detail=(
                "Please capture all required face photos: "
                + ", ".join(pose.title() for pose in missing_poses)
                + "."
            ),
        )


def save_face_images_by_pose(face_images_by_pose: dict[str, UploadFile], prefix_base: str):
    saved_face_images = []

    try:
        for pose in FACE_POSES:
            if pose not in face_images_by_pose:
                continue

            image_path, face_encoding = save_face_image(
                face_images_by_pose[pose],
                prefix=f"{prefix_base}_{pose}",
            )
            saved_face_images.append(
                {
                    "pose": pose,
                    "image_path": image_path,
                    "face_encoding": face_encoding,
                }
            )
    except HTTPException as exc:
        for saved_face_image in saved_face_images:
            remove_file(saved_face_image["image_path"])

        detail = str(exc.detail or "").strip()
        current_pose = pose.title()

        if detail:
            raise HTTPException(
                status_code=exc.status_code,
                detail=f"{current_pose} photo: {detail}",
            ) from exc

        raise

    return saved_face_images


def remove_saved_face_images(saved_face_images: list[dict]):
    for saved_face_image in saved_face_images:
        remove_file(saved_face_image.get("image_path"))


def apply_saved_face_images_to_student(student: Student, saved_face_images: list[dict]):
    replaced_face_paths = []

    for saved_face_image in saved_face_images:
        pose = normalize_face_pose(saved_face_image["pose"])
        existing_profile = get_face_profile_by_pose(student, pose)

        if existing_profile:
            if existing_profile.image_path != saved_face_image["image_path"]:
                replaced_face_paths.append(existing_profile.image_path)

            existing_profile.image_path = saved_face_image["image_path"]
            existing_profile.face_encoding = saved_face_image["face_encoding"]
        else:
            student.face_profiles.append(
                StudentFaceProfile(
                    pose=pose,
                    image_path=saved_face_image["image_path"],
                    face_encoding=saved_face_image["face_encoding"],
                )
            )

    sync_student_primary_face(student)
    return replaced_face_paths


def collect_student_face_image_paths(student: Student):
    image_paths = {
        profile.image_path
        for profile in student.face_profiles or []
        if profile.image_path
    }

    if student.face_image_path:
        image_paths.add(student.face_image_path)

    return sorted(image_paths)
