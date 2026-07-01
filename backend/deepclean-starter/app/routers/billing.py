"""
routers/billing.py
Free vs Pro plan management. Razorpay webhook handling is stubbed for now -
fill in real signature verification once you have Razorpay keys.
"""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.database.db import get_db
from app.models.user import User
from app.config import FREE_TIER_MONTHLY_SEARCH_LIMIT, PRO_TIER_MONTHLY_SEARCH_LIMIT

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/plan")
def get_plan(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return {"error": "User not found"}

    limit = PRO_TIER_MONTHLY_SEARCH_LIMIT if user.plan == "pro" else FREE_TIER_MONTHLY_SEARCH_LIMIT
    return {
        "plan": user.plan,
        "monthly_search_count": user.monthly_search_count,
        "monthly_search_limit": limit,
    }


@router.post("/upgrade")
def upgrade_to_pro(user_id: int, db: Session = Depends(get_db)):
    """Call this after a successful Razorpay payment confirmation."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return {"error": "User not found"}
    user.plan = "pro"
    db.commit()
    return {"message": "Upgraded to Pro", "plan": user.plan}


@router.post("/razorpay-webhook")
async def razorpay_webhook(request: Request):
    """
    Stub - once you have Razorpay set up, verify the webhook signature here
    and call upgrade_to_pro() or downgrade logic based on the event type.
    """
    payload = await request.json()
    print(f"[BILLING] Received webhook payload: {payload}")
    return {"received": True}
