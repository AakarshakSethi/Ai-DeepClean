# AI Inbox DeepClean Backend - Setup Instructions

## What changed
Your old flat `main.py` + `gmail_service.py` have been restructured into
the full architecture: routers, services, models, and a real database
(SQLite for now - zero setup, just a file).

## Where to put this

1. Unzip this into your project so it looks like:
   ```
   ai-inbox-deepclean/
     backend/
       app/
         routers/
         services/
         models/
         database/
         config.py
       main.py
       requirements.txt
   ```
2. **Copy your existing `credentials.json` and `token.json`** (from your old
   `deepclean-starter` folder) into the same folder as this new `main.py`
   (i.e. directly inside `backend/`).

## How to run it

Open a terminal inside the `backend` folder (the one with this `main.py`):

```
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload
```

Then open: http://127.0.0.1:8000/docs

You'll now see ALL the endpoints grouped by feature: auth, gmail-sync,
emails, cleanup, search, survey, billing, settings.

## Suggested first test flow (in this order, using /docs)

1. `POST /auth/connect-gmail` with your email - creates your User record
   and runs the Gmail OAuth flow (reuses your existing token.json if present)
2. `POST /gmail-sync/run` with that `user_id` - pulls your real emails into
   the database, with category + risk score already calculated
3. `GET /emails/storage-summary` with that `user_id` - see your real storage
   breakdown by category
4. `GET /cleanup/review-30` with that `user_id` - see your first Review-30 batch
5. `GET /survey/pending` with that `user_id` - see flagged order/delivery OTPs
   and uncertain emails waiting for a survey answer
6. `GET /search/?query=myntra` with that `user_id` - test the search endpoint

## What's still a placeholder (intentionally, for now)
- AI search is basic keyword matching - swap in the Claude API call shown
  commented out in `app/services/search_engine.py` once you're ready
- Billing/Razorpay webhook just logs the payload - wire in real signature
  verification when you have Razorpay keys
- Notifications just print to the console instead of sending real push
  notifications - connect this once the PWA frontend supports it
