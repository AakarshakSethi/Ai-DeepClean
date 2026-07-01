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
    query = db.query(EmailMeta).filter(EmailMeta.user_id == user_id, EmailMeta.is_deleted == False)
    if category:
        query = query.filter(EmailMeta.category == category)
    emails = query.all()
    return {"count": len(emails), "emails": [_serialize(e) for e in emails]}


from app.services.gmail_client import get_storage_quota

@router.get("/storage-summary")
def storage_summary(user_id: int, db: Session = Depends(get_db)):
    emails = db.query(EmailMeta).filter(EmailMeta.user_id == user_id, EmailMeta.is_deleted == False).all()
    total_size = sum(e.size_bytes for e in emails)
    by_category = {}
    for e in emails:
        by_category[e.category] = by_category.get(e.category, 0) + e.size_bytes

    biggest = sorted(emails, key=lambda e: e.size_bytes, reverse=True)[:5]

    # Fetch real Google storage quota from Drive API
    quota = get_storage_quota(user_id)
    real_limit = quota.get("limit") if quota else None
    real_usage = quota.get("usage") if quota else None

    return {
        "emails_scanned": len(emails),
        "total_size_bytes": total_size,
        "size_by_category": by_category,
        "biggest_emails": [_serialize(e) for e in biggest],
        "real_limit_bytes": real_limit,
        "real_usage_bytes": real_usage,
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
            html_data = base64.urlsafe_b64decode(body["data"].encode("ASCII")).decode("utf-8", errors="ignore")
            body_html += html_data
        elif mime_type == "text/plain" and body.get("data"):
            text_data = base64.urlsafe_b64decode(body["data"].encode("ASCII")).decode("utf-8", errors="ignore")
            body_text += text_data
            
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
                data = base64.urlsafe_b64decode(body["data"].encode("ASCII")).decode("utf-8", errors="ignore")
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

class SendEmailRequest(BaseModel):
    to_email: str
    subject: str
    body: str

@router.post("/send")
def send_email(payload: SendEmailRequest, user_id: int, db: Session = Depends(get_db)):
    try:
        service = get_gmail_service(user_id)
        
        # Build standard MIME text message
        message = MIMEText(payload.body)
        message["to"] = payload.to_email
        message["subject"] = payload.subject
        
        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
        
        # Send via Google Gmail API
        sent_msg = service.users().messages().send(
            userId="me", body={"raw": raw_message}
        ).execute()
        
        return {"status": "success", "message_id": sent_msg.get("id")}
    except Exception as e:
        return {"error": f"Failed to send email: {str(e)}"}
