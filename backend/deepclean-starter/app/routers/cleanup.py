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


@router.get("/subscriptions")
def get_subscriptions(user_id: int, db: Session = Depends(get_db)):
    """Groups promotional emails by sender to identify subscription lists."""
    from sqlalchemy import func
    
    results = (
        db.query(
            EmailMeta.sender,
            func.count(EmailMeta.id).label("email_count"),
            func.sum(EmailMeta.size_bytes).label("total_size_bytes")
        )
        .filter(EmailMeta.user_id == user_id, EmailMeta.is_deleted == False)
        .filter(EmailMeta.category == "Promotions")
        .group_by(EmailMeta.sender)
        .order_by(func.count(EmailMeta.id).desc())
        .limit(50)
        .all()
    )
    
    return {
        "subscriptions": [
            {
                "sender": r.sender,
                "email_count": r.email_count,
                "total_size_bytes": r.total_size_bytes or 0
            }
            for r in results
        ]
    }


@router.post("/unsubscribe")
def unsubscribe_and_bulk_delete(user_id: int, sender: str, db: Session = Depends(get_db)):
    """Bulk-trashes all emails from a specific sender in the database and Gmail."""
    from app.services.gmail_client import get_gmail_service
    
    emails = (
        db.query(EmailMeta)
        .filter(EmailMeta.user_id == user_id, EmailMeta.sender == sender, EmailMeta.is_deleted == False)
        .all()
    )
    
    service = None
    deleted_count = 0
    freed_bytes = 0
    
    for email in emails:
        email.is_deleted = True
        email.deleted_at = datetime.utcnow()
        freed_bytes += email.size_bytes
        try:
            if not service:
                service = get_gmail_service(user_id)
            service.users().messages().trash(userId="me", id=email.gmail_message_id).execute()
            deleted_count += 1
        except Exception as e:
            print(f"[UNSUBSCRIBE ERROR] Failed to trash email {email.gmail_message_id}: {e}")
            
    db.commit()
    return {
        "sender": sender,
        "emails_deleted": deleted_count,
        "freed_bytes": freed_bytes
    }


@router.get("/bin")
def get_bin_emails(user_id: int, db: Session = Depends(get_db)):
    """Returns all deleted emails for a user, auto-purging anything older than 30 days."""
    from datetime import timedelta
    
    # Auto-purge database records older than 30 days
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    db.query(EmailMeta).filter(
        EmailMeta.user_id == user_id,
        EmailMeta.is_deleted == True,
        EmailMeta.deleted_at < thirty_days_ago
    ).delete()
    db.commit()
    
    # Fetch remaining deleted emails
    deleted = (
        db.query(EmailMeta)
        .filter(EmailMeta.user_id == user_id, EmailMeta.is_deleted == True)
        .order_by(EmailMeta.deleted_at.desc())
        .all()
    )
    
    now = datetime.utcnow()
    emails_list = []
    for e in deleted:
        days_left = 30
        if e.deleted_at:
            delta_days = (now - e.deleted_at).days
            days_left = max(0, 30 - delta_days)
            
        emails_list.append({
            "id": e.id,
            "subject": e.subject,
            "sender": e.sender,
            "size_bytes": e.size_bytes,
            "deleted_at": e.deleted_at.isoformat() if e.deleted_at else None,
            "days_left": days_left
        })
        
    return {"count": len(emails_list), "emails": emails_list}


@router.post("/approve-actions")
def approve_actions(user_id: int, email_ids: list[int], action: str, db: Session = Depends(get_db)):
    """
    Approve actions for a list of email IDs in bulk concurrently.
    action: "delete" | "restore" | "keep"
    """
    from concurrent.futures import ThreadPoolExecutor
    
    emails = db.query(EmailMeta).filter(
        EmailMeta.id.in_(email_ids),
        EmailMeta.user_id == user_id
    ).all()
    
    if not emails:
        return {"message": "No emails found to process", "processed_count": 0, "freed_bytes": 0}
        
    freed_bytes = 0
    
    def process_single_email_action(email):
        try:
            # Create thread-local service client for thread safety
            thread_service = get_gmail_service(user_id)
            if action == "delete":
                email.is_deleted = True
                email.deleted_at = datetime.utcnow()
                thread_service.users().messages().trash(userId="me", id=email.gmail_message_id).execute()
                return email.size_bytes
            elif action == "restore":
                email.is_deleted = False
                email.deleted_at = None
                thread_service.users().messages().untrash(userId="me", id=email.gmail_message_id).execute()
                return 0
            elif action == "keep":
                email.is_deleted = False
                email.deleted_at = None
                from app.services.gmail_client import move_email_to_gmail_label
                move_email_to_gmail_label(thread_service, email.gmail_message_id, email.category)
                return 0
        except Exception as inner_e:
            print(f"[BULK ACTION ERROR] Failed to process email {email.id}: {inner_e}")
            return 0

    import time
    def delayed_process(email):
        time.sleep(0.2)
        return process_single_email_action(email)

    with ThreadPoolExecutor(max_workers=3) as executor:
        results = list(executor.map(delayed_process, emails))
        
    freed_bytes = sum(results)
    db.commit()
    
    return {
        "processed_count": len(emails),
        "action": action,
        "freed_bytes": freed_bytes
    }
