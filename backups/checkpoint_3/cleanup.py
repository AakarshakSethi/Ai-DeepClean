"""
routers/cleanup.py
Generates Review-30 batches (ranked by risk score, safest first) and
executes approved cleanup actions. This NEVER auto-deletes - every
action here is something the user already approved on the frontend.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime
from app.database.db import get_db
from app.models.email_meta import EmailMeta
from app.models.cleanup_batch import CleanupBatch
from app.services.gmail_client import get_gmail_service

router = APIRouter(prefix="/cleanup", tags=["cleanup"])


@router.get("/review-30")
def get_review_batch(user_id: int, db: Session = Depends(get_db)):
    """Returns the next 30 cleanup candidates, safest (highest risk score) first."""
    candidates = (
        db.query(EmailMeta)
        .filter(EmailMeta.user_id == user_id, EmailMeta.is_deleted == False)
        .filter(EmailMeta.is_order_otp_exception == False)  # these always go through survey instead
        .order_by(EmailMeta.risk_score.desc())
        .limit(30)
        .all()
    )

    return {
        "batch_size": len(candidates),
        "candidates": [
            {
                "id": e.id,
                "subject": e.subject,
                "sender": e.sender,
                "category": e.category,
                "size_bytes": e.size_bytes,
                "risk_score": e.risk_score,
                "reason": f"{e.category}, risk score {e.risk_score}/100 - {'safe to review' if e.risk_score > 60 else 'review carefully'}",
            }
            for e in candidates
        ],
    }


@router.post("/approve-action")
def approve_action(user_id: int, email_id: int, action: str, db: Session = Depends(get_db)):
    """
    action: "delete" | "archive" | "keep" | "snooze"
    This only runs AFTER the user has approved it on the frontend - never automatic.
    """
    email = db.query(EmailMeta).filter(EmailMeta.id == email_id, EmailMeta.user_id == user_id).first()
    if not email:
        return {"error": "Email not found"}

    freed_bytes = 0
    if action == "delete":
        email.is_deleted = True
        email.deleted_at = datetime.utcnow()
        freed_bytes = email.size_bytes
        try:
            service = get_gmail_service(user_id)
            service.users().messages().trash(userId="me", id=email.gmail_message_id).execute()
        except Exception as e:
            print(f"[GMAIL API ERROR] Failed to trash message {email.gmail_message_id} in Gmail: {e}")
    elif action in ("restore", "keep"):
        email.is_deleted = False
        email.deleted_at = None
        if action == "restore":
            try:
                service = get_gmail_service(user_id)
                service.users().messages().untrash(userId="me", id=email.gmail_message_id).execute()
            except Exception as e:
                print(f"[GMAIL API ERROR] Failed to untrash message {email.gmail_message_id} in Gmail: {e}")
        elif action == "keep":
            try:
                from app.services.gmail_client import move_email_to_gmail_label
                service = get_gmail_service(user_id)
                move_email_to_gmail_label(service, email.gmail_message_id, email.category)
            except Exception as e:
                print(f"[GMAIL API ERROR] Failed to move message {email.gmail_message_id} to label {email.category} in Gmail: {e}")

    db.commit()
    return {"email_id": email_id, "action": action, "freed_bytes": freed_bytes}


@router.post("/complete-batch")
def complete_batch(user_id: int, storage_freed_bytes: int, db: Session = Depends(get_db)):
    """Call this once the user finishes reviewing a batch of 30, to log progress."""
    last_batch = (
        db.query(CleanupBatch)
        .filter(CleanupBatch.user_id == user_id)
        .order_by(CleanupBatch.batch_number.desc())
        .first()
    )
    next_number = (last_batch.batch_number + 1) if last_batch else 1

    batch = CleanupBatch(
        user_id=user_id,
        batch_number=next_number,
        emails_reviewed_total=30,
        storage_freed_bytes=storage_freed_bytes,
    )
    db.add(batch)
    db.commit()

    return {"batch_number": next_number, "storage_freed_bytes": storage_freed_bytes}
