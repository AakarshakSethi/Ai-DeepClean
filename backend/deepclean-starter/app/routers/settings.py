"""
routers/settings.py
Account preferences and the data-deletion / disconnect requirement
needed for Google's OAuth app verification and basic user trust.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.db import get_db
from app.models.user import User
from app.models.email_meta import EmailMeta
from app.models.survey_response import SurveyResponse

router = APIRouter(prefix="/settings", tags=["settings"])


@router.post("/disconnect-gmail")
def disconnect_gmail(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return {"error": "User not found"}
    user.google_refresh_token = None
    db.commit()
    return {"message": "Gmail disconnected"}


@router.delete("/delete-my-data")
def delete_my_data(user_id: int, db: Session = Depends(get_db)):
    """Required for trust/legal reasons - fully removes a user's data."""
    db.query(SurveyResponse).filter(SurveyResponse.user_id == user_id).delete()
    db.query(EmailMeta).filter(EmailMeta.user_id == user_id).delete()
    db.query(User).filter(User.id == user_id).delete()
    db.commit()
    return {"message": "All data deleted for this user"}
