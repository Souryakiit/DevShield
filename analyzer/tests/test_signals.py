"""
tests/test_signals.py — One test per signal (positive + negative case).
"""
import json
import os
import sys
import tempfile

import pytest

# Ensure the analyzer package root is on sys.path so signals.py is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

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
# Helpers
# ---------------------------------------------------------------------------

def _make_file(tmp_dir: str, rel_path: str, content: bytes) -> None:
    """Write bytes to tmp_dir/rel_path, creating intermediate dirs."""
    full = os.path.join(tmp_dir, rel_path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "wb") as fh:
        fh.write(content)


def _fi(rel_path: str, ext: str, sha256: str = "aa" * 32, **kwargs) -> dict:
    """Minimal file_info dict."""
    return {
        "id": "test",
        "relativePath": rel_path,
        "extension": ext,
        "size": 100,
        "sha256": sha256,
        "modifiedTime": "2025-01-01T00:00:00Z",
        "changeType": "NEW",
        **kwargs,
    }


# ---------------------------------------------------------------------------
# Signal 1 — known_bad_hash
# ---------------------------------------------------------------------------

class TestKnownBadHash:
    def test_triggered(self, tmp_path):
        bad_sha = "d" * 64
        hashes_file = os.path.join(os.path.dirname(__file__), "..", "known_bad_hashes.txt")
        # Temporarily inject a bad hash
        original = open(hashes_file, "r").read()
        try:
            with open(hashes_file, "a") as fh:
                fh.write(f"\n{bad_sha}\n")
            # Reset cache
            import signals as _s
            _s._KNOWN_BAD_HASHES = None

            fi = _fi("file.txt", "txt", sha256=bad_sha)
            weight, detail = check_known_bad_hash(fi, str(tmp_path))
            assert weight == 100
            assert detail is not None
        finally:
            with open(hashes_file, "w") as fh:
                fh.write(original)
            import signals as _s
            _s._KNOWN_BAD_HASHES = None

    def test_not_triggered(self, tmp_path):
        import signals as _s
        _s._KNOWN_BAD_HASHES = set()  # empty blocklist
        fi = _fi("file.txt", "txt", sha256="a" * 64)
        weight, detail = check_known_bad_hash(fi, str(tmp_path))
        assert weight == 0
        assert detail is None


# ---------------------------------------------------------------------------
# Signal 2 — magic_mismatch
# ---------------------------------------------------------------------------

class TestMagicMismatch:
    def test_triggered_elf_as_png(self, tmp_path):
        # ELF header but extension png
        content = bytes.fromhex("7F454C46") + b"\x00" * 4
        _make_file(str(tmp_path), "image.png", content)
        fi = _fi("image.png", "png")
        weight, detail = check_magic_mismatch(fi, str(tmp_path))
        assert weight == 35
        assert detail is not None

    def test_triggered_pe_as_txt(self, tmp_path):
        content = bytes.fromhex("4D5A") + b"\x00" * 6
        _make_file(str(tmp_path), "readme.txt", content)
        fi = _fi("readme.txt", "txt")
        weight, detail = check_magic_mismatch(fi, str(tmp_path))
        assert weight == 35

    def test_not_triggered_real_png(self, tmp_path):
        content = bytes.fromhex("89504E47") + b"\x00" * 4
        _make_file(str(tmp_path), "image.png", content)
        fi = _fi("image.png", "png")
        weight, detail = check_magic_mismatch(fi, str(tmp_path))
        assert weight == 0

    def test_triggered_png_magic_wrong_ext(self, tmp_path):
        content = bytes.fromhex("89504E47") + b"\x00" * 4
        _make_file(str(tmp_path), "image.jpg", content)
        fi = _fi("image.jpg", "jpg")
        weight, detail = check_magic_mismatch(fi, str(tmp_path))
        assert weight == 35


# ---------------------------------------------------------------------------
# Signal 3 — install_script
# ---------------------------------------------------------------------------

