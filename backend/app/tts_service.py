"""
TTS-Service — Text → Audio via Mistral TTS API (voxtral-mini-tts-2603).
Response ist Base64-kodiertes Audio, Format: mp3.
"""
import base64
import logging

from .config import MISTRAL_TTS_MODEL
from .mistral_client import MistralError, mistral_post_json

logger = logging.getLogger(__name__)

_DEFAULT_TTS_MODEL = "voxtral-mini-tts-2603"
_DEFAULT_FORMAT = "mp3"

# Einfaches In-Process-Cache (Text-Hash → Audio-Bytes)
_cache: dict[str, bytes] = {}
_MAX_CACHE = 100


def synthesize(text: str, response_format: str = _DEFAULT_FORMAT) -> bytes:
    """
    Konvertiert Text zu Audio-Bytes via Mistral TTS API.

    Returns:
        Audio-Bytes im gewünschten Format (Standard: mp3)
    """
    if not text or not text.strip():
        raise ValueError("Kein Text für TTS angegeben")

    cache_key = f"{text[:200]}:{response_format}"
    if cache_key in _cache:
        logger.debug("TTS: Cache-Treffer")
        return _cache[cache_key]

    model = MISTRAL_TTS_MODEL or _DEFAULT_TTS_MODEL
    logger.info("TTS: Synthetisiere %d Zeichen mit Modell %s", len(text), model)

    payload = {
        "model": model,
        "input": text,
        "response_format": response_format,
    }

    result = mistral_post_json("/audio/speech", payload)

    audio_b64 = result.get("audio_data") or result.get("audio")
    if not audio_b64:
        raise MistralError("TTS API hat kein Audio zurückgegeben")

    audio_bytes = base64.b64decode(audio_b64)
    logger.info("TTS: %d Bytes Audio generiert", len(audio_bytes))

    # Cache befüllen (LRU-ähnlich: älteste entfernen wenn voll)
    if len(_cache) >= _MAX_CACHE:
        oldest = next(iter(_cache))
        del _cache[oldest]
    _cache[cache_key] = audio_bytes

    return audio_bytes
