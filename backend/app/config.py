import os
from dotenv import load_dotenv

load_dotenv()

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
PORT = int(os.getenv("PORT", "8000"))

JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))

CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

# Table names (sb_ prefix — namespace for this app)
USERS_TABLE = os.getenv("USERS_TABLE", "sb_users")
AUDIT_LOG_TABLE = os.getenv("AUDIT_LOG_TABLE", "sb_audit_log")
SESSIONS_TABLE = os.getenv("SESSIONS_TABLE", "sb_sessions")
MESSAGES_TABLE = os.getenv("MESSAGES_TABLE", "sb_messages")
FLOWS_TABLE = os.getenv("FLOWS_TABLE", "sb_flows")
FLOW_VERSIONS_TABLE = os.getenv("FLOW_VERSIONS_TABLE", "sb_flow_versions")
CONFIG_PROVIDERS_TABLE = os.getenv("CONFIG_PROVIDERS_TABLE", "sb_config_providers")
CONFIG_WEBHOOKS_TABLE = os.getenv("CONFIG_WEBHOOKS_TABLE", "sb_config_webhooks")

# Mistral AI (Sprint 2+)
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "")
MISTRAL_LLM_MODEL = os.getenv("MISTRAL_LLM_MODEL", "mistral-large-latest")
MISTRAL_STT_MODEL = os.getenv("MISTRAL_STT_MODEL", "")
MISTRAL_TTS_MODEL = os.getenv("MISTRAL_TTS_MODEL", "voxtral-mini-tts-2603")

# Encryption key for provider API keys at rest (Fernet)
PROVIDER_KEY_ENCRYPTION_KEY = os.getenv("PROVIDER_KEY_ENCRYPTION_KEY", "")

# Bootstrap admin (only used on first startup)
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
