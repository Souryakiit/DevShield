#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Install the DevShield pre-push git hook into .git/hooks/

.DESCRIPTION
    Copies scripts/pre-push to .git/hooks/pre-push.
    The hook blocks git push when HIGH findings are unresolved.

.NOTES
    Requires bash to be on PATH (Git for Windows ships bash at C:\Program Files\Git\bin\bash.exe).
    The hook uses curl; Git for Windows ships curl as well.

.EXAMPLE
    .\scripts\install-hooks.ps1
#>

$Root      = $PSScriptRoot | Split-Path -Parent
$HooksDir  = Join-Path $Root ".git\hooks"
$HookSrc   = Join-Path $Root "scripts\pre-push"
$HookDest  = Join-Path $HooksDir "pre-push"

if (-not (Test-Path $HooksDir)) {
    Write-Error "No .git/hooks directory found. Are you in a git repository?"
    exit 1
}

if (-not (Test-Path $HookSrc)) {
    Write-Error "scripts/pre-push not found. Run from the repo root."
    exit 1
}

Copy-Item $HookSrc $HookDest -Force

# Make it executable via git (chmod equivalent on Windows via git update-index)
try {
    git update-index --chmod=+x ".git/hooks/pre-push" 2>&1 | Out-Null
} catch {}

# If bash is available, set Unix permissions too
$BashPath = "C:\Program Files\Git\bin\bash.exe"
if (Test-Path $BashPath) {
    & $BashPath -c "chmod +x '$($HookDest.Replace('\','/'))')" 2>$null
}

Write-Host "Installed DevShield pre-push hook at: $HookDest" -ForegroundColor Green
Write-Host ""
Write-Host "The hook will:"
Write-Host "  - Run a DevShield scan before every push"
Write-Host "  - BLOCK the push if there are unresolved HIGH findings"
Write-Host "  - WARN (but allow) if there are MEDIUM findings"
Write-Host "  - Skip silently if the backend is not running"
Write-Host ""
Write-Host "To uninstall:"
Write-Host "  Remove-Item .git\hooks\pre-push"
Write-Host ""
Write-Host "To bypass once (emergency only):"
Write-Host "  git push --no-verify"
