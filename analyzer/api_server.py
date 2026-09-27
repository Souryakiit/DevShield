"""
api_server.py — DevShield all-in-one API server for cloud deployment.
Handles all frontend API calls (replaces Spring Boot) + analyzer.
Runs on port 8080 by default.
"""
from __future__ import annotations

import hashlib
import io
import os
import pathlib
import shutil
import tempfile
import time
import uuid
from typing import Any

import yaml
from fastapi import FastAPI, File, Form, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from signals import (
    check_known_bad_hash, check_magic_mismatch, check_install_script,
    check_double_extension, check_non_registry_dependency,
    check_binary_in_source_dir, check_obfuscated_code,
    check_hidden_file_unusual_location, check_hardcoded_secret,
    check_xss_injection_risk, check_sql_injection_risk,
    check_suspicious_network_call, _load_known_bad_hashes,
)

# ---------------------------------------------------------------------------
# Weights
# ---------------------------------------------------------------------------
_WEIGHTS_FILE = pathlib.Path(__file__).parent / "weights.yaml"
with open(_WEIGHTS_FILE, "r", encoding="utf-8") as _f:
    WEIGHTS: dict[str, int] = yaml.safe_load(_f)

SIGNAL_CHECKS = [
    ("known_bad_hash",               check_known_bad_hash),
    ("magic_mismatch",               check_magic_mismatch),
    ("install_script",               check_install_script),
    ("double_extension",             check_double_extension),
    ("non_registry_dependency",      check_non_registry_dependency),
    ("binary_in_source_dir",         check_binary_in_source_dir),
    ("obfuscated_code",              check_obfuscated_code),
    ("hidden_file_unusual_location", check_hidden_file_unusual_location),
    ("hardcoded_secret",             check_hardcoded_secret),
    ("xss_injection_risk",           check_xss_injection_risk),
    ("sql_injection_risk",           check_sql_injection_risk),
    ("suspicious_network_call",      check_suspicious_network_call),
]

# ---------------------------------------------------------------------------
# In-memory state
# ---------------------------------------------------------------------------
_state: dict[str, Any] = {
    "scan_id": None,
    "workspace_path": None,
    "findings": [],
    "files_meta": {},       # fileId -> meta dict
    "baseline_approved_at": None,
    "session_id": None,
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _risk_level(score: int) -> str:
    if score >= 70: return "HIGH"
    if score >= 30: return "MEDIUM"
    return "LOW"

def _recommendation(risk: str) -> str:
    return {"HIGH": "QUARANTINE_REVIEW", "MEDIUM": "REVIEW", "LOW": "ALLOW"}[risk]

def _analyze_file(file_path: str, relative_path: str, workspace_path: str) -> dict:
    stat = os.stat(file_path)
    with open(file_path, "rb") as fh:
        content = fh.read()
    sha256 = hashlib.sha256(content).hexdigest()
    file_id = sha256[:8] + "-" + str(uuid.uuid4())[:4]
    ext = pathlib.Path(relative_path).suffix.lstrip(".")

    file_info = {
        "id": file_id,
        "relativePath": relative_path,
        "extension": ext,
        "size": stat.st_size,
        "sha256": sha256,
        "modifiedTime": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(stat.st_mtime)),
        "changeType": "NEW",
    }

    triggered = []
    raw_score = 0
    for signal_id, check_fn in SIGNAL_CHECKS:
        weight, detail = check_fn(file_info, workspace_path)
        if weight > 0 and detail:
            triggered.append({"id": signal_id, "weight": weight, "detail": detail})
            raw_score += weight

    score = min(raw_score, 100)
    risk = _risk_level(score)
    explanation = (
        f"File triggered {len(triggered)} signal(s): "
        + ", ".join(s["id"] for s in triggered) + "."
        if triggered else "No suspicious signals detected."
    )

    return {
        "fileId": file_id,
        "relativePath": relative_path,
        "absolutePath": file_path,
        "extension": ext,
        "riskLevel": risk,
        "score": score,
        "signals": triggered,
        "recommendation": _recommendation(risk),
        "explanation": explanation,
        "changeType": "NEW",
        "size": stat.st_size,
        "sha256": sha256,
        "modifiedTime": file_info["modifiedTime"],
        "quarantined": False,
    }

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="DevShield API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Upload + scan
# ---------------------------------------------------------------------------

@app.post("/api/workspace/upload")
async def upload_workspace(
    files: list[UploadFile] = File(...),
    paths: list[str] = Form(...),
):
    tmp_dir = tempfile.mkdtemp(prefix="devshield_")
    session_id = str(uuid.uuid4())[:8]
    workspace_path = tmp_dir

    saved: list[tuple[str, str]] = []  # (abs_path, rel_path)
    for uf, rel_path in zip(files, paths):
        rel_clean = rel_path.lstrip("/")
        dest = os.path.join(tmp_dir, rel_clean)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "wb") as fh:
            shutil.copyfileobj(uf.file, fh)
        saved.append((dest, rel_clean))

    # analyze
    t0 = time.time()
    findings = []
    for abs_path, rel_path in saved:
        try:
            f = _analyze_file(abs_path, rel_path, workspace_path)
            findings.append(f)
        except Exception:
            pass
    duration_ms = int((time.time() - t0) * 1000)

    scan_id = f"scan-{session_id}"
    low = sum(1 for f in findings if f["riskLevel"] == "LOW")
    medium = sum(1 for f in findings if f["riskLevel"] == "MEDIUM")
    high = sum(1 for f in findings if f["riskLevel"] == "HIGH")

    _state.update({
        "scan_id": scan_id,
        "workspace_path": workspace_path,
        "findings": findings,
        "files_meta": {f["fileId"]: f for f in findings},
        "session_id": session_id,
    })

    return {
        "workspacePath": workspace_path,
        "fileCount": len(saved),
        "sessionId": session_id,
        # also embed scan result so frontend can use it directly
        "scanResult": {
            "scanId": scan_id,
            "workspacePath": workspace_path,
            "totalFiles": len(saved),
            "newFiles": len(saved),
            "modifiedFiles": 0,
            "deletedFiles": 0,
            "analyzedFiles": len(findings),
            "lowCount": low,
            "mediumCount": medium,
            "highCount": high,
            "durationMs": duration_ms,
            "baselineApprovedAt": _state["baseline_approved_at"],
        },
    }

