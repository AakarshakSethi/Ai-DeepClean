"""
routers/survey.py
Stores and serves the per-email survey: priority, classification,
keep/delete, and the order/delivery OTP exception flow.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.db import get_db
from app.models.email_meta import EmailMeta
from app.models.survey_response import SurveyResponse

router = APIRouter(prefix="/survey", tags=["survey"])


@router.get("/pending")
def get_pending_survey_items(user_id: int, limit: int = 10, db: Session = Depends(get_db)):
    """
    Returns emails that need a survey answer: order/delivery OTPs (always),
    plus a few uncertain-category emails (risk score in the middle range).
    """
    otp_exceptions = (
        db.query(EmailMeta)
        .filter(EmailMeta.user_id == user_id, EmailMeta.is_order_otp_exception == True)
        .filter(EmailMeta.is_deleted == False)
        .limit(limit)
        .all()
    )

    uncertain = (
        db.query(EmailMeta)
        .filter(EmailMeta.user_id == user_id)
        .filter(EmailMeta.risk_score.between(40, 60))
        .filter(EmailMeta.is_deleted == False)
        .limit(limit)
        .all()
    )

    items = otp_exceptions + uncertain
    return {
        "count": len(items),
        "items": [
            {"id": e.id, "subject": e.subject, "sender": e.sender, "category": e.category,
             "is_order_otp_exception": e.is_order_otp_exception}
            for e in items
        ],
    }


@router.post("/answer")
def submit_survey_answer(
    user_id: int,
    email_id: int,
    priority: str = None,
    classification: str = None,
    keep_or_delete: str = None,
    will_need_again: str = None,
    db: Session = Depends(get_db),
):
    response = SurveyResponse(
        user_id=user_id,
        email_meta_id=email_id,
        priority=priority,
        classification=classification,
        keep_or_delete=keep_or_delete,
        will_need_again=will_need_again,
    )
    db.add(response)

    email = db.query(EmailMeta).filter(EmailMeta.id == email_id).first()
    if email:
        if classification:
            email.category = classification

        # Real-time synchronization to Gmail API
        try:
            from app.services.gmail_client import get_gmail_service, move_email_to_gmail_label
            service = get_gmail_service(user_id)
            if keep_or_delete == "delete":
                service.users().messages().trash(userId="me", id=email.gmail_message_id).execute()
                email.is_deleted = True
            elif keep_or_delete == "keep" and classification:
                move_email_to_gmail_label(service, email.gmail_message_id, classification)
        except Exception as e:
            print(f"[GMAIL SYNC ERROR] Failed to apply survey action on Gmail: {e}")

    db.commit()
    return {"message": "Survey answer saved", "email_id": email_id}
