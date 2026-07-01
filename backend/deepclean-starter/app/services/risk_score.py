"""
services/risk_score.py
v1 heuristic Deletion Risk Score (DRS): higher score = safer to delete.
Later this can be replaced with the ML model described in the project
report, without changing how other files call calculate_risk_score().
"""

SAFE_CATEGORIES = {"Promotions", "Social", "Updates"}
NEVER_AUTO_DELETE_CATEGORIES = {"OTP", "Important", "Receipts"}


def calculate_risk_score(category: str, size_bytes: int, is_order_otp_exception: bool) -> float:
    """Returns a 0-100 score. Higher = safer to suggest for deletion."""

    if is_order_otp_exception:
        # Never confidently auto-suggest deleting these - always goes through survey
        return 5.0

    if category in NEVER_AUTO_DELETE_CATEGORIES:
        return 10.0

    score = 50.0  # neutral baseline

    if category in SAFE_CATEGORIES:
        score += 30.0

    # Larger emails get a slightly higher "worth reviewing" bump,
    # since they're the ones that actually free up meaningful storage
    if size_bytes > 1_000_000:
        score += 10.0
    elif size_bytes > 100_000:
        score += 5.0

    return min(score, 95.0)  # cap below 100 - nothing is ever fully "certain", user always approves
