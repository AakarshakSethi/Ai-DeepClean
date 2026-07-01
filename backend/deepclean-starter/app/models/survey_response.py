"""
models/survey_response.py
Stores answers from the per-email survey: priority, classification, keep/delete.
"""

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.database.db import Base


class SurveyResponse(Base):
    __tablename__ = "survey_responses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    email_meta_id = Column(Integer, ForeignKey("email_meta.id"))
    priority = Column(String, nullable=True)       # High / Medium / Low / Not important
    classification = Column(String, nullable=True)  # user-confirmed category
    keep_or_delete = Column(String, nullable=True)   # Keep / Archive / Delete / Snooze
    will_need_again = Column(String, nullable=True)  # Yes / Maybe / No
    answered_at = Column(DateTime(timezone=True), server_default=func.now())
