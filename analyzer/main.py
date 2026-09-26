"""
main.py — DevShield Analyzer Service
FastAPI app exposing POST /analyze on port 8001.
"""
from __future__ import annotations

import os
import pathlib
from typing import Any

import yaml
from fastapi import FastAPI
from pydantic import BaseModel

from signals import (
    check_known_bad_hash,
    check_magic_mismatch,
    check_install_script,
    check_double_extension,
    check_non_registry_dependency,
    check_binary_in_source_dir,
    check_obfuscated_code,
    check_hidden_file_unusual_location,
)

# ---------------------------------------------------------------------------
# Load weights
# ---------------------------------------------------------------------------

_WEIGHTS_FILE = pathlib.Path(__file__).parent / "weights.yaml"

with open(_WEIGHTS_FILE, "r", encoding="utf-8") as _f:
    WEIGHTS: dict[str, int] = yaml.safe_load(_f)

# ---------------------------------------------------------------------------
# Signal registry — ordered list of (signal_id, check_fn)
# ---------------------------------------------------------------------------

SIGNAL_CHECKS = [
    ("known_bad_hash",              check_known_bad_hash),
    ("magic_mismatch",              check_magic_mismatch),
    ("install_script",              check_install_script),
    ("double_extension",            check_double_extension),
    ("non_registry_dependency",     check_non_registry_dependency),
    ("binary_in_source_dir",        check_binary_in_source_dir),
    ("obfuscated_code",             check_obfuscated_code),
    ("hidden_file_unusual_location",check_hidden_file_unusual_location),
]

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class FileEntry(BaseModel):
    id: str
    relativePath: str
    extension: str
    size: int
    sha256: str
    modifiedTime: str
    changeType: str


class AnalyzeRequest(BaseModel):
    workspacePath: str
    files: list[FileEntry]


class Signal(BaseModel):
    id: str
    weight: int
    detail: str


class Finding(BaseModel):
    fileId: str
    score: int
    riskLevel: str
    signals: list[Signal]
    recommendation: str
    explanation: str


class AnalyzeResponse(BaseModel):
    findings: list[Finding]


# ---------------------------------------------------------------------------
# Risk helpers
# ---------------------------------------------------------------------------

def _risk_level(score: int) -> str:
    if score >= 70:
        return "HIGH"
    if score >= 30:
        return "MEDIUM"
    return "LOW"


def _recommendation(risk: str) -> str:
    return {"HIGH": "QUARANTINE_REVIEW", "MEDIUM": "REVIEW", "LOW": "ALLOW"}[risk]


def _build_explanation(triggered: list[Signal]) -> str:
    if not triggered:
        return "No suspicious signals detected."
    ids = ", ".join(s.id for s in triggered)
    summaries = " ".join(s.detail for s in triggered)
    return f"File triggered {len(triggered)} signal(s): {ids}. {summaries}"


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="DevShield Analyzer", version="0.1.0")


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest) -> Any:
    findings: list[Finding] = []

    for file_entry in request.files:
        file_info = file_entry.model_dump()
        triggered: list[Signal] = []
        raw_score = 0

        for signal_id, check_fn in SIGNAL_CHECKS:
            weight, detail = check_fn(file_info, request.workspacePath)
            if weight > 0 and detail is not None:
                triggered.append(Signal(id=signal_id, weight=weight, detail=detail))
                raw_score += weight

        score = min(raw_score, 100)
        risk = _risk_level(score)

        findings.append(Finding(
            fileId=file_entry.id,
            score=score,
            riskLevel=risk,
            signals=triggered,
            recommendation=_recommendation(risk),
            explanation=_build_explanation(triggered),
        ))

    return AnalyzeResponse(findings=findings)


# ---------------------------------------------------------------------------
# Entry-point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
