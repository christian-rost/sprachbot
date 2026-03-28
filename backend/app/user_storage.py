from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional

from .config import USERS_TABLE
from .database import get_db
from .security import hash_password

_mem_users: Dict[str, Dict] = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize(row: Dict) -> Dict:
    roles = row.get("roles", [])
    if isinstance(roles, str):
        roles = [r.strip() for r in roles.split(",") if r.strip()]
    if not roles:
        roles = ["USER"]
    return {
        "id": str(row.get("id", "")),
        "username": row.get("username", ""),
        "email": row.get("email", ""),
        "password_hash": row.get("password_hash", ""),
        "roles": roles,
        "is_active": bool(row.get("is_active", True)),
        "created_at": row.get("created_at", _now()),
        "updated_at": row.get("updated_at", _now()),
    }


def list_users() -> List[Dict]:
    db = get_db()
    if db:
        result = db.table(USERS_TABLE).select("*").order("created_at").execute()
        return [_normalize(r) for r in (result.data or [])]
    return sorted(_mem_users.values(), key=lambda u: u.get("created_at", ""))


def get_user_by_id(user_id: str) -> Optional[Dict]:
    db = get_db()
    if db:
        result = db.table(USERS_TABLE).select("*").eq("id", user_id).limit(1).execute()
        rows = result.data or []
        return _normalize(rows[0]) if rows else None
    return _mem_users.get(user_id)


def get_user_by_username(username: str) -> Optional[Dict]:
    db = get_db()
    if db:
        result = db.table(USERS_TABLE).select("*").eq("username", username).limit(1).execute()
        rows = result.data or []
        return _normalize(rows[0]) if rows else None
    for u in _mem_users.values():
        if u.get("username") == username:
            return u
    return None


def create_user(username: str, email: str, password: str, roles: Optional[List[str]] = None) -> Dict:
    if get_user_by_username(username):
        raise ValueError("Username already exists")
    user = {
        "id": str(uuid.uuid4()),
        "username": username,
        "email": email,
        "password_hash": hash_password(password),
        "roles": roles or ["USER"],
        "is_active": True,
        "created_at": _now(),
        "updated_at": _now(),
    }
    db = get_db()
    if db:
        result = db.table(USERS_TABLE).insert(user).execute()
        rows = result.data or []
        return _normalize(rows[0]) if rows else _normalize(user)
    _mem_users[user["id"]] = user
    return user


def update_user(user_id: str, updates: Dict) -> Optional[Dict]:
    updates = {**updates, "updated_at": _now()}
    if "password" in updates:
        updates["password_hash"] = hash_password(updates.pop("password"))
    db = get_db()
    if db:
        result = db.table(USERS_TABLE).update(updates).eq("id", user_id).execute()
        rows = result.data or []
        return _normalize(rows[0]) if rows else None
    existing = _mem_users.get(user_id)
    if not existing:
        return None
    existing.update(updates)
    return existing


def bootstrap_admin(admin_username: str, admin_password: str) -> Optional[Dict]:
    if not admin_username or not admin_password:
        return None
    existing = get_user_by_username(admin_username)
    if existing:
        if "ADMIN" not in existing.get("roles", []):
            new_roles = list(dict.fromkeys([*existing.get("roles", []), "ADMIN"]))
            return update_user(existing["id"], {"roles": new_roles}) or existing
        return existing
    return create_user(
        username=admin_username,
        email=f"{admin_username}@local",
        password=admin_password,
        roles=["ADMIN"],
    )
