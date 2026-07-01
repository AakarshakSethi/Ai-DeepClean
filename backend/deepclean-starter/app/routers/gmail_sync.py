"""
routers/gmail_sync.py
Pulls emails from Gmail and saves them into the database with a category
and risk score already attached - this is the "initial inbox scan" step.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.db import get_db
from app.models.email_meta import EmailMeta
from app.services.gmail_client import fetch_recent_emails
from app.services.classifier import classify_email
from app.services.risk_score import calculate_risk_score

router = APIRouter(prefix="/gmail-sync", tags=["gmail-sync"])


from email.utils import parsedate_to_datetime
from datetime import datetime, timezone
from app.services.gmail_client import get_gmail_service

@router.post("/run")
def run_sync(
    user_id: int, 
    max_results: int = 50, 
    autodelete_otps: bool = False, 
    autodelete_promos: bool = False, 
    db: Session = Depends(get_db)
):
    """Fetches recent emails from Gmail, classifies them, scores them, and saves to DB."""
    fetched = fetch_recent_emails(user_id=user_id, max_results=max_results)
    saved_count = 0
    trashed_count = 0
    service = None

    for email in fetched:
        existing = (
            db.query(EmailMeta)
            .filter(EmailMeta.gmail_message_id == email["gmail_message_id"])
            .first()
        )
        if existing:
            continue  # already synced, skip

        classification = classify_email(db, user_id, email["subject"], email["sender"], email["labels"], email.get("snippet", ""))
        risk = calculate_risk_score(
            classification["category"], email["size_bytes"], classification["is_order_otp_exception"]
        )

        record = EmailMeta(
            user_id=user_id,
            gmail_message_id=email["gmail_message_id"],
            subject=email["subject"],
            sender=email["sender"],
            date=email["date"],
            size_bytes=email["size_bytes"],
            category=classification["category"],
            risk_score=risk,
            is_order_otp_exception=classification["is_order_otp_exception"],
        )
        
        # Enforce Auto-Clean Filters
        should_trash = False
        
        # Rule 1: Auto-Delete OTPs (Standard OTPs older than 24 hours / 1 day)
        if autodelete_otps and record.category == "OTP" and not record.is_order_otp_exception:
            try:
                msg_date = parsedate_to_datetime(record.date)
                age_hours = (datetime.now(timezone.utc) - msg_date).total_seconds() / 3600
                if age_hours > 24:
                    should_trash = True
            except Exception:
                # If date parsing fails, fallback to delete
                should_trash = True
                
        # Rule 2: Auto-Delete Promotions older than 30 days
        if autodelete_promos and record.category == "Promotions":
            try:
                msg_date = parsedate_to_datetime(record.date)
                age_days = (datetime.now(timezone.utc) - msg_date).days
                if age_days > 30:
                    should_trash = True
            except Exception:
                pass
                
        if should_trash:
            record.is_deleted = True
            record.deleted_at = datetime.utcnow()
            try:
                if not service:
                    service = get_gmail_service(user_id)
                service.users().messages().trash(userId="me", id=record.gmail_message_id).execute()
                trashed_count += 1
            except Exception as e:
                print(f"[AUTO-CLEAN ERROR] Failed to trash email {record.gmail_message_id}: {e}")

        db.add(record)
        saved_count += 1

    db.commit()
    return {
        "synced_new_emails": saved_count, 
        "total_fetched": len(fetched),
        "auto_cleaned_emails": trashed_count
    }
