#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Start the DevShield analyzer (Python/FastAPI) and backend (Java/Spring Boot).

.DESCRIPTION
    Launches both services in background processes and writes their logs to
    logs/analyzer.log and logs/backend.log respectively.

    Prerequisites:
      - Java 21+ on PATH (or JAVA_HOME set)
      - Apache Maven 3.9+ on PATH  (or set $env:MVN_CMD to the full mvn.cmd path)
      - Python 3.11+ with analyzer/.venv present
        (run: cd analyzer && python -m venv .venv && .venv\Scripts\pip install -r requirements.txt)

    Usage:
      .\scripts\run-all.ps1 [-AnalyzerPort 8001] [-BackendPort 8080]

    Stop:
      Stop-Process -Name "python","java" -ErrorAction SilentlyContinue
#>
param(
    [int]$AnalyzerPort  = 8001,
    [int]$BackendPort   = 8080
)

$Root     = $PSScriptRoot | Split-Path -Parent
$LogDir   = Join-Path $Root "logs"
New-Item -ItemType Directory -Force $LogDir | Out-Null

# ---------------------------------------------------------------------------
# Locate mvn
# ---------------------------------------------------------------------------
$MvnCmd = if ($env:MVN_CMD) { $env:MVN_CMD } `
          elseif (Get-Command mvn -ErrorAction SilentlyContinue) { "mvn" } `
          elseif (Test-Path "C:\Program Files\apache-maven-3.9.16\bin\mvn.cmd") {
              "C:\Program Files\apache-maven-3.9.16\bin\mvn.cmd"
          } else {
              Write-Error "Maven not found. Set `$env:MVN_CMD or add mvn to PATH."
              exit 1
          }

# ---------------------------------------------------------------------------
# Build backend JAR if needed
# ---------------------------------------------------------------------------
$JarPattern = Join-Path $Root "backend\target\backend-*.jar"
$JarFiles   = Get-Item $JarPattern -ErrorAction SilentlyContinue

