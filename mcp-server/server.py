#!/usr/bin/env python3
"""
DevShield MCP Server
Wraps the DevShield backend REST API for use with IBM Bob.
Transport: stdio
"""
from mcp.server.fastmcp import FastMCP
import httpx

BACKEND_URL = "http://localhost:8080"

mcp = FastMCP("DevShield")


@mcp.tool()
def scan_workspace(workspace_path: str) -> dict:
    """Scan a workspace for supply-chain risks. Indexes all files, diffs against the approved baseline, and analyzes NEW/MODIFIED files for security signals. Returns scan summary with risk counts."""
    response = httpx.post(
        f"{BACKEND_URL}/api/workspace/scan",
        json={"workspacePath": workspace_path},
        timeout=120.0,
    )
    response.raise_for_status()
    return response.json()


@mcp.tool()
def get_findings(min_risk: str = None) -> dict:
    """Get all findings from the most recent scan. Returns file details, risk scores, signals, and recommendations. Optionally filter by min_risk: LOW, MEDIUM, or HIGH."""
    response = httpx.get(f"{BACKEND_URL}/api/workspace/findings", timeout=30.0)
    response.raise_for_status()
    data = response.json()
    if min_risk:
        levels = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}
        min_level = levels.get(min_risk.upper(), 0)
        data["findings"] = [
            f
            for f in data.get("findings", [])
            if levels.get(f.get("riskLevel", "LOW"), 0) >= min_level
        ]
    return data


@mcp.tool()
def get_file_details(file_id: str) -> dict:
    """Get full metadata and analysis details for a specific file by its ID."""
    response = httpx.get(f"{BACKEND_URL}/api/files/{file_id}", timeout=30.0)
    response.raise_for_status()
    return response.json()


@mcp.tool()
def search_files(query: str) -> dict:
    """Search for files by name or path fragment across the current scan index."""
    response = httpx.get(
        f"{BACKEND_URL}/api/files/search", params={"q": query}, timeout=30.0
    )
    response.raise_for_status()
    return response.json()


@mcp.tool()
def quarantine_file(file_id: str, confirmed: bool = False) -> dict:
    """⚠️ REQUIRES EXPLICIT USER CONFIRMATION. Ask the user 'Do you want to quarantine file {file_id}? This will move it to .devshield/quarantine/ and it will no longer be accessible from its original location.' Only proceed if they explicitly say yes. Never call with confirmed=True without explicit user approval. Moves the file to quarantine and records it in the manifest."""
    response = httpx.post(
        f"{BACKEND_URL}/api/files/{file_id}/quarantine",
        json={"confirmed": confirmed},
        timeout=30.0,
    )
    response.raise_for_status()
    return response.json()


@mcp.tool()
def approve_baseline() -> dict:
    """⚠️ REQUIRES EXPLICIT USER CONFIRMATION. Ask the user 'Do you want to approve the current workspace state as the new trusted baseline? All future scans will diff against this state.' Only proceed if they explicitly confirm with yes. Never approve without user consent. Seals the current workspace state as the new trusted baseline."""
    response = httpx.post(
        f"{BACKEND_URL}/api/workspace/baseline/approve", json={}, timeout=30.0
    )
    response.raise_for_status()
    return response.json()


if __name__ == "__main__":
    mcp.run(transport="stdio")
