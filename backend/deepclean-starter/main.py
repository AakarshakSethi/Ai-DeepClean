"""
main.py
The entry point - wires together every router into one app.
This replaces your old flat main.py.
"""

import ssl
ssl._create_default_https_context = ssl._create_unverified_context

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
