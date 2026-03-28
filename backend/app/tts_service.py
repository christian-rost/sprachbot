"""
TTS-Service — Text → Audio via Mistral TTS SDK (voxtral-mini-tts-2603).
Nutzt mistralai SDK: client.audio.speech.complete()
Response: response.audio_data (Base64) → decode zu Bytes.
"""
import base64
import logging

from mistralai import Mistral

from .config import MISTRAL_API_KEY, MISTRAL_TTS_MODEL, MISTRAL_TTS_VOICE

logger = logging.getLogger(__name__)

_DEFAULT_TTS_MODEL = "voxtral-mini-tts-2603"
_DEFAULT_FORMAT = "mp3"

# In-Process-Cache
_cache: dict[str, bytes] = {}
_MAX_CACHE = 100


def _get_client() -> Mistral:
    if not MISTRAL_API_KEY:
        raise ValueError("MISTRAL_API_KEY ist nicht konfiguriert")
    return Mistral(api_key=MISTRAL_API_KEY)


def synthesize(
    text: str,
    voice_id: str | None = None,
    response_format: str = _DEFAULT_FORMAT,
) -> bytes:
    """
    Konvertiert Text zu Audio-Bytes via Mistral TTS SDK.

    Returns:
        Raw Audio-Bytes im gewünschten Format (Standard: mp3)
    """
    if not text or not text.strip():
        raise ValueError("Kein Text für TTS angegeben")

    voice = voice_id or MISTRAL_TTS_VOICE
    if not voice:
        raise ValueError("Keine TTS-Stimme konfiguriert (MISTRAL_TTS_VOICE)")

    model = MISTRAL_TTS_MODEL or _DEFAULT_TTS_MODEL
    cache_key = f"{voice}:{response_format}:{text[:200]}"

    if cache_key in _cache:
        logger.debug("TTS: Cache-Treffer")
        return _cache[cache_key]

    logger.info("TTS: Synthetisiere %d Zeichen mit Modell %s, voice_id=%s", len(text), model, voice)

    client = _get_client()
    response = client.audio.speech.complete(
        model=model,
        input=text,
        voice_id=voice,
        response_format=response_format,
    )

    audio_bytes = base64.b64decode(response.audio_data)

    if not audio_bytes:
        raise ValueError("TTS API hat kein Audio zurückgegeben")

    logger.info("TTS: %d Bytes Audio generiert", len(audio_bytes))

    if len(_cache) >= _MAX_CACHE:
        oldest = next(iter(_cache))
        del _cache[oldest]
    _cache[cache_key] = audio_bytes

    return audio_bytes
