"""
gmail_service.py
Reusable Gmail connection logic.
"""

import os.path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


def get_gmail_service():
    creds = None

    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file("credentials.json", SCOPES)
            creds = flow.run_local_server(port=0)

        with open("token.json", "w") as token_file:
            token_file.write(creds.to_json())

    return build("gmail", "v1", credentials=creds)


def get_recent_emails(max_results=10):
    service = get_gmail_service()
    results = service.users().messages().list(userId="me", maxResults=max_results).execute()
    messages = results.get("messages", [])

    emails = []
    for msg in messages:
        msg_data = service.users().messages().get(
            userId="me", id=msg["id"], format="metadata",
            metadataHeaders=["Subject", "From", "Date"]
        ).execute()

        headers = msg_data.get("payload", {}).get("headers", [])
        subject = next((h["value"] for h in headers if h["name"] == "Subject"), "(no subject)")
        sender = next((h["value"] for h in headers if h["name"] == "From"), "(unknown sender)")
        date = next((h["value"] for h in headers if h["name"] == "Date"), "(unknown date)")
        size = msg_data.get("sizeEstimate", 0)
        labels = msg_data.get("labelIds", [])

        emails.append({
            "id": msg["id"],
            "subject": subject,
            "from": sender,
            "date": date,
            "size_bytes": size,
            "labels": labels,
        })

    return emails


def get_storage_summary(max_results=50):
    emails = get_recent_emails(max_results=max_results)
    total_size = sum(e["size_bytes"] for e in emails)
    biggest = sorted(emails, key=lambda e: e["size_bytes"], reverse=True)[:5]

    return {
        "emails_scanned": len(emails),
        "total_size_bytes": total_size,
        "biggest_emails": biggest,
    }