class TestInstallScript:
    def test_triggered_package_json_postinstall(self, tmp_path):
        pkg = {"scripts": {"postinstall": "node evil.js"}}
        _make_file(str(tmp_path), "package.json", json.dumps(pkg).encode())
        fi = _fi("package.json", "json")
        weight, detail = check_install_script(fi, str(tmp_path))
        assert weight == 30
        assert "postinstall" in detail

    def test_triggered_setup_py(self, tmp_path):
        code = "from setuptools import setup\nimport subprocess\nsetup(name='x')\n"
        _make_file(str(tmp_path), "setup.py", code.encode())
        fi = _fi("setup.py", "py")
        weight, detail = check_install_script(fi, str(tmp_path))
        assert weight == 30
        assert "subprocess" in detail

    def test_not_triggered_clean_package_json(self, tmp_path):
        pkg = {"name": "safe-pkg", "scripts": {"test": "jest"}}
        _make_file(str(tmp_path), "package.json", json.dumps(pkg).encode())
        fi = _fi("package.json", "json")
        weight, detail = check_install_script(fi, str(tmp_path))
        assert weight == 0

    def test_not_triggered_clean_setup_py(self, tmp_path):
        code = "from setuptools import setup\nsetup(name='x')\n"
        _make_file(str(tmp_path), "setup.py", code.encode())
        fi = _fi("setup.py", "py")
        weight, detail = check_install_script(fi, str(tmp_path))
        assert weight == 0


# ---------------------------------------------------------------------------
# Signal 4 — double_extension
# ---------------------------------------------------------------------------

class TestDoubleExtension:
    def test_triggered(self, tmp_path):
        fi = _fi("docs/invoice.pdf.exe", "exe")
        weight, detail = check_double_extension(fi, str(tmp_path))
        assert weight == 25
        assert detail is not None

    def test_not_triggered_single_ext(self, tmp_path):
        fi = _fi("src/main.py", "py")
        weight, detail = check_double_extension(fi, str(tmp_path))
        assert weight == 0

    def test_not_triggered_harmless_double(self, tmp_path):
        # .tar.gz — last ext not executable
        fi = _fi("dist/archive.tar.gz", "gz")
        weight, detail = check_double_extension(fi, str(tmp_path))
        assert weight == 0


# ---------------------------------------------------------------------------
# Signal 5 — non_registry_dependency
# ---------------------------------------------------------------------------

class TestNonRegistryDependency:
    def test_triggered_package_json_git(self, tmp_path):
        pkg = {"dependencies": {"evil-pkg": "git+https://evil.example.com/repo.git"}}
        _make_file(str(tmp_path), "package.json", json.dumps(pkg).encode())
        fi = _fi("package.json", "json")
        weight, detail = check_non_registry_dependency(fi, str(tmp_path))
        assert weight == 25
        assert "evil-pkg" in detail

    def test_triggered_requirements_txt_git(self, tmp_path):
        reqs = "requests==2.31.0\ngit+https://github.com/malicious/lib.git\nnumpy\n"
        _make_file(str(tmp_path), "requirements.txt", reqs.encode())
        fi = _fi("requirements.txt", "txt")
        weight, detail = check_non_registry_dependency(fi, str(tmp_path))
        assert weight == 25

    def test_not_triggered_clean_package_json(self, tmp_path):
        pkg = {"dependencies": {"react": "^18.2.0", "lodash": "^4.17.21"}}
        _make_file(str(tmp_path), "package.json", json.dumps(pkg).encode())
        fi = _fi("package.json", "json")
        weight, detail = check_non_registry_dependency(fi, str(tmp_path))
        assert weight == 0

    def test_not_triggered_clean_requirements(self, tmp_path):
        reqs = "requests==2.31.0\nnumpy>=1.24\npytest\n"
        _make_file(str(tmp_path), "requirements.txt", reqs.encode())
        fi = _fi("requirements.txt", "txt")
        weight, detail = check_non_registry_dependency(fi, str(tmp_path))
        assert weight == 0


