"""
services/gmail_client.py
Same Gmail connection logic you already had working in gmail_service.py,
just moved into the proper app structure.
"""

import os.path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/drive.metadata.readonly",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile"
]


def get_client_config():
    """Generates the client_config dict dynamically from env vars"""
    from app.config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return None
    return {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "project_id": "ai-inbox-deepclean",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_secret": GOOGLE_CLIENT_SECRET
        }
    }


def get_gmail_service(user_id: int = None):
    import httplib2
    token_filename = f"token_{user_id}.json" if user_id else "token.json"
    creds = None
    if os.path.exists(token_filename):
        creds = Credentials.from_authorized_user_file(token_filename, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            raise Exception("User has no valid token. They must go through the Web OAuth flow.")

    # Create transport with disabled SSL validation for proxy safety
    import google_auth_httplib2
    http_transport = httplib2.Http(disable_ssl_certificate_validation=True)
    authorized_http = google_auth_httplib2.AuthorizedHttp(creds, http=http_transport)
    return build("gmail", "v1", http=authorized_http)


def fetch_recent_emails(user_id: int = None, max_results=50, q=None):
    service = get_gmail_service(user_id)
    
    # Google API list caps maxResults at 500 per page. 
    # We paginate to retrieve the full list.
    messages = []
    next_page_token = None
    
    while len(messages) < max_results:
        page_size = min(max_results - len(messages), 500)
        try:
            kwargs = {
                "userId": "me",
                "maxResults": page_size,
                "pageToken": next_page_token
            }
            if q:
                kwargs["q"] = q
            results = service.users().messages().list(**kwargs).execute()
        except Exception as e:
            print(f"[GMAIL API ERROR] Failed to fetch message list: {e}")
            break
            
        page_messages = results.get("messages", [])
        if not page_messages:
            break
            
        messages.extend(page_messages)
        next_page_token = results.get("nextPageToken")
        if not next_page_token:
            break
            
    messages = messages[:max_results]

    emails = []
    from concurrent.futures import ThreadPoolExecutor
    import threading
    
    thread_local = threading.local()

    def get_thread_service():
        if not hasattr(thread_local, "service"):
            thread_local.service = get_gmail_service(user_id)
        return thread_local.service

    def fetch_single_email(msg):
        try:
            # Re-use the thread-local service client instead of building it from scratch
            thread_service = get_thread_service()
            msg_data = thread_service.users().messages().get(
                userId="me", id=msg["id"], format="metadata",
                metadataHeaders=["Subject", "From", "Date"]
            ).execute()

            headers = msg_data.get("payload", {}).get("headers", [])
            subject = next((h["value"] for h in headers if h["name"].lower() == "subject"), "(no subject)")
            sender = next((h["value"] for h in headers if h["name"].lower() == "from"), "(unknown sender)")
            date = next((h["value"] for h in headers if h["name"].lower() == "date"), "(unknown date)")
            size = msg_data.get("sizeEstimate", 0)
            labels = msg_data.get("labelIds", [])
            snippet = msg_data.get("snippet", "")

            return {
                "gmail_message_id": msg["id"],
                "subject": subject,
                "sender": sender,
                "date": date,
                "size_bytes": size,
                "labels": labels,
                "snippet": snippet,
            }
        except Exception as e:
            print(f"[GMAIL API ERROR] Failed to fetch email details for {msg['id']}: {e}")
            return None

    # Fetch up to 15 emails concurrently to speed up the process by 10x-15x
    with ThreadPoolExecutor(max_workers=15) as executor:
        results = executor.map(fetch_single_email, messages)

    emails = [r for r in results if r is not None]
    return emails


def get_storage_quota(user_id: int):
    """Fetches the user's real Google storage quota from Drive API."""
    import os
    import httplib2
    import google_auth_httplib2
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    
    try:
        token_filename = f"token_{user_id}.json" if user_id else "token.json"
        if not os.path.exists(token_filename):
            return None
            
        creds = Credentials.from_authorized_user_file(token_filename, SCOPES)
        http_transport = httplib2.Http(disable_ssl_certificate_validation=True)
        authorized_http = google_auth_httplib2.AuthorizedHttp(creds, http=http_transport)
        
        drive_service = build("drive", "v3", http=authorized_http)
        about_data = drive_service.about().get(fields="storageQuota").execute()
        quota = about_data.get("storageQuota", {})
        
        return {
            "limit": int(quota.get("limit", 15 * 1024 * 1024 * 1024)),
            "usage": int(quota.get("usage", 0))
        }
    except Exception as e:
        print(f"[QUOTA ERROR] Failed to fetch Google storage quota: {str(e)}")
        return None


def get_or_create_label_id(service, label_name: str) -> str:
    """Finds or creates a Gmail label by name and returns its ID."""
    try:
        # Fetch all existing labels
        results = service.users().labels().list(userId="me").execute()
        labels = results.get("labels", [])
        
        # Check if label already exists (case-insensitive check)
        for label in labels:
            if label["name"].lower() == label_name.lower():
                return label["id"]
                
        # If it doesn't exist, create it!
        label_body = {
            "name": label_name,
            "labelListVisibility": "labelShow",
            "messageListVisibility": "show"
        }
        created_label = service.users().labels().create(userId="me", body=label_body).execute()
        return created_label["id"]
    except Exception as e:
        print(f"[LABEL ERROR] Failed to get/create label {label_name}: {e}")
        # Return uppercase string as fallback
        return label_name.upper()


def move_email_to_gmail_label(service, gmail_id: str, label_name: str):
    """Moves an email to a specific label in Gmail and removes it from the INBOX."""
    try:
        # Get the label ID
        label_id = get_or_create_label_id(service, label_name)
        
        # Modify the message labels: add the new label, remove 'INBOX'
        service.users().messages().modify(
            userId="me",
            id=gmail_id,
            body={
                "addLabelIds": [label_id],
                "removeLabelIds": ["INBOX"]
            }
        ).execute()
    except Exception as e:
        print(f"[GMAIL MODIFY ERROR] Failed to move message {gmail_id} to label {label_name}: {e}")
