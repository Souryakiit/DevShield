#!/usr/bin/env bash
# DevShield — start all services on Linux/macOS for local dev
#
# Usage:
#   chmod +x scripts/run-all.sh
#   ./scripts/run-all.sh
#
# Prerequisites:
#   - Java 21+       (sudo apt install openjdk-21-jdk)
#   - Maven 3.9+     (sudo apt install maven)  OR use the included ./mvnw
#   - Python 3.11+   (sudo apt install python3.11 python3.11-venv)
#   - Node 18+       (https://nodejs.org or: sudo apt install nodejs npm)
#
# Stop all:
#   kill $(cat /tmp/devshield-pids.txt) 2>/dev/null
#   OR: pkill -f "uvicorn main:app"; pkill -f "backend.*jar"

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT/logs"
mkdir -p "$LOG_DIR"
PID_FILE="/tmp/devshield-pids.txt"
> "$PID_FILE"

ANALYZER_PORT="${DEVSHIELD_ANALYZER_PORT:-8001}"
BACKEND_PORT="${DEVSHIELD_BACKEND_PORT:-8080}"
FRONTEND_PORT=5173

GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; RESET='\033[0m'
info()  { echo -e "${GREEN}[run-all]${RESET} $*"; }
step()  { echo -e "${CYAN}[run-all]${RESET} $*"; }
warn()  { echo -e "${YELLOW}[run-all]${RESET} $*"; }
error() { echo -e "${RED}[run-all]${RESET} $*" >&2; }

# ---------------------------------------------------------------------------
# Locate Java
# ---------------------------------------------------------------------------
if [ -n "${JAVA_HOME:-}" ] && [ -x "$JAVA_HOME/bin/java" ]; then
    JAVA_EXE="$JAVA_HOME/bin/java"
elif command -v java &>/dev/null; then
    JAVA_EXE="java"
else
    error "Java not found. Install: sudo apt install openjdk-21-jdk"
    exit 1
fi
info "Java: $($JAVA_EXE -version 2>&1 | head -1)"

# ---------------------------------------------------------------------------
# Build backend JAR if needed
# ---------------------------------------------------------------------------
JAR=$(ls "$ROOT/backend/target/backend-"*.jar 2>/dev/null | head -1 || true)
if [ -z "$JAR" ]; then
    step "Building backend JAR (first run)..."
    if command -v mvn &>/dev/null; then
        MVN_CMD="mvn"
    elif [ -x "$ROOT/backend/mvnw" ]; then
        MVN_CMD="$ROOT/backend/mvnw"
    else
        error "Maven not found. Install: sudo apt install maven"
        exit 1
    fi
    (cd "$ROOT/backend" && $MVN_CMD package -DskipTests -q)
    JAR=$(ls "$ROOT/backend/target/backend-"*.jar | head -1)
fi
info "Backend JAR: $JAR"

# ---------------------------------------------------------------------------
# Locate Python in analyzer/.venv
# ---------------------------------------------------------------------------
PYTHON_EXE="$ROOT/analyzer/.venv/bin/python"
if [ ! -x "$PYTHON_EXE" ]; then
    warn "analyzer/.venv not found. Creating..."
    if command -v python3.11 &>/dev/null; then
        python3.11 -m venv "$ROOT/analyzer/.venv"
    elif command -v python3 &>/dev/null; then
        python3 -m venv "$ROOT/analyzer/.venv"
    else
        error "Python 3 not found. Install: sudo apt install python3.11 python3.11-venv"
        exit 1
    fi
    "$PYTHON_EXE" -m pip install -q -r "$ROOT/analyzer/requirements.txt"
    info "Analyzer venv created."
fi

# ---------------------------------------------------------------------------
# Start analyzer
# ---------------------------------------------------------------------------
ANALYZER_LOG="$LOG_DIR/analyzer.log"
step "Starting analyzer on port $ANALYZER_PORT  (log: $ANALYZER_LOG)"
"$PYTHON_EXE" -m uvicorn main:app \
    --host 0.0.0.0 \
    --port "$ANALYZER_PORT" \
    > "$ANALYZER_LOG" 2>"$LOG_DIR/analyzer-err.log" &
