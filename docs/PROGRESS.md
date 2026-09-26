# DevShield — Progress Log

## 2026-09-26 — Backend Implementation (Subagent A)

### What was built

Complete `backend/` Spring Boot 3 / Java 21 / Maven component:

**Project scaffold**
- `pom.xml` — Spring Boot 3.3.0 parent, Java 21, `spring-boot-starter-web`, `jackson-databind`, `lombok`, `mockito-core` (test)
- `mvnw` / `mvnw.cmd` — Maven Wrapper scripts (Apache Maven 3.9.9)
- `.mvn/wrapper/maven-wrapper.properties` — wrapper config pointing to Maven 3.9.9

**Config**
- `CorsConfig.java` — CORS enabled for `http://localhost:5173` on `/api/**`
- `application.properties` — port 8080, analyzer URL `http://localhost:8001/analyze`

**Models** (`model/`)
- `FileRecord` — id, relativePath, absolutePath, extension, size, sha256, modifiedTime, changeType
- `FileNode` — name, path, children (directory tree node)
- `BaselineEntry` — size, modifiedTime, sha256 (one entry in baseline snapshot)
- `ScanResult` — full scan response DTO
- `Finding` — full finding DTO including quarantined flag
- `Signal` — id, weight, detail

**Indexer** (`indexer/`)
- `HashIndex` — streaming SHA-256 with 8 KB buffer; also hashes strings for file IDs
- `FileIndexer` — `Files.walkFileTree`, skips `.git`, `node_modules`, `target`, `.devshield`; builds `FileRecord` with ID = first 8 hex chars of SHA-256 of relative path
- `FilenameIndex` — in-memory index by filename segment
- `ExtensionIndex` — in-memory index by lowercase extension

**Store** (`store/`)
- `BaselineStore` — reads/writes `<workspace>/.devshield/baseline.json` (map of relativePath → {size, modifiedTime, sha256} plus top-level `approvedAt`)

**Services** (`service/`)
- `AnalyzerClient` — HTTP POST to `http://localhost:8001/analyze` via `RestTemplate`; returns empty list on `ResourceAccessException` or any IO error (analyzer unreachable)
- `ScanService` — orchestrates full incremental scan: index → diff vs baseline → hash NEW/MODIFIED → call analyzer → classify UNCHANGED files → store findings in memory; `approveBaseline()` writes new baseline; `UNKNOWN` risk level lumped into `mediumCount` for summary counts

**Controllers** (`controller/`)
- `ScanController` — `POST /api/workspace/scan`, `GET /api/workspace/findings`, `POST /api/workspace/baseline/approve`
- `FileController` — `GET /api/files/search?q=`, `GET /api/files/{id}`, `POST /api/files/{id}/quarantine` (moves file, appends `manifest.json`, marks finding as quarantined in memory)

**Tests** (`src/test/`)
- `IndexerTest` (6 tests) — correct file count, skips `.git`/`node_modules`/`target`, field validation, ID format
- `ScanServiceTest` (5 tests) — first scan all-NEW, second scan only-modified analyzed (`analyzedFiles==1`), unchanged not analyzed, deleted counted, UNKNOWN risk when analyzer unreachable
- `QuarantineTest` (5 tests) — `confirmed:false` → 400, null body → 400, `confirmed:true` → file moved + manifest created + 200 response, finding marked quarantined, 404 for unknown id

### Test results

```
Tests run: 16, Failures: 0, Errors: 0, Skipped: 0  — BUILD SUCCESS
```

All 16 tests pass (IndexerTest: 6, QuarantineTest: 5, ScanServiceTest: 5).

### Known issues / notes

- The `maven-wrapper.jar` binary is not committed to the repo (`.gitignore` typically excludes `.jar` files). Teammates must either have network access for auto-download, or add `distributionOnly=true` mode. A `.gitignore` exemption for the wrapper JAR (`!.mvn/wrapper/maven-wrapper.jar`) is recommended.
- `UNKNOWN` riskLevel (analyzer unreachable) is counted in `mediumCount` in the scan summary as specified.
- All file operations use `java.nio.file` — no shell execution of scanned workspace content.

---

## 2026-09-26 — Analyzer Implementation (Subagent B)

### What was built

Complete `analyzer/` Python/FastAPI component on port 8001:

