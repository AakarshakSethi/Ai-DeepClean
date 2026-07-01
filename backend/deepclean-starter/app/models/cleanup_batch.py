"""
models/cleanup_batch.py
Tracks which 30-email Review-30 batch a user is on, and progress overall.
"""

from sqlalchemy import Column, Integer, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.database.db import Base


class CleanupBatch(Base):
    __tablename__ = "cleanup_batches"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    batch_number = Column(Integer, default=1)        # 1st batch of 30, 2nd batch of 30, etc.
    emails_reviewed_total = Column(Integer, default=0)
    storage_freed_bytes = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
