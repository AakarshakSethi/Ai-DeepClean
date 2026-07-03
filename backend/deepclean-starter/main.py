"""
main.py
The entry point - wires together every router into one app.
This replaces your old flat main.py.
"""
import ssl
ssl._create_default_https_context = ssl._create_unverified_context

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.db import init_db
from app.routers import auth, gmail_sync, emails, cleanup, search, survey, billing, settings

app = FastAPI(title="AI Inbox DeepClean API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten this to your real frontend URL before going live
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()
    
    # Run a one-time data correction to heal incorrectly classified historic emails (like bookings)
    try:
        from app.database.db import SessionLocal
        from app.models.email_meta import EmailMeta
        from app.services.classifier import classify_email
        from app.services.risk_score import calculate_risk_score
        
        db = SessionLocal()
        emails = db.query(EmailMeta).all()
        updated = 0
        for e in emails:
            classification = classify_email(db, e.user_id, e.subject, e.sender, [])
            if classification["category"] != e.category:
                e.category = classification["category"]
                e.risk_score = calculate_risk_score(
                    e.category, e.size_bytes, classification["is_order_otp_exception"]
                )
                updated += 1
        if updated > 0:
            db.commit()
            print(f"[RECLASSIFY] Successfully healed {updated} historic emails in the database!")
        db.close()
    except Exception as se:
        print(f"[RECLASSIFY ERROR] Failed to run startup reclassification: {se}")


@app.get("/")
def root():
    return {"message": "AI Inbox DeepClean backend is running"}


app.include_router(auth.router)
app.include_router(gmail_sync.router)
app.include_router(emails.router)
app.include_router(cleanup.router)
app.include_router(search.router)
app.include_router(survey.router)
app.include_router(billing.router)
app.include_router(settings.router)
