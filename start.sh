#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

if [ ! -x "./install.sh" ]; then
  chmod +x install.sh 2>/dev/null || true
fi
if [ ! -x "./doctor.sh" ]; then
  chmod +x doctor.sh 2>/dev/null || true
fi

echo "== CogniClaw One-Command Start =="
./install.sh
./doctor.sh
cd cogniclaw/hosted-control-plane
cp -f .env.example .env
exec npm run dev
