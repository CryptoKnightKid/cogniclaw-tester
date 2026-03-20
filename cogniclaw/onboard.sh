#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
chmod +x install.sh 2>/dev/null || true
echo "== CogniClaw CLI Onboarding =="
echo "Launching interactive installer..."
exec ./install.sh