if (-not $JarFiles) {
    Write-Host "[run-all] Building backend JAR (first run)..." -ForegroundColor Cyan
    $build = Start-Process -FilePath $MvnCmd `
        -ArgumentList "package", "-DskipTests", "-q" `
        -WorkingDirectory (Join-Path $Root "backend") `
        -Wait -PassThru -NoNewWindow
    if ($build.ExitCode -ne 0) {
        Write-Error "Backend build failed. Check Maven output."
        exit 1
    }
    $JarFiles = Get-Item $JarPattern -ErrorAction SilentlyContinue
}

$Jar = ($JarFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
Write-Host "[run-all] Backend JAR: $Jar" -ForegroundColor Green

# ---------------------------------------------------------------------------
# Locate Python in .venv
# ---------------------------------------------------------------------------
$PythonExe = Join-Path $Root "analyzer\.venv\Scripts\python.exe"
if (-not (Test-Path $PythonExe)) {
    Write-Error "analyzer/.venv not found. Run: cd analyzer && python -m venv .venv && .\.venv\Scripts\pip install -r requirements.txt"
    exit 1
}

# ---------------------------------------------------------------------------
# Start analyzer
# ---------------------------------------------------------------------------
$AnalyzerLog = Join-Path $LogDir "analyzer.log"
Write-Host "[run-all] Starting analyzer on port $AnalyzerPort  (log: $AnalyzerLog)" -ForegroundColor Cyan
$analyzerProc = Start-Process -FilePath $PythonExe `
    -ArgumentList "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "$AnalyzerPort" `
    -WorkingDirectory (Join-Path $Root "analyzer") `
    -RedirectStandardOutput $AnalyzerLog `
    -RedirectStandardError  ($AnalyzerLog -replace '\.log$', '-err.log') `
    -PassThru -NoNewWindow
Write-Host "[run-all] Analyzer PID: $($analyzerProc.Id)" -ForegroundColor Green

# ---------------------------------------------------------------------------
# Start backend
# ---------------------------------------------------------------------------
$BackendLog  = Join-Path $LogDir "backend.log"
$JavaExe     = if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME "bin\java.exe" } else { "java" }
Write-Host "[run-all] Starting backend on port $BackendPort  (log: $BackendLog)" -ForegroundColor Cyan
$backendProc = Start-Process -FilePath $JavaExe `
    -ArgumentList "-jar", $Jar, "--server.port=$BackendPort" `
    -WorkingDirectory $Root `
    -RedirectStandardOutput $BackendLog `
    -RedirectStandardError  ($BackendLog -replace '\.log$', '-err.log') `
    -PassThru -NoNewWindow
Write-Host "[run-all] Backend PID: $($backendProc.Id)" -ForegroundColor Green

# ---------------------------------------------------------------------------
# Wait for services to be ready
# ---------------------------------------------------------------------------
Write-Host "[run-all] Waiting for services to become ready..." -ForegroundColor Cyan
$maxWait = 60
$interval = 2
$elapsed  = 0
$analyzerReady = $false
$backendReady  = $false

while ($elapsed -lt $maxWait -and (-not ($analyzerReady -and $backendReady))) {
    Start-Sleep -Seconds $interval
    $elapsed += $interval

    if (-not $analyzerReady) {
        try {
            $r = Invoke-WebRequest -Uri "http://localhost:$AnalyzerPort/docs" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
            $analyzerReady = $true
            Write-Host "[run-all]   Analyzer ready  (${elapsed}s)" -ForegroundColor Green
        } catch {}
    }
    if (-not $backendReady) {
        try {
            $r = Invoke-WebRequest -Uri "http://localhost:$BackendPort/actuator/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
            $backendReady = $true
            Write-Host "[run-all]   Backend  ready  (${elapsed}s)" -ForegroundColor Green
        } catch {
            # Try a basic endpoint as health fallback
            try {
                $r = Invoke-WebRequest -Uri "http://localhost:$BackendPort/api/workspace/findings" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
                $backendReady = $true
                Write-Host "[run-all]   Backend  ready  (${elapsed}s)" -ForegroundColor Green
            } catch {}
        }
    }
}

if (-not ($analyzerReady -and $backendReady)) {
    Write-Warning "[run-all] One or more services did not become ready within ${maxWait}s. Check logs/."
} else {
    Write-Host "[run-all] All services ready. DevShield is running." -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# Start frontend dev server (optional — requires Node 18+ and npm install)
# ---------------------------------------------------------------------------
$FrontendDir = Join-Path $Root "frontend"
$FrontendLog = Join-Path $LogDir "frontend.log"
$FrontendPort = 5173

if (Test-Path (Join-Path $FrontendDir "node_modules")) {
    Write-Host "[run-all] Starting frontend dev server on port $FrontendPort  (log: $FrontendLog)" -ForegroundColor Cyan
    $npmCmd = if (Get-Command npm -ErrorAction SilentlyContinue) { "npm" } else { $null }
    if ($npmCmd) {
        $frontendProc = Start-Process -FilePath $npmCmd `
            -ArgumentList "run", "dev" `
            -WorkingDirectory $FrontendDir `
            -RedirectStandardOutput $FrontendLog `
            -RedirectStandardError ($FrontendLog -replace '\.log$', '-err.log') `
            -PassThru -NoNewWindow
        Write-Host "[run-all] Frontend PID: $($frontendProc.Id)" -ForegroundColor Green
    } else {
        Write-Warning "[run-all] npm not found — skipping frontend. Install Node 18+ to run the dashboard."
    }
} else {
    Write-Warning "[run-all] frontend/node_modules not found. Run 'cd frontend && npm install' first."
}

Write-Host ""
Write-Host "  Backend:  http://localhost:$BackendPort"
Write-Host "  Analyzer: http://localhost:$AnalyzerPort/docs"
Write-Host "  Frontend: http://localhost:$FrontendPort"
Write-Host ""
Write-Host "  To stop:  Stop-Process -Name node,python,java -ErrorAction SilentlyContinue"
