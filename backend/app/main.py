import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr

from .auth import (
    authenticate_user,
    create_access_token,
    get_current_user,
    require_admin,
    require_admin_or_operator,
)
from .audit_storage import list_events, log_event
from .config import ADMIN_PASSWORD, ADMIN_USERNAME, CORS_ORIGINS
from .config_storage import get_provider_config, list_provider_configs, upsert_provider_config
from .mistral_client import MistralError
from .session_storage import (
    add_message,
    create_session,
    get_session,
    list_messages,
    list_sessions,
    update_session,
)
from .stt_service import transcribe, validate_audio
from .user_storage import bootstrap_admin, create_user, list_users, update_user

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Sprachbot API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: str
    username: str
    email: str
    roles: List[str]
    is_active: bool
    created_at: str


class CreateUserRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    roles: Optional[List[str]] = None


class UpdateUserRequest(BaseModel):
    email: Optional[EmailStr] = None
    roles: Optional[List[str]] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

@app.on_event("startup")
def on_startup():
    if ADMIN_USERNAME and ADMIN_PASSWORD:
        user = bootstrap_admin(ADMIN_USERNAME, ADMIN_PASSWORD)
        if user:
            logger.info("Admin user ready: %s", user["username"])
    else:
        logger.warning("ADMIN_USERNAME / ADMIN_PASSWORD not set — no admin bootstrapped")


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    from .database import get_db
    db = get_db()
    db_status = "connected" if db else "no_database_configured"
    return {"status": "ok", "database": db_status, "version": "0.1.0"}


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

