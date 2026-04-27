import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = Path(__file__).resolve().parents[1]
ROOT_ENV_FILE = PROJECT_ROOT / ".env"
BACKEND_ENV_FILE = BACKEND_DIR / ".env"

load_dotenv(ROOT_ENV_FILE)
load_dotenv(BACKEND_ENV_FILE, override=True)


def normalize_database_url(database_url: str):
    cleaned_url = database_url.strip()

    if cleaned_url.startswith("postgres://"):
        return cleaned_url.replace("postgres://", "postgresql://", 1)

    return cleaned_url


def get_database_url():
    database_url = normalize_database_url(os.getenv("DATABASE_URL", ""))

    if not database_url:
        raise RuntimeError(
            "DATABASE_URL is required. WhosHere now runs on PostgreSQL only."
        )

    if not database_url.startswith("postgresql://"):
        raise RuntimeError(
            "WhosHere now requires a PostgreSQL DATABASE_URL."
        )

    return database_url


def build_engine(database_url: str | None = None):
    resolved_url = normalize_database_url(database_url or get_database_url())

    if not resolved_url.startswith("postgresql://"):
        raise RuntimeError("WhosHere now requires a PostgreSQL DATABASE_URL.")

    return create_engine(resolved_url, pool_pre_ping=True)


DATABASE_URL = get_database_url()
engine = build_engine(DATABASE_URL)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

Base = declarative_base()
