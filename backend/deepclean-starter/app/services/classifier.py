"""
services/classifier.py
Simple rule-based classification for v1 - no ML needed yet.
Looks at Gmail's own labels plus sender/subject keywords to guess a category.
"""

import re

from sqlalchemy.orm import Session

OTP_KEYWORDS = ["otp", "verification code", "one time password", "2-step verification", "login code"]
ORDER_KEYWORDS = ["order", "delivery", "shipment", "tracking", "out for delivery", "package"]
RECEIPT_KEYWORDS = ["receipt", "invoice", "payment confirmation", "your order has been placed", "billed"]
PROMO_SENDER_HINTS = ["no-reply", "noreply", "updates@", "newsletter", "marketing", "deals@"]


def classify_email(db: Session, user_id: int, subject: str, sender: str, gmail_labels: list, snippet: str = "") -> dict:
    """
    Returns: {"category": str, "is_order_otp_exception": bool}
    Learns from user's past surveys or defaults to keyword matching.
    """
    # 1. Check if user has manually classified this sender in past surveys
    from app.models.survey_response import SurveyResponse
    from app.models.email_meta import EmailMeta

    past_preferred = (
        db.query(EmailMeta.category)
        .join(SurveyResponse, EmailMeta.id == SurveyResponse.email_meta_id)
        .filter(EmailMeta.user_id == user_id, EmailMeta.sender == sender, SurveyResponse.classification != None)
        .order_by(SurveyResponse.id.desc())
        .first()
    )

    if past_preferred and past_preferred[0]:
        return {"category": past_preferred[0], "is_order_otp_exception": False}

    subject_lower = (subject or "").lower()
    sender_lower = (sender or "").lower()
    snippet_lower = (snippet or "").lower()
    labels = gmail_labels or []

    # Check for OTP indicators in subject or snippet
    otp_triggers = [
        "otp", "one-time", "one time", "passcode", "2-step", "two-step", 
        "2fa", "mfa", "verification code", "security code", "login code", 
        "auth code", "temp code", "temporary code", "verification pin"
    ]
    
    is_otp = any(t in subject_lower or t in snippet_lower for t in otp_triggers)
    
    # Check if subject/snippet has digits/codes accompanied by activation/verification terms
    if not is_otp:
        code_words = ["verify", "verification", "code", "pin", "activation", "confirm"]
        has_code_word = any(w in subject_lower or w in snippet_lower for w in code_words)
        has_digits = re.search(r'\b\d{4,8}\b', snippet_lower) is not None or re.search(r'\b\d{4,8}\b', subject_lower) is not None
        if has_code_word and has_digits:
            is_otp = True

    is_order_related = any(k in subject_lower or k in snippet_lower for k in ORDER_KEYWORDS)

    # Key rule from your requirements: order/delivery OTPs are NOT auto-classified
    # the same as login OTPs - they get flagged for the survey instead.
    if is_otp and is_order_related:
        return {"category": "OTP", "is_order_otp_exception": True}

    if is_otp:
        return {"category": "OTP", "is_order_otp_exception": False}

    if any(k in subject_lower for k in RECEIPT_KEYWORDS):
        return {"category": "Receipts", "is_order_otp_exception": False}

    if "CATEGORY_PROMOTIONS" in labels or any(h in sender_lower for h in PROMO_SENDER_HINTS):
        return {"category": "Promotions", "is_order_otp_exception": False}

    if "CATEGORY_SOCIAL" in labels:
        return {"category": "Social", "is_order_otp_exception": False}

    if "CATEGORY_UPDATES" in labels:
        return {"category": "Updates", "is_order_otp_exception": False}

    if "IMPORTANT" in labels or "STARRED" in labels:
        return {"category": "Important", "is_order_otp_exception": False}

    return {"category": "Uncategorized", "is_order_otp_exception": False}
