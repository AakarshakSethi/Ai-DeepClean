import re
import os
import pickle
from sqlalchemy.orm import Session

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.naive_bayes import MultinomialNB
    from sklearn.pipeline import Pipeline
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

def get_model_path(user_id: int) -> str:
    return f"email_classifier_model_{user_id}.pkl"

# Hand-crafted high-quality training seeds to pre-train our ML classifier
TRAINING_DATA = [
    # OTP / 2FA
    ("Your verification code is 129034", "OTP"),
    ("OTP for transaction verification", "OTP"),
    ("LinkedIn verification PIN code", "OTP"),
    ("2-Step verification login code", "OTP"),
    ("Confirm your registration code", "OTP"),
    ("Your one-time passcode is 4821", "OTP"),
    ("My Bharat OTP code", "OTP"),
    ("Verification pin for skill india", "OTP"),
    ("IRCTC email verification OTP", "OTP"),
    
    # Receipts / Bills
    ("Your Amazon order invoice receipt", "Receipts"),
    ("IRCTC Train Ticket Booking Confirmation", "Receipts"),
    ("Payment confirmation for order #38219", "Receipts"),
    ("Electricity bill payment receipt", "Receipts"),
    ("Confirmation of purchase from Apple Store", "Receipts"),
    ("Zomato delivery order invoice", "Receipts"),
    ("Uber trip invoice receipt", "Receipts"),
    
    # Promotions / Newsletters
    ("W3Schools Newsletter: What employers search for", "Promotions"),
    ("Summer sale up to 50% off buy now", "Promotions"),
    ("Weekly tech newsletter updates", "Promotions"),
    ("Check out our premium subscription deals", "Promotions"),
    ("Special offers and marketing discounts", "Promotions"),
    ("Upgrade to Spotify Premium discount code", "Promotions"),
    
    # Social
    ("Meet Thummar wants to connect on LinkedIn", "Social"),
    ("New follower alert on Instagram", "Social"),
    ("Your friend tagged you in a comment", "Social"),
    ("Facebook notification: updates from friends", "Social"),
    ("John Doe sent you a direct message", "Social"),
    
    # Updates
    ("Security alert: new login from Chrome", "Updates"),
    ("Your account password has been updated", "Updates"),
    ("System alert: database backup complete", "Updates"),
    ("Your balance status statement report", "Updates"),
    ("Github repository notification commits", "Updates")
]

_MODEL_CACHE = {}

def train_model(db: Session, user_id: int):
    """Retrains the ML model for a specific user incorporating their historical choices."""
    if not SKLEARN_AVAILABLE:
        return None
        
    X = [item[0].lower() for item in TRAINING_DATA]
    y = [item[1] for item in TRAINING_DATA]
    
    # Query manual user choices from survey_response table to customize the AI
    try:
        from app.models.survey_response import SurveyResponse
        from app.models.email_meta import EmailMeta
        
        responses = (
            db.query(EmailMeta.subject, SurveyResponse.classification)
            .join(SurveyResponse, EmailMeta.id == SurveyResponse.email_meta_id)
            .filter(SurveyResponse.user_id == user_id, SurveyResponse.classification != None)
            .all()
        )
        for subject, category in responses:
            if subject and category:
                X.append(subject.lower())
                y.append(category)
    except Exception as e:
        print(f"[ML CLASSIFIER] Failed to query user responses: {e}")
                
    pipeline = Pipeline([
        ('vectorizer', TfidfVectorizer(ngram_range=(1, 2), stop_words='english')),
        ('classifier', MultinomialNB(alpha=0.1))
    ])
    
    pipeline.fit(X, y)
    
    model_path = get_model_path(user_id)
    try:
        with open(model_path, "wb") as f:
            pickle.dump(pipeline, f)
    except Exception as e:
        print(f"[ML CLASSIFIER] Failed to save model to {model_path}: {e}")
        
    _MODEL_CACHE[user_id] = pipeline
    return pipeline

def load_or_train_model(db: Session, user_id: int):
    if not SKLEARN_AVAILABLE:
        return None
        
    if user_id in _MODEL_CACHE:
        return _MODEL_CACHE[user_id]
        
    model_path = get_model_path(user_id)
    if os.path.exists(model_path):
        try:
            with open(model_path, "rb") as f:
                model = pickle.load(f)
                _MODEL_CACHE[user_id] = model
                return model
        except Exception:
            return train_model(db, user_id)
    else:
        return train_model(db, user_id)

def ml_classify(db: Session, user_id: int, subject: str) -> str:
    """Classifies email subject using the user's personal trained ML model."""
    if not SKLEARN_AVAILABLE:
        return None
        
    model = load_or_train_model(db, user_id)
    if not model:
        return None
        
    try:
        # Calculate prediction probabilities for all classes
        probs = model.predict_proba([subject.lower()])[0]
        max_idx = probs.argmax()
        max_prob = probs[max_idx]
        
        # If the model is not confident (confidence < 50%), ignore and fallback to rules
        if max_prob < 0.5:
            return None
            
        prediction = model.classes_[max_idx]
        return prediction
    except Exception:
        return None
