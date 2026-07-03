from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from app.database.db import get_db
from app.models.user import User
from app.services.gmail_client import SCOPES, get_client_config
import google_auth_oauthlib.flow
import os

# Google sometimes returns extra scopes (or reorders them). We must tell oauthlib to relax.
os.environ['OAUTHLIB_RELAX_TOKEN_SCOPE'] = '1'

router = APIRouter(prefix="/auth", tags=["auth"])

@router.get("/google/login")
def google_login(request: Request, db: Session = Depends(get_db)):
    """Starts the Google Web OAuth flow."""
    client_config = get_client_config()
    if not client_config:
        return {"error": "Google Client ID/Secret not configured on server"}

    host = request.headers.get("host", "localhost:8000")
    scheme = "https" if "onrender.com" in host or request.headers.get("x-forwarded-proto") == "https" else "http"
    redirect_uri = f"{scheme}://{host}/auth/google/callback"

    flow = google_auth_oauthlib.flow.Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        redirect_uri=redirect_uri
    )

    import uuid
    state_token = str(uuid.uuid4())

    # Generate the authorization URL with a secure random state
    authorization_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=state_token
    )

    return RedirectResponse(url=authorization_url)

@router.get("/google/callback")
def google_callback(request: Request, state: str = None, code: str = None):
    """Handles the redirect back from Google."""
    try:
        import urllib.parse
        import traceback

        if not code or not state:
            return {"error": "Missing code or state"}
        
        client_config = get_client_config()
        
        host = request.headers.get("x-forwarded-host", request.headers.get("host", "localhost:8000"))
        scheme = "https" if "onrender.com" in host or request.headers.get("x-forwarded-proto") == "https" else "http"
        redirect_uri = f"{scheme}://{host}/auth/google/callback"

        flow = google_auth_oauthlib.flow.Flow.from_client_config(
            client_config,
            scopes=SCOPES,
            redirect_uri=redirect_uri,
            state=state
        )

        authorization_response = str(request.url)
        
        flow.fetch_token(authorization_response=authorization_response)
        creds = flow.credentials

        # Fetch user's email address from Google
        from googleapiclient.discovery import build
        service = build('oauth2', 'v2', credentials=creds)
        user_info = service.userinfo().get().execute()
        user_email = user_info.get('email')
        
        if not user_email:
            return {"error": "Could not fetch email from Google"}

        from app.database.db import SessionLocal
        db = SessionLocal()
        
        # Create user if not exists
        user = db.query(User).filter(User.email == user_email).first()
        if not user:
            user = User(email=user_email, plan="free")
            db.add(user)
            db.commit()
            db.refresh(user)
        
        if user:
            token_filename = f"token_{user.id}.json"
            with open(token_filename, "w") as token_file:
                token_file.write(creds.to_json())
                
        db.close()

        from app.config import FRONTEND_URL
        frontend_url = FRONTEND_URL.rstrip('/')
        return RedirectResponse(url=f"{frontend_url}/login?auth=success&email={urllib.parse.quote(user_email)}")
    except Exception as e:
        return {"error": str(e), "traceback": traceback.format_exc()}

@router.get("/me")
def get_current_user(user_email: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        return {"error": "User not found"}
    return {"id": user.id, "email": user.email, "plan": user.plan}
