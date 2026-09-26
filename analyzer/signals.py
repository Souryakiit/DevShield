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

    if filename == "requirements.txt" or (filename.endswith(".txt") and "requirement" in filename.lower()):
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
