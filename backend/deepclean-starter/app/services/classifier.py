"""
services/classifier.py
Simple rule-based classification for v1 - no ML needed yet.
Looks at Gmail's own labels plus sender/subject keywords to guess a category.
"""

import re
import email.utils

from sqlalchemy.orm import Session

def extract_brand(sender_string):
    name, email_addr = email.utils.parseaddr(sender_string)
    if not email_addr or '@' not in email_addr:
        return "Unknown"
    
    domain = email_addr.split('@')[-1].lower()
    suffixes = ['.com', '.co.in', '.in', '.co.uk', '.org', '.net', '.edu', '.gov', '.io', '.co', '.ai', '.app']
    for suffix in suffixes:
        if domain.endswith(suffix):
            domain = domain[:-len(suffix)]
            break
            
    parts = domain.split('.')
    brand = parts[-1].capitalize()
    
    if brand.lower() in ['gmail', 'yahoo', 'outlook', 'hotmail', 'icloud', 'live']:
        if name:
            return name
    return brand

OTP_KEYWORDS = ["otp", "verification code", "one time password", "2-step verification", "login code"]
ORDER_KEYWORDS = ["order", "delivery", "shipment", "tracking", "out for delivery", "package"]
RECEIPT_KEYWORDS = ["receipt", "invoice", "payment confirmation", "your order has been placed", "billed"]
PROMO_SENDER_HINTS = ["no-reply", "noreply", "updates@", "newsletter", "marketing", "deals@"]


def classify_email(db: Session, user_id: int, subject: str, sender: str, gmail_labels: list, snippet: str = "") -> dict:
    """
    Returns: {"category": str, "is_order_otp_exception": bool}
    Learns from user's past surveys or defaults to keyword matching.
    """
    # Skip manual survey lookups if the email is sent from the user's own email address
    from app.models.user import User
    user = db.query(User).filter(User.id == user_id).first()
    is_self_sent = user and user.email.lower() in (sender or "").lower()

    if not is_self_sent:
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

    # Check for digits/codes in snippet/subject (ignoring calendar years)
    digits_found = re.findall(r'\b\d{4,8}\b', snippet_lower) + re.findall(r'\b\d{4,8}\b', subject_lower)
    has_digits = any(d not in ["2024", "2025", "2026", "2027", "2028"] for d in digits_found)

    # Check ML prediction first if available
    from app.services.ml_classifier import ml_classify
    ml_prediction = ml_classify(db, user_id, subject)
    
    is_otp = False
    if ml_prediction == "OTP":
        # Validate that the ML OTP prediction matches basic OTP criteria (prevent sparse TF-IDF overfits)
        strong_tokens = ["otp", "pin", "passcode", "2-step", "two-step", "2fa", "mfa", "verification code", "security code", "login code"]
        has_strong_token = any(t in subject_lower for t in strong_tokens)
        code_words = ["verify", "verification", "code", "activation", "confirm"]
        has_code_word = any(w in subject_lower for w in code_words)
        if has_strong_token or (has_code_word and has_digits):
            is_otp = True

    # Check for OTP indicators in subject or snippet
    otp_triggers = [
        "otp", "one-time", "one time", "passcode", "2-step", "two-step", 
        "2fa", "mfa", "verification code", "security code", "login code", 
        "auth code", "temp code", "temporary code", "verification pin"
    ]
    
    # 1. Very strong matches in the subject line (always true)
    if not is_otp:
        is_otp = any(t in subject_lower for t in otp_triggers)
    
    # 2. Matches in the snippet MUST be accompanied by a digit code to avoid matching help footers
    if not is_otp:
        if any(t in snippet_lower for t in otp_triggers) and has_digits:
            is_otp = True
            
    # 3. Code words in subject line accompanied by digits in subject or snippet
    if not is_otp:
        code_words = ["verify", "verification", "code", "pin", "activation", "confirm"]
        has_code_word = any(w in subject_lower for w in code_words)
        if has_code_word and has_digits:
            is_otp = True

    # Hard exclusions: If it's a digest, newsletter, or forum roundup, it's NOT an OTP.
    if is_otp:
        hard_exclusions = ["digest", "newsletter", "quora", "roundup", "bulletin", "weekly", "daily", "highlights"]
        if any(ex in sender_lower or ex in subject_lower for ex in hard_exclusions):
            is_otp = False

    # Exclude typical transaction/booking/order/program/status terms from OTP classification
    # BUT keep them if the subject line explicitly contains very strong OTP tokens
    otp_exclusions = [
        "booking", "ticket", "reservation", "pnr", "flight", "hotel", "statement", "receipt", "invoice", "itinerary",
        "selection", "internship", "allotment", "program", "training", "connect", "admission", "noc", "turned on", "enabled", "disabled", "setup"
    ]
    if is_otp and any(ex in subject_lower or ex in snippet_lower for ex in otp_exclusions):
        strong_overrides = ["otp", "pin", "passcode", "one-time", "verification code", "security code"]
        if not any(ov in subject_lower for ov in strong_overrides):
            is_otp = False

    is_order_related = any(k in subject_lower or k in snippet_lower for k in ORDER_KEYWORDS)

    # Key rule from your requirements: order/delivery OTPs are NOT auto-classified
    # the same as login OTPs - they get flagged for the survey instead.
    if is_otp and is_order_related:
        return {"category": "OTP", "is_order_otp_exception": True}

    if is_otp:
        return {"category": "OTP", "is_order_otp_exception": False}

    # If it's not OTP, use ML category predictions if available, else fall back to label/rules
    if ml_prediction and ml_prediction not in ["OTP", "Promotions", "Social", "Updates", "Important", "Receipts"]:
        return {"category": ml_prediction, "is_order_otp_exception": False}

    if any(k in subject_lower for k in RECEIPT_KEYWORDS):
        return {"category": "Receipts", "is_order_otp_exception": False}

    # Dynamic Brand Extraction (e.g. Claude, Groww, Amazon)
    brand = extract_brand(sender)
    
    # Capitalize nicely
    if len(brand) > 1:
        brand = brand[0].upper() + brand[1:]
        
    return {"category": brand, "is_order_otp_exception": False}
