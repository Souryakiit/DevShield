# DevShield — Project Brief (IBM Bob 2.0 Hackathon)

**Tagline:** Nothing enters your build that you haven't approved.

**One-liner:** DevShield is an IBM Bob–driven pre-build gate for software supply-chain risk. It keeps an approved baseline of your workspace, detects everything that entered since, scores it with deterministic security signals, and has Bob's subagents review dependency and configuration changes before anything reaches your build or deployment.

## 1. Problem

Projects constantly take in things developers didn't write: new dependencies, install scripts, downloaded archives, generated files, binaries, config changes. Supply-chain attacks exploit this (malicious install scripts, dependencies from untrusted URLs, disguised binaries). Checking all of this manually before a build is slow and error-prone, so it rarely happens. `git diff` shows that a file changed, not whether it is risky, and existing tools each check one narrow thing (secrets, known CVEs, AV signatures). Nothing answers: "What entered my workspace since I last trusted it, and is any of it dangerous?"

## 2. Solution: the approved baseline

When a developer approves a scan, DevShield records the workspace state (path, size, modified time, SHA-256 per file) as the trusted baseline, like a lockfile for the whole workspace. Every later scan analyzes only files that are NEW or MODIFIED since the baseline. Benefits: speed (only changes are analyzed), focus (developer reviews only what's new), accountability (every artifact was either in an approved baseline or explicitly reviewed).

## 3. Target users

- Developers preparing a build/merge/deploy
- Maintainers reviewing contributions and dependency updates
- Small teams without a dedicated security engineer

## 4. Workflow (Bob is the front door)

1. Developer asks Bob (in the "DevShield Gate" custom mode): "Check what has entered this workspace since the last approved baseline before I deploy."
2. Bob calls DevShield through MCP: DevShield indexes the workspace, diffs against the baseline, analyzes only NEW/MODIFIED files, returns scored findings.
3. Bob runs parallel subagents:
   - **Dependency reviewer** (reads changed `package.json` / `requirements.txt` / `pom.xml`, new dependencies, their sources, install scripts)
   - **Config reviewer** (changed config and CI files)
   - **Artifact reviewer** (explains HIGH/MEDIUM findings)
4. Bob merges results into `DEVSHIELD_REPORT.md` with `ALLOW` / `REVIEW` / `QUARANTINE` per item.
5. Developer inspects details in the dashboard and explicitly approves quarantine.
6. Developer approves the new baseline.

**Stretch:** `git pre-push` hook that blocks pushes with unresolved HIGH findings.

## 5. IBM Bob's role

DevShield does deterministic work (indexing, hashing, diffing, scoring). Bob does the reasoning: reading manifests and configs, correlating findings, explaining risk, guiding the decision.

**Bob features used:** MCP integration, parallel subagents, document understanding, custom mode "DevShield Gate", skill "pre-build-supply-chain-check", Plan/Agent modes, code review, commit messages, PRs, `/init`.

**MCP tools:** `scan_workspace`, `get_findings`, `get_file_details`, `search_files`, `quarantine_file` (requires confirmation), `approve_baseline`.

## 6. Signals and scoring (prototype heuristics, not industry-standard scoring)

| Signal | Weight | Description |
|---|---|---|
| `known_bad_hash` | +100 | Local blocklist match |
| `magic_mismatch` | +35 | e.g. PE header inside a `.png` |
| `install_script` | +30 | `postinstall` in `package.json`, risky `setup.py` hooks |
| `double_extension` | +25 | `invoice.pdf.exe` |
| `non_registry_dependency` | +25 | git URL / tarball URL / `file:` path |
| `binary_in_source_dir` | +20 | `.exe`/`.dll`/`.so` in `src/` or `uploads/` |
| `obfuscated_code` | +20 | Large base64 blobs, `eval(atob(...))` |
| `hidden_file_unusual_location` | +10 | Hidden file in unexpected location |

Score capped at 100. Thresholds:
- **0–29** LOW → `ALLOW`
- **30–69** MEDIUM → `REVIEW`
- **70+** HIGH → `QUARANTINE_REVIEW`

> Output is an AI-assisted risk assessment, never a definitive malware verdict.

## 7. Safety principles

- Never execute scanned files.
- Never delete automatically.
- Quarantine moves files to `<workspace>/.devshield/quarantine/` with a manifest (original path, hash, reason, time), is restorable, and requires explicit developer confirmation.
- Only safe synthetic test fixtures, no real malware.
- No credentials in the repo.

## 8. Architecture

| Service | Stack | Port |
|---|---|---|
| Backend | Java 21 + Spring Boot 3 (Maven) | 8080 |
| Analyzer | Python 3.11 + FastAPI | 8001 |
| MCP server | Python + FastMCP (official MCP Python SDK) | — |
| Frontend | React + Vite | 5173 |

**Storage:** In-memory indexes; baseline persisted to `<workspace>/.devshield/baseline.json`. No database.

**Data structures:**
- Directory tree of `FileNode`
- Filename index `Map<String, List<FileRecord>>`
- Extension index `Map<String, List<FileRecord>>`
- Hash index `Map<String, FileRecord>` by SHA-256
- Baseline map `path -> {size, modifiedTime, sha256}`

**Incremental diff:** If size and modifiedTime match baseline, reuse hash; otherwise rehash and classify `NEW` / `MODIFIED` / `DELETED` / `UNCHANGED`.

**Skip folders:** `.git`, `node_modules`, `target`, `.devshield`

## 9. Dashboard screens

- **Overview** — baseline date, files tracked, changed since baseline, LOW/MEDIUM/HIGH counts, scan button
- **Findings** — file, risk, score, top signals, recommendation
- **File details** — metadata, signals, explanation, quarantine with confirmation dialog
- **Approve baseline** — summary + confirm

## 10. Measuring impact (only real measurements)

Use a permissively licensed open-source repo (~10,000+ files), approve a baseline, plant ~10 safe fixtures plus harmless changes. Report:
- Detected vs missed fixtures
- False positives
- Initial vs incremental scan time and files analyzed
- Manual `git diff` review time vs DevShield + Bob workflow time

## 11. Out of scope

**Not in scope:** Full antivirus, OS-wide or real-time monitoring, kernel drivers, automatic deletion, malware reverse engineering, cloud malware database, mobile app, browser extension.

**Future:** NTFS USN journal, CI/CD integration, shared team baselines, hash reputation APIs, signature verification.
