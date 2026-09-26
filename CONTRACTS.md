# DevShield — Service Contracts

All dates are ISO-8601 strings. All scores are integers 0–100. `riskLevel` is one of `LOW | MEDIUM | HIGH`. `changeType` is one of `NEW | MODIFIED`. `recommendation` is one of `ALLOW | REVIEW | QUARANTINE_REVIEW`.

---

## 1. Backend → Analyzer

### `POST http://localhost:8001/analyze`

Called by the backend for every workspace scan. Only NEW and MODIFIED files are included.

#### Request

```json
{
  "workspacePath": "/home/dev/my-project",
  "files": [
    {
      "id": "f1a2b3c4",
      "relativePath": "src/utils/loader.png",
      "extension": "png",
      "size": 48320,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "modifiedTime": "2025-07-14T10:22:05Z",
      "changeType": "NEW"
    },
    {
      "id": "d9e8f7a6",
      "relativePath": "package.json",
      "extension": "json",
      "size": 1842,
      "sha256": "4355a46b19d348dc2f57c046f8ef63d4538ebb936000f3c9ee954a27460dd865",
      "modifiedTime": "2025-07-14T09:55:10Z",
      "changeType": "MODIFIED"
    },
    {
      "id": "b5c6d7e8",
      "relativePath": "scripts/setup.sh",
      "extension": "sh",
      "size": 3210,
      "sha256": "53c234e5e8472b6ac51c1ae1cab3fe06fad053beb8ebfd8977b010655bfdd3c3",
      "modifiedTime": "2025-07-14T11:01:33Z",
      "changeType": "NEW"
    }
  ]
}
```

#### Response `200 OK`

```json
{
  "findings": [
    {
      "fileId": "f1a2b3c4",
      "score": 85,
      "riskLevel": "HIGH",
      "signals": [
        { "id": "magic_mismatch",            "weight": 35, "detail": "File has PNG extension but contains a PE (Windows executable) header." },
        { "id": "binary_in_source_dir",       "weight": 20, "detail": "Executable-format file found under src/." },
        { "id": "hidden_file_unusual_location","weight": 10, "detail": "File is in a path segment not expected to contain binaries." }
      ],
      "recommendation": "QUARANTINE_REVIEW",
      "explanation": "loader.png carries a Windows PE magic number (MZ) despite its .png extension, strongly suggesting a disguised executable placed inside the source tree."
    },
    {
      "fileId": "d9e8f7a6",
      "score": 55,
      "riskLevel": "MEDIUM",
      "signals": [
        { "id": "install_script",          "weight": 30, "detail": "package.json defines a 'postinstall' script: 'node scripts/setup.js'." },
        { "id": "non_registry_dependency", "weight": 25, "detail": "Dependency 'internal-lib' resolved via git+https://github.com/corp/internal-lib.git." }
      ],
      "recommendation": "REVIEW",
      "explanation": "package.json adds a postinstall hook and introduces a git-URL dependency. Both are common supply-chain attack vectors and should be reviewed before the next npm install."
    },
    {
      "fileId": "b5c6d7e8",
      "score": 0,
      "riskLevel": "LOW",
      "signals": [],
      "recommendation": "ALLOW",
      "explanation": "No suspicious signals detected. Shell script appears to be a standard project setup helper."
    }
  ]
}
```

---

## 2. Backend REST API

Base URL: `http://localhost:8080`

---

### `POST /api/workspace/scan`

Triggers a full workspace index, diff against the current baseline, and analysis of all NEW/MODIFIED files.

#### Request

```json
{
  "workspacePath": "/home/dev/my-project"
}
```

#### Response `200 OK`

```json
{
  "scanId": "scan-2025-07-14-001",
  "workspacePath": "/home/dev/my-project",
  "totalFiles": 10482,
  "newFiles": 3,
  "modifiedFiles": 1,
  "deletedFiles": 0,
  "analyzedFiles": 4,
  "lowCount": 1,
  "mediumCount": 1,
  "highCount": 2,
  "durationMs": 4271,
  "baselineApprovedAt": "2025-07-13T08:30:00Z"
}
```

---

### `GET /api/workspace/findings`

Returns all findings from the most recent scan, with full detail for UI rendering.

#### Response `200 OK`

