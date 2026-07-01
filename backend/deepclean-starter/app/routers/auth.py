"""
routers/auth.py
Handles Google sign-in / OAuth callback. v1 keeps it simple: we already
have a working OAuth flow (your gmail_connect_test.py) - this wraps that
same flow behind a proper endpoint, plus creates a User record.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.db import get_db
from app.models.user import User
from app.services.gmail_client import get_gmail_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/connect-gmail")
def connect_gmail(user_email: str, db: Session = Depends(get_db)):
    """
    Triggers the Gmail OAuth flow (opens a browser locally, same as before)
    and creates/updates a User record. In production this becomes a proper
    web redirect-based OAuth flow instead of a local browser popup.
    """
    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        user = User(email=user_email, plan="free")
        db.add(user)
        db.commit()
        db.refresh(user)

    get_gmail_service(user_id=user.id)  # runs the OAuth flow if token_{user_id}.json doesn't exist yet

    return {"message": "Gmail connected", "user_id": user.id, "plan": user.plan}


@router.get("/me")
def get_current_user(user_email: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        return {"error": "User not found"}
    return {"id": user.id, "email": user.email, "plan": user.plan}
