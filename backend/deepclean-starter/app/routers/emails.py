"""
routers/emails.py
Read access to already-synced email metadata - this is what the
frontend's Categories and Dashboard pages will call.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.db import get_db
from app.models.email_meta import EmailMeta

router = APIRouter(prefix="/emails", tags=["emails"])


@router.get("/")
def list_emails(user_id: int, category: str = None, db: Session = Depends(get_db)):
    query = db.query(EmailMeta).filter(EmailMeta.user_id == user_id, EmailMeta.is_deleted == False).order_by(EmailMeta.id.desc())
    if category:
        query = query.filter(EmailMeta.category == category)
    emails = query.all()
    return {"count": len(emails), "emails": [_serialize(e) for e in emails]}


from app.services.gmail_client import get_storage_quota, get_gmail_service

import time
_google_api_cache = {}

@router.get("/storage-summary")
def storage_summary(user_id: int, db: Session = Depends(get_db)):
    from sqlalchemy import func, desc
    
    # 1. Total emails count
    emails_count = db.query(EmailMeta).filter(EmailMeta.user_id == user_id, EmailMeta.is_deleted == False).count()
    
    # 2. Total size
    total_size = db.query(func.sum(EmailMeta.size_bytes)).filter(
        EmailMeta.user_id == user_id, EmailMeta.is_deleted == False
    ).scalar() or 0
    
    # 3. Size by category
    category_sizes = db.query(EmailMeta.category, func.sum(EmailMeta.size_bytes)).filter(
        EmailMeta.user_id == user_id, EmailMeta.is_deleted == False
    ).group_by(EmailMeta.category).all()
    by_category = {cat: size for cat, size in category_sizes}

    # 4. Biggest 5 emails
    biggest = db.query(EmailMeta).filter(
        EmailMeta.user_id == user_id, EmailMeta.is_deleted == False
    ).order_by(desc(EmailMeta.size_bytes)).limit(5).all()

    # 5. Fetch real Google storage quota and profile (with 10-minute cache)
    now = time.time()
    quota = None
    total_gmail_emails = None
    
    if user_id in _google_api_cache and (now - _google_api_cache[user_id]["timestamp"] < 600):
        cached = _google_api_cache[user_id]
        quota = cached["quota"]
        total_gmail_emails = cached["total_gmail_emails"]
    else:
        quota = get_storage_quota(user_id)
        try:
            service = get_gmail_service(user_id)
            profile = service.users().getProfile(userId="me").execute()
            total_gmail_emails = profile.get("messagesTotal")
        except Exception as pe:
            print(f"[PROFILE ERROR] Failed to fetch total Gmail messages count: {pe}")
            
        _google_api_cache[user_id] = {
            "quota": quota,
            "total_gmail_emails": total_gmail_emails,
            "timestamp": now
        }

    real_limit = quota.get("limit") if quota else None
    real_usage = quota.get("usage") if quota else None

    return {
        "emails_scanned": emails_count,
        "total_size_bytes": total_size,
        "size_by_category": by_category,
        "biggest_emails": [_serialize(e) for e in biggest],
        "real_limit_bytes": real_limit,
        "real_usage_bytes": real_usage,
        "total_gmail_emails": total_gmail_emails,
    }


def _serialize(e: EmailMeta):
    return {
        "id": e.id,
        "subject": e.subject,
        "sender": e.sender,
        "date": e.date,
        "size_bytes": e.size_bytes,
        "category": e.category,
        "risk_score": e.risk_score,
        "is_order_otp_exception": e.is_order_otp_exception,
    }


import base64
from fastapi import Response
from app.services.gmail_client import get_gmail_service

def decode_base64_urlsafe(data: str) -> str:
    if not data:
        return ""
    data += "=" * ((4 - len(data) % 4) % 4)
    return base64.urlsafe_b64decode(data.encode("ASCII")).decode("utf-8", errors="ignore")

def parse_parts(parts):
    body_html = ""
    body_text = ""
    attachments = []
    
    for part in parts:
        mime_type = part.get("mimeType", "")
        filename = part.get("filename", "")
        body = part.get("body", {})
        
        if filename:
            attachments.append({
                "filename": filename,
                "mime_type": mime_type,
                "size_bytes": body.get("size", 0),
                "attachment_id": body.get("attachmentId", ""),
            })
        elif "parts" in part:
            h, t, atts = parse_parts(part["parts"])
            body_html += h
            body_text += t
            attachments.extend(atts)
        elif mime_type == "text/html" and body.get("data"):
            body_html += decode_base64_urlsafe(body["data"])
        elif mime_type == "text/plain" and body.get("data"):
            body_text += decode_base64_urlsafe(body["data"])
            
    return body_html, body_text, attachments

@router.get("/{email_id}/details")
def get_email_details(email_id: int, user_id: int, db: Session = Depends(get_db)):
    email_meta = db.query(EmailMeta).filter(EmailMeta.id == email_id, EmailMeta.user_id == user_id).first()
    if not email_meta:
        return {"error": "Email not found"}
        
    try:
        service = get_gmail_service(user_id)
        msg_data = service.users().messages().get(
            userId="me", id=email_meta.gmail_message_id, format="full"
        ).execute()
        
        payload = msg_data.get("payload", {})
        mime_type = payload.get("mimeType", "")
        body_html = ""
        body_text = ""
        attachments = []
        
        if "parts" in payload:
            body_html, body_text, attachments = parse_parts(payload["parts"])
        else:
            body = payload.get("body", {})
            if body.get("data"):
                data = decode_base64_urlsafe(body["data"])
                if mime_type == "text/html":
                    body_html = data
                else:
                    body_text = data
                    
        snippet = msg_data.get("snippet", "")
        
        return {
            "id": email_meta.id,
            "subject": email_meta.subject,
            "sender": email_meta.sender,
            "date": email_meta.date,
            "size_bytes": email_meta.size_bytes,
            "category": email_meta.category,
            "risk_score": email_meta.risk_score,
            "snippet": snippet,
            "body_html": body_html,
            "body_text": body_text,
            "attachments": attachments
        }
    except Exception as e:
        return {"error": f"Failed to fetch email body: {str(e)}"}

@router.get("/{email_id}/attachments/{attachment_id}")
def download_attachment(email_id: int, attachment_id: str, user_id: int, filename: str, db: Session = Depends(get_db)):
    email_meta = db.query(EmailMeta).filter(EmailMeta.id == email_id, EmailMeta.user_id == user_id).first()
    if not email_meta:
        return Response(content="Email not found", status_code=404)
        
    try:
        service = get_gmail_service(user_id)
        attachment = service.users().messages().attachments().get(
            userId="me", messageId=email_meta.gmail_message_id, id=attachment_id
        ).execute()
        
        file_data = base64.urlsafe_b64decode(attachment["data"].encode("ASCII"))
        return Response(
            content=file_data,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        return Response(content=f"Failed to download attachment: {str(e)}", status_code=500)


from pydantic import BaseModel
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders

class AttachmentPayload(BaseModel):
    filename: str
    content: str  # Base64 encoded string

class SendEmailRequest(BaseModel):
    to_email: str
    subject: str
    body: str
    attachments: list[AttachmentPayload] = None

@router.post("/send")
def send_email(payload: SendEmailRequest, user_id: int, db: Session = Depends(get_db)):
    try:
        service = get_gmail_service(user_id)
        
        # Build multipart message
        message = MIMEMultipart()
        message["to"] = payload.to_email
        message["subject"] = payload.subject
        
        # Attach body
        message.attach(MIMEText(payload.body, "plain"))
        
        # Attach files if any
        if payload.attachments:
            for att in payload.attachments:
                part = MIMEBase("application", "octet-stream")
                # Decode the base64 content
                file_data = base64.b64decode(att.content.split(",")[-1] if "," in att.content else att.content)
                part.set_payload(file_data)
                encoders.encode_base64(part)
                part.add_header(
                    "Content-Disposition",
                    f"attachment; filename={att.filename}"
                )
                message.attach(part)
                
        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
        
        # Send via Google Gmail API
        sent_msg = service.users().messages().send(
            userId="me", body={"raw": raw_message}
        ).execute()
        
        return {"status": "success", "message_id": sent_msg.get("id")}
    except Exception as e:
        return {"error": f"Failed to send email: {str(e)}"}


class AIComposeRequest(BaseModel):
    prompt: str
    tone: str = "professional"
    recipient: str = ""

@router.post("/ai/compose")
def ai_compose_email(payload: AIComposeRequest):
    import os
    import requests
    
    gemini_key = os.environ.get("GEMINI_API_KEY")
    
    # Heuristic high-fidelity fallback drafts if key is absent
    default_drafts = {
        "professional": f"Dear recipient,\n\nI hope this email finds you well.\n\nI am writing to follow up regarding {payload.prompt}.\n\nPlease let me know if you have any questions or require additional details.\n\nBest regards,\n[Your Name]",
        "casual": f"Hi there,\n\nHope you're having a great week!\n\nJust wanted to check in about {payload.prompt}. Let me know what you think.\n\nCheers,\n[Your Name]",
        "urgent": f"Hello,\n\nThis is urgent: regarding {payload.prompt}. Please review and reply as soon as possible so we can move forward.\n\nThank you,\n[Your Name]",
        "apologetic": f"Dear recipient,\n\nI sincerely apologize for the inconvenience. Regarding {payload.prompt}, I am working to resolve this immediately.\n\nThank you for your understanding.\n\nSincerely,\n[Your Name]"
    }
    
    selected_tone = payload.tone.lower()
    if selected_tone not in default_drafts:
        selected_tone = "professional"
        
    draft = default_drafts[selected_tone]
    
    # If Gemini API Key is available, invoke Gemini-1.5-Flash
    if gemini_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
            system_instruction = (
                f"You are a helpful AI email assistant writing an email in a {payload.tone} tone. "
                "Write only the email body text. Do not output anything else."
            )
            prompt_content = f"Write an email about: '{payload.prompt}'"
            if payload.recipient:
                prompt_content += f" to {payload.recipient}"
                
            body_payload = {
                "contents": [{
                    "parts": [{"text": f"{system_instruction}\n\n{prompt_content}"}]
                }]
            }
            res = requests.post(url, json=body_payload, timeout=12)
            if res.status_code == 200:
                data = res.json()
                generated_text = data["candidates"][0]["content"]["parts"][0]["text"]
                if generated_text:
                    draft = generated_text.strip()
        except Exception as e:
            print(f"[GEMINI AI ERROR] Failed to fetch reply: {e}")
            
    return {"draft": draft}


@router.get("/sent")
def list_sent_emails(user_id: int):
    from app.services.gmail_client import get_gmail_service
    from concurrent.futures import ThreadPoolExecutor
    try:
        service = get_gmail_service(user_id)
        # Query for sent emails (fetch up to 100 historical sent messages)
        results = service.users().messages().list(
            userId="me", q="from:me", maxResults=100
        ).execute()
        
        messages = results.get("messages", [])
        
        def fetch_single_sent_meta(msg):
            try:
                # Instantiate thread-local service client for thread safety
                thread_service = get_gmail_service(user_id)
                msg_data = thread_service.users().messages().get(
                    userId="me", id=msg["id"], format="metadata",
                    metadataHeaders=["Subject", "To", "Date"]
                ).execute()
                
                headers = msg_data.get("payload", {}).get("headers", [])
                subject = next((h["value"] for h in headers if h["name"].lower() == "subject"), "(no subject)")
                recipient = next((h["value"] for h in headers if h["name"].lower() == "to"), "(unknown recipient)")
                date = next((h["value"] for h in headers if h["name"].lower() == "date"), "(unknown date)")
                snippet = msg_data.get("snippet", "")
                
                return {
                    "id": msg["id"],
                    "subject": subject,
                    "recipient": recipient,
                    "date": date,
                    "snippet": snippet
                }
            except Exception as inner_e:
                print(f"[SENT BLOCK ERROR] Failed to get message meta {msg['id']}: {inner_e}")
                return None

        # Fetch up to 100 details concurrently (blazing fast)
        with ThreadPoolExecutor(max_workers=20) as executor:
            fetched_results = executor.map(fetch_single_sent_meta, messages)
            
        emails = [r for r in fetched_results if r is not None]
        return {"emails": emails}
    except Exception as e:
        return {"error": f"Failed to fetch sent emails: {str(e)}"}


@router.get("/gmail/{gmail_id}/details")
def get_gmail_message_details(gmail_id: str, user_id: int):
    import base64
    from app.services.gmail_client import get_gmail_service
    try:
        service = get_gmail_service(user_id)
        msg_data = service.users().messages().get(
            userId="me", id=gmail_id, format="full"
        ).execute()
        
        payload = msg_data.get("payload", {})
        headers = payload.get("headers", [])
        
        subject = next((h["value"] for h in headers if h["name"].lower() == "subject"), "(no subject)")
        sender = next((h["value"] for h in headers if h["name"].lower() == "from"), "(unknown sender)")
        recipient = next((h["value"] for h in headers if h["name"].lower() == "to"), "(unknown recipient)")
        date = next((h["value"] for h in headers if h["name"].lower() == "date"), "(unknown date)")
        
        body_html = ""
        body_text = ""
        attachments = []
        
        parts = payload.get("parts", [])
        if parts:
            body_html, body_text, attachments = parse_parts(parts)
        else:
            body = payload.get("body", {})
            mime_type = payload.get("mimeType", "")
            if mime_type == "text/html" and body.get("data"):
                body_html = base64.urlsafe_b64decode(body["data"].encode("ASCII")).decode("utf-8", errors="ignore")
            elif mime_type == "text/plain" and body.get("data"):
                body_text = base64.urlsafe_b64decode(body["data"].encode("ASCII")).decode("utf-8", errors="ignore")
                
        if not body_html and body_text:
            body_html = body_text.replace("\n", "<br/>")
            
        return {
            "id": gmail_id,
            "gmail_message_id": gmail_id,
            "subject": subject,
            "sender": sender,
            "recipient": recipient,
            "date": date,
            "body_html": body_html,
            "body_text": body_text,
            "attachments": attachments
        }
    except Exception as e:
        return {"error": f"Failed to fetch message details: {str(e)}"}


@router.get("/spam")
def list_spam_emails(user_id: int):
    from app.services.gmail_client import get_gmail_service
    from concurrent.futures import ThreadPoolExecutor
    try:
        service = get_gmail_service(user_id)
        # Query for spam emails (retrieve top 50 spam messages)
        results = service.users().messages().list(
            userId="me", q="label:SPAM", maxResults=50
        ).execute()
        
        messages = results.get("messages", [])
        
        import threading
        thread_local = threading.local()
        
        def get_thread_service():
            if not hasattr(thread_local, "service"):
                thread_local.service = get_gmail_service(user_id)
            return thread_local.service
        
        def fetch_single_spam_meta(msg):
            try:
                # Instantiate thread-local service client for thread safety
                thread_service = get_thread_service()
                msg_data = thread_service.users().messages().get(
                    userId="me", id=msg["id"], format="metadata",
                    metadataHeaders=["Subject", "From", "Date"]
                ).execute()
                
                headers = msg_data.get("payload", {}).get("headers", [])
                subject = next((h["value"] for h in headers if h["name"].lower() == "subject"), "(no subject)")
                sender = next((h["value"] for h in headers if h["name"].lower() == "from"), "(unknown sender)")
                date = next((h["value"] for h in headers if h["name"].lower() == "date"), "(unknown date)")
                snippet = msg_data.get("snippet", "")
                
                return {
                    "id": msg["id"],
                    "subject": subject,
                    "sender": sender,
                    "date": date,
                    "snippet": snippet
                }
            except Exception as inner_e:
                print(f"[SPAM BLOCK ERROR] Failed to get message meta {msg['id']}: {inner_e}")
                return None

        # Fetch up to 50 spam details concurrently
        with ThreadPoolExecutor(max_workers=20) as executor:
            fetched_results = executor.map(fetch_single_spam_meta, messages)
            
        emails = [r for r in fetched_results if r is not None]
        return {"emails": emails}
    except Exception as e:
        return {"error": f"Failed to fetch spam emails: {str(e)}"}
