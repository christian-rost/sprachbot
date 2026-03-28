"""
LLM-Service — Intent-Erkennung + Slot-Filling via Mistral Chat API.
Erzwingt JSON-Antworten über response_format.
"""
import json
import logging
from typing import Any

from .config import MISTRAL_LLM_MODEL
from .mistral_client import MistralError, mistral_post_json

logger = logging.getLogger(__name__)

SYSTEM_PROMPT_INTENT = """\
Du bist ein Intent-Erkennungs-Assistent für ein Sprachbot-System.

Deine Aufgabe:
1. Erkenne den Intent des Nutzers aus der Liste verfügbarer Flows
2. Extrahiere bereits genannte Slot-Werte
3. Antworte AUSSCHLIESSLICH im folgenden JSON-Format:

{
  "intent": "<intent_name oder 'unknown'>",
  "confidence": <0.0 bis 1.0>,
  "slots": {
    "<slot_name>": "<wert oder null>"
  },
  "needs_clarification": <true oder false>,
  "clarification_question": "<Rückfrage an den Nutzer oder null>"
}

Regeln:
- Sei präzise bei der Intent-Erkennung
- Extrahiere nur Slots die explizit genannt wurden
- Bei Unklarheit: needs_clarification=true und eine konkrete Rückfrage stellen
- Antworte immer auf Deutsch
- KEINE Erklärungen außerhalb des JSON
"""

SYSTEM_PROMPT_CHAT = """\
Du bist ein freundlicher, professioneller Sprachbot-Assistent.
Antworte präzise, höflich und auf Deutsch.
Halte deine Antworten kurz (1-3 Sätze), da sie vorgelesen werden.
"""


def build_messages(
    conversation_history: list[dict],
    user_message: str,
    system_prompt: str,
) -> list[dict]:
    """Baut die Nachrichten-Liste für die Mistral Chat API."""
    messages = [{"role": "system", "content": system_prompt}]
    for msg in conversation_history[-10:]:  # Max. 10 letzte Nachrichten als Kontext
        role = "user" if msg.get("role") == "user" else "assistant"
        messages.append({"role": role, "content": msg.get("content", "")})
    messages.append({"role": "user", "content": user_message})
    return messages


def detect_intent(
    user_text: str,
    available_flows: list[dict],
    conversation_history: list[dict] | None = None,
) -> dict:
    """
    Erkennt den Intent des Nutzers und extrahiert Slots.

    Args:
        user_text: Transkribierter Nutzertext
        available_flows: Liste aktiver Flows mit name, intent, slots
        conversation_history: Bisherige Gesprächsnachrichten

    Returns:
        dict mit intent, confidence, slots, needs_clarification, clarification_question
    """
    flows_description = _format_flows(available_flows)
    prompt = f"Verfügbare Flows:\n{flows_description}\n\nNutzer sagt: {user_text}"

    messages = build_messages(
        conversation_history or [],
        prompt,
        SYSTEM_PROMPT_INTENT,
    )

    payload = {
        "model": MISTRAL_LLM_MODEL,
        "messages": messages,
        "response_format": {"type": "json_object"},
        "temperature": 0.1,
        "max_tokens": 500,
    }

    logger.info("LLM: Intent-Erkennung für: %s", user_text[:80])
    result = mistral_post_json("/chat/completions", payload)

    raw_content = result["choices"][0]["message"]["content"]
    return _parse_intent_response(raw_content)


def generate_response(
    user_text: str,
    conversation_history: list[dict] | None = None,
    context: str | None = None,
) -> str:
    """
    Generiert eine natürlichsprachige Antwort (für Fallback/Allgemein).

    Returns:
        Antwort-Text als String
    """
    system = SYSTEM_PROMPT_CHAT
    if context:
        system += f"\n\nKontext: {context}"

    messages = build_messages(
        conversation_history or [],
        user_text,
        system,
    )

    payload = {
        "model": MISTRAL_LLM_MODEL,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 300,
    }

    result = mistral_post_json("/chat/completions", payload)
    return result["choices"][0]["message"]["content"].strip()


def _format_flows(flows: list[dict]) -> str:
    if not flows:
        return "Keine Flows konfiguriert."
    lines = []
    for f in flows:
        slots = ", ".join(f.get("slots", {}).keys()) if f.get("slots") else "keine"
        lines.append(f"- Intent: {f['intent']} | Name: {f['name']} | Slots: {slots}")
    return "\n".join(lines)


def _parse_intent_response(raw: str) -> dict:
    """Parst die LLM-JSON-Antwort, tolerant bei kleinen Abweichungen."""
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.warning("LLM Antwort kein gültiges JSON: %s — %s", e, raw[:200])
        return {
            "intent": "unknown",
            "confidence": 0.0,
            "slots": {},
            "needs_clarification": True,
            "clarification_question": "Ich habe Sie leider nicht verstanden. Könnten Sie das bitte wiederholen?",
        }

    return {
        "intent": data.get("intent", "unknown"),
        "confidence": float(data.get("confidence", 0.0)),
        "slots": data.get("slots") or {},
        "needs_clarification": bool(data.get("needs_clarification", False)),
        "clarification_question": data.get("clarification_question"),
    }
