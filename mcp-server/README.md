# DevShield MCP Server

Wraps the DevShield backend REST API and exposes it to IBM Bob via the Model Context Protocol (MCP) over stdio transport.

## What it does

The MCP server acts as the bridge between IBM Bob and the DevShield backend (running on port 8080). Bob calls MCP tools; the server translates those calls into HTTP requests to the backend and returns structured JSON results.

**Exposed tools:**

| Tool | Description |
|---|---|
| `scan_workspace` | Index all workspace files, diff against baseline, return risk summary |
| `get_findings` | Retrieve scored findings from the last scan (optional `min_risk` filter) |
| `get_file_details` | Get full metadata and signals for a specific file by ID |
| `search_files` | Search files by name or path fragment |
| `quarantine_file` | ⚠️ Move a file to `.devshield/quarantine/` — **requires explicit user confirmation** |
| `approve_baseline` | ⚠️ Seal current workspace state as new trusted baseline — **requires explicit user confirmation** |

## Safety note

`quarantine_file` and `approve_baseline` are destructive/irreversible operations. Their tool descriptions instruct Bob to ask the user for explicit confirmation before calling them with `confirmed=True`. Bob must **never** call these with confirmation pre-set without user consent.

## Prerequisites

- Python 3.11+
- DevShield backend running on `http://localhost:8080`
- Virtual environment created and dependencies installed (see setup below)

## Setup

```powershell
cd mcp-server
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## Running manually

```powershell
cd mcp-server
.\.venv\Scripts\python.exe server.py
```

Or using the MCP CLI:

```powershell
cd mcp-server
.\.venv\Scripts\python.exe -m mcp.server.fastmcp server.py
```

## Registering with IBM Bob (Windows)

Add the following to Bob's MCP server configuration (Settings → MCP Servers):

```json
{
  "mcpServers": {
    "devshield": {
      "command": "C:\\Users\\soury\\OneDrive\\DevShield\\mcp-server\\.venv\\Scripts\\python.exe",
      "args": [
        "C:\\Users\\soury\\OneDrive\\DevShield\\mcp-server\\server.py"
      ],
      "transport": "stdio"
    }
  }
}
```

Bob will launch the server as a subprocess on demand and communicate with it over stdin/stdout. No port is required.
