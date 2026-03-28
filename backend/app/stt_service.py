"""
STT-Service — Audio → Text via Mistral Speech API.
"""
import logging

from .config import MISTRAL_STT_MODEL
from .mistral_client import MistralError, mistral_post_multipart

logger = logging.getLogger(__name__)

# Unterstützte Audioformate
ALLOWED_MIME_TYPES = {
    "audio/wav",
    "audio/wave",
    "audio/webm",
    "audio/ogg",
    "audio/mpeg",
    "audio/mp4",
    "audio/x-wav",
}

ALLOWED_EXTENSIONS = {".wav", ".webm", ".ogg", ".mp3", ".mp4", ".m4a"}

MAX_AUDIO_BYTES = 10 * 1024 * 1024  # 10 MB

# Fallback-Modell falls nicht konfiguriert
_DEFAULT_STT_MODEL = "mistral-stt-latest"


def validate_audio(data: bytes, content_type: str | None, filename: str | None) -> None:
    """Validiert Audio-Daten vor dem Upload. Wirft ValueError bei Problemen."""
    if len(data) == 0:
        raise ValueError("Audiodatei ist leer")

    if len(data) > MAX_AUDIO_BYTES:
        raise ValueError(f"Audiodatei zu groß ({len(data) / 1024 / 1024:.1f} MB, max 10 MB)")

    if content_type and content_type not in ALLOWED_MIME_TYPES:
        # Tolerant sein, wenn Content-Type unbekannt aber Dateiendung passt
        if not _has_allowed_extension(filename):
            raise ValueError(
                f"Nicht unterstütztes Audioformat: {content_type}. "
                f"Erlaubt: WAV, WebM, OGG, MP3, MP4"
            )


def _has_allowed_extension(filename: str | None) -> bool:
    if not filename:
        return False
    return any(filename.lower().endswith(ext) for ext in ALLOWED_EXTENSIONS)


def transcribe(
    audio_data: bytes,
    filename: str = "audio.webm",
    content_type: str = "audio/webm",
    language: str = "de",
) -> dict:
    """
    Transkribiert Audio via Mistral STT API.

    Returns:
        dict mit 'text' (transkribierter Text) und 'language'
    """
    model = MISTRAL_STT_MODEL or _DEFAULT_STT_MODEL

    logger.info("STT: Transkribiere %d Bytes mit Modell %s", len(audio_data), model)

    result = mistral_post_multipart(
        "/audio/transcriptions",
        files={
            "file": (filename, audio_data, content_type),
        },
        data={
            "model": model,
            "language": language,
            "response_format": "json",
        },
    )

    text = result.get("text", "").strip()
    logger.info("STT: Transkription erfolgreich (%d Zeichen)", len(text))

    return {
        "text": text,
        "language": result.get("language", language),
        "duration": result.get("duration"),
    }
