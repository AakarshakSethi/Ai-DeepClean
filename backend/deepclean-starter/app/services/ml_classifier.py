import re
import os
import pickle
import math
from collections import defaultdict
from sqlalchemy.orm import Session

# We no longer need scikit-learn!
SKLEARN_AVAILABLE = True

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

class CustomNaiveBayes:
    """A pure-Python implementation of a Naive Bayes classifier with TF vectorization."""
    def __init__(self):
        self.class_counts = defaultdict(int)
        self.word_counts = defaultdict(dict)
        self.vocab = set()
        self.total_docs = 0

    def tokenize(self, text):
        text = text.lower()
        words = re.findall(r'\b[a-z]{2,}\b', text)
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'your'}
        return [w for w in words if w not in stop_words]

    def fit(self, X, y):
        for text, label in zip(X, y):
            self.total_docs += 1
            self.class_counts[label] += 1
            words = self.tokenize(text)
            
            # Using binary presence (Multinomial NB variant)
            for word in set(words):
                if word not in self.word_counts[label]:
                    self.word_counts[label][word] = 0
                self.word_counts[label][word] += 1
                self.vocab.add(word)

    def predict_proba_dict(self, text):
        words = set(self.tokenize(text))
        log_probs = {}
        for label in self.class_counts:
            # Prior probability P(Class)
            log_prob = math.log(self.class_counts[label] / self.total_docs)
            
            # Likelihood P(Word | Class) with Laplace smoothing
            denominator = self.class_counts[label] + 2 
            
            for word in words:
                if word in self.vocab:
                    numerator = self.word_counts[label].get(word, 0) + 1
                    log_prob += math.log(numerator / denominator)
                else:
                    # OOV words are ignored in standard NB
                    pass
            log_probs[label] = log_prob
            
        # Convert log probabilities to normalized probabilities (Softmax)
        if not log_probs:
            return {}
            
        max_log = max(log_probs.values())
        probs = {}
        denom = 0
        for label, lp in log_probs.items():
            val = math.exp(lp - max_log)
            probs[label] = val
            denom += val
            
        return {label: val / denom for label, val in probs.items()}

_MODEL_CACHE = {}

def train_model(db: Session, user_id: int):
    """Retrains the custom ML model for a specific user incorporating their historical choices."""
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
                
    model = CustomNaiveBayes()
    model.fit(X, y)
    
    model_path = get_model_path(user_id)
    try:
        with open(model_path, "wb") as f:
            pickle.dump(model, f)
    except Exception as e:
        print(f"[ML CLASSIFIER] Failed to save model to {model_path}: {e}")
        
    _MODEL_CACHE[user_id] = model
    return model

def load_or_train_model(db: Session, user_id: int):
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
    """Classifies email subject using the user's custom ML model."""
    model = load_or_train_model(db, user_id)
    if not model:
        return None
        
    try:
        probs = model.predict_proba_dict(subject)
        if not probs:
            return None
            
        best_class = max(probs.items(), key=lambda x: x[1])
        max_prob = best_class[1]
        prediction = best_class[0]
        
        # If the model is not confident (confidence < 50%), ignore and fallback to rules
        if max_prob < 0.5:
            return None
            
        return prediction
    except Exception:
        return None
