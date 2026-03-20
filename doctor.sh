#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$ROOT_DIR/cogniclaw"
CONTROL_PLANE_DIR="$APP_DIR/hosted-control-plane"

ok(){ echo "[OK] $1"; }
warn(){ echo "[WARN] $1"; }
fail(){ echo "[FAIL] $1"; }

command -v node >/dev/null 2>&1 && ok "node: $(node -v)" || fail "node missing"
command -v npm >/dev/null 2>&1 && ok "npm: $(npm -v)" || fail "npm missing"
command -v python3 >/dev/null 2>&1 && ok "python3: $(python3 --version 2>&1)" || warn "python3 missing (only needed for some utilities)"
[ -d "$APP_DIR" ] && ok "cogniclaw directory present" || fail "cogniclaw directory missing"
[ -f "$APP_DIR/README.md" ] && ok "README present" || warn "README missing"
[ -f "$CONTROL_PLANE_DIR/package.json" ] && ok "hosted-control-plane package.json present" || warn "hosted-control-plane package.json missing"
[ -f "$CONTROL_PLANE_DIR/.env" ] && ok "hosted-control-plane .env present" || warn "hosted-control-plane .env missing (run install.sh)"
[ -d "$CONTROL_PLANE_DIR/node_modules" ] && ok "node_modules installed" || warn "node_modules missing (run install.sh)"

echo
echo "Suggested run command:"
echo "cd cogniclaw/hosted-control-plane && npm run dev"
