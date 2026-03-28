import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, HTTPException, Request, status
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
# System info
# ---------------------------------------------------------------------------

@app.get("/api/system/info")
def system_info(current_user: Dict = Depends(require_admin)):
    return {
        "version": "0.1.0",
        "environment": __import__("app.config", fromlist=["ENVIRONMENT"]).ENVIRONMENT,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
