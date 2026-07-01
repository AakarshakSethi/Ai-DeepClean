"""
database/db.py
Sets up the database connection. Using SQLite to start (zero setup,
it's just a file on your computer) - you can switch to PostgreSQL/Supabase
later by only changing config.DATABASE_URL.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI calls this to get a database session for each request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Creates all tables based on the models - call this once on startup."""
    from app.models import user, email_meta, survey_response, cleanup_batch  # noqa
    Base.metadata.create_all(bind=engine)
