"""
routers/search.py
The AI search bar endpoint - includes the "this email was deleted" popup logic.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.db import get_db
from app.services.search_engine import search_emails

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/")
def search(user_id: int, query: str, db: Session = Depends(get_db)):
    results = search_emails(db, user_id, query)

    response = {"query": query, "matches": results["matches"]}

    if results["deleted_matches"]:
        # This is the deleted-email popup feature from your requirements
        response["deleted_notice"] = [
            {
                "id": m["id"],
                "subject": m["subject"],
                "deleted_at": m["deleted_at"],
                "message": f"This email ('{m['subject']}') was deleted on {m['deleted_at']}. Want to restore it?",
            }
            for m in results["deleted_matches"]
        ]

    return response
