"""
Graph-basierte Flow-Engine — traversiert Node/Edge-Graphen.
Wird von flow_engine.py aufgerufen wenn definition.nodes vorhanden ist.

Node-Typen:
  start     — Eingang, keine Aktion, leitet zu erstem Node weiter
  slot      — Sammelt Nutzereingabe (fragt per LLM nach)
  dialog    — LLM-generierte Antwort mit optionalem Prompt-Hint
  webhook   — Führt Webhook aus, geht dann zum nächsten Node
  condition — Verzweigt basierend auf Edges (erste passende)
  end       — Beendet Flow mit Abschlussnachricht
"""
import logging

from .llm_service import MistralError, generate_response, generate_slot_reply
from .mistral_client import MistralError as MistralClientError
from .slot_utils import normalize_slot, render_template, validate_slot

logger = logging.getLogger(__name__)

MAX_DEPTH = 20  # Verhindert Endlosschleifen


def is_graph_flow(definition: dict) -> bool:
    """Gibt True zurück wenn die Flow-Definition als Node-Graph vorliegt."""
    return bool(definition.get("nodes"))


def process_graph_turn(
    user_text: str,
    session: dict,
    messages: list[dict],
    flow: dict,
    flows_for_llm: list[dict],
) -> dict:
    """
    Verarbeitet einen Turn in einem Graph-basierten Flow.

    Traversiert den Node-Graphen vom aktuellen Node aus, führt Aktionen aus
    und gibt Antwort + aktualisierte Session zurück.
    """
    definition = flow["definition"]
    nodes_list = definition.get("nodes", [])
    edges_list = definition.get("edges", [])

    # Index für schnellen Zugriff
    nodes = {n["id"]: n for n in nodes_list}

    # Adjacency: source_id → [{target, label, id}]
    adjacency: dict[str, list[dict]] = {}
    for e in edges_list:
        adjacency.setdefault(e["source"], []).append({
            "target": e["target"],
            "label": e.get("label", ""),
            "id": e.get("id", ""),
        })

    # Start-Node ermitteln
    start_id = next(
        (n["id"] for n in nodes_list if n["type"] == "start"),
        nodes_list[0]["id"] if nodes_list else None,
    )

    current_node_id = session.get("current_node_id") or start_id
    current_slots = dict(session.get("slots") or {})

    return _run_node(
        node_id=current_node_id,
        user_text=user_text,
        nodes=nodes,
        adjacency=adjacency,
        slots=current_slots,
        session=session,
        messages=messages,
        flow=flow,
        flows_for_llm=flows_for_llm,
        depth=0,
    )


