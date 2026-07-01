"""
services/search_engine.py
v1 placeholder for the AI search feature. Right now it does simple keyword
matching against synced email metadata. Swap in a real Claude API call here
later (see the commented section) without changing routers/search.py.
"""

from sqlalchemy.orm import Session
from app.models.email_meta import EmailMeta


def search_emails(db: Session, user_id: int, query: str):
    """
    v1: basic keyword search across subject/sender.
    v2: replace this with an embedding/RAG-based search, or a Claude API call
    that turns `query` into a smarter Gmail search + summarized answer.
    """
    keyword = f"%{query.lower()}%"
    results = (
        db.query(EmailMeta)
        .filter(EmailMeta.user_id == user_id)
        .filter(EmailMeta.subject.ilike(keyword) | EmailMeta.sender.ilike(keyword))
        .all()
    )

    matches = []
    deleted_matches = []
    for r in results:
        item = {
            "id": r.id,
            "subject": r.subject,
            "sender": r.sender,
            "date": r.date,
            "category": r.category,
        }
        if r.is_deleted:
            item["deleted_at"] = str(r.deleted_at)
            deleted_matches.append(item)
        else:
            matches.append(item)

    return {
        "matches": matches,
        "deleted_matches": deleted_matches,  # used for the "this was deleted on..." popup
    }


# --- Example of how to plug in Claude API later ---
# import anthropic
# from app.config import ANTHROPIC_API_KEY
#
# def ai_search_answer(query: str, matched_emails: list):
#     client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
#     response = client.messages.create(
#         model="claude-sonnet-4-6",
#         max_tokens=300,
#         messages=[{
#             "role": "user",
#             "content": f"User asked: '{query}'. Here are matching emails: {matched_emails}. "
#                         f"Write a short, helpful answer pointing to the most relevant one."
#         }]
#     )
#     return response.content[0].text
