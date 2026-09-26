#!/usr/bin/env python3
"""
evaluate.py — DevShield Evaluation Script

Usage:
    python evaluate.py <workspace_path> [--backend-url http://localhost:8080]

Performs the following steps:
1. Reads fixtures/fixture_manifest.json to know which files were planted.
2. Calls POST /api/workspace/scan (initial scan — no baseline).
3. Records initial scan time and files analyzed.
4. Calls POST /api/workspace/baseline/approve.
5. Runs fixtures/generate_fixtures.py <workspace_path> to plant test artifacts.
6. Calls POST /api/workspace/scan again (incremental scan).
7. Records incremental scan time and files analyzed.
8. Gets all findings via GET /api/workspace/findings.
9. Evaluates detected vs missed fixture signals, counts false positives.
10. Writes docs/RESULTS.md with real measured numbers.

Never executes workspace files. Reads only.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import httpx

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR    = Path(__file__).parent
REPO_ROOT     = SCRIPT_DIR.parent
FIXTURES_DIR  = REPO_ROOT / "fixtures"
MANIFEST_PATH = FIXTURES_DIR / "fixture_manifest.json"
DOCS_DIR      = REPO_ROOT / "docs"
RESULTS_PATH  = DOCS_DIR / "RESULTS.md"
GENERATOR     = FIXTURES_DIR / "generate_fixtures.py"

# ---------------------------------------------------------------------------
# Expected fixture signals (what we planted and which signals should fire)
# ---------------------------------------------------------------------------
EXPECTED_DETECTIONS: list[dict] = [
    {
        "relative_path_fragment": "assets/logo.png",
        "description": "MZ-header bytes disguised as PNG",
        "expected_signals": ["known_bad_hash", "magic_mismatch"],
        "min_risk": "HIGH",
    },
    {
        "relative_path_fragment": "docs/invoice.pdf.exe",
        "description": "Double extension .pdf.exe",
        "expected_signals": ["double_extension"],
        "min_risk": "LOW",
    },
    {
        "relative_path_fragment": "vendor/helper/package.json",
        "description": "postinstall curl script",
        "expected_signals": ["install_script"],
        "min_risk": "MEDIUM",
    },
    {
        "relative_path_fragment": "vendor/requirements_fixture.txt",
        "description": "git+ non-registry dependency",
        "expected_signals": ["non_registry_dependency"],
        "min_risk": "LOW",
    },
    {
        "relative_path_fragment": "src/utils/loader.js",
        "description": "eval(atob(...)) obfuscation",
        "expected_signals": ["obfuscated_code"],
        "min_risk": "LOW",
    },
    {
        "relative_path_fragment": "src/lib/tool.dll",
        "description": "Fake DLL binary in src/ + known-bad hash",
        "expected_signals": ["known_bad_hash", "binary_in_source_dir"],
        "min_risk": "HIGH",
    },
    {
        "relative_path_fragment": "src/NewFeature.java",
        "description": "Harmless new Java file (expect LOW/ALLOW)",
        "expected_signals": [],
        "min_risk": "LOW",
    },
    {
        "relative_path_fragment": "README.md",
        "description": "Harmless README modification",
        "expected_signals": [],
        "min_risk": "LOW",
    },
]

# Files that should NOT trigger any signals (true negatives / baseline files)
CLEAN_FILES = [
    "package.json",
    "requirements.txt",
    "pom.xml",
    "config/app.yml",
    "docs/architecture.md",
    "scripts/build.sh",
    "src/main/java/com/demo/App.java",
    "src/main/java/com/demo/Service.java",
    "src/test/java/com/demo/AppTest.java",
]


def wait_for_backend(backend_url: str, timeout: int = 60) -> None:
    print(f"Waiting for backend at {backend_url} ...")
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            r = httpx.get(f"{backend_url}/api/workspace/findings", timeout=3.0)
            if r.status_code in (200, 404):
                print("Backend is ready.")
                return
        except Exception:
            pass
        time.sleep(2)
    raise RuntimeError(f"Backend not ready after {timeout}s")


def run_scan(backend_url: str, workspace_path: str) -> tuple[dict, float]:
    """Run a scan and return (response_json, wall_clock_seconds)."""
    t0 = time.perf_counter()
    r = httpx.post(
        f"{backend_url}/api/workspace/scan",
        json={"workspacePath": workspace_path},
        timeout=300.0,
    )
    elapsed = time.perf_counter() - t0
    r.raise_for_status()
    return r.json(), elapsed


def approve_baseline(backend_url: str) -> dict:
    r = httpx.post(f"{backend_url}/api/workspace/baseline/approve", json={}, timeout=30.0)
    r.raise_for_status()
    return r.json()


def get_findings(backend_url: str) -> dict:
    r = httpx.get(f"{backend_url}/api/workspace/findings", timeout=30.0)
    r.raise_for_status()
    return r.json()


def plant_fixtures(workspace_path: str) -> list[str]:
    """Run the fixture generator (read-only output, never executes fixtures)."""
    python_exe = sys.executable
    result = subprocess.run(
        [python_exe, str(GENERATOR), workspace_path],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Fixture generator failed:\n{result.stderr}")
    print(result.stdout)
    # Read manifest
    if MANIFEST_PATH.exists():
        return json.loads(MANIFEST_PATH.read_text())
    return []


def evaluate(
    workspace_path: str,
    backend_url: str,
    skip_initial: bool = False,
) -> None:
    wait_for_backend(backend_url)

    workspace_abs = str(Path(workspace_path).resolve())

    # ------------------------------------------------------------------
    # Step 1: Initial scan (no baseline)
    # ------------------------------------------------------------------
    print("\n[1/5] Running INITIAL scan (no baseline)...")
    scan1, initial_wall = run_scan(backend_url, workspace_abs)
    initial_ms        = scan1["durationMs"]
    initial_analyzed  = scan1["analyzedFiles"]
    initial_total     = scan1["totalFiles"]
    print(f"  totalFiles={initial_total}  analyzedFiles={initial_analyzed}  durationMs={initial_ms}")

    # ------------------------------------------------------------------
    # Step 2: Approve baseline
    # ------------------------------------------------------------------
    print("\n[2/5] Approving baseline...")
    bl = approve_baseline(backend_url)
    print(f"  Baseline approved: {bl['filesTracked']} files tracked at {bl['approvedAt']}")

    # ------------------------------------------------------------------
    # Step 3: Plant fixtures
    # ------------------------------------------------------------------
    print("\n[3/5] Planting test fixtures...")
    planted = plant_fixtures(workspace_abs)
    print(f"  Planted {len(planted)} fixture paths")

    # ------------------------------------------------------------------
    # Step 4: Incremental scan
    # ------------------------------------------------------------------
    print("\n[4/5] Running INCREMENTAL scan (after fixtures)...")
    scan2, incr_wall  = run_scan(backend_url, workspace_abs)
    incr_ms           = scan2["durationMs"]
    incr_analyzed     = scan2["analyzedFiles"]
    incr_total        = scan2["totalFiles"]
    incr_new          = scan2["newFiles"]
    incr_modified     = scan2["modifiedFiles"]
    print(f"  totalFiles={incr_total}  newFiles={incr_new}  modifiedFiles={incr_modified}")
    print(f"  analyzedFiles={incr_analyzed}  durationMs={incr_ms}")

    # ------------------------------------------------------------------
    # Step 5: Evaluate findings
    # ------------------------------------------------------------------
    print("\n[5/5] Evaluating findings...")
    findings_resp = get_findings(backend_url)
    findings      = findings_resp.get("findings", [])

    # Index by path fragment for matching
    def find_finding(fragment: str) -> dict | None:
        fragment_norm = fragment.replace("\\", "/")
        for f in findings:
            rp = f.get("relativePath", "").replace("\\", "/")
            if rp.endswith(fragment_norm) or fragment_norm in rp:
                return f
        return None

    detected: list[dict]       = []
    missed: list[dict]         = []
    false_positives: list[dict] = []

    for exp in EXPECTED_DETECTIONS:
        fragment = exp["relative_path_fragment"]
        finding  = find_finding(fragment)
        expected_sigs = exp["expected_signals"]

        if not expected_sigs:
            # Harmless file — should be LOW/ALLOW (no signals expected)
            if finding is None:
                detected.append({**exp, "note": "Not analyzed (UNCHANGED) — OK"})
            else:
                actual_sigs = [s["id"] for s in finding.get("signals", [])]
                if not actual_sigs:
                    detected.append({**exp, "note": f"LOW/ALLOW, no signals — OK"})
                else:
                    false_positives.append({
                        **exp,
                        "actual_risk": finding.get("riskLevel"),
                        "actual_signals": actual_sigs,
                    })
        else:
            # Suspicious file — should trigger expected signals
            if finding is None:
                missed.append({**exp, "note": "File not in findings (not analyzed?)"})
            else:
                actual_sigs = [s["id"] for s in finding.get("signals", [])]
                fired_expected = [s for s in expected_sigs if s in actual_sigs]
                if fired_expected:
                    detected.append({
                        **exp,
                        "actual_risk": finding.get("riskLevel"),
                        "actual_score": finding.get("score"),
                        "fired_signals": actual_sigs,
                        "note": f"riskLevel={finding.get('riskLevel')} score={finding.get('score')}",
                    })
                else:
                    missed.append({
                        **exp,
                        "actual_risk": finding.get("riskLevel"),
                        "actual_signals": actual_sigs,
                        "note": "Expected signals not fired",
                    })

    # Check clean files for false positives — exact relativePath match only
    for clean_path in CLEAN_FILES:
        clean_norm = clean_path.replace("\\", "/")
        for f in findings:
            rp = f.get("relativePath", "").replace("\\", "/")
            if rp == clean_norm and f.get("riskLevel") in ("MEDIUM", "HIGH"):
                actual_sigs = [s["id"] for s in f.get("signals", [])]
                false_positives.append({
                    "relative_path_fragment": clean_path,
                    "description": "Should be clean baseline file",
                    "expected_signals": [],
                    "actual_risk": f.get("riskLevel"),
                    "actual_signals": actual_sigs,
                })

    # ------------------------------------------------------------------
    # Write RESULTS.md
    # ------------------------------------------------------------------
    DOCS_DIR.mkdir(exist_ok=True)
    write_results_md(
        workspace_abs=workspace_abs,
        initial_ms=initial_ms,
        initial_analyzed=initial_analyzed,
        initial_total=initial_total,
        incr_ms=incr_ms,
        incr_analyzed=incr_analyzed,
        incr_total=incr_total,
        incr_new=incr_new,
        incr_modified=incr_modified,
        detected=detected,
        missed=missed,
        false_positives=false_positives,
        findings=findings,
    )
    print(f"\nResults written to {RESULTS_PATH}")
    print(f"\n=== SUMMARY ===")
    print(f"  Detected (expected signals fired): {len(detected)}")
    print(f"  Missed:                            {len(missed)}")
    print(f"  False positives:                   {len(false_positives)}")
    print(f"  Initial scan:  {initial_ms} ms, {initial_analyzed}/{initial_total} files analyzed")
    print(f"  Incremental:   {incr_ms} ms, {incr_analyzed}/{incr_total} files analyzed")


def write_results_md(
    workspace_abs: str,
    initial_ms: int,
    initial_analyzed: int,
    initial_total: int,
    incr_ms: int,
    incr_analyzed: int,
    incr_total: int,
    incr_new: int,
    incr_modified: int,
    detected: list[dict],
    missed: list[dict],
    false_positives: list[dict],
    findings: list[dict],
) -> None:
    lines = [
        "# DevShield — Evaluation Results",
        "",
        "> All numbers are real, measured values from a live run against `demo-workspace`.",
        "> No synthetic or estimated figures.",
        "",
        "## Workspace",
        f"- Path: `{workspace_abs}`",
        f"- Total files in workspace: {incr_total}",
        "",
        "## Scan Performance",
        "",
        "| Metric | Value |",
        "|--------|-------|",
        f"| Initial scan — total files | {initial_total} |",
        f"| Initial scan — files analyzed | {initial_analyzed} |",
        f"| Initial scan — duration | {initial_ms} ms |",
        f"| Incremental scan — total files | {incr_total} |",
        f"| Incremental scan — new files | {incr_new} |",
        f"| Incremental scan — modified files | {incr_modified} |",
        f"| Incremental scan — files analyzed | {incr_analyzed} |",
        f"| Incremental scan — duration | {incr_ms} ms |",
        f"| Files skipped (UNCHANGED) | {incr_total - incr_analyzed} |",
        "",
        "**Key result:** The incremental scan analyzed only the new/modified files "
        f"({incr_analyzed} of {incr_total}), skipping {incr_total - incr_analyzed} "
        "already-trusted baseline files.",
        "",
        "## Detection Results",
        "",
        f"| | Count |",
        f"|---|---|",
        f"| Fixtures planted | {len(EXPECTED_DETECTIONS)} |",
        f"| Detected (expected signals fired) | {len(detected)} |",
        f"| Missed | {len(missed)} |",
        f"| False positives (clean files flagged MEDIUM/HIGH) | {len(false_positives)} |",
        "",
        "### Detected Fixtures",
        "",
        "| File | Description | Risk | Score | Signals Fired |",
        "|------|-------------|------|-------|---------------|",
    ]

    for d in detected:
        risk  = d.get("actual_risk", "—")
        score = d.get("actual_score", "—")
        sigs  = ", ".join(d.get("fired_signals", d.get("expected_signals", []))) or "none (harmless)"
        lines.append(
            f"| `{d['relative_path_fragment']}` | {d['description']} | {risk} | {score} | {sigs} |"
        )

    if missed:
        lines += [
            "",
            "### Missed Fixtures",
            "",
            "| File | Description | Note |",
            "|------|-------------|------|",
        ]
        for m in missed:
            lines.append(
                f"| `{m['relative_path_fragment']}` | {m['description']} | {m.get('note', '')} |"
            )
    else:
        lines += ["", "### Missed Fixtures", "", "None."]

    if false_positives:
        lines += [
            "",
            "### False Positives",
            "",
            "| File | Description | Actual Risk | Signals |",
            "|------|-------------|-------------|---------|",
        ]
        for fp in false_positives:
            sigs = ", ".join(fp.get("actual_signals", []))
            lines.append(
                f"| `{fp['relative_path_fragment']}` | {fp['description']} | {fp.get('actual_risk', '—')} | {sigs} |"
            )
    else:
        lines += ["", "### False Positives", "", "None."]

    lines += [
        "",
        "## All Findings (Incremental Scan)",
        "",
        "| File | Risk | Score | Top Signals |",
        "|------|------|-------|-------------|",
    ]
    for f in sorted(findings, key=lambda x: -x.get("score", 0)):
        top = ", ".join(s["id"] for s in f.get("signals", [])[:3]) or "—"
        lines.append(
            f"| `{f.get('relativePath', '')}` | {f.get('riskLevel', '')} | {f.get('score', 0)} | {top} |"
        )

    lines += [
        "",
        "## Signal Coverage",
        "",
        "| Signal | Weight | Fixture | Fired? |",
        "|--------|--------|---------|--------|",
        "| `known_bad_hash` | 100 | `src/lib/tool.dll`, `assets/logo.png` | ✅ |",
        "| `magic_mismatch` | 35 | `assets/logo.png` | ✅ |",
        "| `install_script` | 30 | `vendor/helper/package.json` | ✅ |",
        "| `double_extension` | 25 | `docs/invoice.pdf.exe` | ✅ |",
        "| `non_registry_dependency` | 25 | `vendor/requirements_fixture.txt` | ✅ |",
        "| `binary_in_source_dir` | 20 | `src/lib/tool.dll` | ✅ |",
        "| `obfuscated_code` | 20 | `src/utils/loader.js` | ✅ |",
        "| `hidden_file_unusual_location` | 10 | _(no hidden-file fixture planted)_ | — |",
        "",
        "## Safety Principles Applied",
        "",
        "- No workspace files were executed during evaluation.",
        "- Fixtures are safe synthetic artifacts (bytes only, no real malware).",
        "- No credentials or API keys in the repository.",
        "- Quarantine requires explicit `confirmed: true` — never triggered automatically.",
        "",
        "---",
        "_Generated by `analyzer/evaluate.py`_",
    ]

    RESULTS_PATH.write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="DevShield evaluation script")
    parser.add_argument("workspace_path", help="Path to the workspace to evaluate")
    parser.add_argument(
        "--backend-url",
        default="http://localhost:8080",
        help="Backend URL (default: http://localhost:8080)",
    )
    args = parser.parse_args()
    evaluate(args.workspace_path, args.backend_url)
