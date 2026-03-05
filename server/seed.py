"""DDL and seed data for FE ANZ Energy Hub.

Creates the expertise schema tables on startup (CREATE IF NOT EXISTS).
Seeds the configured admin user from the ADMIN_EMAIL env var.
"""

import os
from server.db import db


async def ensure_schema_and_tables():
    """Create all tables in the expertise schema (idempotent)."""
    schema = os.environ.get("PGSCHEMA", "expertise")

    await db.execute_raw(f"CREATE SCHEMA IF NOT EXISTS {schema}")

    ddl_statements = [
        f"""
        CREATE TABLE IF NOT EXISTS {schema}.users (
            id          SERIAL PRIMARY KEY,
            email       TEXT UNIQUE NOT NULL,
            display_name TEXT NOT NULL DEFAULT '',
            role        TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'contributor', 'admin')),
            created_at  TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        f"""
        CREATE TABLE IF NOT EXISTS {schema}.tools (
            id                      SERIAL PRIMARY KEY,
            name                    TEXT NOT NULL,
            vendor                  TEXT NOT NULL DEFAULT '',
            category                TEXT NOT NULL DEFAULT 'Other',
            description             TEXT NOT NULL DEFAULT '',
            databricks_integration  TEXT NOT NULL DEFAULT '',
            integration_type        TEXT NOT NULL DEFAULT 'Custom ETL',
            website_url             TEXT NOT NULL DEFAULT '',
            tags                    TEXT[] NOT NULL DEFAULT '{{}}',
            status                  TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
            created_by              TEXT NOT NULL DEFAULT '',
            created_at              TIMESTAMPTZ DEFAULT NOW(),
            updated_at              TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        f"""
        CREATE TABLE IF NOT EXISTS {schema}.use_cases (
            id                  SERIAL PRIMARY KEY,
            name                TEXT NOT NULL,
            category            TEXT NOT NULL DEFAULT 'Other',
            problem_statement   TEXT NOT NULL DEFAULT '',
            databricks_solution TEXT NOT NULL DEFAULT '',
            relevant_products   TEXT NOT NULL DEFAULT '',
            maturity            TEXT NOT NULL DEFAULT 'Emerging' CHECK (maturity IN ('Emerging', 'Growing', 'Established')),
            tags                TEXT[] NOT NULL DEFAULT '{{}}',
            status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
            created_by          TEXT NOT NULL DEFAULT '',
            created_at          TIMESTAMPTZ DEFAULT NOW(),
            updated_at          TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        f"""
        CREATE TABLE IF NOT EXISTS {schema}.customer_stories (
            id                          SERIAL PRIMARY KEY,
            title                       TEXT NOT NULL,
            customer_name               TEXT NOT NULL DEFAULT '',
            summary                     TEXT NOT NULL DEFAULT '',
            challenge                   TEXT NOT NULL DEFAULT '',
            outcome                     TEXT NOT NULL DEFAULT '',
            databricks_products         TEXT NOT NULL DEFAULT '',
            salesforce_opportunity_url  TEXT NOT NULL DEFAULT '',
            salesforce_account_url      TEXT NOT NULL DEFAULT '',
            is_referenceable            BOOLEAN NOT NULL DEFAULT FALSE,
            tags                        TEXT[] NOT NULL DEFAULT '{{}}',
            status                      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
            created_by                  TEXT NOT NULL DEFAULT '',
            created_at                  TIMESTAMPTZ DEFAULT NOW(),
            updated_at                  TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        f"""
        CREATE TABLE IF NOT EXISTS {schema}.story_links (
            story_id    INTEGER NOT NULL REFERENCES {schema}.customer_stories(id) ON DELETE CASCADE,
            entity_type TEXT NOT NULL CHECK (entity_type IN ('tool', 'use_case')),
            entity_id   INTEGER NOT NULL,
            PRIMARY KEY (story_id, entity_type, entity_id)
        )
        """,
        f"""
        CREATE TABLE IF NOT EXISTS {schema}.audit_log (
            id          SERIAL PRIMARY KEY,
            actor_email TEXT NOT NULL,
            action      TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id   INTEGER,
            entity_name TEXT,
            details     JSONB,
            created_at  TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        f"CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON {schema}.audit_log (created_at DESC)",
        f"CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON {schema}.audit_log (actor_email)",
        f"""
        CREATE TABLE IF NOT EXISTS {schema}.tool_customers (
            id          SERIAL PRIMARY KEY,
            tool_id     INTEGER NOT NULL REFERENCES {schema}.tools(id) ON DELETE CASCADE,
            customer_name TEXT NOT NULL,
            stage       TEXT NOT NULL DEFAULT 'Identified' CHECK (stage IN ('Identified', 'Implementing', 'Live')),
            notes       TEXT NOT NULL DEFAULT '',
            created_by  TEXT NOT NULL DEFAULT '',
            updated_by  TEXT NOT NULL DEFAULT '',
            created_at  TIMESTAMPTZ DEFAULT NOW(),
            updated_at  TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        f"CREATE INDEX IF NOT EXISTS tool_customers_tool_id_idx ON {schema}.tool_customers (tool_id)",
    ]

    for ddl in ddl_statements:
        try:
            await db.execute_raw(ddl)
        except Exception as e:
            print(f"[SEED] DDL warning: {e}")

    print("[SEED] All tables ensured")


async def seed_admin_user():
    """Seed the admin user from ADMIN_EMAIL env var if set."""
    admin_email = os.environ.get("ADMIN_EMAIL", "").strip()
    if not admin_email:
        print("[SEED] ADMIN_EMAIL not set, skipping admin seed")
        return

    try:
        await db.execute(
            """
            INSERT INTO users (email, display_name, role)
            VALUES ($1, $2, 'admin')
            ON CONFLICT (email) DO UPDATE SET role = 'admin'
            """,
            admin_email,
            admin_email.split("@")[0].replace(".", " ").title(),
        )
        print(f"[SEED] Admin user seeded: {admin_email}")
    except Exception as e:
        print(f"[SEED] Admin seed warning: {e}")
