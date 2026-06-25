import os
import shutil
from uuid import uuid4

from fastapi import HTTPException, UploadFile

from app.config import BACKEND_DIR, UPLOAD_DIR
from app.face_utils import generate_face_encoding


def resolve_storage_path(file_path: str | None):
    if not file_path:
        return None

    if os.path.isabs(file_path):
        return file_path

    normalized = str(file_path).replace("\\", "/").lstrip("/")

    if normalized.startswith("uploads/"):
        return os.path.join(BACKEND_DIR, *normalized.split("/"))

    return os.path.join(UPLOAD_DIR, os.path.basename(normalized))


def build_upload_url(file_path: str | None):
    if not file_path:
        return None

    normalized = str(file_path).replace("\\", "/")

    if normalized.startswith("/uploads/"):
        return normalized

    if normalized.startswith("uploads/"):
        return f"/{normalized}"

    return f"/uploads/{os.path.basename(normalized)}"


def remove_file(file_path: str | None):
    storage_path = resolve_storage_path(file_path)

    if storage_path and os.path.exists(storage_path):
        os.remove(storage_path)


def save_uploaded_file(face_image: UploadFile, prefix: str):
    original_name = os.path.basename(face_image.filename or f"{prefix}.jpg")
    file_extension = os.path.splitext(original_name.replace(" ", "_"))[1] or ".jpg"
    file_name = f"{prefix}_{uuid4().hex}{file_extension}"
    relative_path = f"uploads/{file_name}"
    absolute_path = resolve_storage_path(relative_path)

    with open(absolute_path, "wb") as buffer:
        shutil.copyfileobj(face_image.file, buffer)

    return relative_path, absolute_path


def save_face_image(face_image: UploadFile, prefix: str = "student"):
    relative_path, absolute_path = save_uploaded_file(face_image, prefix)

    try:
        face_encoding = generate_face_encoding(absolute_path)
    except ValueError as exc:
        remove_file(relative_path)
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return relative_path, face_encoding


def save_temp_face_image(face_image: UploadFile):
    relative_path, absolute_path = save_uploaded_file(face_image, "temp")
    return relative_path, absolute_path
