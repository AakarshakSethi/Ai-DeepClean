"""
config.py
Central place for settings the rest of the app reads from.
For now these are simple defaults - later you'll move secrets like
API keys into a .env file instead of hardcoding them.
"""

import os

# Where your SQLite database file lives (simplest option to start with,
# you can switch to PostgreSQL/Supabase later without changing other files much)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./deepclean.db")

# Add these once you have them - for now they can stay empty strings
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")

FREE_TIER_MONTHLY_SEARCH_LIMIT = 10
PRO_TIER_MONTHLY_SEARCH_LIMIT = 100
