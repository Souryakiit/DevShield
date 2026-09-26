# DevShield

> **Nothing enters your build that you haven't approved.**

DevShield is an IBM Bob–driven pre-build gate for software supply-chain risk. It keeps an approved baseline of your workspace, detects everything that entered since, scores it with deterministic security signals, and has Bob's subagents review dependency and configuration changes before anything reaches your build or deployment.

Built for the **IBM Bob 2.0 Hackathon**.

---

## Project documentation

| Document | Description |
|---|---|
| [`docs/BRIEF.md`](docs/BRIEF.md) | Full project brief — problem, solution, architecture, scoring, safety principles |
| [`CONTRACTS.md`](CONTRACTS.md) | Exact JSON request/response shapes for all service boundaries |

---

## Architecture

Four services, no shared database. The backend is the single source of truth for workspace state; it delegates analysis to the analyzer and exposes everything to Bob via the MCP server.

```
Developer / Bob (MCP client)
        │
        ▼
┌──────────────────┐      POST /analyze       ┌─────────────────────┐
│  Backend         │ ───────────────────────► │  Analyzer           │
│  Java 21         │ ◄─────────────────────── │  Python 3.11        │
│  Spring Boot 3   │      findings JSON        │  FastAPI            │
│  :8080           │                           │  :8001              │
└──────────────────┘                           └─────────────────────┘
        │
        │  REST API
        ▼
┌──────────────────┐
│  MCP Server      │   Bob calls scan_workspace, get_findings,
│  Python          │   get_file_details, search_files,
│  FastMCP         │   quarantine_file, approve_baseline
└──────────────────┘
        │
        │  (same REST API)
        ▼
┌──────────────────┐
│  Frontend        │   Findings dashboard
│  React + Vite    │   Overview · Findings · File detail · Approve baseline
│  :5173           │
└──────────────────┘
```

### Baseline storage

`<workspace>/.devshield/baseline.json` — persisted map of `path → {size, modifiedTime, sha256}`. No database required.

Quarantined files land in `<workspace>/.devshield/quarantine/` with a manifest and are always restorable.

---

## Repository structure

```
devshield/
├── backend/          # Java 21 + Spring Boot 3 (Maven)
├── analyzer/         # Python 3.11 + FastAPI
├── mcp-server/       # Python + FastMCP
├── frontend/         # React + Vite
│   └── mocks/        # Realistic example JSON responses for every endpoint
├── fixtures/         # Safe synthetic test files (no real malware)
├── bob_sessions/     # Saved Bob session logs and DEVSHIELD_REPORT examples
├── docs/
│   └── BRIEF.md      # Full project brief
├── CONTRACTS.md      # Service boundary contracts (request/response shapes)
└── README.md
```

---

## Running each service

> Service source code is not yet scaffolded. The commands below are the intended run targets once implementation is in place.

### Backend (Java 21 + Spring Boot 3)

```bash
cd backend
./mvnw spring-boot:run
# Starts on http://localhost:8080
```

### Analyzer (Python 3.11 + FastAPI)

```bash
cd analyzer
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --port 8001 --reload
# Starts on http://localhost:8001
```

### MCP Server (Python + FastMCP)

```bash
cd mcp-server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python server.py
# Registers with Bob via MCP; backend must be running first
```

### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
# Starts on http://localhost:5173
# Set VITE_API_BASE=http://localhost:8080 in .env.local
```

---

## Frontend mock data

[`frontend/mocks/`](frontend/mocks/) contains one realistic JSON file per endpoint response, all sharing the same file IDs so they can be used together as a consistent fixture set:

| File | Endpoint |
|---|---|
| [`scan.json`](frontend/mocks/scan.json) | `POST /api/workspace/scan` |
| [`findings.json`](frontend/mocks/findings.json) | `GET /api/workspace/findings` |
| [`file-detail.json`](frontend/mocks/file-detail.json) | `GET /api/files/{id}` |
| [`file-search.json`](frontend/mocks/file-search.json) | `GET /api/files/search?q=` |
| [`quarantine-success.json`](frontend/mocks/quarantine-success.json) | `POST /api/files/{id}/quarantine` — 200 |
| [`quarantine-error.json`](frontend/mocks/quarantine-error.json) | `POST /api/files/{id}/quarantine` — 400 |
| [`baseline-approve.json`](frontend/mocks/baseline-approve.json) | `POST /api/workspace/baseline/approve` |

---

## Scoring quick reference

| Signal | Weight |
|---|---|
| `known_bad_hash` | +100 |
| `magic_mismatch` | +35 |
| `install_script` | +30 |
| `double_extension` | +25 |
| `non_registry_dependency` | +25 |
| `binary_in_source_dir` | +20 |
| `obfuscated_code` | +20 |
| `hidden_file_unusual_location` | +10 |

Score thresholds: **0–29** LOW → `ALLOW` · **30–69** MEDIUM → `REVIEW` · **70+** HIGH → `QUARANTINE_REVIEW`

> DevShield output is an AI-assisted risk assessment, not a definitive malware verdict. Files are never executed or automatically deleted.

---

## IBM Bob integration

DevShield is operated through IBM Bob in the **"DevShield Gate"** custom mode. Bob calls the MCP server, runs parallel subagents (dependency reviewer, config reviewer, artifact reviewer), and produces `DEVSHIELD_REPORT.md` with a per-item `ALLOW / REVIEW / QUARANTINE` decision.

MCP tools exposed: `scan_workspace` · `get_findings` · `get_file_details` · `search_files` · `quarantine_file` · `approve_baseline`

See [`docs/BRIEF.md`](docs/BRIEF.md) §5 for the full Bob workflow.
