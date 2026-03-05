"""Use cases CRUD routes."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from server.db import db
from server.auth import get_current_user, require_contributor
import server.audit as audit

router = APIRouter(prefix="/api/use-cases", tags=["use_cases"])

UC_CATEGORIES = ["Asset Management", "Grid Operations", "Customer Analytics", "Trading & Market", "Compliance", "Other"]
MATURITY_LEVELS = ["Emerging", "Growing", "Established"]


class UseCaseCreate(BaseModel):
    name: str
    category: str = "Other"
    problem_statement: str = ""
    databricks_solution: str = ""
    relevant_products: str = ""
    maturity: str = "Emerging"
    tags: List[str] = []


class UseCaseUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    problem_statement: Optional[str] = None
    databricks_solution: Optional[str] = None
    relevant_products: Optional[str] = None
    maturity: Optional[str] = None
    tags: Optional[List[str]] = None
    status: Optional[str] = None


def _uc_row(row: dict) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "category": row["category"],
        "problem_statement": row["problem_statement"],
        "databricks_solution": row["databricks_solution"],
        "relevant_products": row["relevant_products"],
        "maturity": row["maturity"],
        "tags": list(row["tags"]) if row["tags"] else [],
        "status": row["status"],
        "created_by": row["created_by"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
    }


@router.get("")
async def list_use_cases(
    category: Optional[str] = Query(None),
    maturity: Optional[str] = Query(None),
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

    if category:
        conditions.append(f"category = ${idx}")
        params.append(category)
        idx += 1

    if maturity:
        conditions.append(f"maturity = ${idx}")
        params.append(maturity)
        idx += 1

    if search:
        conditions.append(f"(name ILIKE ${idx} OR problem_statement ILIKE ${idx} OR databricks_solution ILIKE ${idx})")
        params.append(f"%{search}%")
        idx += 1

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    rows = await db.fetch(f"SELECT * FROM use_cases {where} ORDER BY created_at DESC", *params)
    return [_uc_row(r) for r in rows]


@router.get("/categories")
async def get_categories():
    return {"categories": UC_CATEGORIES, "maturity_levels": MATURITY_LEVELS}


@router.get("/{uc_id}")
async def get_use_case(uc_id: int, user: dict = Depends(get_current_user)):
    row = await db.fetchrow("SELECT * FROM use_cases WHERE id = $1", uc_id)
    if not row:
        raise HTTPException(status_code=404, detail="Use case not found")
    if user["role"] == "viewer" and row["status"] != "published":
        raise HTTPException(status_code=403, detail="Access denied")
    return _uc_row(row)


@router.post("", status_code=201)
async def create_use_case(body: UseCaseCreate, user: dict = Depends(require_contributor)):
    row = await db.fetchrow(
        """
        INSERT INTO use_cases (name, category, problem_statement, databricks_solution,
            relevant_products, maturity, tags, status, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8)
        RETURNING *
        """,
        body.name, body.category, body.problem_statement, body.databricks_solution,
        body.relevant_products, body.maturity, body.tags, user["email"],
    )
    await audit.log(user["email"], "create", "use_case", row["id"], row["name"])
    return _uc_row(row)


@router.patch("/{uc_id}")
async def update_use_case(uc_id: int, body: UseCaseUpdate, user: dict = Depends(get_current_user)):
    row = await db.fetchrow("SELECT * FROM use_cases WHERE id = $1", uc_id)
    if not row:
        raise HTTPException(status_code=404, detail="Use case not found")

    if user["role"] == "contributor":
        if row["created_by"] != user["email"] or row["status"] != "draft":
            raise HTTPException(status_code=403, detail="Can only edit your own drafts")
    elif user["role"] not in ("admin",):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    updates = {}
    for field in ["name", "category", "problem_statement", "databricks_solution",
                  "relevant_products", "maturity", "tags"]:
        val = getattr(body, field)
        if val is not None:
            updates[field] = val

    if body.status is not None and user["role"] == "admin":
        updates["status"] = body.status

    if not updates:
        return _uc_row(row)

    set_clauses = [f"{k} = ${i+1}" for i, k in enumerate(updates)]
    set_clauses.append("updated_at = NOW()")
    params = list(updates.values()) + [uc_id]
    updated = await db.fetchrow(
        f"UPDATE use_cases SET {', '.join(set_clauses)} WHERE id = ${len(params)} RETURNING *",
        *params,
    )
    await audit.log(user["email"], "update", "use_case", updated["id"], updated["name"],
                    {"changed_fields": list(updates.keys())})
    return _uc_row(updated)