# ---------------------------------------------------------------------------
# Signal 6 — binary_in_source_dir
# ---------------------------------------------------------------------------

class TestBinaryInSourceDir:
    def test_triggered_binary_ext(self, tmp_path):
        _make_file(str(tmp_path), "src/tool.exe", b"\x00" * 10)
        fi = _fi("src/tool.exe", "exe")
        weight, detail = check_binary_in_source_dir(fi, str(tmp_path))
        assert weight == 20

    def test_triggered_elf_magic_no_ext(self, tmp_path):
        content = bytes.fromhex("7F454C46") + b"\x00" * 4
        _make_file(str(tmp_path), "lib/runme", content)
        fi = _fi("lib/runme", "")
        weight, detail = check_binary_in_source_dir(fi, str(tmp_path))
        assert weight == 20

    def test_not_triggered_binary_outside_src(self, tmp_path):
        _make_file(str(tmp_path), "dist/tool.exe", b"\x00" * 10)
        fi = _fi("dist/tool.exe", "exe")
        weight, detail = check_binary_in_source_dir(fi, str(tmp_path))
        assert weight == 0

    def test_not_triggered_py_in_src(self, tmp_path):
        _make_file(str(tmp_path), "src/main.py", b"print('hello')")
        fi = _fi("src/main.py", "py")
        weight, detail = check_binary_in_source_dir(fi, str(tmp_path))
        assert weight == 0


# ---------------------------------------------------------------------------
# Signal 7 — obfuscated_code
# ---------------------------------------------------------------------------

class TestObfuscatedCode:
    def test_triggered_eval_atob(self, tmp_path):
        code = "eval(atob('aGVsbG8='));"
        _make_file(str(tmp_path), "bundle.js", code.encode())
        fi = _fi("bundle.js", "js")
        weight, detail = check_obfuscated_code(fi, str(tmp_path))
        assert weight == 20
        assert "eval(atob" in detail

    def test_triggered_large_base64(self, tmp_path):
        b64 = "A" * 1001  # >1000 chars of valid base64-like chars
        code = f'var x = "{b64}";'
        _make_file(str(tmp_path), "script.js", code.encode())
        fi = _fi("script.js", "js")
        weight, detail = check_obfuscated_code(fi, str(tmp_path))
        assert weight == 20

    def test_not_triggered_clean_js(self, tmp_path):
        code = "console.log('hello world');"
        _make_file(str(tmp_path), "app.js", code.encode())
        fi = _fi("app.js", "js")
        weight, detail = check_obfuscated_code(fi, str(tmp_path))
        assert weight == 0

    def test_not_triggered_wrong_ext(self, tmp_path):
        code = "eval(atob('aGVsbG8='));"
        _make_file(str(tmp_path), "file.html", code.encode())
        fi = _fi("file.html", "html")
        weight, detail = check_obfuscated_code(fi, str(tmp_path))
        assert weight == 0


# ---------------------------------------------------------------------------
# Signal 8 — hidden_file_unusual_location
# ---------------------------------------------------------------------------

class TestHiddenFileUnusualLocation:
    def test_triggered(self, tmp_path):
        fi = _fi("src/.hidden_config", "")
        weight, detail = check_hidden_file_unusual_location(fi, str(tmp_path))
        assert weight == 10
        assert ".hidden_config" in detail

    def test_not_triggered_in_git(self, tmp_path):
        fi = _fi(".git/.gitconfig", "")
        weight, detail = check_hidden_file_unusual_location(fi, str(tmp_path))
        assert weight == 0

    def test_not_triggered_not_hidden(self, tmp_path):
        fi = _fi("src/main.py", "py")
        weight, detail = check_hidden_file_unusual_location(fi, str(tmp_path))
        assert weight == 0

    def test_not_triggered_devshield(self, tmp_path):
        fi = _fi(".devshield/.session", "")
        weight, detail = check_hidden_file_unusual_location(fi, str(tmp_path))
        assert weight == 0
