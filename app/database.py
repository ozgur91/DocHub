"""Datenbankverbindung.

Standard ist SQLite (Datei portal.db im Projektordner). Für einen späteren
Umzug auf PostgreSQL genügt es, die Umgebungsvariable DATABASE_URL zu setzen,
z. B. postgresql+psycopg://user:pass@host/portal
"""
import os
from pathlib import Path

from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine

BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'portal.db'}")

is_sqlite = DATABASE_URL.startswith("sqlite")
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if is_sqlite else {},
)

if is_sqlite:
    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_conn, _):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")   # paralleles Lesen/Schreiben
        cur.execute("PRAGMA foreign_keys=ON")    # Fremdschlüssel prüfen
        cur.close()


def init_db() -> None:
    from . import models  # noqa: F401  (Tabellen registrieren)
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
