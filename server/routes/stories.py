"""Customer stories CRUD routes."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from server.db import db
from server.auth import get_current_user, require_contributor
import server.audit as audit

router = APIRouter(prefix="/api/stories", tags=["stories"])


class StoryCreate(BaseModel):
    title: str
    customer_name: str = ""
    summary: str = ""
    challenge: str = ""
    outcome: str = ""
    databricks_products: str = ""
    salesforce_opportunity_url: str = ""
    salesforce_account_url: str = ""
    is_referenceable: bool = False
    tags: List[str] = []


class StoryUpdate(BaseModel):
    title: Optional[str] = None
    customer_name: Optional[str] = None
    summary: Optional[str] = None
    challenge: Optional[str] = None
    outcome: Optional[str] = None
    databricks_products: Optional[str] = None
    salesforce_opportunity_url: Optional[str] = None
    salesforce_account_url: Optional[str] = None
    is_referenceable: Optional[bool] = None
    tags: Optional[List[str]] = None
    status: Optional[str] = None


class StoryLink(BaseModel):
    entity_type: str  # 'tool' or 'use_case'
    entity_id: int


def _story_row(row: dict, links: list = None) -> dict:
    result = {
        "id": row["id"],
        "title": row["title"],
        "customer_name": row["customer_name"],
        "summary": row["summary"],
        "challenge": row["challenge"],
        "outcome": row["outcome"],
        "databricks_products": row["databricks_products"],
        "salesforce_opportunity_url": row["salesforce_opportunity_url"],
        "salesforce_account_url": row["salesforce_account_url"],
        "is_referenceable": row["is_referenceable"],
        "tags": list(row["tags"]) if row["tags"] else [],
        "status": row["status"],
        "created_by": row["created_by"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
    }
    if links is not None:
        result["links"] = links
    return result


@router.get("")
async def list_stories(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    conditions = []
    params = []
    idx = 1

    if user["role"] == "viewer":
        conditions.append("status = 'published'")
    elif status:
        conditions.append(f"status = ${idx}")
        params.append(status)
        idx += 1

    if search:
        conditions.append(f"(title ILIKE ${idx} OR customer_name ILIKE ${idx} OR summary ILIKE ${idx})")
        params.append(f"%{search}%")
        idx += 1

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    rows = await db.fetch(f"SELECT * FROM customer_stories {where} ORDER BY created_at DESC", *params)
    return [_story_row(r) for r in rows]


@router.get("/{story_id}")
async def get_story(story_id: int, user: dict = Depends(get_current_user)):
    row = await db.fetchrow("SELECT * FROM customer_stories WHERE id = $1", story_id)
    if not row:
        raise HTTPException(status_code=404, detail="Story not found")
    if user["role"] == "viewer" and row["status"] != "published":
        raise HTTPException(status_code=403, detail="Access denied")

    links = await db.fetch(
        "SELECT entity_type, entity_id FROM story_links WHERE story_id = $1", story_id
    )
    return _story_row(row, links=links)


@router.post("", status_code=201)
async def create_story(body: StoryCreate, user: dict = Depends(require_contributor)):
    row = await db.fetchrow(
        """
        INSERT INTO customer_stories (title, customer_name, summary, challenge, outcome,
            databricks_products, salesforce_opportunity_url, salesforce_account_url,
            is_referenceable, tags, status, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft', $11)
        RETURNING *
        """,
        body.title, body.customer_name, body.summary, body.challenge, body.outcome,
        body.databricks_products, body.salesforce_opportunity_url, body.salesforce_account_url,
        body.is_referenceable, body.tags, user["email"],
    )
    await audit.log(user["email"], "create", "story", row["id"], row["title"])
    return _story_row(row, links=[])


@router.patch("/{story_id}")
async def update_story(story_id: int, body: StoryUpdate, user: dict = Depends(get_current_user)):
    row = await db.fetchrow("SELECT * FROM customer_stories WHERE id = $1", story_id)
    if not row:
        raise HTTPException(status_code=404, detail="Story not found")

    if user["role"] == "contributor":
        if row["created_by"] != user["email"] or row["status"] != "draft":
            raise HTTPException(status_code=403, detail="Can only edit your own drafts")
    elif user["role"] not in ("admin",):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    updates = {}
    for field in ["title", "customer_name", "summary", "challenge", "outcome",
                  "databricks_products", "salesforce_opportunity_url", "salesforce_account_url",
                  "is_referenceable", "tags"]:
        val = getattr(body, field)
        if val is not None:
            updates[field] = val

    if body.status is not None and user["role"] == "admin":
        updates["status"] = body.status

    if not updates:
        links = await db.fetch("SELECT entity_type, entity_id FROM story_links WHERE story_id = $1", story_id)
        return _story_row(row, links=links)

    set_clauses = [f"{k} = ${i+1}" for i, k in enumerate(updates)]
    set_clauses.append("updated_at = NOW()")
    params = list(updates.values()) + [story_id]
    updated = await db.fetchrow(
        f"UPDATE customer_stories SET {', '.join(set_clauses)} WHERE id = ${len(params)} RETURNING *",
        *params,
    )
    links = await db.fetch("SELECT entity_type, entity_id FROM story_links WHERE story_id = $1", story_id)
    await audit.log(user["email"], "update", "story", updated["id"], updated["title"],
                    {"changed_fields": list(updates.keys())})
    return _story_row(updated, links=links)


@router.post("/{story_id}/links", status_code=201)
async def add_story_link(story_id: int, body: StoryLink, user: dict = Depends(require_contributor)):
    if body.entity_type not in ("tool", "use_case"):
        raise HTTPException(status_code=400, detail="entity_type must be 'tool' or 'use_case'")

    row = await db.fetchrow("SELECT id FROM customer_stories WHERE id = $1", story_id)
    if not row:
        raise HTTPException(status_code=404, detail="Story not found")

    await db.execute(
        """
        INSERT INTO story_links (story_id, entity_type, entity_id)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
        """,
        story_id, body.entity_type, body.entity_id,
    )
    links = await db.fetch("SELECT entity_type, entity_id FROM story_links WHERE story_id = $1", story_id)
    return {"story_id": story_id, "links": links}


@router.delete("/{story_id}/links/{entity_type}/{entity_id}")
async def remove_story_link(
    story_id: int, entity_type: str, entity_id: int,
    user: dict = Depends(require_contributor),
):
    await db.execute(
        "DELETE FROM story_links WHERE story_id = $1 AND entity_type = $2 AND entity_id = $3",
        story_id, entity_type, entity_id,
    )
    return {"deleted": True}
