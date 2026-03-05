"""GenAI-powered tool description generation."""

import os
import json
import aiohttp
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from server.auth import require_contributor
from server.config import get_oauth_token, get_workspace_host

router = APIRouter(prefix="/api/generate", tags=["generate"])

SYSTEM_PROMPT = """You are a technical researcher specialising in enterprise software used by energy and utilities companies in the ANZ region.

When given a tool or software product name, provide:
1. A clear, concise description of what it is and what it does (2-4 sentences). Focus on its role in the energy/utilities industry.
2. How it typically integrates with Databricks (ingestion patterns, connectors, APIs, or common architectures).
3. 3-5 relevant tags (short keywords like: SCADA, OT, real-time, billing, AMI, GIS, market data, etc.)

Respond ONLY with valid JSON in this exact format:
{
  "description": "...",
  "databricks_integration": "...",
  "tags": ["tag1", "tag2"]
}"""


class GenerateRequest(BaseModel):
    name: str
    vendor: str = ""


@router.post("/tool-description")
async def generate_tool_description(
    body: GenerateRequest,
    user: dict = Depends(require_contributor),
):
    endpoint = os.environ.get("SERVING_ENDPOINT", "databricks-claude-sonnet-4-6")
    host = get_workspace_host()
    token = get_oauth_token()

    if not host or not token:
        raise HTTPException(status_code=503, detail="Workspace not configured")

    query = body.name
    if body.vendor:
        query = f"{body.name} by {body.vendor}"

    payload = {
        "model": endpoint,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Research this tool: {query}"},
        ],
        "max_tokens": 600,
        "temperature": 0.3,
    }

    url = f"{host}/serving-endpoints/{endpoint}/invocations"

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=aiohttp.ClientTimeout(total=30),
            ) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    raise HTTPException(status_code=502, detail=f"LLM error: {text[:200]}")
                data = await resp.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM request failed: {e}")

    try:
        content = data["choices"][0]["message"]["content"]
        # Strip markdown code fences if present
        content = content.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        result = json.loads(content)
        return {
            "description": result.get("description", ""),
            "databricks_integration": result.get("databricks_integration", ""),
            "tags": result.get("tags", []),
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to parse LLM response: {e}")
