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
