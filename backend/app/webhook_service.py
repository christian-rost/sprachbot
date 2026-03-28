"""
Webhook-Service — führt HTTP-Webhooks mit Retry-Logik aus.
Unterstützt: none, bearer, basic, api_key Auth-Typen.
Payload-Templates: {{slot_name}} wird durch Slot-Werte ersetzt.
"""
import json
import logging
import time

import httpx

from .flow_engine import render_template
from .webhook_storage import get_webhook

logger = logging.getLogger(__name__)


class WebhookError(Exception):
    def __init__(self, message: str, status_code: int | None = None, response_body: str | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.response_body = response_body


def _build_headers(webhook: dict) -> dict:
    headers = {"Content-Type": "application/json"}
    headers.update(webhook.get("headers") or {})

    auth_type = webhook.get("auth_type", "none")
    auth_data = webhook.get("auth_data", "")

    if auth_type == "bearer" and auth_data:
        headers["Authorization"] = f"Bearer {auth_data}"
    elif auth_type == "basic" and auth_data:
        import base64
        headers["Authorization"] = f"Basic {base64.b64encode(auth_data.encode()).decode()}"
    elif auth_type == "api_key" and auth_data:
        # Format: "Header-Name:value"
        if ":" in auth_data:
            key, value = auth_data.split(":", 1)
            headers[key.strip()] = value.strip()

    return headers


def execute_webhook(
    webhook_id: str,
    slots: dict,
    session_id: str | None = None,
    payload_template: dict | None = None,
) -> dict:
    """
    Führt einen Webhook aus.

    Args:
        webhook_id: ID des Webhooks
        slots: Gesammelte Slot-Werte (werden in Payload eingesetzt)
        session_id: Optionale Session-ID für Kontext
        payload_template: Optionales Payload-Template ({{slot}} Platzhalter)

    Returns:
        dict mit success, status_code, response_body
    """
    webhook = get_webhook(webhook_id)
    if not webhook:
        raise WebhookError(f"Webhook '{webhook_id}' nicht gefunden")
    if not webhook.get("is_active", True):
        raise WebhookError(f"Webhook '{webhook.get('name')}' ist deaktiviert")

    # Payload aufbauen
    if payload_template:
        # Template mit Slots befüllen (JSON-String → render → parse)
        template_str = json.dumps(payload_template)
        rendered_str = render_template(template_str, slots)
        try:
            payload = json.loads(rendered_str)
        except json.JSONDecodeError:
            payload = {"rendered": rendered_str}
    else:
        payload = {
            "slots": slots,
            "session_id": session_id,
        }

    url = webhook["url"]
    method = webhook.get("method", "POST").upper()
    headers = _build_headers(webhook)
    timeout = webhook.get("timeout_seconds", 15)
    retry_max = webhook.get("retry_max", 3)

    logger.info("Webhook: %s %s (retry_max=%d)", method, url, retry_max)

    last_error = None
    for attempt in range(1, retry_max + 1):
        try:
            response = httpx.request(
                method=method,
                url=url,
                headers=headers,
                json=payload,
                timeout=timeout,
            )

            if response.status_code >= 500:
                # Server-Fehler → retry
                last_error = WebhookError(
                    f"Webhook HTTP {response.status_code}",
                    status_code=response.status_code,
                    response_body=response.text[:500],
                )
                if attempt < retry_max:
                    wait = 2 ** (attempt - 1)  # Exponential backoff: 1s, 2s, 4s
                    logger.warning("Webhook Versuch %d fehlgeschlagen, warte %ds", attempt, wait)
                    time.sleep(wait)
                continue

            if response.status_code >= 400:
                raise WebhookError(
                    f"Webhook HTTP {response.status_code}: {response.text[:200]}",
                    status_code=response.status_code,
                    response_body=response.text[:500],
                )

            logger.info("Webhook erfolgreich: HTTP %d", response.status_code)
            return {
                "success": True,
                "status_code": response.status_code,
                "response_body": response.text[:500],
                "attempts": attempt,
            }

        except httpx.RequestError as e:
            last_error = WebhookError(f"Netzwerkfehler: {e}")
            if attempt < retry_max:
                time.sleep(2 ** (attempt - 1))

    raise last_error or WebhookError("Webhook fehlgeschlagen nach allen Versuchen")
