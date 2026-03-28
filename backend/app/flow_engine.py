"""
Flow-Engine — steuert den Konversationsfluss.

Ablauf pro Turn:
  1. Intent aus STT-Text erkennen (via LLM)
  2. Passenden Flow finden
  3. Fehlende Slots ermitteln
  4. Rückfrage generieren ODER Aktion ausführen
"""
import logging
import re

from .flow_storage import get_flow_by_intent, list_flows
from .llm_service import detect_intent, generate_response
from .mistral_client import MistralError

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Slot-Validierung
# ---------------------------------------------------------------------------

def validate_slot(value: str, slot_def: dict) -> tuple[bool, str | None]:
    """
    Validiert einen Slot-Wert gegen seine Definition.
    Returns (is_valid, error_message_or_None)
    """
    slot_type = slot_def.get("type", "string")

    if slot_type == "enum":
        allowed = [v.lower() for v in slot_def.get("values", [])]
        if value.lower() not in allowed:
            return False, f"Erlaubte Werte: {', '.join(slot_def.get('values', []))}"
        return True, None

    if slot_type == "email":
        if not re.match(r"^[^@]+@[^@]+\.[^@]+$", value):
            return False, "Bitte geben Sie eine gültige E-Mail-Adresse an."
        return True, None

    if slot_type == "boolean":
        if value.lower() not in {"ja", "nein", "yes", "no", "true", "false", "1", "0"}:
            return False, "Bitte antworten Sie mit 'ja' oder 'nein'."
        return True, None

    if slot_type == "string":
        min_len = slot_def.get("min_length", 1)
        max_len = slot_def.get("max_length", 500)
        if len(value.strip()) < min_len:
            return False, "Bitte geben Sie einen gültigen Wert an."
        if len(value.strip()) > max_len:
            return False, f"Maximale Länge: {max_len} Zeichen."
        return True, None

    return True, None


def normalize_slot(value: str, slot_def: dict) -> str:
    """Normalisiert einen Slot-Wert (z.B. Boolean-Werte vereinheitlichen)."""
    slot_type = slot_def.get("type", "string")

    if slot_type == "boolean":
        return "true" if value.lower() in {"ja", "yes", "true", "1"} else "false"

    if slot_type == "enum":
        for allowed in slot_def.get("values", []):
            if value.lower() == allowed.lower():
                return allowed
        return value

    return value.strip()


# ---------------------------------------------------------------------------
# Slot-Template-Rendering
# ---------------------------------------------------------------------------

def render_template(template: str, slots: dict) -> str:
    """Ersetzt {{slot_name}} Platzhalter mit Slot-Werten."""
    for key, value in slots.items():
        template = template.replace(f"{{{{{key}}}}}", str(value or ""))
    return template


# ---------------------------------------------------------------------------
# Haupt-Turn-Verarbeitung
# ---------------------------------------------------------------------------

