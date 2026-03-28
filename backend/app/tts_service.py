"""
TTS-Service — Text → Audio via Mistral TTS SDK (voxtral-mini-tts-2603).
Wählt automatisch eine verfügbare Stimme (bevorzugt Deutsch).
"""
import base64
import logging

try:
    from mistralai import Mistral
except ImportError:
    from mistralai.client import Mistral

from .config import MISTRAL_API_KEY, MISTRAL_TTS_MODEL, MISTRAL_TTS_VOICE

logger = logging.getLogger(__name__)

_DEFAULT_TTS_MODEL = "voxtral-mini-tts-2603"
_DEFAULT_FORMAT = "mp3"

_cache: dict[str, bytes] = {}
_MAX_CACHE = 100
_resolved_voice_id: str | None = None


def _get_client() -> Mistral:
    if not MISTRAL_API_KEY:
        raise ValueError("MISTRAL_API_KEY ist nicht konfiguriert")
    return Mistral(api_key=MISTRAL_API_KEY)


def resolve_voice_id() -> str | None:
    """
    Gibt die konfigurierte oder automatisch gewählte Voice-ID zurück.
    Reihenfolge: MISTRAL_TTS_VOICE env → erste deutsche Stimme → erste verfügbare Stimme → None
    """
    global _resolved_voice_id

    if MISTRAL_TTS_VOICE:
        return MISTRAL_TTS_VOICE

    if _resolved_voice_id:
        return _resolved_voice_id

    try:
        client = _get_client()
        result = client.audio.voices.list()
        voices = result.items if hasattr(result, "items") else (result if isinstance(result, list) else [])

        if not voices:
            logger.warning("TTS: Keine Stimmen im Account gefunden")
            return None

        # Bevorzugt: Stimme mit Deutsch-Support
        de_voice = next(
            (v for v in voices if "de" in (getattr(v, "languages", None) or [])),
            None,
        )
        chosen = de_voice or voices[0]
        _resolved_voice_id = getattr(chosen, "id", None) or str(chosen)
        logger.info("TTS: Stimme automatisch gewählt: %s (%s)", getattr(chosen, "name", "?"), _resolved_voice_id)
        return _resolved_voice_id

    except Exception as e:
        logger.warning("TTS: Stimmen-Liste fehlgeschlagen: %s — versuche ohne voice_id", e)
        return None


def synthesize(
    text: str,
    voice_id: str | None = None,
    response_format: str = _DEFAULT_FORMAT,
) -> bytes:
    """
    Konvertiert Text zu Audio-Bytes via Mistral TTS SDK.
    """
    if not text or not text.strip():
        raise ValueError("Kein Text für TTS angegeben")

    model = MISTRAL_TTS_MODEL or _DEFAULT_TTS_MODEL
    voice = voice_id or resolve_voice_id()
    cache_key = f"{voice}:{response_format}:{text[:200]}"

    if cache_key in _cache:
        logger.debug("TTS: Cache-Treffer")
        return _cache[cache_key]

    logger.info("TTS: Synthetisiere %d Zeichen, voice_id=%s", len(text), voice)

    client = _get_client()

    kwargs = dict(
        model=model,
        input=text,
        response_format=response_format,
    )
    if voice:
        kwargs["voice_id"] = voice

    response = client.audio.speech.complete(**kwargs)
    audio_bytes = base64.b64decode(response.audio_data)

    if not audio_bytes:
        raise ValueError("TTS API hat kein Audio zurückgegeben")

    logger.info("TTS: %d Bytes Audio generiert", len(audio_bytes))

    if len(_cache) >= _MAX_CACHE:
        del _cache[next(iter(_cache))]
    _cache[cache_key] = audio_bytes

    return audio_bytes
