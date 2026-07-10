import os
import sys

# Ensure we're running from the correct directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from app.database.db import SessionLocal
from app.models.email_meta import EmailMeta
from app.services.ml_classifier import train_model, ml_classify
from app.services.classifier import classify_email

def run():
    db = SessionLocal()
    user_id = 1 # Assuming user 1
    
    # Train model
    print("Training model...")
    train_model(db, user_id)
    
    # Fetch all emails
    emails = db.query(EmailMeta).filter(EmailMeta.user_id == user_id).all()
    print(f"Found {len(emails)} emails. Reclassifying...")
    
    count = 0
    for e in emails:
        old_cat = e.category
        new_data = classify_email(db, user_id, e.subject, e.sender, "", [])
        new_cat = new_data["category"]
        if old_cat != new_cat:
            e.category = new_cat
            e.is_order_otp_exception = new_data["is_order_otp_exception"]
            count += 1
            print(f"Updated: {old_cat} -> {new_cat} ({e.subject[:30]}...)")
            
    db.commit()
    db.close()
    print(f"Reclassified {count} emails successfully.")

if __name__ == "__main__":
    run()
