#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="${WORKSPACE:-/home/ubuntu/.openclaw/workspace}"
OUT_DIR="$WORKSPACE/memory/research"
DATE_UTC="$(date -u +%F)"
OUT_FILE="$OUT_DIR/openclaw-health-${DATE_UTC}.md"

mkdir -p "$OUT_DIR"

{
  echo "# OpenClaw Nightly Health Snapshot - ${DATE_UTC}"
  echo
  echo "Generated (UTC): $(date -u +"%Y-%m-%d %H:%M:%S")"
  echo
  echo "## openclaw status"
  echo '```'
  openclaw status || true
  echo '```'
  echo
  echo "## openclaw security audit"
  echo '```'
  openclaw security audit || true
  echo '```'
} > "$OUT_FILE"

echo "Wrote $OUT_FILE"