- `main.py` — FastAPI app with `POST /analyze` endpoint
- `signals.py` — 8 signal functions (known_bad_hash, magic_mismatch, install_script, double_extension, non_registry_dependency, binary_in_source_dir, obfuscated_code, hidden_file_unusual_location)
- `weights.yaml` — configurable signal weights
- `known_bad_hashes.txt` — SHA-256 blocklist
- `analyzer/.venv` — Python virtual environment (in .gitignore)

### Test results

```
29 passed in 0.12s (Python 3.14.7 / pytest 9.1.1)
```

### Known issues

- `non_registry_dependency` initially only matched `requirements.txt` by exact filename. Fixed to also match `.txt` files with "requirement" in the name.

---

## 2026-09-26 — Fixtures + MCP Server (Subagent C)

### What was built

- `fixtures/generate_fixtures.py` — safe synthetic fixture generator (8 artifacts, never executes anything it writes)
- `mcp-server/server.py` — FastMCP stdio server wrapping all 6 backend REST endpoints
- `mcp-server/README.md` — includes exact Bob MCP registration JSON for Windows
- `mcp-server/.venv` — Python virtual environment (in .gitignore)

### Test results

MCP import verified: `from mcp.server.fastmcp import FastMCP` — OK.

---

## 2026-09-26 — Phase 2: Integration

### What was built

- `demo-workspace/` — 11-file clean sample project (Java, Python, config, docs)
- `scripts/run-all.ps1` — starts analyzer (uvicorn) + backend (Java jar) in background, waits for readiness
- Fixed `ScanService.search()` to search all indexed files, not just findings

### Integration test results

Scan cycle verified:
1. Initial scan (no baseline): 11 files, all NEW, all LOW — PASS
2. Baseline approved: 11 files tracked — PASS
3. Fixtures planted: 8 new files + 1 modified README
4. Incremental scan: 9 analyzed (8 new + 1 modified), 10 UNCHANGED skipped — PASS
5. HIGH findings: assets/logo.png (known_bad_hash+magic_mismatch), src/lib/tool.dll (known_bad_hash+binary_in_source_dir) — PASS
6. MEDIUM: vendor/helper/package.json (install_script) — PASS
7. Quarantine 400 without confirmation — PASS

---

## 2026-09-26 — Phase 3: Evaluation

### What was built

- `analyzer/evaluate.py` — full evaluation script: initial scan → baseline → plant fixtures → incremental scan → measure detection

### Results (real measured numbers)

| Metric | Value |
|--------|-------|
| Initial scan duration | 27 ms |
| Initial files analyzed | 11/11 |
| Incremental scan duration | 15 ms |
| Incremental files analyzed | 9/19 |
| Files skipped (UNCHANGED) | 10 |
| Fixtures planted | 8 |
| Detected | 8/8 (100%) |
| Missed | 0 |
| False positives | 0 |

Signal fix: `non_registry_dependency` extended to match `requirements_fixture.txt` (any `.txt` with "requirement" in name). Evaluator fix: clean-file false-positive check uses exact path matching.

---

## 2026-09-26 — Phase 4: Bob Workflow Assets

### What was built

- `.bob/custom_modes.yaml` — DevShield Gate mode (slug: devshield-gate)
  - Auto-calls scan_workspace on session start
  - Launches 3 parallel subagents (dependency, config/CI, findings)
  - Safety rules: never execute files, never quarantine/approve without explicit confirmation
  - groups: read, mcp, skill, todo, subagent, mode

- `.bob/skills/pre-build-supply-chain-check/SKILL.md`
  - 5-step procedure: scan → findings → 3 parallel subagents → write DEVSHIELD_REPORT.md → present summary
  - Auto-activates on "check supply chain", "scan before build", "review what entered" etc.

---

## 2026-09-26 — Phase 5: Pre-push Hook

### What was built

- `scripts/pre-push` — bash hook that calls scan API, blocks push on HIGH findings, warns on MEDIUM
- `scripts/install-hooks.ps1` — PowerShell installer that copies hook to .git/hooks/

---

## 2026-09-26 — Phase 6: Documentation

### What was built

- `README.md` — full project README with problem/solution, Mermaid architecture diagram, Bob integration details (MCP tools, custom mode, skill, parallel subagents), how-to-run, evaluation results, safety principles