def process_turn(
    user_text: str,
    session: dict,
    messages: list[dict],
) -> dict:
    """
    Verarbeitet einen Konversations-Turn vollständig.

    Args:
        user_text: Transkribierter Nutzertext
        session: Aktuelle Session (id, intent, slots, turn_count)
        messages: Bisherige Nachrichten

    Returns:
        dict mit:
          - reply: Antworttext für den Nutzer
          - intent: Erkannter Intent
          - slots: Aktuell gesammelte Slots
          - action: None | "complete" | "confirm"
          - flow_id: ID des aktiven Flows (oder None)
          - updated_session: Aktualisierte Session-Felder
    """
    active_flows = list_flows(active_only=True)
    flows_for_llm = [
        {"name": f["name"], "intent": f["intent_name"], "slots": f["definition"].get("slots", {})}
        for f in active_flows
    ]

    # Aktueller Intent und Slots aus der Session
    current_intent = session.get("intent")
    current_slots = dict(session.get("slots") or {})
    turn_count = session.get("turn_count", 0)

    # Intent erkennen (immer neu, da Nutzer Intent wechseln kann)
    try:
        intent_result = detect_intent(
            user_text=user_text,
            available_flows=flows_for_llm,
            conversation_history=messages,
        )
    except MistralError as e:
        return {
            "reply": "Entschuldigung, ich konnte Ihre Eingabe nicht verarbeiten. Bitte versuchen Sie es erneut.",
            "intent": current_intent,
            "slots": current_slots,
            "action": None,
            "flow_id": None,
            "updated_session": {},
            "error": str(e),
        }

    detected_intent = intent_result.get("intent", "unknown")
    new_slots = intent_result.get("slots") or {}

    # Intent geändert → neuer Flow, Slots zurücksetzen
    if detected_intent != "unknown" and detected_intent != current_intent:
        current_intent = detected_intent
        current_slots = {}

    # Neue Slots einfügen (nur wenn Wert vorhanden)
    for k, v in new_slots.items():
        if v is not None and str(v).strip():
            current_slots[k] = v

    # Flow für diesen Intent laden
    flow = get_flow_by_intent(current_intent) if current_intent and current_intent != "unknown" else None

    if not flow:
        # Kein passender Flow → freie LLM-Antwort
        try:
            reply = generate_response(user_text, messages)
        except MistralError:
            reply = "Ich kann Ihnen bei diesem Anliegen leider nicht helfen. Bitte kontaktieren Sie den Support."
        return {
            "reply": reply,
            "intent": current_intent,
            "slots": current_slots,
            "action": None,
            "flow_id": None,
            "updated_session": {"intent": current_intent, "slots": current_slots},
        }

    definition = flow.get("definition", {})
    slot_defs = definition.get("slots", {})
    max_turns = definition.get("max_turns", 10)

    # Max-Turns überschritten → abbrechen
    if turn_count >= max_turns:
        return {
            "reply": "Das Gespräch hat die maximale Länge erreicht. Bitte starten Sie eine neue Sitzung.",
            "intent": current_intent,
            "slots": current_slots,
            "action": "abort",
            "flow_id": flow["id"],
            "updated_session": {"status": "abandoned", "intent": current_intent, "slots": current_slots},
        }

    # Fehlende Pflicht-Slots ermitteln
    missing = _find_missing_slots(slot_defs, current_slots)

    if missing:
        slot_name = missing[0]
        slot_def = slot_defs[slot_name]

        # Slot-Validierung für gerade genannten Wert
        if slot_name in new_slots and new_slots[slot_name]:
            valid, err = validate_slot(str(new_slots[slot_name]), slot_def)
            if not valid:
                return {
                    "reply": err or slot_def.get("question", f"Bitte geben Sie {slot_name} an."),
                    "intent": current_intent,
                    "slots": current_slots,
                    "action": None,
                    "flow_id": flow["id"],
                    "updated_session": {"intent": current_intent, "slots": current_slots},
                }
            else:
                current_slots[slot_name] = normalize_slot(str(new_slots[slot_name]), slot_def)
                missing = _find_missing_slots(slot_defs, current_slots)

        if missing:
            next_slot = missing[0]
            question = slot_defs[next_slot].get("question", f"Bitte geben Sie {next_slot} an.")
            return {
                "reply": question,
                "intent": current_intent,
                "slots": current_slots,
                "action": None,
                "flow_id": flow["id"],
                "updated_session": {"intent": current_intent, "slots": current_slots},
            }

    # Alle Slots gefüllt → Bestätigungsschritt
    confirmation_template = definition.get("confirmation")
    if confirmation_template and not session.get("confirmed"):
        confirmation = render_template(confirmation_template, current_slots)
        return {
            "reply": confirmation,
            "intent": current_intent,
            "slots": current_slots,
            "action": "confirm",
            "flow_id": flow["id"],
            "updated_session": {"intent": current_intent, "slots": current_slots},
        }

    # Bestätigung erhalten oder kein Bestätigungsschritt → abschließen
    if confirmation_template:
        confirmed = _is_confirmation(user_text)
        if not confirmed:
            return {
                "reply": "Verstanden, ich breche die Aktion ab. Wie kann ich Ihnen sonst helfen?",
                "intent": None,
                "slots": {},
                "action": "cancelled",
                "flow_id": flow["id"],
                "updated_session": {"intent": None, "slots": {}, "status": "active"},
            }

    # Webhook ausführen falls konfiguriert
    action_def = definition.get("action", {})
    webhook_error = None
    if action_def.get("type") == "webhook" and action_def.get("webhook_id"):
        try:
            from .webhook_service import WebhookError, execute_webhook
            execute_webhook(
                webhook_id=action_def["webhook_id"],
                slots=current_slots,
                session_id=session.get("id"),
                payload_template=action_def.get("payload_template"),
            )
        except Exception as e:
            webhook_error = str(e)
            logger.warning("Webhook-Ausführung fehlgeschlagen: %s", e)

    if webhook_error:
        return {
            "reply": f"Die Aktion konnte leider nicht ausgeführt werden. Bitte versuchen Sie es später erneut.",
            "intent": current_intent,
            "slots": current_slots,
            "action": "error",
            "flow_id": flow["id"],
            "updated_session": {"intent": current_intent, "slots": current_slots},
            "error": webhook_error,
        }

    success = render_template(
        definition.get("success_message", "Ihre Anfrage wurde erfolgreich ausgeführt."),
        current_slots,
    )

    return {
        "reply": success,
        "intent": current_intent,
        "slots": current_slots,
        "action": "complete",
        "flow_id": flow["id"],
        "updated_session": {"intent": None, "slots": {}, "status": "completed"},
    }


def _find_missing_slots(slot_defs: dict, current_slots: dict) -> list[str]:
    """Gibt Liste der fehlenden Pflicht-Slots zurück."""
    missing = []
    for name, defn in slot_defs.items():
        if defn.get("required", True):
            val = current_slots.get(name)
            if not val or not str(val).strip():
                missing.append(name)
    return missing


def _is_confirmation(text: str) -> bool:
    """Erkennt ob der Nutzer bestätigt hat."""
    text_lower = text.lower().strip()
    positive = {"ja", "yes", "ok", "okay", "bitte", "gerne", "stimmt", "richtig",
                "korrekt", "bestätigen", "ausführen", "machen", "weiter"}
    return any(word in text_lower for word in positive)