```json
{
  "scanId": "scan-2025-07-14-001",
  "findings": [
    {
      "fileId": "f1a2b3c4",
      "relativePath": "src/utils/loader.png",
      "riskLevel": "HIGH",
      "score": 85,
      "signals": [
        { "id": "magic_mismatch",             "weight": 35, "detail": "File has PNG extension but contains a PE (Windows executable) header." },
        { "id": "binary_in_source_dir",        "weight": 20, "detail": "Executable-format file found under src/." },
        { "id": "hidden_file_unusual_location","weight": 10, "detail": "File is in a path segment not expected to contain binaries." }
      ],
      "recommendation": "QUARANTINE_REVIEW",
      "explanation": "loader.png carries a Windows PE magic number (MZ) despite its .png extension, strongly suggesting a disguised executable placed inside the source tree.",
      "changeType": "NEW",
      "size": 48320,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "modifiedTime": "2025-07-14T10:22:05Z"
    },
    {
      "fileId": "a0b1c2d3",
      "relativePath": "uploads/report.pdf.exe",
      "riskLevel": "HIGH",
      "score": 100,
      "signals": [
        { "id": "known_bad_hash",    "weight": 100, "detail": "SHA-256 matches local blocklist entry added 2025-07-01." },
        { "id": "double_extension",  "weight": 25,  "detail": "Filename contains two extensions: .pdf.exe." }
      ],
      "recommendation": "QUARANTINE_REVIEW",
      "explanation": "This file's hash is on the local blocklist and its double extension (.pdf.exe) is a classic social-engineering pattern. Immediate quarantine is strongly advised.",
      "changeType": "NEW",
      "size": 102400,
      "sha256": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a4",
      "modifiedTime": "2025-07-14T11:45:00Z"
    },
    {
      "fileId": "d9e8f7a6",
      "relativePath": "package.json",
      "riskLevel": "MEDIUM",
      "score": 55,
      "signals": [
        { "id": "install_script",          "weight": 30, "detail": "package.json defines a 'postinstall' script: 'node scripts/setup.js'." },
        { "id": "non_registry_dependency", "weight": 25, "detail": "Dependency 'internal-lib' resolved via git+https://github.com/corp/internal-lib.git." }
      ],
      "recommendation": "REVIEW",
      "explanation": "package.json adds a postinstall hook and introduces a git-URL dependency. Both are common supply-chain attack vectors and should be reviewed before the next npm install.",
      "changeType": "MODIFIED",
      "size": 1842,
      "sha256": "4355a46b19d348dc2f57c046f8ef63d4538ebb936000f3c9ee954a27460dd865",
      "modifiedTime": "2025-07-14T09:55:10Z"
    },
    {
      "fileId": "b5c6d7e8",
      "relativePath": "scripts/setup.sh",
      "riskLevel": "LOW",
      "score": 0,
      "signals": [],
      "recommendation": "ALLOW",
      "explanation": "No suspicious signals detected. Shell script appears to be a standard project setup helper.",
      "changeType": "NEW",
      "size": 3210,
      "sha256": "53c234e5e8472b6ac51c1ae1cab3fe06fad053beb8ebfd8977b010655bfdd3c3",
      "modifiedTime": "2025-07-14T11:01:33Z"
    }
  ]
}
```

---

### `GET /api/files/{id}`

Returns full metadata and analysis detail for a single file.

#### Response `200 OK` — example: `GET /api/files/f1a2b3c4`

```json
{
  "fileId": "f1a2b3c4",
  "relativePath": "src/utils/loader.png",
  "absolutePath": "/home/dev/my-project/src/utils/loader.png",
  "extension": "png",
  "size": 48320,
  "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "modifiedTime": "2025-07-14T10:22:05Z",
  "changeType": "NEW",
  "riskLevel": "HIGH",
  "score": 85,
  "signals": [
    { "id": "magic_mismatch",             "weight": 35, "detail": "File has PNG extension but contains a PE (Windows executable) header." },
    { "id": "binary_in_source_dir",        "weight": 20, "detail": "Executable-format file found under src/." },
    { "id": "hidden_file_unusual_location","weight": 10, "detail": "File is in a path segment not expected to contain binaries." }
  ],
  "recommendation": "QUARANTINE_REVIEW",
  "explanation": "loader.png carries a Windows PE magic number (MZ) despite its .png extension, strongly suggesting a disguised executable placed inside the source tree.",
  "quarantined": false
}
```

#### Response `404 Not Found`

```json
{
  "error": "FILE_NOT_FOUND",
  "message": "No file with id 'f1a2b3c4' found in the current scan."
}
```

---

### `GET /api/files/search?q={query}`

Full-text search over relative paths in the current scan index.

#### Response `200 OK` — example: `GET /api/files/search?q=loader`

```json
{
  "query": "loader",
  "results": [
    {
      "fileId": "f1a2b3c4",
      "relativePath": "src/utils/loader.png",
      "riskLevel": "HIGH",
      "score": 85,
      "recommendation": "QUARANTINE_REVIEW"
    }
  ]
}
```

---

### `POST /api/files/{id}/quarantine`

Moves a file to `.devshield/quarantine/` and records the manifest entry. Requires explicit developer confirmation in the request body.

#### Request

```json
{
  "confirmed": true
}
```

#### Response `200 OK` — example: `POST /api/files/f1a2b3c4/quarantine`

```json
{
  "fileId": "f1a2b3c4",
  "relativePath": "src/utils/loader.png",
  "quarantinePath": ".devshield/quarantine/f1a2b3c4_loader.png",
  "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "reason": "magic_mismatch, binary_in_source_dir",
  "quarantinedAt": "2025-07-14T12:00:00Z",
  "restorable": true
}
```

#### Response `400 Bad Request` — missing or false confirmation

```json
{
  "error": "CONFIRMATION_REQUIRED",
  "message": "Quarantine requires explicit confirmation. Send { \"confirmed\": true } in the request body."
}
```

---

### `POST /api/workspace/baseline/approve`

Seals the current workspace state as the new trusted baseline. All findings must have been reviewed; any unresolved HIGH findings produce a warning (not a block, by design — the developer decides).

#### Request

```json
{}
```

#### Response `200 OK`

```json
{
  "baselineId": "baseline-2025-07-14-001",
  "workspacePath": "/home/dev/my-project",
  "approvedAt": "2025-07-14T12:05:00Z",
  "filesTracked": 10482,
  "unresolvedHighFindings": 0,
  "message": "Baseline approved. 10482 files tracked. Next scan will diff against this state."
}
```
