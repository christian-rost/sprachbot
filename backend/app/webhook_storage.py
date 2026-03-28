"""
Webhook-Storage — CRUD für Webhook-Konfigurationen mit verschlüsselten Auth-Daten.
"""
import logging
import uuid
from datetime import datetime, timezone

from .config import CONFIG_WEBHOOKS_TABLE, PROVIDER_KEY_ENCRYPTION_KEY
from .database import get_db

logger = logging.getLogger(__name__)

_mem_webhooks: dict[str, dict] = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _encrypt(value: str) -> str:
    if not value or not PROVIDER_KEY_ENCRYPTION_KEY:
        return value
    try:
        from cryptography.fernet import Fernet
        return Fernet(PROVIDER_KEY_ENCRYPTION_KEY.encode()).encrypt(value.encode()).decode()
    except Exception as e:
        logger.warning("Verschlüsselung fehlgeschlagen: %s", e)
        return value


def _decrypt(value: str) -> str:
    if not value or not PROVIDER_KEY_ENCRYPTION_KEY:
        return value
    try:
        from cryptography.fernet import Fernet
        return Fernet(PROVIDER_KEY_ENCRYPTION_KEY.encode()).decrypt(value.encode()).decode()
    except Exception:
        return value


def _prepare_for_db(webhook: dict) -> dict:
    row = dict(webhook)
    if row.get("auth_data"):
        row["auth_enc"] = _encrypt(row.pop("auth_data"))
    return row


def _db_to_webhook(row: dict) -> dict:
    wh = dict(row)
    if wh.get("auth_enc"):
        wh["auth_data"] = _decrypt(wh.pop("auth_enc"))
    return wh


def list_webhooks() -> list[dict]:
    db = get_db()
    if db:
        try:
            result = db.table(CONFIG_WEBHOOKS_TABLE).select("*").order("name").execute()
            return [_db_to_webhook(r) for r in result.data]
        except Exception as e:
            logger.warning("Supabase webhook list fehlgeschlagen: %s", e)
    return [_db_to_webhook(w) for w in _mem_webhooks.values()]


def get_webhook(webhook_id: str) -> dict | None:
    db = get_db()
    if db:
        try:
            result = db.table(CONFIG_WEBHOOKS_TABLE).select("*").eq("id", webhook_id).execute()
            if result.data:
                return _db_to_webhook(result.data[0])
        except Exception as e:
            logger.warning("Supabase webhook get fehlgeschlagen: %s", e)
    raw = _mem_webhooks.get(webhook_id)
    return _db_to_webhook(raw) if raw else None


def create_webhook(
    name: str,
    url: str,
    method: str = "POST",
    auth_type: str = "none",
    auth_data: str | None = None,
    headers: dict | None = None,
    timeout_seconds: int = 15,
    retry_max: int = 3,
) -> dict:
    webhook = {
        "id": str(uuid.uuid4()),
        "name": name,
        "url": url,
        "method": method.upper(),
        "auth_type": auth_type,
        "auth_data": auth_data or "",
        "headers": headers or {},
        "timeout_seconds": timeout_seconds,
        "retry_max": retry_max,
        "is_active": True,
        "created_at": _now(),
        "updated_at": _now(),
    }

    db = get_db()
    if db:
        try:
            result = db.table(CONFIG_WEBHOOKS_TABLE).insert(_prepare_for_db(webhook)).execute()
            if result.data:
                return _db_to_webhook(result.data[0])
        except Exception as e:
            logger.warning("Supabase webhook insert fehlgeschlagen: %s", e)

    _mem_webhooks[webhook["id"]] = _prepare_for_db(webhook)
    return webhook


def update_webhook(webhook_id: str, updates: dict) -> dict | None:
    updates["updated_at"] = _now()
    db = get_db()
    if db:
        try:
            result = db.table(CONFIG_WEBHOOKS_TABLE).update(_prepare_for_db(updates)).eq("id", webhook_id).execute()
            if result.data:
                return _db_to_webhook(result.data[0])
        except Exception as e:
            logger.warning("Supabase webhook update fehlgeschlagen: %s", e)
    if webhook_id in _mem_webhooks:
        _mem_webhooks[webhook_id].update(_prepare_for_db(updates))
        return _db_to_webhook(_mem_webhooks[webhook_id])
    return None


def delete_webhook(webhook_id: str) -> bool:
    db = get_db()
    if db:
        try:
            db.table(CONFIG_WEBHOOKS_TABLE).delete().eq("id", webhook_id).execute()
            _mem_webhooks.pop(webhook_id, None)
            return True
        except Exception as e:
            logger.warning("Supabase webhook delete fehlgeschlagen: %s", e)
    if webhook_id in _mem_webhooks:
        del _mem_webhooks[webhook_id]
        return True
    return False
