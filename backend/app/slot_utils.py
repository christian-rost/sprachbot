"""
Slot-Hilfsfunktionen — geteilt zwischen flow_engine und graph_engine.
Ausgelagert um zirkuläre Imports zu vermeiden.
"""
import re


def validate_slot(value: str, slot_def: dict) -> tuple[bool, str | None]:
    """Validiert einen Slot-Wert gegen seine Definition."""
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


def render_template(template: str, slots: dict) -> str:
    """Ersetzt {{slot_name}} Platzhalter mit Slot-Werten."""
    for key, value in slots.items():
        template = template.replace(f"{{{{{key}}}}}", str(value or ""))
    return template
