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

DEFAULT_SQLITE_PATH = BACKEND_DIR / "whoshere.db"


def normalize_database_url(database_url: str):
    cleaned_url = database_url.strip()

    if cleaned_url.startswith("postgres://"):
        return cleaned_url.replace("postgres://", "postgresql://", 1)

    return cleaned_url


def get_default_database_url():
    return f"sqlite:///{DEFAULT_SQLITE_PATH.as_posix()}"


def get_database_url():
    return normalize_database_url(os.getenv("DATABASE_URL", get_default_database_url()))


def build_engine(database_url: str | None = None):
    resolved_url = normalize_database_url(database_url or get_database_url())
    engine_kwargs = {"pool_pre_ping": True}

    if resolved_url.startswith("sqlite"):
        engine_kwargs["connect_args"] = {"check_same_thread": False}

    return create_engine(resolved_url, **engine_kwargs)


DATABASE_URL = get_database_url()
engine = build_engine(DATABASE_URL)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

Base = declarative_base()
