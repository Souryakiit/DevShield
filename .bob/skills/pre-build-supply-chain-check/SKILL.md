---
name: pre-build-supply-chain-check
description: >-
  Use when the user wants to check the workspace for supply-chain risks before a
  build, merge, or deploy. Runs a DevShield scan, reviews dependency manifests,
  config/CI files, and HIGH/MEDIUM findings using parallel subagents, then writes
  the final report to DEVSHIELD_REPORT.md. Activate when the user says "check
  supply chain", "scan before build", "review what entered the workspace", or
  similar.
---

# Pre-Build Supply-Chain Check

This skill runs a complete DevShield supply-chain review of the current workspace
and writes a risk report to `DEVSHIELD_REPORT.md`. Output is an AI-assisted risk
assessment - not a definitive malware verdict.

## Safety Rules (non-negotiable)

- Never execute, run, open, or import any workspace file.
- Never call `quarantine_file` with `confirmed=true` without explicit user approval
  for that specific file.
- Never call `approve_baseline` without explicit user confirmation.
- Only review NEW or MODIFIED files - do not re-analyze UNCHANGED baseline files.
- Label all output as "AI-assisted risk assessment".

## Step 1 - Scan the workspace

Call the `scan_workspace` MCP tool with the current workspace path.

```
scan_workspace(workspace_path="<absolute path to workspace>")
```

Record from the response:
- `scanId`, `totalFiles`, `newFiles`, `modifiedFiles`, `analyzedFiles`
- `lowCount`, `mediumCount`, `highCount`, `durationMs`
- `baselineApprovedAt` (null means no baseline exists yet)

If `baselineApprovedAt` is null, note in the report that this is the first scan
(no baseline approved) and all files are treated as NEW.

## Step 2 - Retrieve findings

Call `get_findings()` to get the full list of scored findings.

Group them into three buckets:
- **HIGH** (score >= 70, recommendation = QUARANTINE_REVIEW)
- **MEDIUM** (score 30-69, recommendation = REVIEW)
- **LOW** (score < 30, recommendation = ALLOW)

## Step 3 - Run three parallel subagents

Use `spawn_subagent` to launch all three subagents simultaneously. Pass each one
the relevant slice of data as context (file paths, finding details).

### Subagent 1 - Dependency Manifest Reviewer

Task: Review all changed dependency manifests (package.json, requirements.txt,
pom.xml, Cargo.toml, go.mod). For each changed manifest:

1. Use `get_file_details` or `search_files` to find the file.
2. Read the file content using `read_file`.
3. List every new or changed dependency.
4. Flag any dependency resolved via: git URL, tarball URL, file: path, or a
   version that differs significantly from the registry latest.
5. Flag any install script (preinstall, install, postinstall in package.json;
   cmdclass in setup.py).
6. Produce a table: dependency name | source | verdict (ALLOW/REVIEW/QUARANTINE).

Output format:
```
## Dependency Review
| Dependency | Source | Verdict | Reason |
|------------|--------|---------|--------|
...
```

### Subagent 2 - Configuration and CI Reviewer

Task: Review all changed configuration and CI files (.yml, .yaml, .env, .ini,
Dockerfile, .github/workflows/, .gitlab-ci.yml, Jenkinsfile, etc.). For each:

1. Use `search_files` to find changed config files.
2. Read each with `read_file`.
3. Identify: new environment variables, changed service endpoints, new CI steps
   that download or execute external code, new secrets references, new ports
   or network settings.
4. Produce a verdict per file: ALLOW / REVIEW / QUARANTINE.

Output format:
```
## Configuration and CI Review
| File | Change Summary | Verdict | Reason |
|------|----------------|---------|--------|
...
```

### Subagent 3 - Findings Explainer

Task: Explain every HIGH and MEDIUM finding from DevShield in plain language.
For each finding:

1. Call `get_file_details(file_id)` to get full signal detail.
2. Explain what each triggered signal means (e.g. "magic_mismatch means the file
   claims to be a PNG but its first bytes are a Windows executable header MZ").
3. State what the developer should do: inspect it, quarantine it, or allow it.
4. If the file should be quarantined, say so clearly but remind the developer that
   they must explicitly confirm before quarantine is executed.

Output format:
```
## Findings Analysis
### [HIGH] src/lib/tool.dll (score: 100)
**Signals:** known_bad_hash, binary_in_source_dir
**Explanation:** ...
**Recommended action:** QUARANTINE - ask developer to confirm
```

## Step 4 - Write DEVSHIELD_REPORT.md

After all three subagents complete, combine their outputs into a single file
`DEVSHIELD_REPORT.md` in the workspace root using `write_file`. Use this template:

```markdown
# DevShield Report
**Generated:** <ISO timestamp>
**Scan ID:** <scanId>
**Workspace:** <workspacePath>
**Baseline approved:** <baselineApprovedAt or "No baseline - first scan">

> AI-assisted risk assessment. Not a definitive malware verdict.
> Review findings carefully before approving quarantine or baseline.

## Scan Summary
| Metric | Value |
|--------|-------|
| Total files | <totalFiles> |
| New files | <newFiles> |
| Modified files | <modifiedFiles> |
| Analyzed | <analyzedFiles> |
| HIGH findings | <highCount> |
| MEDIUM findings | <mediumCount> |
| LOW findings | <lowCount> |
| Scan duration | <durationMs> ms |

## Risk Summary
| Risk | Count | Action |
|------|-------|--------|
| HIGH | <n> | Quarantine or explain before build |
| MEDIUM | <n> | Review before build |
| LOW | <n> | Allow (no action needed) |

<Dependency Review section from Subagent 1>

<Configuration and CI Review section from Subagent 2>

<Findings Analysis section from Subagent 3>

## Developer Actions Required
<List each HIGH and MEDIUM item as a checkbox the developer must resolve>
- [ ] [HIGH] <relativePath> - <brief reason> - Quarantine? (requires confirmation)
- [ ] [MEDIUM] <relativePath> - <brief reason> - Review manually

## Next Steps
- Review each item above.
- To quarantine a file, say: "Quarantine <relativePath>" (will ask for confirmation).
- When all findings are resolved, say: "Approve baseline" (will ask for confirmation).
```

## Step 5 - Present summary and await developer decisions

After writing the report:
1. Show the developer a brief summary: HIGH count, MEDIUM count, any immediate
   actions needed.
2. List each HIGH finding explicitly and ask if they want to quarantine it
   (one at a time, never batch-quarantine without confirmation).
3. Remind the developer they can approve the baseline once all findings are
   resolved.

Do not proceed with quarantine or baseline approval unless the developer
explicitly says yes to each action.
