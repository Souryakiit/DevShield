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