def _run_node(
    node_id: str,
    user_text: str,
    nodes: dict,
    adjacency: dict,
    slots: dict,
    session: dict,
    messages: list,
    flow: dict,
    flows_for_llm: list,
    depth: int,
) -> dict:
    if depth > MAX_DEPTH:
        logger.error("Graph-Engine: MAX_DEPTH überschritten — mögliche Endlosschleife")
        return _make_complete("Flow-Fehler: Maximale Tiefe erreicht.", flow, slots)

    node = nodes.get(node_id)
    if not node:
        logger.error("Graph-Engine: Node '%s' nicht gefunden", node_id)
        return _make_complete("Interner Fehler. Bitte versuchen Sie es erneut.", flow, slots)

    ntype = node["type"]
    data = node.get("data", {})

    # ------------------------------------------------------------------ START
    if ntype == "start":
        nxt = _first_next(node_id, adjacency)
        if nxt:
            return _run_node(nxt, user_text, nodes, adjacency, slots, session, messages, flow, flows_for_llm, depth + 1)
        return _make_complete("Kein Flow konfiguriert.", flow, slots)

    # ------------------------------------------------------------------ SLOT
    if ntype == "slot":
        slot_name = data.get("slot_name", "")
        question = data.get("question", f"Bitte geben Sie {slot_name} an.")

        # Slot-Definition aus Node-Daten aufbauen
        slot_def: dict = {"type": data.get("slot_type", "string"), "required": True}
        if data.get("enum_values"):
            slot_def["type"] = "enum"
            slot_def["values"] = [v.strip() for v in data["enum_values"].split(",") if v.strip()]

        # Bereits gefüllt → weiter
        if slot_name and slot_name in slots and str(slots.get(slot_name, "")).strip():
            nxt = _first_next(node_id, adjacency)
            if nxt:
                return _run_node(nxt, user_text, nodes, adjacency, slots, session, messages, flow, flows_for_llm, depth + 1)

        # Nutzer antwortet gerade auf diese Frage
        if user_text and session.get("current_node_id") == node_id:
            valid, err = validate_slot(user_text.strip(), slot_def)
            if valid:
                slots[slot_name] = normalize_slot(user_text.strip(), slot_def)
                nxt = _first_next(node_id, adjacency)
                if nxt:
                    return _run_node(nxt, user_text, nodes, adjacency, slots, session, messages, flow, flows_for_llm, depth + 1)
            else:
                return _make_reply(
                    reply=err or question,
                    node_id=node_id,
                    slots=slots,
                    session=session,
                    flow=flow,
                )

        # Frage stellen (LLM-naturalisiert)
        try:
            reply = generate_slot_reply(
                user_text=user_text,
                flow_name=flow.get("name", ""),
                next_question=question,
                collected_slots=slots,
                conversation_history=messages,
            )
        except Exception:
            reply = question

        return _make_reply(reply=reply, node_id=node_id, slots=slots, session=session, flow=flow)

    # ---------------------------------------------------------------- DIALOG
    if ntype in ("dialog", "llm"):
        prompt_hint = data.get("prompt", "")
        try:
            reply = generate_response(
                user_text=user_text,
                conversation_history=messages,
                context=prompt_hint or None,
                available_flows=flows_for_llm,
            )
        except (MistralError, MistralClientError):
            reply = "Ich konnte Ihre Anfrage leider nicht verarbeiten. Bitte versuchen Sie es erneut."

        nxt = _first_next(node_id, adjacency)
        if not nxt or nodes.get(nxt, {}).get("type") == "end":
            end_data = nodes.get(nxt, {}).get("data", {}) if nxt else {}
            suffix = render_template(end_data.get("message", ""), slots)
            full_reply = reply + ("\n\n" + suffix if suffix else "")
            return _make_complete(full_reply, flow, slots)

        return {
            "reply": reply,
            "intent": session.get("intent"),
            "slots": slots,
            "action": None,
            "flow_id": flow["id"],
            "updated_session": {"slots": slots, "current_node_id": nxt},
        }

    # --------------------------------------------------------------- WEBHOOK
    if ntype == "webhook":
        webhook_id = data.get("webhook_id", "")
        if webhook_id:
            try:
                from .webhook_service import execute_webhook
                execute_webhook(
                    webhook_id=webhook_id,
                    slots=slots,
                    session_id=session.get("id"),
                    payload_template=data.get("payload_template"),
                )
            except Exception as e:
                logger.warning("Graph-Webhook fehlgeschlagen: %s", e)

        nxt = _first_next(node_id, adjacency)
        if nxt:
            return _run_node(nxt, user_text, nodes, adjacency, slots, session, messages, flow, flows_for_llm, depth + 1)
        return _make_complete("Aktion wurde ausgeführt.", flow, slots)

    # ------------------------------------------------------------- CONDITION
    if ntype == "condition":
        nexts = adjacency.get(node_id, [])
        if nexts:
            return _run_node(nexts[0]["target"], user_text, nodes, adjacency, slots, session, messages, flow, flows_for_llm, depth + 1)
        return _make_complete("", flow, slots)

    # ------------------------------------------------------------------- END
    if ntype == "end":
        msg = render_template(
            data.get("message", "Vielen Dank! Ihre Anfrage wurde erfolgreich bearbeitet."),
            slots,
        )
        return _make_complete(msg, flow, slots)

    logger.warning("Graph-Engine: Unbekannter Node-Typ '%s'", ntype)
    return _make_complete("Unbekannter Schritt im Flow.", flow, slots)


# ---------------------------------------------------------------------------
# Hilfsfunktionen
# ---------------------------------------------------------------------------

def _first_next(node_id: str, adjacency: dict) -> str | None:
    nexts = adjacency.get(node_id, [])
    return nexts[0]["target"] if nexts else None


def _make_reply(reply: str, node_id: str, slots: dict, session: dict, flow: dict) -> dict:
    return {
        "reply": reply,
        "intent": session.get("intent"),
        "slots": slots,
        "action": None,
        "flow_id": flow["id"],
        "updated_session": {"slots": slots, "current_node_id": node_id},
    }


def _make_complete(reply: str, flow: dict, slots: dict) -> dict:
    return {
        "reply": reply,
        "intent": None,
        "slots": slots,
        "action": "complete",
        "flow_id": flow["id"],
        "updated_session": {
            "intent": None,
            "slots": {},
            "status": "completed",
            "current_node_id": None,
        },
    }
