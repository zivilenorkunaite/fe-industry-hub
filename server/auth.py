"""Authentication and role management for FE ANZ Energy Hub.

Databricks Apps forwards the authenticated user's identity via headers:
  - X-Forwarded-User: may be email or numeric user ID
  - X-Forwarded-Access-Token: the user's own OAuth token

Resolution strategy:
  1. If X-Forwarded-User looks like an email, use it directly.
  2. If it's a numeric ID, use X-Forwarded-Access-Token to call /api/2.0/preview/scim/v2/Me
     to get the real email. Falls back to app-SP SCIM lookup if no user token available.
  3. Local dev: uses DEV_USER_EMAIL env var.

First user ever to log in automatically gets admin role.
"""

import os
import re
import aiohttp
from fastapi import Request, HTTPException
from server.db import db
from server.config import get_oauth_token, get_workspace_host

_user_id_cache: dict[str, str] = {}
_NUMERIC_ID_RE = re.compile(r"^(\d+)@\d+$")


async def _resolve_email(request: Request, raw: str) -> str:
    """Resolve raw X-Forwarded-User value to an email address."""
    if not _NUMERIC_ID_RE.match(raw):
        return raw  # already an email

    user_id = _NUMERIC_ID_RE.match(raw).group(1)
    if user_id in _user_id_cache:
        return _user_id_cache[user_id]

    host = get_workspace_host()

    # Prefer the user's own token (X-Forwarded-Access-Token) to call /Me
    user_token = request.headers.get("X-Forwarded-Access-Token")
    if user_token:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{host}/api/2.0/preview/scim/v2/Me",
                    headers={"Authorization": f"Bearer {user_token}"},
                    timeout=aiohttp.ClientTimeout(total=5),
                ) as resp:
                    data = await resp.json()
                    email = data.get("userName", "")
                    if email:
                        _user_id_cache[user_id] = email
                        print(f"[AUTH] Resolved via /Me: {user_id} → {email}")
                        return email
        except Exception as e:
            print(f"[AUTH] /Me lookup failed: {e}")

    # Fallback: app SP token + SCIM Users/{id}
    try:
        sp_token = get_oauth_token()
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{host}/api/2.0/preview/scim/v2/Users/{user_id}",
                headers={"Authorization": f"Bearer {sp_token}"},
                timeout=aiohttp.ClientTimeout(total=5),
            ) as resp:
                data = await resp.json()
                email = data.get("userName", "")
                if email:
                    _user_id_cache[user_id] = email
                    print(f"[AUTH] Resolved via SCIM: {user_id} → {email}")
                    return email
    except Exception as e:
        print(f"[AUTH] SCIM lookup failed: {e}")

    print(f"[AUTH] Could not resolve user ID {user_id}, using raw value")
    return raw


async def get_current_user(request: Request) -> dict:
    """Resolve user email and role. First user ever gets admin."""
    raw = (
        request.headers.get("X-Forwarded-User")
        or request.headers.get("x-forwarded-user")
    )

    if not raw:
        raw = os.environ.get("DEV_USER_EMAIL", "dev@databricks.com")

    email = await _resolve_email(request, raw)

    row = await db.fetchrow(
        "SELECT id, email, display_name, role FROM users WHERE email = $1", email
    )
    if not row:
        user_count = await db.fetchval("SELECT COUNT(*) FROM users")
        role = "admin" if user_count == 0 else "viewer"
        display_name = email.split("@")[0].replace(".", " ").title()
        await db.execute(
            "INSERT INTO users (email, display_name, role) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING",
            email, display_name, role,
        )
        row = await db.fetchrow(
            "SELECT id, email, display_name, role FROM users WHERE email = $1", email
        )

    return {
        "id": row["id"],
        "email": row["email"],
        "display_name": row["display_name"],
        "role": row["role"],
    }


async def require_contributor(request: Request) -> dict:
    user = await get_current_user(request)
    if user["role"] not in ("contributor", "admin"):
        raise HTTPException(status_code=403, detail="Contributor role required")
    return user


async def require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return user
