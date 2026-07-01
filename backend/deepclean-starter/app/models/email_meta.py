"""
models/email_meta.py
Stores per-email metadata: sender, subject, size, category, risk score.
"""

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database.db import Base


class EmailMeta(Base):
    __tablename__ = "email_meta"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    gmail_message_id = Column(String, index=True, nullable=False)
    subject = Column(String)
    sender = Column(String)
    date = Column(String)
    size_bytes = Column(Integer, default=0)
    category = Column(String, default="uncategorized")  # Promotions, Receipts, OTP, etc.
    risk_score = Column(Float, default=0.0)  # 0-100, higher = safer to delete
    is_order_otp_exception = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    synced_at = Column(DateTime(timezone=True), server_default=func.now())
