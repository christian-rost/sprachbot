"""
Session- und Message-Storage — CRUD mit Supabase + In-Memory-Fallback.
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone

from .config import MESSAGES_TABLE, SESSIONS_TABLE
from .database import get_db

logger = logging.getLogger(__name__)

# In-memory Fallback
_mem_sessions: dict[str, dict] = {}
_mem_messages: dict[str, list[dict]] = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _db_to_session(row: dict) -> dict:
    """Mappt DB-Spalten auf das interne Session-Format."""
    ctx = row.get("context") or {}
    return {
        "id": row["id"],
        "user_id": row.get("user_id"),
        "status": row.get("status", "active"),
        "intent": ctx.get("intent"),
        "slots": row.get("current_slots") or {},
        "turn_count": ctx.get("turn_count", 0),
        "created_at": str(row.get("started_at") or row.get("created_at") or _now()),
        "updated_at": str(row.get("ended_at") or row.get("started_at") or row.get("updated_at") or _now()),
    }


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

def create_session(user_id: str) -> dict:
    session_id = str(uuid.uuid4())
    now = _now()

    # Internes Format (für API + in-memory)
    session = {
        "id": session_id,
        "user_id": user_id,
        "status": "active",
        "intent": None,
        "slots": {},
        "turn_count": 0,
        "created_at": now,
        "updated_at": now,
    }

    db = get_db()
    if db:
        try:
            # DB-Schema verwendet andere Spaltennamen
            db_row = {
                "id": session_id,
                "user_id": user_id,
                "status": "active",
                "current_slots": {},
                "context": {"intent": None, "turn_count": 0},
                "channel": "browser",
            }
            result = db.table(SESSIONS_TABLE).insert(db_row).execute()
            if result.data:
                return _db_to_session(result.data[0])
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
                return _db_to_session(result.data[0])
            # Nicht in Supabase → in-memory prüfen (z.B. wenn INSERT vorher fehlschlug)
        except Exception as e:
            logger.warning("Supabase session get fehlgeschlagen: %s", e)

    return _mem_sessions.get(session_id)


def update_session(session_id: str, updates: dict) -> dict | None:
    db = get_db()
    if db:
        try:
            # Felder auf DB-Schema mappen
            db_updates = {}
            if "status" in updates:
                db_updates["status"] = updates["status"]
            if "slots" in updates or "intent" in updates or "turn_count" in updates:
                # context + current_slots zusammenführen
                existing = get_session(session_id)
                ctx = {"intent": existing.get("intent") if existing else None,
                       "turn_count": existing.get("turn_count", 0) if existing else 0}
                if "intent" in updates:
                    ctx["intent"] = updates["intent"]
                if "turn_count" in updates:
                    ctx["turn_count"] = updates["turn_count"]
                db_updates["context"] = ctx
                if "slots" in updates:
                    db_updates["current_slots"] = updates["slots"]

            if db_updates:
                result = db.table(SESSIONS_TABLE).update(db_updates).eq("id", session_id).execute()
                if result.data:
                    return _db_to_session(result.data[0])
        except Exception as e:
            logger.warning("Supabase session update fehlgeschlagen: %s", e)

    if session_id in _mem_sessions:
        _mem_sessions[session_id].update(updates)
        _mem_sessions[session_id]["updated_at"] = _now()
        return _mem_sessions[session_id]
    return None


def list_sessions(user_id: str | None = None, limit: int = 100, status: str | None = None) -> list[dict]:
    db = get_db()
    if db:
        try:
            q = db.table(SESSIONS_TABLE).select("*").order("started_at", desc=True).limit(limit)
            if user_id:
                q = q.eq("user_id", user_id)
            if status:
                q = q.eq("status", status)
            return [_db_to_session(r) for r in q.execute().data]
        except Exception as e:
            logger.warning("Supabase session list fehlgeschlagen: %s", e)

    sessions = list(_mem_sessions.values())
    if user_id:
        sessions = [s for s in sessions if s["user_id"] == user_id]
    if status:
        sessions = [s for s in sessions if s.get("status") == status]
    return sessions[:limit]


def close_active_sessions(user_id: str) -> int:
    """Schließt alle aktiven Sessions eines Nutzers (abandoned). Gibt Anzahl zurück."""
    db = get_db()
    count = 0
    if db:
        try:
            result = (
                db.table(SESSIONS_TABLE)
                .update({"status": "abandoned"})
                .eq("user_id", user_id)
                .eq("status", "active")
                .execute()
            )
            count = len(result.data)
        except Exception as e:
            logger.warning("Session close_active fehlgeschlagen: %s", e)
    for s in _mem_sessions.values():
        if s.get("user_id") == user_id and s.get("status") == "active":
            s["status"] = "abandoned"
            count += 1
    return count


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


def expire_inactive_sessions(timeout_minutes: int = 30) -> int:
    """Markiert aktive Sessions ohne Aktivität als 'timeout'. Gibt Anzahl zurück."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=timeout_minutes)
    count = 0

    db = get_db()
    if db:
        try:
            # Timeout basiert auf started_at (Erstellzeit) als Proxy für letzte Aktivität
            # Sessions ohne jegliche Aktivität nach cutoff → timeout
            result = (
                db.table(SESSIONS_TABLE)
                .update({"status": "timeout"})
                .eq("status", "active")
                .lt("started_at", cutoff.isoformat())
                .execute()
            )
            count += len(result.data)
        except Exception as e:
            logger.warning("Supabase session expire fehlgeschlagen: %s", e)

    for s in _mem_sessions.values():
        if s.get("status") == "active":
            ts = s.get("updated_at") or s.get("created_at", "")
            try:
                updated_dt = datetime.fromisoformat(ts)
                if updated_dt.tzinfo is None:
                    updated_dt = updated_dt.replace(tzinfo=timezone.utc)
                if updated_dt < cutoff:
                    s["status"] = "timeout"
                    count += 1
            except Exception:
                pass

    return count
