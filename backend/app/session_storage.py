"""
Session- und Message-Storage — CRUD mit Supabase + In-Memory-Fallback.
"""
import logging
import uuid
from datetime import datetime, timezone

from .config import MESSAGES_TABLE, SESSIONS_TABLE
from .database import get_db

logger = logging.getLogger(__name__)

# In-memory Fallback
_mem_sessions: dict[str, dict] = {}
_mem_messages: dict[str, list[dict]] = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

def create_session(user_id: str) -> dict:
    session = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "status": "active",
        "intent": None,
        "slots": {},
        "turn_count": 0,
        "created_at": _now(),
        "updated_at": _now(),
    }

    db = get_db()
    if db:
        try:
            result = db.table(SESSIONS_TABLE).insert(session).execute()
            return result.data[0]
        except Exception as e:
            logger.warning("Supabase session insert fehlgeschlagen: %s", e)

    _mem_sessions[session["id"]] = session
    return session


def get_session(session_id: str) -> dict | None:
    db = get_db()
    if db:
        try:
            result = db.table(SESSIONS_TABLE).select("*").eq("id", session_id).execute()
            if result.data:
                return result.data[0]
            # Nicht in Supabase → in-memory prüfen (z.B. wenn INSERT vorher fehlschlug)
        except Exception as e:
            logger.warning("Supabase session get fehlgeschlagen: %s", e)

    return _mem_sessions.get(session_id)


def update_session(session_id: str, updates: dict) -> dict | None:
    updates["updated_at"] = _now()

    db = get_db()
    if db:
        try:
            result = db.table(SESSIONS_TABLE).update(updates).eq("id", session_id).execute()
            if result.data:
                return result.data[0]
            # Nicht in Supabase → in-memory versuchen
        except Exception as e:
            logger.warning("Supabase session update fehlgeschlagen: %s", e)

    if session_id in _mem_sessions:
        _mem_sessions[session_id].update(updates)
        return _mem_sessions[session_id]
    return None


def list_sessions(user_id: str | None = None, limit: int = 100) -> list[dict]:
    db = get_db()
    if db:
        try:
            q = db.table(SESSIONS_TABLE).select("*").order("created_at", desc=True).limit(limit)
            if user_id:
                q = q.eq("user_id", user_id)
            return q.execute().data
        except Exception as e:
            logger.warning("Supabase session list fehlgeschlagen: %s", e)

    sessions = list(_mem_sessions.values())
    if user_id:
        sessions = [s for s in sessions if s["user_id"] == user_id]
    return sessions[:limit]


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------

def add_message(session_id: str, role: str, content: str, metadata: dict | None = None) -> dict:
    """
    Fügt eine Nachricht zur Session hinzu.
    role: 'user' | 'assistant' | 'system'
    """
    msg = {
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "role": role,
        "content": content,
        "metadata": metadata or {},
        "created_at": _now(),
    }

    db = get_db()
    if db:
        try:
            result = db.table(MESSAGES_TABLE).insert(msg).execute()
            # Session turn_count erhöhen
            session = get_session(session_id)
            if session and role == "user":
                update_session(session_id, {"turn_count": session.get("turn_count", 0) + 1})
            return result.data[0]
        except Exception as e:
            logger.warning("Supabase message insert fehlgeschlagen: %s", e)

    if session_id not in _mem_messages:
        _mem_messages[session_id] = []
    _mem_messages[session_id].append(msg)

    if role == "user" and session_id in _mem_sessions:
        _mem_sessions[session_id]["turn_count"] = _mem_sessions[session_id].get("turn_count", 0) + 1
        _mem_sessions[session_id]["updated_at"] = _now()

    return msg


def list_messages(session_id: str) -> list[dict]:
    db = get_db()
    if db:
        try:
            result = (
                db.table(MESSAGES_TABLE)
                .select("*")
                .eq("session_id", session_id)
                .order("created_at")
                .execute()
            )
            return result.data
        except Exception as e:
            logger.warning("Supabase message list fehlgeschlagen: %s", e)

    return _mem_messages.get(session_id, [])
