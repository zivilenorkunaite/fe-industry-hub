"""Lakebase Provisioned (PostgreSQL) async connection pool with OAuth token refresh.

Uses PGHOST, PGPORT, PGDATABASE, PGUSER from the Databricks app database resource;
password is a short-lived token from /api/2.0/database/credentials (or workspace token).
All queries run with search_path set to PGSCHEMA (default 'expertise'). Raises RuntimeError
if the database is unavailable.
"""

import os
import asyncpg
import aiohttp
from typing import Optional, List, Any
from server.config import get_oauth_token, get_workspace_host

SCHEMA = os.environ.get("PGSCHEMA", "expertise")
_LAKEBASE_INSTANCE = os.environ.get("LAKEBASE_INSTANCE", "fe-anz-hub-pg")


async def _get_database_token() -> Optional[str]:
    """Get database credential token via /api/2.0/database/credentials (Lakebase Provisioned)."""
    try:
        workspace_token = get_oauth_token()
        if not workspace_token:
            return None
        workspace_host = get_workspace_host()
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{workspace_host}/api/2.0/database/credentials",
                headers={"Authorization": f"Bearer {workspace_token}"},
                json={"instance_names": [_LAKEBASE_INSTANCE]},
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                data = await resp.json()
                token = data.get("token")
                if token:
                    return token
                print("[DB] Database credentials API returned no token, falling back to workspace token")
                return workspace_token
    except Exception as e:
        print(f"[DB] Failed to get database credential: {e}")
        return get_oauth_token()


class DatabasePool:
    """Async database pool with OAuth token refresh (Lakebase Provisioned)."""

    def __init__(self):
        self._pool: Optional[asyncpg.Pool] = None
        self._schema_ready = False

    def _resolve_pghost(self) -> bool:
        """Resolve PGHOST from Lakebase instance API if not set."""
        if os.environ.get("PGHOST"):
            return True
        if not _LAKEBASE_INSTANCE:
            return False
        try:
            from databricks.sdk import WorkspaceClient
            w = WorkspaceClient()
            instance = w.database.get_database_instance(name=_LAKEBASE_INSTANCE)
            host = getattr(instance, "read_write_dns", None) or getattr(instance, "host", None)
            if host:
                os.environ["PGHOST"] = host
                print(f"[DB] Resolved PGHOST from instance {_LAKEBASE_INSTANCE}: {host}")
                return True
        except Exception as e:
            print(f"[DB] Could not resolve PGHOST from instance API: {e}")
        return False

    async def get_pool(self) -> asyncpg.Pool:
        """Return the connection pool. Raises RuntimeError if the database is unavailable."""
        if not self._resolve_pghost():
            raise RuntimeError(
                "Cannot connect to database: PGHOST is not set and could not be resolved from "
                f"LAKEBASE_INSTANCE ({_LAKEBASE_INSTANCE}). Set PGHOST in the environment or ensure the "
                "Databricks workspace can resolve the Lakebase instance."
            )

        if self._pool is None:
            token = await _get_database_token()
            if not token:
                raise RuntimeError(
                    "Cannot connect to database: No database credential token could be obtained."
                )

            pg_user = os.environ.get("PGUSER") or os.environ.get("DATABRICKS_CLIENT_ID", "")
            raw_port = os.environ.get("PGPORT", "5432")
            try:
                pg_port = int(raw_port)
            except (ValueError, TypeError):
                pg_port = 5432
            try:
                self._pool = await asyncpg.create_pool(
                    host=os.environ["PGHOST"],
                    port=pg_port,
                    database=os.environ.get("PGDATABASE", "databricks_postgres"),
                    user=pg_user,
                    password=token,
                    ssl="require",
                    min_size=2,
                    max_size=10,
                    command_timeout=60,
                )
                print(f"[DB] Connected to Lakebase at {os.environ['PGHOST']}")
            except Exception as e:
                raise RuntimeError(
                    f"Cannot connect to database at {os.environ.get('PGHOST', '?')}: {e}. "
                    "Check PGHOST, PGPORT, PGDATABASE, PGUSER and that the Lakebase instance is running."
                ) from e

            if not self._schema_ready:
                async with self._pool.acquire() as conn:
                    try:
                        await conn.execute(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")
                        print(f"[DB] Schema '{SCHEMA}' is ready")
                        self._schema_ready = True
                    except Exception as e:
                        print(f"[DB] Could not create schema '{SCHEMA}': {e}")
                        self._schema_ready = True

        return self._pool

    async def refresh_token(self):
        """Refresh database token (Lakebase tokens expire after ~1h)."""
        if self._pool:
            await self._pool.close()
            self._pool = None
            self._schema_ready = False
        await self.get_pool()

    async def execute(self, sql: str, *args) -> str:
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            await conn.execute(f"SET search_path TO {SCHEMA}")
            return await conn.execute(sql, *args)

    async def fetch(self, sql: str, *args) -> List[Any]:
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            await conn.execute(f"SET search_path TO {SCHEMA}")
            rows = await conn.fetch(sql, *args)
            return [dict(r) for r in rows]

    async def fetchrow(self, sql: str, *args) -> Optional[dict]:
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            await conn.execute(f"SET search_path TO {SCHEMA}")
            row = await conn.fetchrow(sql, *args)
            return dict(row) if row else None

    async def fetchval(self, sql: str, *args) -> Any:
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            await conn.execute(f"SET search_path TO {SCHEMA}")
            return await conn.fetchval(sql, *args)

    async def execute_raw(self, sql: str, *args) -> str:
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            return await conn.execute(sql, *args)

    async def fetch_raw(self, sql: str, *args) -> List[Any]:
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(sql, *args)
            return [dict(r) for r in rows]

    async def fetchval_raw(self, sql: str, *args) -> Any:
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            return await conn.fetchval(sql, *args)

    async def close(self):
        if self._pool:
            await self._pool.close()
            self._pool = None


db = DatabasePool()
