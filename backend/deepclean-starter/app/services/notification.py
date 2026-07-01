"""
services/notification.py
v1 placeholder for notifications (30-day deep clean reminder, survey nudges).
For now this just simulates sending - wire up real push notifications
(web push for the PWA) once the frontend is ready to receive them.
"""

def send_deep_clean_reminder(user_email: str):
    print(f"[NOTIFICATION] Would send 30-day deep clean reminder to {user_email}")


def send_survey_nudge(user_email: str, pending_count: int):
    print(f"[NOTIFICATION] Would remind {user_email} about {pending_count} pending survey questions")