@app.post("/api/auth/login", response_model=TokenResponse)
def login(body: LoginRequest, request: Request):
    user = authenticate_user(body.username, body.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token(user["id"])
    log_event(
        event_type="admin_login",
        actor_user_id=user["id"],
        entity_type="user",
        entity_id=user["id"],
        ip_address=request.client.host if request.client else None,
    )
    return TokenResponse(access_token=token)


@app.post("/api/auth/logout", status_code=204)
def logout(current_user: Dict = Depends(get_current_user)):
    log_event(
        event_type="admin_logout",
        actor_user_id=current_user["id"],
        entity_type="user",
        entity_id=current_user["id"],
    )
    return None


@app.get("/api/auth/me", response_model=UserOut)
def me(current_user: Dict = Depends(get_current_user)):
    return UserOut(**{k: current_user[k] for k in UserOut.model_fields})


# ---------------------------------------------------------------------------
# Admin — Users
# ---------------------------------------------------------------------------

@app.get("/api/admin/users", response_model=List[UserOut])
def admin_list_users(current_user: Dict = Depends(require_admin)):
    return [UserOut(**{k: u[k] for k in UserOut.model_fields}) for u in list_users()]


@app.post("/api/admin/users", response_model=UserOut, status_code=201)
def admin_create_user(body: CreateUserRequest, current_user: Dict = Depends(require_admin)):
    try:
        user = create_user(
            username=body.username,
            email=body.email,
            password=body.password,
            roles=body.roles,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    log_event(
        event_type="user_created",
        actor_user_id=current_user["id"],
        entity_type="user",
        entity_id=user["id"],
        details={"username": user["username"], "roles": user["roles"]},
    )
    return UserOut(**{k: user[k] for k in UserOut.model_fields})


@app.put("/api/admin/users/{user_id}", response_model=UserOut)
def admin_update_user(user_id: str, body: UpdateUserRequest, current_user: Dict = Depends(require_admin)):
    updates: Dict[str, Any] = {k: v for k, v in body.model_dump().items() if v is not None}
    user = update_user(user_id, updates)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    log_event(
        event_type="user_updated",
        actor_user_id=current_user["id"],
        entity_type="user",
        entity_id=user_id,
        details={"fields": list(updates.keys())},
    )
    return UserOut(**{k: user[k] for k in UserOut.model_fields})


# ---------------------------------------------------------------------------
# Admin — Audit Log
# ---------------------------------------------------------------------------

@app.get("/api/admin/audit-log")
def admin_audit_log(
    limit: int = 200,
    event_type: Optional[str] = None,
    current_user: Dict = Depends(require_admin_or_operator),
):
    return list_events(limit=limit, event_type=event_type)


# ---------------------------------------------------------------------------
# Admin — Stats (stub, expanded in Sprint 5)
# ---------------------------------------------------------------------------

@app.get("/api/admin/stats")
def admin_stats(current_user: Dict = Depends(require_admin_or_operator)):
    return {
        "active_sessions": 0,
        "sessions_today": 0,
        "success_rate": 0.0,
        "error_rate": 0.0,
        "avg_latency_ms": 0,
        "top_intents": [],
    }


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

class SessionOut(BaseModel):
    id: str
    user_id: str
    status: str
    intent: Optional[str] = None
    slots: Dict = {}
    turn_count: int = 0
    created_at: str
    updated_at: str


@app.post("/api/sessions", response_model=SessionOut, status_code=201)
def start_session(current_user: Dict = Depends(get_current_user)):
    session = create_session(user_id=current_user["id"])
    log_event(
        event_type="session_started",
        actor_user_id=current_user["id"],
        entity_type="session",
        entity_id=session["id"],
    )
    return SessionOut(**{k: session[k] for k in SessionOut.model_fields if k in session})


@app.get("/api/sessions/{session_id}", response_model=SessionOut)
def get_session_endpoint(session_id: str, current_user: Dict = Depends(get_current_user)):
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session nicht gefunden")
    if session["user_id"] != current_user["id"] and not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Kein Zugriff")
    return SessionOut(**{k: session[k] for k in SessionOut.model_fields if k in session})


@app.get("/api/sessions/{session_id}/messages")
def get_messages(session_id: str, current_user: Dict = Depends(get_current_user)):
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session nicht gefunden")
    if session["user_id"] != current_user["id"] and not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Kein Zugriff")
    return list_messages(session_id)


# ---------------------------------------------------------------------------
# STT — Audio Transkription
# ---------------------------------------------------------------------------

@app.post("/api/sessions/{session_id}/transcribe")
async def transcribe_audio(
    session_id: str,
    audio: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user),
):
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session nicht gefunden")
    if session["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Kein Zugriff")
    if session["status"] != "active":
        raise HTTPException(status_code=400, detail="Session ist nicht aktiv")

    data = await audio.read()
    try:
        validate_audio(data, audio.content_type, audio.filename)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    try:
        result = transcribe(
            audio_data=data,
            filename=audio.filename or "audio.webm",
            content_type=audio.content_type or "audio/webm",
        )
    except MistralError as e:
        raise HTTPException(status_code=502, detail=f"STT-Fehler: {e}")

    text = result["text"]
    if text:
        add_message(session_id, role="user", content=text, metadata={"source": "stt"})

    return {
        "transcript": text,
        "language": result.get("language"),
        "duration": result.get("duration"),
        "session_id": session_id,
    }


# ---------------------------------------------------------------------------
# Intent-Erkennung
# ---------------------------------------------------------------------------

@app.post("/api/sessions/{session_id}/detect-intent")
def detect_intent_endpoint(
    session_id: str,
    body: Dict,
    current_user: Dict = Depends(get_current_user),
):
    """Erkennt Intent aus Text, speichert Ergebnis in Session."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session nicht gefunden")
    if session["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Kein Zugriff")

    text = body.get("text", "").strip()
    if not text:
        raise HTTPException(status_code=422, detail="Kein Text angegeben")

    from .llm_service import detect_intent
    messages = list_messages(session_id)

    try:
        intent_result = detect_intent(
            user_text=text,
            available_flows=[],  # Sprint 3: echte Flows aus DB
            conversation_history=messages,
        )
    except MistralError as e:
        raise HTTPException(status_code=502, detail=f"LLM-Fehler: {e}")

    # Intent in Session persistieren
    update_session(session_id, {
        "intent": intent_result["intent"],
        "slots": {**session.get("slots", {}), **intent_result["slots"]},
    })

    # Antwort als Assistant-Nachricht speichern
    reply = intent_result.get("clarification_question") or "Intent erkannt."
    add_message(session_id, role="assistant", content=reply, metadata={"intent_result": intent_result})

    return {
        **intent_result,
        "reply": reply,
        "session_id": session_id,
    }


# ---------------------------------------------------------------------------
# Provider-Konfiguration (Admin)
# ---------------------------------------------------------------------------

class ProviderConfigIn(BaseModel):
    api_key: Optional[str] = None
    llm_model: Optional[str] = None
    stt_model: Optional[str] = None
    tts_model: Optional[str] = None


@app.get("/api/admin/providers")
def admin_list_providers(current_user: Dict = Depends(require_admin)):
    return list_provider_configs()


@app.get("/api/admin/providers/{name}")
def admin_get_provider(name: str, current_user: Dict = Depends(require_admin)):
    config = get_provider_config(name)
    if config and config.get("api_key"):
        config["api_key"] = "***"  # Key nicht im Klartext zurückgeben
    return config or {}


@app.put("/api/admin/providers/{name}")
def admin_upsert_provider(
    name: str,
    body: ProviderConfigIn,
    current_user: Dict = Depends(require_admin),
):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=422, detail="Keine Felder angegeben")
    config = upsert_provider_config(name, updates)
    if config.get("api_key"):
        config["api_key"] = "***"
    log_event(
        event_type="provider_config_updated",
        actor_user_id=current_user["id"],
        entity_type="provider",
        entity_id=name,
        details={"fields": list(updates.keys())},
    )
    return config


# ---------------------------------------------------------------------------
# System info
# ---------------------------------------------------------------------------

def _is_admin(user: Dict) -> bool:
    return "ADMIN" in user.get("roles", []) or "OPERATOR" in user.get("roles", [])


@app.get("/api/system/info")
def system_info(current_user: Dict = Depends(require_admin)):
    return {
        "version": "0.2.0",
        "environment": __import__("app.config", fromlist=["ENVIRONMENT"]).ENVIRONMENT,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