ANALYZER_PID=$!
echo "$ANALYZER_PID" >> "$PID_FILE"
info "Analyzer PID: $ANALYZER_PID"

# ---------------------------------------------------------------------------
# Start backend
# ---------------------------------------------------------------------------
BACKEND_LOG="$LOG_DIR/backend.log"
step "Starting backend on port $BACKEND_PORT  (log: $BACKEND_LOG)"
"$JAVA_EXE" -jar "$JAR" "--server.port=$BACKEND_PORT" \
    > "$BACKEND_LOG" 2>"$LOG_DIR/backend-err.log" &
BACKEND_PID=$!
echo "$BACKEND_PID" >> "$PID_FILE"
info "Backend PID: $BACKEND_PID"

# ---------------------------------------------------------------------------
# Wait for services to become ready
# ---------------------------------------------------------------------------
step "Waiting for services to become ready..."
MAX_WAIT=60
ELAPSED=0
ANALYZER_READY=false
BACKEND_READY=false

while [ "$ELAPSED" -lt "$MAX_WAIT" ]; do
    sleep 2
    ELAPSED=$((ELAPSED + 2))

    if [ "$ANALYZER_READY" = false ] && \
       curl -sf --connect-timeout 2 "http://localhost:$ANALYZER_PORT/docs" -o /dev/null 2>&1; then
        ANALYZER_READY=true
        info "  Analyzer ready  (${ELAPSED}s)"
    fi

    if [ "$BACKEND_READY" = false ] && \
       curl -sf --connect-timeout 2 "http://localhost:$BACKEND_PORT/api/workspace/findings" -o /dev/null 2>&1; then
        BACKEND_READY=true
        info "  Backend  ready  (${ELAPSED}s)"
    fi

    if [ "$ANALYZER_READY" = true ] && [ "$BACKEND_READY" = true ]; then
        break
    fi
done

if [ "$ANALYZER_READY" = false ] || [ "$BACKEND_READY" = false ]; then
    warn "One or more services did not become ready within ${MAX_WAIT}s. Check logs/."
fi

# ---------------------------------------------------------------------------
# Start frontend dev server (optional)
# ---------------------------------------------------------------------------
FRONTEND_DIR="$ROOT/frontend"
FRONTEND_LOG="$LOG_DIR/frontend.log"

if [ -d "$FRONTEND_DIR/node_modules" ]; then
    if command -v npm &>/dev/null; then
        step "Starting frontend dev server on port $FRONTEND_PORT  (log: $FRONTEND_LOG)"
        (cd "$FRONTEND_DIR" && npm run dev) \
            > "$FRONTEND_LOG" 2>"$LOG_DIR/frontend-err.log" &
        FRONTEND_PID=$!
        echo "$FRONTEND_PID" >> "$PID_FILE"
        info "Frontend PID: $FRONTEND_PID"
        sleep 2
    else
        warn "npm not found — skipping frontend. Install Node 18+."
    fi
else
    warn "frontend/node_modules not found. Run: cd frontend && npm install"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo -e "  ${GREEN}Backend:${RESET}  http://localhost:$BACKEND_PORT"
echo -e "  ${GREEN}Analyzer:${RESET} http://localhost:$ANALYZER_PORT/docs"
echo -e "  ${GREEN}Frontend:${RESET} http://localhost:$FRONTEND_PORT"
echo ""
echo -e "  PIDs saved to $PID_FILE"
echo -e "  Stop all: ${CYAN}kill \$(cat $PID_FILE)${RESET}"
echo -e "  Or:       ${CYAN}pkill -f 'uvicorn main:app'; pkill -f 'backend.*jar'; pkill -f 'vite'${RESET}"
echo ""
