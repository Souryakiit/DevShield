"""
signals.py — All 8 security signal checks for DevShield analyzer.

Each function signature:
    check_<signal_name>(file_info: dict, workspace_path: str) -> tuple[int, str] | tuple[int, None]

Returns (weight, detail) if the signal is triggered, or (0, None) if not.
"""
import os
import json
import re

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_KNOWN_BAD_HASHES: set[str] | None = None
_HASHES_FILE = os.path.join(os.path.dirname(__file__), "known_bad_hashes.txt")


def _load_known_bad_hashes() -> set[str]:
    global _KNOWN_BAD_HASHES
    if _KNOWN_BAD_HASHES is not None:
        return _KNOWN_BAD_HASHES
    hashes: set[str] = set()
    try:
        with open(_HASHES_FILE, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                hashes.add(line.lower())
    except FileNotFoundError:
        pass
    _KNOWN_BAD_HASHES = hashes
    return hashes


def _read_file_bytes(workspace_path: str, relative_path: str, max_bytes: int | None = None) -> bytes | None:
    """Read file bytes safely; returns None if the file cannot be read."""
    full_path = os.path.join(workspace_path, relative_path)
    try:
        with open(full_path, "rb") as fh:
            if max_bytes is not None:
                return fh.read(max_bytes)
            return fh.read()
    except (OSError, PermissionError):
        return None


def _read_file_text(workspace_path: str, relative_path: str) -> str | None:
    """Read file as UTF-8 text (with error replacement); returns None on failure."""
    full_path = os.path.join(workspace_path, relative_path)
    try:
        with open(full_path, "r", encoding="utf-8", errors="replace") as fh:
            return fh.read()
    except (OSError, PermissionError):
        return None


# ---------------------------------------------------------------------------
# Signal 1 — known_bad_hash
# ---------------------------------------------------------------------------

def check_known_bad_hash(file_info: dict, workspace_path: str) -> tuple[int, str] | tuple[int, None]:
    """Return (100, detail) if sha256 is in the local blocklist."""
    sha = (file_info.get("sha256") or "").strip().lower()
    if not sha:
        return (0, None)
    hashes = _load_known_bad_hashes()
    if sha in hashes:
        return (100, "SHA-256 matches local blocklist entry.")
    return (0, None)


# ---------------------------------------------------------------------------
# Signal 2 — magic_mismatch
# ---------------------------------------------------------------------------

_MAGIC_MZ   = bytes.fromhex("4D5A")
_MAGIC_ELF  = bytes.fromhex("7F454C46")
_MAGIC_PK   = bytes.fromhex("504B")
_MAGIC_PDF  = bytes.fromhex("25504446")
_MAGIC_PNG  = bytes.fromhex("89504E47")
_MAGIC_JPEG = bytes.fromhex("FFD8FF")
_MAGIC_GIF  = bytes.fromhex("47494638")

_IMAGE_EXT   = {"png", "jpg", "jpeg", "gif", "bmp", "webp", "svg"}
_DOC_EXT     = {"pdf", "doc", "docx", "xls", "xlsx"}
_ARCHIVE_EXT = {"zip", "jar", "war", "ear"}
_SOURCE_EXT  = {"js", "ts", "py", "java", "txt", "md", "json", "yaml", "yml",
                "xml", "html", "css", "sh", "bat", "ps1"}


def check_magic_mismatch(file_info: dict, workspace_path: str) -> tuple[int, str] | tuple[int, None]:
    """Return (35, detail) when magic bytes contradict the declared extension."""
    ext = (file_info.get("extension") or "").lower()
    header = _read_file_bytes(workspace_path, file_info["relativePath"], max_bytes=8)
    if header is None or len(header) < 2:
        return (0, None)

    def _detail(detected: str) -> tuple[int, str]:
        return (35, f"Magic bytes indicate {detected} but extension is '.{ext}'.")

    if header[:4] == _MAGIC_ELF:
        if ext in _IMAGE_EXT | _DOC_EXT | _SOURCE_EXT:
            return _detail("ELF executable")
    if header[:2] == _MAGIC_MZ:
        if ext in _IMAGE_EXT | _DOC_EXT | _SOURCE_EXT:
            return _detail("PE/MZ executable")
    if header[:4] == _MAGIC_PNG:
        if ext != "png":
            return _detail("PNG image")
    if header[:3] == _MAGIC_JPEG:
        if ext not in {"jpg", "jpeg"}:
            return _detail("JPEG image")
    if header[:4] == _MAGIC_GIF:
        if ext != "gif":
            return _detail("GIF image")
    if header[:4] == _MAGIC_PDF:
        if ext != "pdf":
            return _detail("PDF document")
    if header[:2] == _MAGIC_PK:
        if ext not in {"zip", "jar", "war", "ear", "docx", "xlsx", "pptx"}:
            return _detail("ZIP/PK archive")

    return (0, None)


# ---------------------------------------------------------------------------
# Signal 3 — install_script
# ---------------------------------------------------------------------------

_RISKY_SETUP_PATTERNS = ["subprocess", "os.system", "urllib", "requests", "exec("]


def check_install_script(file_info: dict, workspace_path: str) -> tuple[int, str] | tuple[int, None]:
    """Return (30, detail) when package.json or setup.py define risky install hooks."""
    rel = file_info.get("relativePath", "")
    ext = (file_info.get("extension") or "").lower()

    if ext == "json" and rel.endswith("package.json"):
        text = _read_file_text(workspace_path, rel)
        if text is None:
            return (0, None)
        try:
            pkg = json.loads(text)
        except json.JSONDecodeError:
            return (0, None)
        scripts = pkg.get("scripts", {})
        for key in ("preinstall", "install", "postinstall"):
            if key in scripts:
                return (30, f"package.json defines a '{key}' script: '{scripts[key]}'.")

    if rel.endswith("setup.py"):
        text = _read_file_text(workspace_path, rel)
        if text is None:
            return (0, None)
        for pattern in _RISKY_SETUP_PATTERNS:
            if pattern in text:
                return (30, f"setup.py contains potentially risky hook: '{pattern}'.")

    return (0, None)


# ---------------------------------------------------------------------------
# Signal 4 — double_extension
# ---------------------------------------------------------------------------

_DOC_SECOND_EXT = {"pdf", "doc", "docx", "xls", "xlsx", "txt", "jpg", "png", "gif"}
_EXEC_LAST_EXT  = {"exe", "bat", "cmd", "ps1", "sh", "msi", "vbs", "js", "py", "rb"}


def check_double_extension(file_info: dict, workspace_path: str) -> tuple[int, str] | tuple[int, None]:
    """Return (25, detail) for disguised executables using double-extension tricks."""
    rel = file_info.get("relativePath", "")
    filename = os.path.basename(rel)
    parts = filename.split(".")
    if len(parts) < 3:
        return (0, None)
    second_to_last = parts[-2].lower()
    last_ext = parts[-1].lower()
    if second_to_last in _DOC_SECOND_EXT and last_ext in _EXEC_LAST_EXT:
        return (25, f"Double extension detected: '.{second_to_last}.{last_ext}' may disguise an executable as '{second_to_last}'.")
    return (0, None)


# ---------------------------------------------------------------------------
# Signal 5 — non_registry_dependency
# ---------------------------------------------------------------------------

_NON_REGISTRY_PREFIXES = ("git+", "http://", "https://", "file:")


def check_non_registry_dependency(file_info: dict, workspace_path: str) -> tuple[int, str] | tuple[int, None]:
    """Return (25, detail) when dependencies are resolved via non-registry sources."""
    rel = file_info.get("relativePath", "")
    filename = os.path.basename(rel)

    if filename == "package.json":
        text = _read_file_text(workspace_path, rel)
        if text is None:
            return (0, None)
        try:
            pkg = json.loads(text)
        except json.JSONDecodeError:
            return (0, None)
        for section in ("dependencies", "devDependencies"):
            deps = pkg.get(section, {})
            for dep_name, dep_value in deps.items():
                if isinstance(dep_value, str) and dep_value.startswith(_NON_REGISTRY_PREFIXES):
                    return (25, f"Dependency resolved via non-registry source: '{dep_name}: {dep_value}'.")

    _req_match = (
        filename == "requirements.txt"
        or (filename.startswith("requirements-") and filename.endswith(".txt"))
    )
    if _req_match:
        text = _read_file_text(workspace_path, rel)
        if text is None:
            return (0, None)
        for line in text.splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            if stripped.startswith(("-e git+",) + _NON_REGISTRY_PREFIXES):
                dep_name = stripped.split("#")[0].strip()
                return (25, f"Dependency resolved via non-registry source: '{dep_name}'.")

    return (0, None)


# ---------------------------------------------------------------------------
# Signal 6 — binary_in_source_dir
# ---------------------------------------------------------------------------

_SOURCE_DIR_SEGMENTS = {"src", "lib", "app", "uploads"}
_BINARY_EXTENSIONS   = {"exe", "dll", "so", "bin", "dylib", "elf"}


def check_binary_in_source_dir(file_info: dict, workspace_path: str) -> tuple[int, str] | tuple[int, None]:
    """Return (20, detail) when a binary file is found inside a source directory."""
    rel = file_info.get("relativePath", "")
    ext = (file_info.get("extension") or "").lower()

    # Check path segments
    parts = rel.replace("\\", "/").split("/")
    in_source = any(p.lower() in _SOURCE_DIR_SEGMENTS for p in parts[:-1])
    if not in_source:
        return (0, None)

    if ext in _BINARY_EXTENSIONS:
        return (20, f"Binary file (extension '.{ext}') found in source directory: '{rel}'.")

    # Check magic bytes for PE/ELF even without a binary extension
    header = _read_file_bytes(workspace_path, rel, max_bytes=4)
    if header:
        if header[:2] == _MAGIC_MZ or header[:4] == _MAGIC_ELF:
            detected = "PE/MZ" if header[:2] == _MAGIC_MZ else "ELF"
            return (20, f"{detected} binary found in source directory: '{rel}'.")

    return (0, None)


# ---------------------------------------------------------------------------
# Signal 7 — obfuscated_code
# ---------------------------------------------------------------------------

_RE_EVAL_ATOB   = re.compile(r"eval\s*\(\s*atob\s*\(")
_RE_LARGE_B64   = re.compile(r"[A-Za-z0-9+/]{1000,}={0,2}")


def check_obfuscated_code(file_info: dict, workspace_path: str) -> tuple[int, str] | tuple[int, None]:
    """Return (20, detail) for JS/Python files with obfuscation patterns."""
    ext = (file_info.get("extension") or "").lower()
    if ext not in {"js", "py"}:
        return (0, None)

    text = _read_file_text(workspace_path, file_info["relativePath"])
    if text is None:
        return (0, None)

    if _RE_EVAL_ATOB.search(text):
        return (20, "File contains eval(atob(...)) obfuscation pattern.")
    if _RE_LARGE_B64.search(text):
        return (20, "File contains large base64-encoded string (>1000 chars), possible obfuscated payload.")

    return (0, None)


# ---------------------------------------------------------------------------
# Signal 8 — hidden_file_unusual_location
# ---------------------------------------------------------------------------

_ALLOWED_DOT_PARENTS = {".git", ".devshield", ".github", ".vscode", ".idea"}


def check_hidden_file_unusual_location(file_info: dict, workspace_path: str) -> tuple[int, str] | tuple[int, None]:
    """Return (10, detail) for hidden (dot) files outside expected dot directories."""
    rel = file_info.get("relativePath", "")
    parts = rel.replace("\\", "/").split("/")
    filename = parts[-1]
    if not filename.startswith("."):
        return (0, None)

    parent = parts[-2] if len(parts) >= 2 else ""
    if parent in _ALLOWED_DOT_PARENTS:
        return (0, None)

    return (10, f"Hidden file found in unexpected location: '{rel}'.")


# ---------------------------------------------------------------------------
# Signal 9 — hardcoded_secret
# ---------------------------------------------------------------------------

_RE_AWS_KEY    = re.compile(r'AKIA[0-9A-Z]{16}')
_RE_PRIV_KEY   = re.compile(r'-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----')
_RE_GH_TOKEN   = re.compile(r'gh[ps]_[A-Za-z0-9]{36,}')
_RE_GENERIC_KEY = re.compile(
    r'(?i)(api[_\-]?key|secret[_\-]?key|auth[_\-]?token|password|passwd|access[_\-]?token)\s*[=:]\s*["\']?[A-Za-z0-9+/=_\-]{16,}["\']?'
)
_RE_STRIPE     = re.compile(r'sk_(live|test)_[A-Za-z0-9]{24,}')
_RE_SENDGRID   = re.compile(r'SG\.[A-Za-z0-9_\-]{22}\.[A-Za-z0-9_\-]{43}')

_SECRET_SOURCE_EXT = {"js", "ts", "py", "java", "go", "rb", "php", "sh", "env", "yml", "yaml", "json", "xml", "tf"}


def check_hardcoded_secret(file_info: dict, workspace_path: str) -> tuple[int, str] | tuple[int, None]:
    """Return (60, detail) when a file contains hardcoded credentials or API keys."""
    ext = (file_info.get("extension") or "").lower()
    rel = file_info.get("relativePath", "")

    # Check .env files regardless of extension
    filename = rel.replace("\\", "/").split("/")[-1]
    is_env = filename.startswith(".env") or filename == ".env"

    if ext not in _SECRET_SOURCE_EXT and not is_env:
        return (0, None)

    text = _read_file_text(workspace_path, rel)
    if text is None:
        return (0, None)

    if _RE_PRIV_KEY.search(text):
        return (80, "File contains a private key (RSA/EC/OpenSSH) — must not be committed.")
    if _RE_AWS_KEY.search(text):
        return (70, "AWS access key ID pattern detected (AKIA...) — potential credential exposure.")
    if _RE_STRIPE.search(text):
        return (70, "Stripe secret key pattern detected (sk_live/sk_test) — live credentials exposed.")
    if _RE_SENDGRID.search(text):
        return (65, "SendGrid API key pattern detected — credential exposure risk.")
    if _RE_GH_TOKEN.search(text):
        return (65, "GitHub personal access token pattern detected (ghp_/ghs_).")
    if _RE_GENERIC_KEY.search(text):
        return (45, "Generic hardcoded credential pattern detected (api_key/secret/password assignment).")

    return (0, None)


# ---------------------------------------------------------------------------
# Signal 10 — xss_injection_risk
# ---------------------------------------------------------------------------

_RE_INNER_HTML    = re.compile(r'\.innerHTML\s*=\s*(?!["\'`]<)')  # non-literal assignment
_RE_DOC_WRITE     = re.compile(r'document\.write\s*\(')
_RE_EVAL_INPUT    = re.compile(r'eval\s*\(.*(?:req\.|request\.|params\.|query\.|body\.|input|user)', re.IGNORECASE)
_RE_DANGEROUSLY   = re.compile(r'dangerouslySetInnerHTML')
_RE_SINK_PATTERNS = re.compile(
    r'(?:location\.href|location\.replace|location\.assign)\s*=.*(?:req\.|params\.|query\.|input|user)',
    re.IGNORECASE | re.DOTALL,
)
_RE_TEMPLATE_INJECT = re.compile(r'\$\{.*(?:req\.|params\.|query\.|user\.|input)', re.IGNORECASE)

_XSS_EXT = {"js", "ts", "jsx", "tsx", "html", "php", "py"}


def check_xss_injection_risk(file_info: dict, workspace_path: str) -> tuple[int, str] | tuple[int, None]:
    """Return (weight, detail) when the file contains patterns indicating XSS or injection sinks."""
    ext = (file_info.get("extension") or "").lower()
    if ext not in _XSS_EXT:
        return (0, None)

    text = _read_file_text(workspace_path, file_info["relativePath"])
    if text is None:
        return (0, None)

    if _RE_EVAL_INPUT.search(text):
        return (75, "eval() called with what appears to be user-controlled input — RCE/XSS risk.")
    if _RE_DANGEROUSLY.search(text) and _RE_TEMPLATE_INJECT.search(text):
        return (60, "dangerouslySetInnerHTML with what appears to be interpolated user input — XSS risk.")
    if _RE_DOC_WRITE.search(text):
        return (35, "document.write() usage detected — classic XSS sink, avoid in favour of DOM APIs.")
    if _RE_INNER_HTML.search(text):
        return (30, "innerHTML assignment with non-literal value — potential XSS sink, sanitize input.")
    if _RE_SINK_PATTERNS.search(text):
        return (45, "DOM location sink assigned from what appears to be user-supplied input — open redirect / XSS.")
    if _RE_TEMPLATE_INJECT.search(text):
        return (25, "Template literal interpolation with request/user data — verify output is sanitized.")

    return (0, None)


# ---------------------------------------------------------------------------
# Signal 11 — sql_injection_risk
# ---------------------------------------------------------------------------

_RE_SQL_CONCAT = re.compile(
    r'(?:SELECT|INSERT|UPDATE|DELETE|DROP|UNION)\s+.*?["\'\`]\s*\+\s*(?:req\.|params\.|query\.|user\.|input)',
    re.IGNORECASE | re.DOTALL,
)
_RE_SQL_FORMAT = re.compile(
    r'(?:SELECT|INSERT|UPDATE|DELETE)\s+.*?%s|\.format\s*\(',
    re.IGNORECASE,
)
_RE_RAW_QUERY  = re.compile(
    r'(?:raw_query|rawQuery|executeQuery|executeSql|db\.query|cursor\.execute)\s*\([^)]*(?:req\.|params\.|user\.|input)',
    re.IGNORECASE,
)
_SQL_EXT = {"py", "js", "ts", "php", "java", "rb", "go"}


def check_sql_injection_risk(file_info: dict, workspace_path: str) -> tuple[int, str] | tuple[int, None]:
    """Return (weight, detail) for SQL injection vulnerability patterns."""
    ext = (file_info.get("extension") or "").lower()
    if ext not in _SQL_EXT:
        return (0, None)

    text = _read_file_text(workspace_path, file_info["relativePath"])
    if text is None:
        return (0, None)

    if _RE_SQL_CONCAT.search(text):
        return (70, "SQL query built by string concatenation with request/user data — SQL injection risk.")
    if _RE_RAW_QUERY.search(text):
        return (65, "Raw SQL execution with what appears to be user-supplied parameter — SQLi risk.")
    if _RE_SQL_FORMAT.search(text):
        return (30, "SQL query uses %-format or .format() — potential injection if data is user-controlled.")

    return (0, None)


# ---------------------------------------------------------------------------
# Signal 12 — suspicious_network_call
# ---------------------------------------------------------------------------

_RE_DNS_TUNNEL = re.compile(r'(?:nslookup|dig\s+[A-Za-z0-9]{20,}|host\s+[A-Za-z0-9]{20,})', re.IGNORECASE)
_RE_EXFIL_UA   = re.compile(r'(?:python-urllib|curl|wget)\b.*(?:passwd|shadow|\.ssh|\.aws)', re.IGNORECASE | re.DOTALL)
_RE_RAW_SOCKET = re.compile(r'socket\.connect\s*\(\s*\(?\s*["\'](?:\d{1,3}\.){3}\d{1,3}["\']')
_RE_REVERSE_SHELL = re.compile(
    r'(?:bash\s+-i\s+>&|nc\s+-[el]|\/dev\/tcp\/|mkfifo\s+/tmp)',
    re.IGNORECASE,
)
_NET_EXT = {"py", "sh", "bash", "js", "rb", "pl"}


def check_suspicious_network_call(file_info: dict, workspace_path: str) -> tuple[int, str] | tuple[int, None]:
    """Return (weight, detail) for exfiltration / reverse-shell / C2 communication patterns."""
    ext = (file_info.get("extension") or "").lower()
    if ext not in _NET_EXT:
        return (0, None)

    text = _read_file_text(workspace_path, file_info["relativePath"])
    if text is None:
        return (0, None)

    if _RE_REVERSE_SHELL.search(text):
        return (90, "Reverse shell pattern detected (bash -i, nc -e, /dev/tcp) — high confidence malicious.")
    if _RE_EXFIL_UA.search(text):
        return (75, "HTTP client fetching sensitive system paths (passwd, .ssh, .aws) — data exfiltration risk.")
    if _RE_RAW_SOCKET.search(text):
        return (40, "Raw TCP socket connecting to hardcoded IP address — possible C2 callback.")
    if _RE_DNS_TUNNEL.search(text):
        return (35, "DNS query with unusually long hostname — possible DNS tunnelling exfiltration.")

    return (0, None)
