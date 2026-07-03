"""
routers/gmail_sync.py
Pulls emails from Gmail and saves them into the database with a category
and risk score already attached - this is the "initial inbox scan" step.
"""

from fastapi import APIRouter, Depends, Request, BackgroundTasks
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
    # 1. Fetch general recent emails
    general_fetched = fetch_recent_emails(user_id=user_id, max_results=max_results)
    
    # 2. Fetch targeted historic OTPs/Receipts from the entire inbox history
    targeted_q = "subject:otp OR subject:verification OR subject:code OR subject:pin OR subject:activation OR subject:confirm OR subject:receipt OR subject:invoice OR subject:booking"
    targeted_fetched = fetch_recent_emails(user_id=user_id, max_results=200, q=targeted_q)
    
    # Combined and deduplicate using gmail_message_id
    seen_ids = set()
    fetched = []
    for email in general_fetched + targeted_fetched:
        if email["gmail_message_id"] not in seen_ids:
            seen_ids.add(email["gmail_message_id"])
            fetched.append(email)

    saved_count = 0
    trashed_count = 0
    service = None

    new_emails_list = []
    
    # Bulk fetch existing IDs to prevent hundreds of individual DB queries
    fetched_gmail_ids = [e["gmail_message_id"] for e in fetched]
    existing_records = db.query(EmailMeta.gmail_message_id).filter(EmailMeta.gmail_message_id.in_(fetched_gmail_ids)).all()
    existing_ids = {r[0] for r in existing_records}

    for email in fetched:
        if email["gmail_message_id"] in existing_ids:
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
                # If date parsing fails, keep the OTP in inbox to prevent lockout
                should_trash = False
                
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
        
        # Only add to notifications list if not auto-deleted
        if not should_trash:
            new_emails_list.append({
                "subject": record.subject,
                "sender": record.sender,
                "category": record.category,
                "snippet": email.get("snippet", "")
            })

    db.commit()
    
    # Reclassify existing cached emails to apply latest rules and manual training updates
    try:
        

        all_user_emails = db.query(EmailMeta).filter(EmailMeta.user_id == user_id).all()
        healed_count = 0
        for e in all_user_emails:
            classification = classify_email(db, e.user_id, e.subject, e.sender, [])
            if classification["category"] != e.category:
                e.category = classification["category"]
                e.risk_score = calculate_risk_score(
                    e.category, e.size_bytes, classification["is_order_otp_exception"]
                )
                healed_count += 1
        if healed_count > 0:
            db.commit()
            print(f"[SYNC HEALER] Reclassified and healed {healed_count} existing emails.")
    except Exception as re_err:
        print(f"[SYNC HEALER ERROR] Failed to run reclassification: {re_err}")

    return {
        "synced_new_emails": saved_count, 
        "total_fetched": len(fetched),
        "auto_cleaned_emails": trashed_count,
        "new_emails": new_emails_list
    }

def deep_sync_job(user_id: int):
    from app.database.db import SessionLocal
    db = SessionLocal()
    try:
        print(f"[DEEP SYNC] Starting deep scan for user {user_id}...")
        general_fetched = fetch_recent_emails(user_id=user_id, max_results=10000)
        
        seen_ids = set()
        fetched = []
        for email in general_fetched:
            if email["gmail_message_id"] not in seen_ids:
                seen_ids.add(email["gmail_message_id"])
                fetched.append(email)

        for email in fetched:
            existing = (
                db.query(EmailMeta)
                .filter(EmailMeta.gmail_message_id == email["gmail_message_id"])
                .first()
            )
            if existing:
                continue

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
            db.add(record)
            
            if len(db.new) >= 100:
                db.commit()

        db.commit()
        print(f"[DEEP SYNC] Completed deep scan for user {user_id}.")
    except Exception as e:
        print(f"[DEEP SYNC ERROR] {e}")
    finally:
        db.close()

@router.post("/run-deep")
def run_sync_deep(user_id: int, background_tasks: BackgroundTasks):
    background_tasks.add_task(deep_sync_job, user_id)
    return {"status": "started", "message": "Deep scan initiated in the background."}
