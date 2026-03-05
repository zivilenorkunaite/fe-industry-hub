"""Tools/apps/data sources CRUD routes."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from server.db import db
from server.auth import get_current_user, require_contributor, require_admin
import server.audit as audit

router = APIRouter(prefix="/api/tools", tags=["tools"])

TOOL_CATEGORIES = [
    "SCADA / OT System",
    "Billing & Revenue Management",
    "AMI / Smart Metering",
    "Customer Information System (CIS)",
    "Asset Management (EAM)",
    "GIS / Network Mapping",
    "Outage Management (OMS)",
    "Field Service Management",
    "Work Order Management",
    "Market Data & Trading",
    "DERMS / Grid Edge",
    "Forecasting & Planning",
    "Data Platform & Analytics",
    "IoT / Sensor Platform",
    "Document Management",
    "ERP / Finance",
    "Compliance & Regulatory",
    "Other",
]
INTEGRATION_TYPES = ["Direct Connector", "Partner", "Custom ETL", "API"]


class ToolCreate(BaseModel):
    name: str
    vendor: str = ""
    category: str = "Other"
    description: str = ""
    databricks_integration: str = ""
    integration_type: str = "Custom ETL"
    website_url: str = ""
    tags: List[str] = []


class ToolUpdate(BaseModel):
    name: Optional[str] = None
    vendor: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    databricks_integration: Optional[str] = None
    integration_type: Optional[str] = None
    website_url: Optional[str] = None
    tags: Optional[List[str]] = None
    status: Optional[str] = None


def _tool_row(row: dict) -> dict:
    result = {
        "id": row["id"],
        "name": row["name"],
        "vendor": row["vendor"],
        "category": row["category"],
        "description": row["description"],
        "databricks_integration": row["databricks_integration"],
        "integration_type": row["integration_type"],
        "website_url": row["website_url"],
        "tags": list(row["tags"]) if row["tags"] else [],
        "status": row["status"],
        "created_by": row["created_by"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
    }
    # Customer summary fields (present when loaded from list query)
    if "customer_count" in row.keys():
        result["customer_count"] = row["customer_count"] or 0
        result["live_count"] = row["live_count"] or 0
        result["implementing_count"] = row["implementing_count"] or 0
        result["identified_count"] = row["identified_count"] or 0
        result["customer_names"] = list(row["customer_names"]) if row["customer_names"] else []
    return result


@router.get("")
async def list_tools(
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    conditions = []
    params = []
    idx = 1

    # Viewers only see published; contributors/admins see all (or filter by status)
    if user["role"] == "viewer":
        conditions.append(f"status = 'published'")
    elif status:
        conditions.append(f"status = ${idx}")
        params.append(status)
        idx += 1

    if category:
        conditions.append(f"category = ${idx}")
        params.append(category)
        idx += 1

    if search:
        conditions.append(f"(name ILIKE ${idx} OR vendor ILIKE ${idx} OR description ILIKE ${idx})")
        params.append(f"%{search}%")
        idx += 1

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    query = f"""
        SELECT t.*,
            COALESCE(tc_agg.customer_count, 0) AS customer_count,
            COALESCE(tc_agg.live_count, 0) AS live_count,
            COALESCE(tc_agg.implementing_count, 0) AS implementing_count,
            COALESCE(tc_agg.identified_count, 0) AS identified_count,
            COALESCE(tc_agg.customer_names, '{{}}') AS customer_names
        FROM tools t
        LEFT JOIN (
            SELECT tool_id,
                COUNT(*) AS customer_count,
                COUNT(*) FILTER (WHERE stage = 'Live') AS live_count,
                COUNT(*) FILTER (WHERE stage = 'Implementing') AS implementing_count,
                COUNT(*) FILTER (WHERE stage = 'Identified') AS identified_count,
                ARRAY_AGG(customer_name ORDER BY customer_name) AS customer_names
            FROM tool_customers
            GROUP BY tool_id
        ) tc_agg ON tc_agg.tool_id = t.id
        {where}
        ORDER BY t.created_at DESC
    """
    rows = await db.fetch(query, *params)
    return [_tool_row(r) for r in rows]


@router.get("/categories")
async def get_categories():
    # Merge built-in categories with any custom ones created in the DB
    db_cats = await db.fetch("SELECT DISTINCT category FROM tools WHERE category IS NOT NULL ORDER BY category")
    custom = [r["category"] for r in db_cats if r["category"] not in TOOL_CATEGORIES]
    return {"categories": TOOL_CATEGORIES + custom, "integration_types": INTEGRATION_TYPES}


@router.get("/tags")
async def get_tags():
    """Return all unique tags used across tools."""
    rows = await db.fetch("SELECT DISTINCT unnest(tags) AS tag FROM tools ORDER BY tag")
    return {"tags": [r["tag"] for r in rows]}


@router.get("/{tool_id}")
async def get_tool(tool_id: int, user: dict = Depends(get_current_user)):
    row = await db.fetchrow("SELECT * FROM tools WHERE id = $1", tool_id)
    if not row:
        raise HTTPException(status_code=404, detail="Tool not found")
    if user["role"] == "viewer" and row["status"] != "published":
        raise HTTPException(status_code=403, detail="Access denied")
    return _tool_row(row)


@router.post("", status_code=201)
async def create_tool(body: ToolCreate, user: dict = Depends(require_contributor)):
    row = await db.fetchrow(
        """
        INSERT INTO tools (name, vendor, category, description, databricks_integration,
            integration_type, website_url, tags, status, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9)
        RETURNING *
        """,
        body.name, body.vendor, body.category, body.description,
        body.databricks_integration, body.integration_type, body.website_url,
        body.tags, user["email"],
    )
    await audit.log(user["email"], "create", "tool", row["id"], row["name"])
    return _tool_row(row)


@router.patch("/{tool_id}")
async def update_tool(tool_id: int, body: ToolUpdate, user: dict = Depends(get_current_user)):
    row = await db.fetchrow("SELECT * FROM tools WHERE id = $1", tool_id)
    if not row:
        raise HTTPException(status_code=404, detail="Tool not found")

    # Contributors can only edit their own drafts; admins can edit any
    if user["role"] == "contributor":
        if row["created_by"] != user["email"] or row["status"] != "draft":
            raise HTTPException(status_code=403, detail="Can only edit your own drafts")
    elif user["role"] not in ("admin",):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    updates = {}
    for field in ["name", "vendor", "category", "description", "databricks_integration",
                  "integration_type", "website_url", "tags"]:
        val = getattr(body, field)
        if val is not None:
            updates[field] = val

    # Only admin can change status
    if body.status is not None and user["role"] == "admin":
        updates["status"] = body.status

    if not updates:
        return _tool_row(row)

    set_clauses = [f"{k} = ${i+1}" for i, k in enumerate(updates)]
    set_clauses.append(f"updated_at = NOW()")
    params = list(updates.values()) + [tool_id]
    updated = await db.fetchrow(
        f"UPDATE tools SET {', '.join(set_clauses)} WHERE id = ${len(params)} RETURNING *",
        *params,
    )
    await audit.log(user["email"], "update", "tool", updated["id"], updated["name"],
                    {"changed_fields": list(updates.keys())})
    return _tool_row(updated)


CUSTOMER_STAGES = ["Identified", "Implementing", "Live"]


class ToolCustomerCreate(BaseModel):
    customer_name: str
    stage: str = "Identified"
    notes: str = ""


class ToolCustomerUpdate(BaseModel):
    customer_name: Optional[str] = None
    stage: Optional[str] = None
    notes: Optional[str] = None


def _customer_row(row: dict) -> dict:
    return {
        "id": row["id"],
        "tool_id": row["tool_id"],
        "customer_name": row["customer_name"],
        "stage": row["stage"],
        "notes": row["notes"],
        "created_by": row["created_by"],
        "updated_by": row["updated_by"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
    }


@router.get("/customer-stages")
async def get_customer_stages():
    return {"stages": CUSTOMER_STAGES}


@router.get("/{tool_id}/customers")
async def list_tool_customers(tool_id: int, user: dict = Depends(get_current_user)):
    rows = await db.fetch(
        "SELECT * FROM tool_customers WHERE tool_id = $1 ORDER BY customer_name ASC",
        tool_id,
    )
    return [_customer_row(r) for r in rows]


@router.post("/{tool_id}/customers", status_code=201)
async def add_tool_customer(tool_id: int, body: ToolCustomerCreate, user: dict = Depends(require_contributor)):
    tool = await db.fetchrow("SELECT id, name FROM tools WHERE id = $1", tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    if body.stage not in CUSTOMER_STAGES:
        raise HTTPException(status_code=400, detail=f"stage must be one of {CUSTOMER_STAGES}")

    row = await db.fetchrow(
        """
        INSERT INTO tool_customers (tool_id, customer_name, stage, notes, created_by, updated_by)
        VALUES ($1, $2, $3, $4, $5, $5)
        RETURNING *
        """,
        tool_id, body.customer_name, body.stage, body.notes, user["email"],
    )
    await audit.log(user["email"], "add_customer", "tool", tool_id, tool["name"],
                    {"customer": body.customer_name, "stage": body.stage})
    return _customer_row(row)


@router.patch("/{tool_id}/customers/{customer_id}")
async def update_tool_customer(
    tool_id: int, customer_id: int, body: ToolCustomerUpdate,
    user: dict = Depends(require_contributor),
):
    row = await db.fetchrow(
        "SELECT * FROM tool_customers WHERE id = $1 AND tool_id = $2", customer_id, tool_id
    )
    if not row:
        raise HTTPException(status_code=404, detail="Customer entry not found")
    tool = await db.fetchrow("SELECT name FROM tools WHERE id = $1", tool_id)

    updates: dict = {}
    if body.customer_name is not None:
        updates["customer_name"] = body.customer_name
    if body.stage is not None:
        if body.stage not in CUSTOMER_STAGES:
            raise HTTPException(status_code=400, detail=f"stage must be one of {CUSTOMER_STAGES}")
        updates["stage"] = body.stage
    if body.notes is not None:
        updates["notes"] = body.notes

    if not updates:
        return _customer_row(row)

    updates["updated_by"] = user["email"]
    set_clauses = [f"{k} = ${i+1}" for i, k in enumerate(updates)]
    set_clauses.append(f"updated_at = NOW()")
    params = list(updates.values()) + [customer_id]
    updated = await db.fetchrow(
        f"UPDATE tool_customers SET {', '.join(set_clauses)} WHERE id = ${len(params)} RETURNING *",
        *params,
    )
    tool_name = tool["name"] if tool else None
    await audit.log(user["email"], "update_customer", "tool", tool_id, tool_name,
                    {"customer": updated["customer_name"], "changed_fields": [k for k in updates if k != "updated_by"]})
    return _customer_row(updated)


@router.delete("/{tool_id}/customers/{customer_id}", status_code=204)
async def remove_tool_customer(
    tool_id: int, customer_id: int,
    user: dict = Depends(require_contributor),
):
    row = await db.fetchrow("SELECT * FROM tool_customers WHERE id = $1 AND tool_id = $2", customer_id, tool_id)
    if not row:
        raise HTTPException(status_code=404, detail="Customer entry not found")
    tool = await db.fetchrow("SELECT name FROM tools WHERE id = $1", tool_id)

    await db.execute("DELETE FROM tool_customers WHERE id = $1", customer_id)
    tool_name = tool["name"] if tool else None
    await audit.log(user["email"], "remove_customer", "tool", tool_id, tool_name,
                    {"customer": row["customer_name"]})
    return None
