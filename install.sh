#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$ROOT_DIR/cogniclaw"
CONTROL_PLANE_DIR="$APP_DIR/hosted-control-plane"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'

say() { printf "%b\n" "$1"; }
need_cmd() { command -v "$1" >/dev/null 2>&1; }

install_linux_deps() {
  local pkgs=()
  need_cmd curl || pkgs+=(curl)
  need_cmd git || pkgs+=(git)
  need_cmd python3 || pkgs+=(python3)
  need_cmd npm || pkgs+=(npm)
  need_cmd node || pkgs+=(nodejs)
  if [ ${#pkgs[@]} -gt 0 ]; then
    say "${YELLOW}Installing missing packages: ${pkgs[*]}${NC}"
    if need_cmd sudo; then sudo apt-get update && sudo apt-get install -y "${pkgs[@]}"; else apt-get update && apt-get install -y "${pkgs[@]}"; fi
  fi
}

install_macos_deps() {
  if ! need_cmd brew; then
    say "${RED}Homebrew is required on macOS. Install Homebrew first: https://brew.sh${NC}"
    exit 1
  fi
  local pkgs=()
  need_cmd node || pkgs+=(node)
  need_cmd npm || pkgs+=(node)
  need_cmd python3 || pkgs+=(python)
  need_cmd git || pkgs+=(git)
  need_cmd curl || pkgs+=(curl)
  if [ ${#pkgs[@]} -gt 0 ]; then
    brew install "${pkgs[@]}"
  fi
}

ensure_deps() {
  case "$(uname -s)" in
    Linux) install_linux_deps ;;
    Darwin) install_macos_deps ;;
    *) say "${RED}Unsupported OS for install.sh. Use install.ps1 on Windows.${NC}"; exit 1 ;;
  esac
}

setup_env() {
  if [ -f "$CONTROL_PLANE_DIR/.env.example" ] && [ ! -f "$CONTROL_PLANE_DIR/.env" ]; then
    cp "$CONTROL_PLANE_DIR/.env.example" "$CONTROL_PLANE_DIR/.env"
    say "${GREEN}Created hosted-control-plane/.env from template${NC}"
  fi
}

install_node_project() {
  if [ -f "$CONTROL_PLANE_DIR/package.json" ]; then
    say "${BLUE}Installing hosted control plane dependencies...${NC}"
    cd "$CONTROL_PLANE_DIR"
    npm install
  fi
}

print_next_steps() {
  say ""
  say "${GREEN}CogniClaw tester bootstrap complete.${NC}"
  say ""
  say "Next steps:"
  say "1. Run doctor:   ./doctor.sh"
  say "2. Review env:   cogniclaw/hosted-control-plane/.env"
  say "3. Start app:    cd cogniclaw/hosted-control-plane && npm run dev"
  say ""
  say "Notes:"
  say "- This tester bundle excludes private memory, secrets, caches, and databases."
  say "- Replace placeholder values in .env before real external integrations."
}

say "${BLUE}== CogniClaw Tester Bootstrap ==${NC}"
ensure_deps
setup_env
install_node_project
print_next_steps
