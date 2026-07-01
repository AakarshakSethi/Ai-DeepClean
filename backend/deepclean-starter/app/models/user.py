"""
models/user.py
Stores account info, Gmail OAuth tokens, and plan type.
"""

from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.database.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    google_refresh_token = Column(String, nullable=True)  # store encrypted in production
    plan = Column(String, default="pro")  # "free" or "pro"
    monthly_search_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
