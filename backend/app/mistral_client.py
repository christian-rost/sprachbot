"""
Mistral AI API client — zentraler Zugriffspunkt für alle Mistral-Dienste.
Alle Services (STT, LLM, TTS) nutzen diesen Client.
"""
import logging
from functools import lru_cache

import httpx

from .config import MISTRAL_API_KEY

logger = logging.getLogger(__name__)

MISTRAL_BASE_URL = "https://api.mistral.ai/v1"
REQUEST_TIMEOUT = 60.0


class MistralError(Exception):
    """Fehler bei der Mistral-API-Kommunikation."""
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


def _get_headers() -> dict:
    if not MISTRAL_API_KEY:
        raise MistralError("MISTRAL_API_KEY ist nicht konfiguriert")
    return {
        "Authorization": f"Bearer {MISTRAL_API_KEY}",
    }


def mistral_post_json(path: str, payload: dict) -> dict:
    """JSON-POST an die Mistral API. Gibt geparste Antwort zurück."""
    headers = _get_headers()
    headers["Content-Type"] = "application/json"
    try:
        response = httpx.post(
            f"{MISTRAL_BASE_URL}{path}",
            headers=headers,
            json=payload,
            timeout=REQUEST_TIMEOUT,
        )
    except httpx.RequestError as e:
        raise MistralError(f"Netzwerkfehler: {e}") from e

    if response.status_code >= 400:
        _raise_api_error(response)

    return response.json()


def mistral_post_multipart(path: str, files: dict, data: dict | None = None) -> dict:
    """Multipart-POST an die Mistral API (für Audio-Uploads)."""
    headers = _get_headers()
    try:
        response = httpx.post(
            f"{MISTRAL_BASE_URL}{path}",
            headers=headers,
            files=files,
            data=data or {},
            timeout=REQUEST_TIMEOUT,
        )
    except httpx.RequestError as e:
        raise MistralError(f"Netzwerkfehler: {e}") from e

    if response.status_code >= 400:
        _raise_api_error(response)

    return response.json()


def mistral_post_stream(path: str, payload: dict) -> bytes:
    """POST an die Mistral API, gibt rohe Bytes zurück (für TTS-Audio)."""
    headers = _get_headers()
    headers["Content-Type"] = "application/json"
    try:
        response = httpx.post(
            f"{MISTRAL_BASE_URL}{path}",
            headers=headers,
            json=payload,
            timeout=REQUEST_TIMEOUT,
        )
    except httpx.RequestError as e:
        raise MistralError(f"Netzwerkfehler: {e}") from e

    if response.status_code >= 400:
        _raise_api_error(response)

    return response.content


def _raise_api_error(response: httpx.Response) -> None:
    try:
        detail = response.json().get("message") or response.json().get("detail") or response.text
    except Exception:
        detail = response.text
    logger.error("Mistral API Fehler %s: %s", response.status_code, detail)
    raise MistralError(f"Mistral API Fehler {response.status_code}: {detail}", status_code=response.status_code)
