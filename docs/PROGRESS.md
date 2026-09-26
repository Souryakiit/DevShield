# DevShield — Progress Log

---

## 2025-07-14 — Subagent B: `analyzer/` component

### What was built

| File | Description |
|---|---|
| `analyzer/main.py` | FastAPI app on port 8001, `POST /analyze` endpoint |
| `analyzer/signals.py` | All 8 security signal check functions |
| `analyzer/weights.yaml` | Signal ID → weight mapping (YAML) |
| `analyzer/known_bad_hashes.txt` | SHA-256 blocklist (initially comment-only) |
| `analyzer/requirements.txt` | Python dependencies |
| `analyzer/tests/test_signals.py` | 29 pytest tests (positive + negative per signal) |
| `analyzer/.venv/` | Python virtual environment (gitignored) |
| `.gitignore` | Root gitignore covering `.venv`, `__pycache__`, build artifacts |

### Signals implemented

1. **known_bad_hash** (weight 100) — SHA-256 blocklist lookup
2. **magic_mismatch** (weight 35) — file header vs. extension mismatch (MZ, ELF, PNG, JPEG, GIF, PDF, PK)
3. **install_script** (weight 30) — `package.json` lifecycle hooks / `setup.py` risky patterns
4. **double_extension** (weight 25) — disguised executables (e.g. `invoice.pdf.exe`)
5. **non_registry_dependency** (weight 25) — `git+`, `http://`, `file:` sources in `package.json` / `requirements.txt`
6. **binary_in_source_dir** (weight 20) — PE/ELF binaries inside `src/`, `lib/`, `app/`, `uploads/`
7. **obfuscated_code** (weight 20) — `eval(atob(...))` pattern or base64 strings >1000 chars in JS/Python
8. **hidden_file_unusual_location** (weight 10) — dot-files outside expected dot-dirs

### Risk scoring

- Score = sum of triggered signal weights, capped at 100
- `LOW` (0–29) → `ALLOW`
- `MEDIUM` (30–69) → `REVIEW`
- `HIGH` (70+) → `QUARANTINE_REVIEW`

### Test results

```
29 passed in 0.12s  (Python 3.14.7, pytest 9.1.1)
```

All 29 tests passed on first run. No failures, no warnings.

### Known issues / future improvements

- `known_bad_hashes.txt` is empty by default; must be populated with real threat-intel hashes.
- `_KNOWN_BAD_HASHES` is a module-level cache; the service must be restarted (or the cache manually cleared) when the blocklist is updated.
- `non_registry_dependency` for `requirements.txt` only checks the first triggering line; full-scan reporting can be added later.
- No authentication on `POST /analyze`; should be secured before production deployment.

---

## 2025-07-14 — Subagent C: `fixtures/` and `mcp-server/` components

### What was built

| File | Description |
|---|---|
| `fixtures/generate_fixtures.py` | Fixture generator script — writes 8 safe test artifacts to a target dir |
| `fixtures/fixture_manifest.json` | Auto-generated manifest of created fixture paths (for `--clean`) |
| `mcp-server/server.py` | FastMCP stdio MCP server wrapping the backend REST API |
| `mcp-server/requirements.txt` | Python deps: `mcp[cli]>=1.0.0,<2.0.0`, `httpx>=0.27.0` |
| `mcp-server/README.md` | Setup, usage, and Bob MCP registration JSON |
| `mcp-server/.venv/` | Python virtual environment (gitignored) |
| `analyzer/known_bad_hashes.txt` | Updated with SHA-256 of `src/lib/tool.dll` fixture |

### Fixtures generated (in demo-workspace/)

| Fixture file | Signal triggered |
|---|---|
| `assets/logo.png` | `magic_mismatch` — MZ header in a .png |
| `docs/invoice.pdf.exe` | `double_extension` |
| `vendor/helper/package.json` | `install_script` — postinstall curl pipe |
| `vendor/helper/README.md` | harmless warning |
| `vendor/requirements_fixture.txt` | `non_registry_dependency` — git+https URL |
| `src/utils/loader.js` | `obfuscated_code` — eval(atob(...)) |
| `src/lib/tool.dll` | `binary_in_source_dir` + `known_bad_hash` |
| `src/NewFeature.java` | harmless new file |
| `README.md` | harmless new/appended file |

### SHA-256 blocklist

`src/lib/tool.dll` hash appended to `analyzer/known_bad_hashes.txt`:
`014b8ce9fed0aaf124de966f635da95bf7025bee91d1a1c12d6ff5854eba3307`

### MCP server tools

| Tool | Confirmation required |
|---|---|
| `scan_workspace` | No |
| `get_findings` | No |
| `get_file_details` | No |
| `search_files` | No |
| `quarantine_file` | ⚠️ Yes — explicit user yes required |
| `approve_baseline` | ⚠️ Yes — explicit user yes required |

### Test results

```
MCP import OK   (mcp 1.30.0, .venv\Scripts\python.exe -c "from mcp.server.fastmcp import FastMCP")
Fixture generator: 9 files created, manifest saved, hash appended — exit 0
--clean flag: all manifest files removed before regenerating — exit 0
```

### Known issues / notes

- `mcp[cli]` was pinned to `<2.0.0` because `FastMCP` was renamed to `MCPServer` in mcp 2.x; the spec was written against the v1 API. The pin keeps the import path `mcp.server.fastmcp.FastMCP` valid.
- The MCP server requires the backend to be running on port 8080; all tools will raise `httpx.HTTPStatusError` if the backend is down (surfaces cleanly to Bob).
- `demo-workspace/` is added to `.gitignore` so fixture output is not committed.

