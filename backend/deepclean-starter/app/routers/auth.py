from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from app.database.db import get_db
from app.models.user import User
from app.services.gmail_client import SCOPES, get_client_config
import google_auth_oauthlib.flow

router = APIRouter(prefix="/auth", tags=["auth"])

@router.get("/google/login")
def google_login(user_email: str, request: Request, db: Session = Depends(get_db)):
    """Starts the Google Web OAuth flow."""
    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        user = User(email=user_email, plan="free")
        db.add(user)
        db.commit()
        db.refresh(user)

    client_config = get_client_config()
    if not client_config:
        return {"error": "Google Client ID/Secret not configured on server"}

    # Determine redirect URI based on the request host (localhost vs render)
    host = request.headers.get("host", "localhost:8000")
    scheme = "https" if "onrender.com" in host or request.headers.get("x-forwarded-proto") == "https" else "http"
    redirect_uri = f"{scheme}://{host}/auth/google/callback"

    flow = google_auth_oauthlib.flow.Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        redirect_uri=redirect_uri
    )

    authorization_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent"
    )

    # In a real app we should securely store state in the session and verify it, 
    # but for simplicity we'll pass the user_email in the state
    authorization_url += f"&state={user_email}"

    return RedirectResponse(url=authorization_url)


@router.get("/google/callback")
def google_callback(request: Request, state: str = None, code: str = None):
    """Handles the redirect back from Google."""
    if not code or not state:
        return {"error": "Missing code or state"}

    user_email = state
    client_config = get_client_config()
    
    host = request.headers.get("host", "localhost:8000")
    scheme = "https" if "onrender.com" in host or request.headers.get("x-forwarded-proto") == "https" else "http"
    redirect_uri = f"{scheme}://{host}/auth/google/callback"

    flow = google_auth_oauthlib.flow.Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        redirect_uri=redirect_uri
    )

    # Need to fetch the token using the code
    # Note: Flow uses the request URL to parse the authorization response.
    # However, since we are behind a proxy (Render), the request.url might be HTTP instead of HTTPS.
    # So we construct the authorization_response manually using the correct scheme.
    authorization_response = f"{redirect_uri}?state={state}&code={code}"
    
    flow.fetch_token(authorization_response=authorization_response)
    creds = flow.credentials

    # We need the user ID to save the token correctly
    from app.database.db import SessionLocal
    db = SessionLocal()
    user = db.query(User).filter(User.email == user_email).first()
    
    if user:
        token_filename = f"token_{user.id}.json"
        with open(token_filename, "w") as token_file:
            token_file.write(creds.to_json())
            
    db.close()

    # Redirect back to the frontend
    from app.config import FRONTEND_URL
    return RedirectResponse(url=f"{FRONTEND_URL}?auth=success&email={user_email}")

@router.get("/me")
def get_current_user(user_email: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        return {"error": "User not found"}
    return {"id": user.id, "email": user.email, "plan": user.plan}
