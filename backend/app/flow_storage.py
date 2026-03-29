"""
Flow-Storage — CRUD für Konversations-Flows mit Supabase + In-Memory-Fallback.
"""
import logging
import uuid
from datetime import datetime, timezone

from .config import FLOWS_TABLE
from .database import get_db

logger = logging.getLogger(__name__)

_mem_flows: dict[str, dict] = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def list_flows(active_only: bool = False) -> list[dict]:
    db = get_db()
    if db:
        try:
            q = db.table(FLOWS_TABLE).select("*").order("priority", desc=True)
            if active_only:
                q = q.eq("is_active", True)
            return q.execute().data
        except Exception as e:
            logger.warning("Supabase flow list fehlgeschlagen: %s", e)

    flows = list(_mem_flows.values())
    if active_only:
        flows = [f for f in flows if f.get("is_active", True)]
    flows.sort(key=lambda f: f.get("priority", 0), reverse=True)
    return flows


def get_flow(flow_id: str) -> dict | None:
    db = get_db()
    if db:
        try:
            result = db.table(FLOWS_TABLE).select("*").eq("id", flow_id).execute()
            if result.data:
                return result.data[0]
        except Exception as e:
            logger.warning("Supabase flow get fehlgeschlagen: %s", e)

    return _mem_flows.get(flow_id)


def get_flow_by_intent(intent_name: str) -> dict | None:
    db = get_db()
    if db:
        try:
            result = (
                db.table(FLOWS_TABLE)
                .select("*")
                .eq("intent_name", intent_name)
                .eq("is_active", True)
                .execute()
            )
            return result.data[0] if result.data else None
        except Exception as e:
            logger.warning("Supabase flow by intent fehlgeschlagen: %s", e)

    for f in _mem_flows.values():
        if f.get("intent_name") == intent_name and f.get("is_active", True):
            return f
    return None


def create_flow(
    name: str,
    intent_name: str,
    definition: dict,
    description: str = "",
    system_prompt: str | None = None,
    priority: int = 0,
    created_by: str | None = None,
) -> dict:
    flow = {
        "id": str(uuid.uuid4()),
        "name": name,
        "description": description,
        "intent_name": intent_name,
        "definition": definition,
        "system_prompt": system_prompt,
        "is_active": True,
        "priority": priority,
        "created_at": _now(),
        "updated_at": _now(),
        "created_by": created_by,
    }

    db = get_db()
    if db:
        try:
            result = db.table(FLOWS_TABLE).insert(flow).execute()
            if result.data:
                return result.data[0]
        except Exception as e:
            logger.warning("Supabase flow insert fehlgeschlagen: %s", e)

    _mem_flows[flow["id"]] = flow
    return flow


def update_flow(flow_id: str, updates: dict) -> dict | None:
    updates["updated_at"] = _now()

    db = get_db()
    if db:
        try:
            result = db.table(FLOWS_TABLE).update(updates).eq("id", flow_id).execute()
            if result.data:
                return result.data[0]
        except Exception as e:
            logger.warning("Supabase flow update fehlgeschlagen: %s", e)

    if flow_id in _mem_flows:
        _mem_flows[flow_id].update(updates)
        return _mem_flows[flow_id]
    return None


def delete_flow(flow_id: str) -> bool:
    db = get_db()
    if db:
        try:
            db.table(FLOWS_TABLE).delete().eq("id", flow_id).execute()
            return True
        except Exception as e:
            logger.warning("Supabase flow delete fehlgeschlagen: %s", e)

    if flow_id in _mem_flows:
        del _mem_flows[flow_id]
        return True
    return False


def _deactivate_problematic_flows() -> None:
    """Deaktiviert Flows die keine sinnvolle Aktion haben (z.B. 'allgemeine_auskunft' ohne Slots)."""
    db = get_db()
    if db:
        try:
            db.table(FLOWS_TABLE).update({"is_active": False}).eq("intent_name", "allgemeine_auskunft").execute()
        except Exception:
            pass
    # In-memory
    for f in _mem_flows.values():
        if f.get("intent_name") == "allgemeine_auskunft":
            f["is_active"] = False


def seed_example_flows() -> None:
    """Legt Beispiel-Flows an falls noch keine vorhanden. Bereinigt problematische Seed-Flows."""
    _deactivate_problematic_flows()
    existing = [f for f in list_flows() if f.get("intent_name") != "allgemeine_auskunft"]
    if existing:
        return

    examples = [
        {
            "name": "Passwort zurücksetzen",
            "intent_name": "passwort_reset",
            "description": "Setzt das Passwort eines Benutzers zurück",
            "priority": 10,
            "definition": {
                "slots": {
                    "username": {
                        "type": "string",
                        "required": True,
                        "question": "Für welchen Benutzernamen soll das Passwort zurückgesetzt werden?",
                    }
                },
                "confirmation": "Soll ich das Passwort für '{{username}}' wirklich zurücksetzen?",
                "success_message": "Das Passwort für '{{username}}' wurde erfolgreich zurückgesetzt.",
                "action": {"type": "webhook"},
                "max_turns": 8,
            },
        },
        {
            "name": "Support-Ticket erstellen",
            "intent_name": "ticket_erstellen",
            "description": "Erstellt ein neues Support-Ticket",
            "priority": 8,
            "definition": {
                "slots": {
                    "betreff": {
                        "type": "string",
                        "required": True,
                        "question": "Was ist der Betreff Ihres Anliegens?",
                    },
                    "prioritaet": {
                        "type": "enum",
                        "values": ["niedrig", "mittel", "hoch"],
                        "required": False,
                        "question": "Welche Priorität hat Ihr Anliegen — niedrig, mittel oder hoch?",
                        "default": "mittel",
                    },
                },
                "confirmation": "Soll ich ein Ticket mit dem Betreff '{{betreff}}' (Priorität: {{prioritaet}}) erstellen?",
                "success_message": "Ihr Ticket wurde erfolgreich erstellt.",
                "action": {"type": "webhook"},
                "max_turns": 10,
            },
        },
        {
            "name": "Benutzerkonto sperren",
            "intent_name": "konto_sperren",
            "description": "Sperrt ein Benutzerkonto",
            "priority": 8,
            "definition": {
                "slots": {
                    "username": {
                        "type": "string",
                        "required": True,
                        "question": "Welches Konto soll gesperrt werden?",
                    },
                    "bestaetigung": {
                        "type": "boolean",
                        "required": True,
                        "question": "Sind Sie sicher, dass Sie dieses Konto sperren möchten? (Ja/Nein)",
                    },
                },
                "confirmation": "Soll ich das Konto '{{username}}' wirklich sperren?",
                "success_message": "Das Konto '{{username}}' wurde erfolgreich gesperrt.",
                "action": {"type": "webhook"},
                "max_turns": 6,
            },
        },
    ]

    for ex in examples:
        try:
            create_flow(**ex)
            logger.info("Beispiel-Flow erstellt: %s", ex["name"])
        except Exception as e:
            logger.warning("Beispiel-Flow konnte nicht erstellt werden: %s", e)
