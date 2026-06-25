import base64
import hashlib
import hmac
import json
import secrets
from uuid import uuid4

from fastapi import HTTPException

from app.config import REVOKED_SESSION_TOKENS, SESSION_SECRET
from app.time_utils import get_local_now


def encode_token_segment(value: bytes):
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("utf-8")


def decode_token_segment(value: str):
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}")


def create_session_token(role: str, subject: str, ttl_seconds: int, extra_payload: dict | None = None):
    issued_at = int(get_local_now().timestamp())
    payload = {
        "role": role,
        "sub": str(subject),
        "iat": issued_at,
        "exp": issued_at + ttl_seconds,
        "jti": uuid4().hex,
    }

    if extra_payload:
        payload.update(extra_payload)

    payload_segment = encode_token_segment(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    signature_segment = encode_token_segment(
        hmac.new(
            SESSION_SECRET.encode("utf-8"),
            payload_segment.encode("utf-8"),
            hashlib.sha256,
        ).digest()
    )

    return f"{payload_segment}.{signature_segment}"


def extract_bearer_token(
    authorization: str | None,
    error_detail: str = "Authentication required.",
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail=error_detail)

    return authorization.removeprefix("Bearer ").strip()


def verify_session_token(token: str):
    if token in REVOKED_SESSION_TOKENS:
        raise HTTPException(status_code=401, detail="Session is invalid or expired.")

    try:
        payload_segment, signature_segment = token.split(".", 1)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Session is invalid or expired.") from exc

    expected_signature = encode_token_segment(
        hmac.new(
            SESSION_SECRET.encode("utf-8"),
            payload_segment.encode("utf-8"),
            hashlib.sha256,
        ).digest()
    )

    if not hmac.compare_digest(expected_signature, signature_segment):
        raise HTTPException(status_code=401, detail="Session is invalid or expired.")

    try:
        payload = json.loads(decode_token_segment(payload_segment).decode("utf-8"))
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=401, detail="Session is invalid or expired.") from exc

    expires_at = int(payload.get("exp", 0))

    if expires_at <= int(get_local_now().timestamp()):
        raise HTTPException(status_code=401, detail="Session is invalid or expired.")

    return payload


def hash_password(password: str):
    iterations = 100_000
    salt = secrets.token_hex(16)
    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        iterations,
    ).hex()

    return f"pbkdf2_sha256${iterations}${salt}${password_hash}"


def verify_password(plain_password: str, stored_password: str):
    if not stored_password.startswith("pbkdf2_sha256$"):
        return hmac.compare_digest(stored_password, plain_password)

    try:
        _, iteration_count, salt, stored_hash = stored_password.split("$", 3)
    except ValueError:
        return False

    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        plain_password.encode("utf-8"),
        salt.encode("utf-8"),
        int(iteration_count),
    ).hex()

    return hmac.compare_digest(password_hash, stored_hash)
