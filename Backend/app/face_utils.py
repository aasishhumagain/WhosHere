import json
import os
from functools import lru_cache
from pathlib import Path

import cv2
import numpy as np

MODEL_DIR = Path(__file__).resolve().parents[1] / "models"
FACE_DETECTOR_MODEL_PATH = MODEL_DIR / "face_detection_yunet_2023mar.onnx"
FACE_RECOGNIZER_MODEL_PATH = MODEL_DIR / "face_recognition_sface_2021dec.onnx"
FACE_ENCODING_VERSION = "sface_v1"
FACE_MATCH_THRESHOLD = float(os.getenv("FACE_MATCH_THRESHOLD", "0.363"))
FACE_DETECTION_SCORE_THRESHOLD = float(os.getenv("FACE_DETECTION_SCORE_THRESHOLD", "0.9"))


def get_missing_model_paths():
    required_paths = [FACE_DETECTOR_MODEL_PATH, FACE_RECOGNIZER_MODEL_PATH]
    return [path for path in required_paths if not path.exists()]


def ensure_face_models_exist():
    missing_paths = get_missing_model_paths()

    if missing_paths:
        missing_files = ", ".join(path.name for path in missing_paths)
        raise ValueError(
            "Face recognition models are missing "
            f"({missing_files}). Run `python scripts/download_face_models.py` from the backend folder."
        )


def create_face_detector(input_size: tuple[int, int]):
    ensure_face_models_exist()
    return cv2.FaceDetectorYN_create(
        str(FACE_DETECTOR_MODEL_PATH),
        "",
        input_size,
        FACE_DETECTION_SCORE_THRESHOLD,
        0.3,
        5000,
    )


@lru_cache(maxsize=1)
def get_face_recognizer():
    ensure_face_models_exist()
    return cv2.FaceRecognizerSF_create(str(FACE_RECOGNIZER_MODEL_PATH), "")


def read_image(image_path):
    image = cv2.imread(str(image_path))

    if image is None:
        raise ValueError("Could not read image.")

    return image


def detect_primary_face(image: np.ndarray):
    image_height, image_width = image.shape[:2]
    detector = create_face_detector((image_width, image_height))
    _, faces = detector.detect(image)

    if faces is None or len(faces) == 0:
        raise ValueError("No face detected in image.")

    best_face = max(faces, key=lambda face: float(face[-1]))
    return np.asarray(best_face[:14], dtype=np.float32)


def build_face_encoding_payload(embedding: np.ndarray):
    return json.dumps(
        {
            "version": FACE_ENCODING_VERSION,
            "embedding": embedding.astype(np.float32).flatten().tolist(),
        }
    )


def parse_face_encoding_payload(face_encoding: str | None):
    if not face_encoding:
        return None

    try:
        payload = json.loads(face_encoding)
    except json.JSONDecodeError:
        return None

    if isinstance(payload, list):
        return {"version": "legacy_pixel_v1", "embedding": payload}

    if isinstance(payload, dict) and isinstance(payload.get("embedding"), list):
        return payload

    return None


def is_current_face_encoding(face_encoding: str | None):
    payload = parse_face_encoding_payload(face_encoding)
    return bool(payload and payload.get("version") == FACE_ENCODING_VERSION)


def generate_face_encoding(image_path):
    image = read_image(image_path)
    face = detect_primary_face(image)
    recognizer = get_face_recognizer()
    aligned_face = recognizer.alignCrop(image, face)
    embedding = recognizer.feature(aligned_face)
    return build_face_encoding_payload(embedding)


def compare_faces(known_encoding, new_encoding):
    known_payload = parse_face_encoding_payload(known_encoding)
    new_payload = parse_face_encoding_payload(new_encoding)

    if not known_payload or not new_payload:
        raise ValueError("Invalid face encoding payload.")

    if (
        known_payload.get("version") != FACE_ENCODING_VERSION
        or new_payload.get("version") != FACE_ENCODING_VERSION
    ):
        raise ValueError("Legacy face encodings must be regenerated before comparison.")

    known_vector = np.asarray(known_payload["embedding"], dtype=np.float32)
    new_vector = np.asarray(new_payload["embedding"], dtype=np.float32)

    if known_vector.size == 0 or new_vector.size == 0:
        raise ValueError("Face encoding is empty.")

    denominator = np.linalg.norm(known_vector) * np.linalg.norm(new_vector)

    if denominator == 0:
        raise ValueError("Face encoding norm is zero.")

    return float(np.dot(known_vector, new_vector) / denominator)