# ---------------------------------------------------------------------------
# Scan (path-based, for local use)
# ---------------------------------------------------------------------------

class ScanRequest(BaseModel):
    workspacePath: str

@app.post("/api/workspace/scan")
def scan_workspace(req: ScanRequest):
    wp = req.workspacePath
    if not os.path.exists(wp):
        raise HTTPException(404, f"Path not found: {wp}")

    t0 = time.time()
    findings = []
    for root, _, fnames in os.walk(wp):
        for fname in fnames:
            abs_path = os.path.join(root, fname)
            rel_path = os.path.relpath(abs_path, wp)
            try:
                f = _analyze_file(abs_path, rel_path, wp)
                findings.append(f)
            except Exception:
                pass

    duration_ms = int((time.time() - t0) * 1000)
    scan_id = f"scan-{int(time.time())}"
    low = sum(1 for f in findings if f["riskLevel"] == "LOW")
    medium = sum(1 for f in findings if f["riskLevel"] == "MEDIUM")
    high = sum(1 for f in findings if f["riskLevel"] == "HIGH")

    _state.update({
        "scan_id": scan_id,
        "workspace_path": wp,
        "findings": findings,
        "files_meta": {f["fileId"]: f for f in findings},
    })

    return {
        "scanId": scan_id,
        "workspacePath": wp,
        "totalFiles": len(findings),
        "newFiles": len(findings),
        "modifiedFiles": 0,
        "deletedFiles": 0,
        "analyzedFiles": len(findings),
        "lowCount": low,
        "mediumCount": medium,
        "highCount": high,
        "durationMs": duration_ms,
        "baselineApprovedAt": _state["baseline_approved_at"],
    }

# ---------------------------------------------------------------------------
# Findings
# ---------------------------------------------------------------------------

@app.get("/api/workspace/findings")
def get_findings():
    return {
        "scanId": _state["scan_id"] or "no-scan",
        "findings": _state["findings"],
    }

# ---------------------------------------------------------------------------
# File detail + search
# ---------------------------------------------------------------------------

@app.get("/api/files/search")
def search_files(q: str = Query(...)):
    q_lower = q.lower()
    results = []
    for f in _state["findings"]:
        if q_lower in f["relativePath"].lower():
            results.append({
                "fileId": f["fileId"],
                "relativePath": f["relativePath"],
                "riskLevel": f["riskLevel"],
                "score": f["score"],
                "recommendation": f["recommendation"],
            })
    return {"query": q, "results": results}

@app.get("/api/files/{file_id}")
def get_file_detail(file_id: str):
    f = _state["files_meta"].get(file_id)
    if not f:
        raise HTTPException(404, "File not found")
    return f

# ---------------------------------------------------------------------------
# Quarantine
# ---------------------------------------------------------------------------

@app.post("/api/files/{file_id}/quarantine")
def quarantine_file(file_id: str):
    f = _state["files_meta"].get(file_id)
    if not f:
        raise HTTPException(404, "File not found")
    f["quarantined"] = True
    return {
        "fileId": file_id,
        "relativePath": f["relativePath"],
        "quarantinePath": f".devshield/quarantine/{file_id}_{pathlib.Path(f['relativePath']).name}",
        "sha256": f["sha256"],
        "reason": ", ".join(s["id"] for s in f.get("signals", [])) or "manual",
        "quarantinedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "restorable": True,
    }

# ---------------------------------------------------------------------------
# Baseline
# ---------------------------------------------------------------------------

@app.post("/api/workspace/baseline/approve")
def approve_baseline():
    ts = time.strftime("%Y-%m-%dT%H:%M:%SZ")
    _state["baseline_approved_at"] = ts
    unresolved = sum(1 for f in _state["findings"]
                     if f["riskLevel"] == "HIGH" and not f.get("quarantined"))
    return {
        "baselineId": f"baseline-{int(time.time())}",
        "workspacePath": _state["workspace_path"] or "/",
        "approvedAt": ts,
        "filesTracked": len(_state["findings"]),
        "unresolvedHighFindings": unresolved,
        "message": f"Baseline approved. {len(_state['findings'])} files tracked.",
    }

# ---------------------------------------------------------------------------
# Hash lookup
# ---------------------------------------------------------------------------

@app.get("/hash-lookup")
def hash_lookup(hash: str = Query(...)):
    sha = hash.strip().lower()
    hashes = _load_known_bad_hashes()
    found = sha in hashes
    return {
        "hash": sha,
        "found": found,
        "verdict": "MALICIOUS" if found else "NOT_FOUND",
        "source": "devshield_local_blocklist" if found else None,
        "message": (
            "SHA-256 matches a known-bad hash in the DevShield blocklist."
            if found else
            "Hash not found in local blocklist."
        ),
    }

@app.get("/health")
def health():
    return {"status": "ok", "service": "devshield-api"}

@app.get("/")
def root():
    return {"service": "DevShield API", "version": "0.2.0", "docs": "/docs"}

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("api_server:app", host="0.0.0.0", port=port, reload=False)
