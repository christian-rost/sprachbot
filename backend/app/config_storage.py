"""
Provider-Konfiguration — speichert verschlüsselte API-Keys und Modell-Einstellungen.
Nutzt Fernet-Verschlüsselung für API-Keys at rest.
"""
import base64
import logging

from .config import CONFIG_PROVIDERS_TABLE, PROVIDER_KEY_ENCRYPTION_KEY
from .database import get_db

logger = logging.getLogger(__name__)

# In-memory Fallback
_mem_providers: dict[str, dict] = {}


def _get_fernet():
    """Gibt ein Fernet-Objekt zurück oder None wenn kein Key konfiguriert."""
    if not PROVIDER_KEY_ENCRYPTION_KEY:
        return None
    try:
        from cryptography.fernet import Fernet
        return Fernet(PROVIDER_KEY_ENCRYPTION_KEY.encode())
    except Exception as e:
        logger.warning("Fernet-Initialisierung fehlgeschlagen: %s", e)
        return None


def encrypt_key(api_key: str) -> str:
    """Verschlüsselt einen API-Key. Gibt den Key unverändert zurück wenn keine Verschlüsselung."""
    fernet = _get_fernet()
    if not fernet or not api_key:
        return api_key
    return fernet.encrypt(api_key.encode()).decode()


def decrypt_key(encrypted: str) -> str:
    """Entschlüsselt einen API-Key. Gibt den Wert unverändert zurück wenn keine Verschlüsselung."""
    fernet = _get_fernet()
    if not fernet or not encrypted:
        return encrypted
    try:
        return fernet.decrypt(encrypted.encode()).decode()
    except Exception:
        return encrypted  # Fallback: unverschlüsselt (z.B. Legacy-Werte)


def get_provider_config(provider_name: str = "mistral") -> dict:
    """
    Gibt die Provider-Konfiguration zurück.
    API-Keys werden entschlüsselt zurückgegeben.
    """
    db = get_db()
    if db:
        try:
            result = db.table(CONFIG_PROVIDERS_TABLE).select("*").eq("name", provider_name).execute()
            if result.data:
                config = result.data[0]
                if config.get("api_key"):
                    config["api_key"] = decrypt_key(config["api_key"])
                return config
        except Exception as e:
            logger.warning("Supabase provider config get fehlgeschlagen: %s", e)

    raw = _mem_providers.get(provider_name, {})
    if raw.get("api_key"):
        result = dict(raw)
        result["api_key"] = decrypt_key(raw["api_key"])
        return result
    return raw


def upsert_provider_config(provider_name: str, updates: dict) -> dict:
    """
    Legt Provider-Konfiguration an oder aktualisiert sie.
    API-Keys werden vor dem Speichern verschlüsselt.
    """
    to_store = dict(updates)
    if "api_key" in to_store and to_store["api_key"]:
        to_store["api_key"] = encrypt_key(to_store["api_key"])

    to_store["name"] = provider_name

    db = get_db()
    if db:
        try:
            # Prüfen ob schon vorhanden
            existing = db.table(CONFIG_PROVIDERS_TABLE).select("id").eq("name", provider_name).execute()
            if existing.data:
                result = db.table(CONFIG_PROVIDERS_TABLE).update(to_store).eq("name", provider_name).execute()
            else:
                result = db.table(CONFIG_PROVIDERS_TABLE).insert(to_store).execute()
            stored = result.data[0]
            # Entschlüsselt zurückgeben
            if stored.get("api_key"):
                stored["api_key"] = decrypt_key(stored["api_key"])
            return stored
        except Exception as e:
            logger.warning("Supabase provider config upsert fehlgeschlagen: %s", e)

    _mem_providers[provider_name] = to_store
    # Entschlüsselt zurückgeben
    return get_provider_config(provider_name)


def list_provider_configs() -> list[dict]:
    """Gibt alle Provider-Configs zurück. API-Keys werden NICHT zurückgegeben (nur Metadaten)."""
    db = get_db()
    if db:
        try:
            result = db.table(CONFIG_PROVIDERS_TABLE).select("id, name, llm_model, stt_model, tts_model, updated_at").execute()
            return result.data
        except Exception as e:
            logger.warning("Supabase provider config list fehlgeschlagen: %s", e)

    return [
        {k: v for k, v in cfg.items() if k != "api_key"}
        for cfg in _mem_providers.values()
    ]
