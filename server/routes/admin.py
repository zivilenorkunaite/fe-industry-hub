"""Admin routes: user management, draft review, publish/unpublish."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from server.db import db
from server.auth import require_admin
import server.audit as audit

router = APIRouter(prefix="/api/admin", tags=["admin"])

TABLE_MAP = {
    "tool": "tools",
    "use_case": "use_cases",
    "story": "customer_stories",
}


class UserCreate(BaseModel):
    email: str
    display_name: str = ""
    role: str = "viewer"


class UserUpdate(BaseModel):
    role: Optional[str] = None
    display_name: Optional[str] = None


class PublishAction(BaseModel):
    action: str  # 'publish' or 'unpublish'


@router.get("/users")
async def list_users(user: dict = Depends(require_admin)):
    rows = await db.fetch("SELECT id, email, display_name, role, created_at FROM users ORDER BY created_at DESC")
    return [
        {
            "id": r["id"],
            "email": r["email"],
            "display_name": r["display_name"],
            "role": r["role"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        }
        for r in rows
    ]


@router.post("/users", status_code=201)
async def add_user(body: UserCreate, user: dict = Depends(require_admin)):
    if body.role not in ("viewer", "contributor", "admin"):
        raise HTTPException(status_code=400, detail="Invalid role")

    display = body.display_name or body.email.split("@")[0].replace(".", " ").title()
    row = await db.fetchrow(
        """
        INSERT INTO users (email, display_name, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, display_name = EXCLUDED.display_name
        RETURNING id, email, display_name, role, created_at
        """,
        body.email, display, body.role,
    )
    await audit.log(user["email"], "add_user", "user", row["id"], row["email"],
                    {"role": body.role})
    return {
        "id": row["id"],
        "email": row["email"],
        "display_name": row["display_name"],
        "role": row["role"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
    }


@router.patch("/users/{user_id}")
async def update_user(user_id: int, body: UserUpdate, user: dict = Depends(require_admin)):
    if body.role is not None and body.role not in ("viewer", "contributor", "admin"):
        raise HTTPException(status_code=400, detail="Invalid role")

    updates = {}
    if body.role is not None:
        updates["role"] = body.role
    if body.display_name is not None:
        updates["display_name"] = body.display_name

    if not updates:
        row = await db.fetchrow("SELECT id, email, display_name, role, created_at FROM users WHERE id = $1", user_id)
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        return dict(row)

    set_clauses = [f"{k} = ${i+1}" for i, k in enumerate(updates)]
    params = list(updates.values()) + [user_id]
    row = await db.fetchrow(
        f"UPDATE users SET {', '.join(set_clauses)} WHERE id = ${len(params)} RETURNING id, email, display_name, role, created_at",
        *params,
    )
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    if body.role is not None:
        await audit.log(user["email"], "role_change", "user", row["id"], row["email"],
                        {"new_role": body.role})
    return {
        "id": row["id"],
        "email": row["email"],
        "display_name": row["display_name"],
        "role": row["role"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
    }


@router.get("/drafts")
async def list_drafts(user: dict = Depends(require_admin)):
    """Return all pending drafts across tools, use cases, and stories."""
    tools = await db.fetch(
        "SELECT id, name AS title, 'tool' AS type, created_by, created_at FROM tools WHERE status = 'draft' ORDER BY created_at DESC"
    )
    use_cases = await db.fetch(
        "SELECT id, name AS title, 'use_case' AS type, created_by, created_at FROM use_cases WHERE status = 'draft' ORDER BY created_at DESC"
    )
    stories = await db.fetch(
        "SELECT id, title, 'story' AS type, created_by, created_at FROM customer_stories WHERE status = 'draft' ORDER BY created_at DESC"
    )

    def fmt(rows):
        return [
            {
                "id": r["id"],
                "title": r["title"],
                "type": r["type"],
                "created_by": r["created_by"],
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            }
            for r in rows
        ]

    return {"drafts": fmt(tools) + fmt(use_cases) + fmt(stories)}


@router.patch("/publish/{entity_type}/{entity_id}")
async def publish_entity(
    entity_type: str,
    entity_id: int,
    body: PublishAction,
    user: dict = Depends(require_admin),
):
    if entity_type not in TABLE_MAP:
        raise HTTPException(status_code=400, detail=f"Unknown entity type: {entity_type}")
    if body.action not in ("publish", "unpublish"):
        raise HTTPException(status_code=400, detail="action must be 'publish' or 'unpublish'")

    table = TABLE_MAP[entity_type]
    new_status = "published" if body.action == "publish" else "draft"
    result = await db.fetchval(
        f"UPDATE {table} SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id",
        new_status, entity_id,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Entity not found")

    await audit.log(user["email"], body.action, entity_type, entity_id,
                    details={"new_status": new_status})
    return {"id": entity_id, "type": entity_type, "status": new_status}


@router.get("/audit")
async def list_audit_log(user: dict = Depends(require_admin)):
    rows = await db.fetch(
        "SELECT id, actor_email, action, entity_type, entity_id, entity_name, details, created_at "
        "FROM audit_log ORDER BY created_at DESC LIMIT 500"
    )
    return [
        {
            "id": r["id"],
            "actor_email": r["actor_email"],
            "action": r["action"],
            "entity_type": r["entity_type"],
            "entity_id": r["entity_id"],
            "entity_name": r["entity_name"],
            "details": r["details"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        }
        for r in rows
    ]
