"""
AI Inbox DeepClean - Step 1 starter script
This connects to your own Gmail account and prints the subject lines
of your 10 most recent emails.
"""

import os.path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/drive.metadata.readonly"
]


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


def list_recent_emails(service, max_results=10):
    results = service.users().messages().list(userId="me", maxResults=max_results).execute()
    messages = results.get("messages", [])

    if not messages:
        print("No messages found.")
        return

    print(f"\nYour {len(messages)} most recent emails:\n")
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

        print(f"- {subject}")
        print(f"  From: {sender}")
        print(f"  Date: {date}")
        print(f"  Size: {size} bytes")
        print()


if __name__ == "__main__":
    print("Connecting to Gmail...")
    service = get_gmail_service()
    print("Connected successfully!")
    list_recent_emails(service)