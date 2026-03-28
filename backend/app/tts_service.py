"""
TTS-Service — Text → Audio via Mistral TTS API (voxtral-mini-tts-2603).
Response ist Raw-Audio-Bytes (kein JSON), voice-Parameter ist Pflichtfeld.
"""
import logging

from .config import MISTRAL_TTS_MODEL
from .mistral_client import MistralError, mistral_post_stream

logger = logging.getLogger(__name__)

_DEFAULT_TTS_MODEL = "voxtral-mini-tts-2603"
_DEFAULT_VOICE = "casual_male"
_DEFAULT_FORMAT = "mp3"

# Einfaches In-Process-Cache (Text → Audio-Bytes)
_cache: dict[str, bytes] = {}
_MAX_CACHE = 100


def synthesize(
    text: str,
    voice: str = _DEFAULT_VOICE,
    response_format: str = _DEFAULT_FORMAT,
) -> bytes:
    """
    Konvertiert Text zu Audio-Bytes via Mistral TTS API.

    Returns:
        Raw Audio-Bytes im gewünschten Format (Standard: mp3)
    """
    if not text or not text.strip():
        raise ValueError("Kein Text für TTS angegeben")

    cache_key = f"{voice}:{response_format}:{text[:200]}"
    if cache_key in _cache:
        logger.debug("TTS: Cache-Treffer")
        return _cache[cache_key]

    model = MISTRAL_TTS_MODEL or _DEFAULT_TTS_MODEL
    logger.info("TTS: Synthetisiere %d Zeichen mit Modell %s, Stimme %s", len(text), model, voice)

    payload = {
        "model": model,
        "input": text,
        "voice": voice,
        "response_format": response_format,
    }

    # Response ist Raw-Bytes (kein JSON)
    audio_bytes = mistral_post_stream("/audio/speech", payload)

    if not audio_bytes:
        raise MistralError("TTS API hat kein Audio zurückgegeben")

    logger.info("TTS: %d Bytes Audio generiert", len(audio_bytes))

    if len(_cache) >= _MAX_CACHE:
        oldest = next(iter(_cache))
        del _cache[oldest]
    _cache[cache_key] = audio_bytes

    return audio_bytes
