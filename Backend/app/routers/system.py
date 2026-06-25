from fastapi import APIRouter
from sqlalchemy import text

from app.database import SessionLocal

router = APIRouter()


@router.get("/", include_in_schema=False)
def read_root():
    return {
        "message": "WhosHere backend is running.",
        "docs_url": "/docs",
        "health_url": "/healthz",
    }


@router.get("/healthz", include_in_schema=False)
def health_check():
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
    finally:
        db.close()

    return {"status": "ok"}
