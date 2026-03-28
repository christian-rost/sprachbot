from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .config import AUDIT_LOG_TABLE
from .database import get_db

_mem_events: List[Dict[str, Any]] = []


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def log_event(
    event_type: str,
    actor_user_id: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
) -> Dict[str, Any]:
    row = {
        "id": str(uuid.uuid4()),
        "event_type": event_type,
        "actor_user_id": actor_user_id,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "details": details or {},
        "ip_address": ip_address,
        "created_at": _now(),
    }
    db = get_db()
    if db:
        result = db.table(AUDIT_LOG_TABLE).insert(row).execute()
        rows = result.data or []
        return rows[0] if rows else row
    _mem_events.append(row)
    return row


def list_events(limit: int = 200, event_type: Optional[str] = None) -> List[Dict[str, Any]]:
    db = get_db()
    if db:
        q = db.table(AUDIT_LOG_TABLE).select("*").order("created_at", desc=True)
        if event_type:
            q = q.eq("event_type", event_type)
        result = q.limit(limit).execute()
        return result.data or []
    rows = sorted(_mem_events, key=lambda x: x.get("created_at", ""), reverse=True)
    if event_type:
        rows = [r for r in rows if r.get("event_type") == event_type]
    return rows[:limit]
