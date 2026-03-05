# FE ANZ Industry Hub

Internal Databricks App for the ANZ Energy & Utilities Field Engineering team. A centralised knowledge base for tracking industry tools, customer adoption, and customer success stories.

## Purpose

The ANZ Energy & Utilities sector uses a broad and fragmented set of operational technology — SCADA systems, billing platforms, AMI infrastructure, GIS tools, trading systems, and more. This app gives the FE team a single place to:

- **Track tools & systems** used across the industry, with notes on how they integrate with Databricks
- **Record which customers use each tool** and at what stage (Identified → Implementing → Live)
- **Store customer stories** with challenge/outcome narratives and Salesforce links
- **Monitor adoption trends** — which tools have the most live implementations, what's currently being integrated

Everything is auditable: every create, edit, publish, and role change is logged with the actor's email and a timestamp.

## Features

- **Tools & Systems** — searchable/filterable catalogue with Databricks integration notes, 18 pre-built Energy & Utilities categories, AI-generated descriptions via Foundation Model API
- **Customer tracking per tool** — attach customers with implementation stage (Identified / Implementing / Live), editable inline
- **Customer Stories** — full story detail with challenge, outcome, Databricks products used, and Salesforce opportunity/account links
- **Home dashboard** — live stats, top adopted tools with stage breakdown, recent additions, in-progress implementation pipeline
- **Role-based access** — viewer (read-only) / contributor (submit own entries) / admin (manage all). First user to log in automatically becomes admin
- **Admin panel** — draft review queue, user management, full audit log
- **Submit form** — tabbed form for tools and stories, saved as draft pending admin review

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python / FastAPI |
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Database | Lakebase Provisioned (PostgreSQL via asyncpg) |
| Auth | Databricks Apps OAuth proxy (`X-Forwarded-User`) + SCIM resolution |
| AI | Databricks Foundation Model API (`databricks-claude-sonnet-4-6`) |
| Deployment | Databricks Asset Bundles (DABs) |

## Project Structure

```
fe-anz-energy-hub/
├── app.py                  # FastAPI entry point + SPA serving
├── app.yaml                # Databricks App config (local reference)
├── databricks.yml          # DABs bundle config (targets, resources, env vars)
├── requirements.txt        # Python dependencies
├── deploy.sh               # One-command build + deploy script
├── server/
│   ├── auth.py             # X-Forwarded-User → email resolution via SCIM, role lookup
│   ├── audit.py            # Fire-and-forget audit log writer
│   ├── config.py           # Workspace client, OAuth token helper
│   ├── db.py               # asyncpg connection pool with Lakebase token refresh
│   ├── seed.py             # DDL (CREATE TABLE IF NOT EXISTS) + admin user seed
│   └── routes/
│       ├── tools.py        # Tools CRUD + customer tracking endpoints
│       ├── stories.py      # Customer stories CRUD
│       ├── admin.py        # Draft review, user management, audit log
│       ├── generate.py     # AI description generation
│       └── auth.py         # GET /api/auth/me
└── frontend/src/
    ├── App.tsx             # Layout, routing, nav
    ├── pages/
    │   ├── Home.tsx        # Dashboard
    │   ├── Tools.tsx       # Tools list + detail/edit drawer + customer management
    │   ├── Stories.tsx     # Stories list + detail drawer
    │   ├── Submit.tsx      # Contributor submission form
    │   └── Admin.tsx       # Admin panel (drafts / users / audit log)
    └── components/
        ├── ComboBox.tsx    # Select from list or type to create custom value
        ├── TagInput.tsx    # Multi-select pill input with suggestions
        ├── Badge.tsx
        ├── Card.tsx
        └── SearchBar.tsx
```

## Deployment

### Prerequisites

- Databricks CLI (`databricks` ≥ 0.229) authenticated against an FE-VM workspace with Lakebase support
- Node.js 18+ and npm
- Python 3.11+

### First-time setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/zivilenorkunaite/fe-industry-hub.git
   cd fe-industry-hub
   ```

2. **Configure your target workspace** in `databricks.yml`:
   ```yaml
   targets:
     dev:
       workspace:
         host: https://<your-workspace>.cloud.databricks.com
       variables:
         lakebase_instance_name: fe-anz-hub-pg-dev
         admin_email: "<your-email>"
   ```

3. **Install frontend dependencies** (one-time):
   ```bash
   cd frontend && npm install && cd ..
   ```

4. **Deploy**:
   ```bash
   ./deploy.sh
   ```

   The script:
   - Rebuilds the frontend only when source files have changed
   - Runs `databricks bundle deploy --force-lock`
   - Runs `databricks apps deploy` to the workspace

### Subsequent deployments

```bash
./deploy.sh
```

That's it. The script detects whether a frontend rebuild is needed automatically.

### Bundle variables

| Variable | Default | Description |
|----------|---------|-------------|
| `lakebase_instance_name` | `fe-anz-hub-pg` | Lakebase Provisioned instance name |
| `pg_database` | `databricks_postgres` | Postgres database name |
| `pg_schema` | `expertise` | Schema used for all app tables |
| `admin_email` | `""` | Email seeded as admin on first startup |
| `serving_endpoint` | `databricks-claude-sonnet-4-6` | Foundation Model endpoint for AI generation |

### Database

Tables are created automatically on startup (`CREATE TABLE IF NOT EXISTS`). No migration scripts needed.

Schema (`expertise`): `users`, `tools`, `use_cases`, `customer_stories`, `story_links`, `tool_customers`, `audit_log`

### Access control

| Action | Viewer | Contributor | Admin |
|--------|--------|-------------|-------|
| View published content | ✓ | ✓ | ✓ |
| Submit new entry (as draft) | — | ✓ | ✓ |
| Edit own drafts | — | ✓ | ✓ |
| Add/edit customers on tools | — | ✓ | ✓ |
| Edit any entry | — | — | ✓ |
| Publish / unpublish | — | — | ✓ |
| Manage users | — | — | ✓ |

The first user to log in is automatically granted the `admin` role.
