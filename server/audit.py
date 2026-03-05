"""Audit logging utility — fire-and-forget writes to audit_log table."""

import json
from server.db import db


async def log(
    actor_email: str,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    entity_name: str | None = None,
    details: dict | None = None,
):
    """Insert an audit log entry. Errors are swallowed so they never break the main flow."""
    try:
        await db.execute(
            """
            INSERT INTO audit_log (actor_email, action, entity_type, entity_id, entity_name, details)
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            actor_email,
            action,
            entity_type,
            entity_id,
            entity_name,
            json.dumps(details) if details else None,
        )
    except Exception as e:
        print(f"[AUDIT] Failed to log: {e}")
