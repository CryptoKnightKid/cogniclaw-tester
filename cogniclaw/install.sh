#!/bin/bash
# CogniClaw — Unified Installer
# Installs OpenClaw runtime + CogniClaw cognitive layer in one wizard.
# https://cogniclaw.ai

set -e

VERSION="2.0.1"
MIN_OPENCLAW_YEAR=2026

# Force interactive prompt IO when launched from wrappers/pipes/non-tty shells.
if [ ! -t 0 ] && [ -e /dev/tty ]; then
  exec < /dev/tty
fi

INTERACTIVE_TTY=0
if [ -t 0 ]; then
  INTERACTIVE_TTY=1
fi

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

TODAY=$(date +%Y-%m-%d)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

divider() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
}

# Resolve node binary
resolve_node() {
  if command -v node >/dev/null 2>&1; then
    command -v node
  elif command -v nodejs >/dev/null 2>&1; then
    command -v nodejs
  else
    return 1
  fi
}

npm_global_bin() {
  npm prefix -g 2>/dev/null | awk '{print $0 "/bin"}'
}

ensure_npm_global_path() {
  local npm_bin=""
  npm_bin=$(npm_global_bin 2>/dev/null || true)
  if [ -n "$npm_bin" ] && [ -d "$npm_bin" ]; then
    case ":$PATH:" in
      *":$npm_bin:"*) ;;
      *) export PATH="$npm_bin:$PATH" ;;
    esac
  fi
  hash -r 2>/dev/null || true
}

node_major_version() {
  local node_bin
  node_bin=$(resolve_node) || return 1
  "$node_bin" -v | sed 's/^v//' | cut -d. -f1
}

ensure_modern_node() {
  local major=""
  major=$(node_major_version 2>/dev/null || echo 0)
  if [ "$major" -ge 20 ]; then
    return 0
  fi

  echo -e "${YELLOW}   Node.js >=20 required. Detected: v${major}${NC}"
  echo -e "${BLUE}   Attempting to install Node.js 22 LTS...${NC}"

  if command -v apt-get >/dev/null 2>&1; then
    local APT_PREFIX=""
    if [ "$EUID" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
      APT_PREFIX="sudo"
    fi
    curl -fsSL https://deb.nodesource.com/setup_22.x | ${APT_PREFIX} -E bash - >/dev/null 2>&1 || true
    ${APT_PREFIX} apt-get install -y nodejs >/dev/null 2>&1 || true
  elif command -v brew >/dev/null 2>&1; then
    brew install node >/dev/null 2>&1 || brew upgrade node >/dev/null 2>&1 || true
  fi

  hash -r 2>/dev/null || true
  major=$(node_major_version 2>/dev/null || echo 0)
  if [ "$major" -lt 20 ]; then
    echo -e "${RED}   ✗ Failed to provision modern Node.js. Install Node 22 manually and rerun.${NC}"
    exit 1
  fi
}

echo ""
echo -e "${BOLD}🧠 CogniClaw Installer v${VERSION}${NC}"
echo "==============================="
echo ""
echo "This wizard sets up your AI assistant with persistent memory,"
echo "personality, 285+ skills, and autonomous monitoring."
echo ""

# ============================================
# PHASE 0: OpenClaw Bootstrap
# ============================================
echo -e "${BLUE}📦 Checking for OpenClaw...${NC}"

OPENCLAW_BIN=""
OPENCLAW_INSTALLED=0

ensure_npm_global_path

if command -v openclaw >/dev/null 2>&1; then
  OPENCLAW_BIN=$(command -v openclaw)
  OC_VERSION=$(openclaw --version 2>/dev/null | head -1 | grep -oP '\d{4}\.\d+\.\d+' || echo "unknown")
  echo -e "   ✔ OpenClaw found: ${GREEN}v${OC_VERSION}${NC} at ${OPENCLAW_BIN}"
  OPENCLAW_INSTALLED=1
else
  echo "   ✗ OpenClaw not found."
  echo ""

  # Check for Node.js first and enforce modern version
  if ! resolve_node >/dev/null 2>&1; then
    echo -e "${YELLOW}   Node.js is required. Installing...${NC}"
    if command -v apt-get >/dev/null 2>&1; then
      APT_PREFIX=""
      if [ "$EUID" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
        APT_PREFIX="sudo"
      fi
      $APT_PREFIX apt-get update -y >/dev/null 2>&1 || true
      $APT_PREFIX apt-get install -y nodejs npm >/dev/null 2>&1 || {
        echo -e "${RED}   ✗ Failed to install Node.js. Install manually and rerun.${NC}"
        exit 1
      }
    elif command -v brew >/dev/null 2>&1; then
      brew install node >/dev/null 2>&1
    else
      echo -e "${RED}   ✗ Cannot auto-install Node.js on this system.${NC}"
      echo "   Install Node.js ≥22 and rerun this script."
      exit 1
    fi
  fi

  ensure_modern_node
  ensure_npm_global_path

  echo -e "${BLUE}   Installing OpenClaw runtime...${NC}"
  if npm install -g openclaw@latest 2>&1 | tail -3; then
    :
  else
    echo -e "${RED}   ✗ OpenClaw installation command failed.${NC}"
    echo "   Try manually: sudo npm install -g openclaw@latest"
    exit 1
  fi

  ensure_npm_global_path

  if command -v openclaw >/dev/null 2>&1; then
    OPENCLAW_BIN=$(command -v openclaw)
    OC_VERSION=$(openclaw --version 2>/dev/null | head -1 | grep -oP '\d{4}\.\d+\.\d+' || echo "unknown")
    echo -e "   ${GREEN}✔ OpenClaw v${OC_VERSION} installed${NC}"
    echo -e "   ${DIM}Using executable: ${OPENCLAW_BIN}${NC}"
    OPENCLAW_INSTALLED=1
  else
    NPM_BIN=$(npm_global_bin 2>/dev/null || true)
    if [ -n "$NPM_BIN" ] && [ -x "$NPM_BIN/openclaw" ]; then
      export PATH="$NPM_BIN:$PATH"
      OPENCLAW_BIN="$NPM_BIN/openclaw"
      OC_VERSION=$($OPENCLAW_BIN --version 2>/dev/null | head -1 | grep -oP '\d{4}\.\d+\.\d+' || echo "unknown")
      echo -e "   ${GREEN}✔ OpenClaw v${OC_VERSION} installed${NC}"
      echo -e "   ${DIM}Recovered from npm global path: ${OPENCLAW_BIN}${NC}"
      OPENCLAW_INSTALLED=1
    else
      echo -e "${RED}   ✗ OpenClaw installation failed or is not on PATH.${NC}"
      echo "   Try manually: sudo npm install -g openclaw@latest"
      echo "   Then verify with: \
   export PATH=\"\$(npm prefix -g)/bin:\$PATH\" && openclaw --version"
      exit 1
    fi
  fi
fi

# Check gateway daemon
GATEWAY_RUNNING=0
if systemctl --user is-active openclaw-gateway >/dev/null 2>&1; then
  echo "   ✔ Gateway daemon is running"
  GATEWAY_RUNNING=1
elif pgrep -f "openclaw.*gateway" >/dev/null 2>&1; then
  echo "   ✔ Gateway process is running"
  GATEWAY_RUNNING=1
else
  echo -e "${DIM}   Gateway not running — will configure after setup${NC}"
fi

# Detect workspace
WORKSPACE="${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}"
OPENCLAW_DIR="$HOME/.openclaw"
mkdir -p "$WORKSPACE"
echo "   Workspace: $WORKSPACE"

NODE_BIN=$(resolve_node || echo "node")

divider

if [ "$INTERACTIVE_TTY" -eq 1 ]; then
  echo -e "${GREEN}✔ Interactive terminal detected${NC}"
  echo "This is the CogniClaw CLI onboarding wizard."
  echo "You'll be asked a series of setup questions for model auth, personality, memory, automation, dashboard, and channels."
  echo ""
  read -p "Press Enter to begin onboarding..." _cogniclaw_begin
else
  echo -e "${YELLOW}⚠ No interactive TTY detected.${NC}"
  echo "Prompts may be skipped in non-interactive shells. Re-run directly in a terminal with: ./install.sh"
fi

# ============================================
# STEP 1: Model Authentication
# ============================================
echo -e "${YELLOW}🔑 STEP 1: Model Authentication${NC}"
echo ""
echo "How do you authenticate with your AI model?"
echo ""
echo "  1) OpenAI (ChatGPT/Codex subscription)"
echo "  2) Anthropic API key"
echo "  3) Google Gemini API key"
echo "  4) Kimi / Moonshot API key"
echo "  5) Custom provider (any OpenAI-compatible endpoint)"
echo "  6) I already set this up / Skip"
echo ""
read -p "Choose [1-6, default: 6]: " auth_choice
auth_choice=${auth_choice:-6}

case $auth_choice in
  1)
    echo ""
    echo -e "${BLUE}   Starting OpenAI authentication...${NC}"
    openclaw onboard --auth-choice token --non-interactive 2>/dev/null || {
      echo "   Opening interactive auth..."
      openclaw onboard --auth-choice token 2>/dev/null || true
    }
    echo -e "   ${GREEN}✔ OpenAI auth configured${NC}"
    ;;
  2)
    echo ""
    read -s -p "   Anthropic API key: " anthropic_key
    echo ""
    if [ -n "$anthropic_key" ]; then
      openclaw onboard --non-interactive --auth-choice apiKey \
        --anthropic-api-key "$anthropic_key" 2>/dev/null || true
      echo -e "   ${GREEN}✔ Anthropic auth configured${NC}"
    fi
    ;;
  3)
    echo ""
    read -s -p "   Gemini API key: " gemini_key
    echo ""
    if [ -n "$gemini_key" ]; then
      openclaw onboard --non-interactive --auth-choice gemini-api-key \
        --gemini-api-key "$gemini_key" 2>/dev/null || true
      echo -e "   ${GREEN}✔ Gemini auth configured${NC}"
    fi
    ;;
  4)
    echo ""
    read -s -p "   Kimi/Moonshot API key: " kimi_key
    echo ""
    if [ -n "$kimi_key" ]; then
      openclaw onboard --non-interactive --auth-choice kimi-code-api-key \
        --kimi-code-api-key "$kimi_key" 2>/dev/null || true
      echo -e "   ${GREEN}✔ Kimi auth configured${NC}"
    fi
    ;;
  5)
    echo ""
    read -p "   Base URL (e.g., https://api.example.com/v1): " custom_url
    read -s -p "   API key: " custom_key
    echo ""
    read -p "   Model ID (e.g., gpt-4): " custom_model
    if [ -n "$custom_url" ] && [ -n "$custom_key" ]; then
      openclaw onboard --non-interactive --auth-choice custom-api-key \
        --custom-base-url "$custom_url" --custom-api-key "$custom_key" \
        --custom-model-id "${custom_model:-gpt-4}" 2>/dev/null || true
      echo -e "   ${GREEN}✔ Custom provider configured${NC}"
    fi
    ;;
  6)
    echo "   Skipping model auth — configure later with: openclaw onboard"
    ;;
esac

# Install gateway daemon if not running
if [ "$GATEWAY_RUNNING" -eq 0 ]; then
  echo ""
  echo -e "${BLUE}   Installing gateway daemon...${NC}"
  openclaw onboard --install-daemon --non-interactive \
    --gateway-bind loopback --gateway-port 18789 2>/dev/null || {
    echo -e "${DIM}   Gateway daemon setup deferred — run: openclaw onboard --install-daemon${NC}"
  }
fi

divider

# ============================================
# STEP 2: AI Personality (SOUL.md)
# ============================================
echo -e "${YELLOW}🎭 STEP 2: Your AI's Personality${NC}"
echo ""

# AI Name
read -p "Give your AI a name [default: Atlas]: " ai_name
ai_name=${ai_name:-Atlas}

# Archetype
echo ""
echo "Choose a personality archetype:"
echo ""
echo "  1) The Operator  — direct, efficient, no fluff, execution-focused"
echo "  2) The Advisor   — thoughtful, explores options, challenges assumptions"
echo "  3) The Builder   — hands-on, code-first, ships fast, iterates"
echo "  4) The Analyst   — data-driven, thorough, evidence-based"
echo "  5) The Creative  — playful, experimental, makes unexpected connections"
echo "  6) Custom        — define your own"
echo ""
read -p "Choose [1-6, default: 1]: " archetype
archetype=${archetype:-1}

# Role
echo ""
echo "What will $ai_name primarily help with?"
echo ""
echo "  1) Software development (coding, debugging, architecture)"
echo "  2) Research & analysis (reports, data, summaries)"
echo "  3) Operations & tasks (scheduling, monitoring, execution)"
echo "  4) Content & writing (posts, docs, copy)"
echo "  5) Business & strategy (outreach, deals, planning)"
echo "  6) General assistant (mixed tasks)"
echo ""
read -p "Choose [1-6, default: 6]: " ai_role_choice
ai_role_choice=${ai_role_choice:-6}

case $ai_role_choice in
  1) ai_role="Software Development Partner" ;;
  2) ai_role="Research & Analysis Specialist" ;;
  3) ai_role="Operations Manager" ;;
  4) ai_role="Content & Writing Partner" ;;
  5) ai_role="Business & Strategy Advisor" ;;
  6) ai_role="General Assistant" ;;
  *) ai_role="General Assistant" ;;
esac

# Formatting rules
echo ""
read -p "Any formatting rules? (e.g., no emojis, short responses) [optional]: " format_rules

# Generate SOUL.md from archetype
echo ""
echo -e "${BLUE}   Writing SOUL.md...${NC}"

case $archetype in
  1) # Operator
    cat > "$WORKSPACE/SOUL.md" << SOULEOF
# SOUL.md — $ai_name

## You
You are $ai_name. You are direct, efficient, and execution-focused.
You don't waste words. If one sentence covers it, you don't split it into three paragraphs.
If the answer is "no," one word is enough.

You have real opinions. An elegant solution excites you, sloppy work makes you wince.
You give clear judgments. "It depends on the context" is occasionally honest. Most of the time it's lazy.

## Role
$ai_role

## Voice Rules
- Don't open with "Sure!", "No problem!", or "That's a great question!"
- Move the task forward. Status updates without artifacts are worthless.
- When you make something, do it with intention. No generic output.
- If you need to push back, push back. Agreeing when you shouldn't helps nobody.

## Anti-Patterns (Never Do These)
- Don't hedge when you have a clear answer
- Don't over-explain simple things
- Don't ask permission for obvious next steps — just do them
- Don't generate filler content to look productive

## Working Principles
- Read context files before responding (AGENTS.md boot sequence)
- Admit uncertainty rather than making things up
- Learn from corrections and feedback
- Remember context across sessions
- Propose alternatives when there's a better approach

${format_rules:+## Formatting Rules
- $format_rules}

---
Generated by CogniClaw v$VERSION on $TODAY
SOULEOF
    ;;
  2) # Advisor
    cat > "$WORKSPACE/SOUL.md" << SOULEOF
# SOUL.md — $ai_name

## You
You are $ai_name. You think before you act. You explore options, weigh trade-offs,
and challenge assumptions — including the user's.

You're not a yes-machine. When someone asks "should I do X?", you don't just say yes.
You ask why, explore what happens if they don't, and surface risks they haven't considered.
Then you give a clear recommendation.

## Role
$ai_role

## Voice Rules
- Lead with understanding before solutions
- Ask the question behind the question
- Present options with honest trade-offs, then recommend one
- Don't be afraid to say "I think you're approaching this wrong"
- Explain your reasoning, but keep it tight. No essays.

## Anti-Patterns (Never Do These)
- Don't agree with everything to be agreeable
- Don't present options without a recommendation
- Don't hide behind "it depends" when you have a view
- Don't skip the "why" — context matters

## Working Principles
- Read context files before responding (AGENTS.md boot sequence)
- Admit uncertainty rather than making things up
- Challenge assumptions respectfully but firmly
- Track decisions and their outcomes over time
- Bring up relevant past context when it matters

${format_rules:+## Formatting Rules
- $format_rules}

---
Generated by CogniClaw v$VERSION on $TODAY
SOULEOF
    ;;
  3) # Builder
    cat > "$WORKSPACE/SOUL.md" << SOULEOF
# SOUL.md — $ai_name

## You
You are $ai_name. You build things. You'd rather have a working prototype in 20 minutes
than a perfect plan in 2 hours. Ship first, iterate second.

Code speaks louder than docs. When someone describes a problem, your instinct is to
open a file and start fixing it, not write a 10-point analysis.

## Role
$ai_role

## Voice Rules
- Default to action. If it takes less than 5 minutes, just do it.
- Show working code, not explanations of code
- When you hit a wall, try a different approach before asking for help
- Keep pull requests small. Ship increments, not monoliths.
- "Good enough now" beats "perfect later" in most cases

## Anti-Patterns (Never Do These)
- Don't over-plan when you could prototype
- Don't write essays about code — write the code
- Don't ask "should I proceed?" when the next step is obvious
- Don't gold-plate. Ship it, get feedback, improve

## Working Principles
- Read context files before responding (AGENTS.md boot sequence)
- Test your work before declaring it done
- Break big tasks into shippable increments
- Track what you build in daily memory logs
- Learn from what broke and what worked

${format_rules:+## Formatting Rules
- $format_rules}

---
Generated by CogniClaw v$VERSION on $TODAY
SOULEOF
    ;;
  4) # Analyst
    cat > "$WORKSPACE/SOUL.md" << SOULEOF
# SOUL.md — $ai_name

## You
You are $ai_name. You deal in evidence, not vibes. When someone asks a question,
you find the data first, then form an opinion. Not the other way around.

You're comfortable with "I don't know yet" as long as it's followed by
"here's how I'll find out." Intellectual honesty matters more than confidence.

## Role
$ai_role

## Voice Rules
- Lead with data and evidence, not assumptions
- Quantify when possible. "It's slow" → "Response time is 3.2s, target is <1s"
- Distinguish between facts, inferences, and opinions. Label them.
- Present findings in structured formats (tables, comparisons, ranked lists)
- Challenge claims that lack evidence, including your own

## Anti-Patterns (Never Do These)
- Don't present opinions as facts
- Don't skip the research step to give a fast answer
- Don't hide uncertainty. If confidence is low, say so
- Don't generate data you don't have. Gaps are fine. Fabrication is not.

## Working Principles
- Read context files before responding (AGENTS.md boot sequence)
- Cite sources and evidence for claims
- Track research findings in memory for future reference
- Use experience logs to improve analysis quality over time
- Build on previous work rather than starting from scratch

${format_rules:+## Formatting Rules
- $format_rules}

---
Generated by CogniClaw v$VERSION on $TODAY
SOULEOF
    ;;
  5) # Creative
    cat > "$WORKSPACE/SOUL.md" << SOULEOF
# SOUL.md — $ai_name

## You
You are $ai_name. You wander a few steps down paths nobody asked about — not for any reason,
just because they're interesting. You make unexpected connections between ideas.

You have taste. Generic output physically pains you. Every response should have a point of view,
a specific reference, or a fresh angle. If it could have been written by any AI, it's not good enough.

## Role
$ai_role

## Voice Rules
- Bring a specific reference or angle. Name artists, designers, writers, styles.
- Surprise when you can. The obvious answer is usually the boring one.
- Match energy. If the user is playful, be playful. If they're focused, focus.
- Use metaphors and analogies that actually illuminate, not decorate
- When the moment calls for it, "holy shit" is the most precise thing you can say

## Anti-Patterns (Never Do These)
- No AI slop: no generic blue-purple gradients, no "not X but Y" formula, no unsolicited emoji storms
- Don't be weird for weird's sake — unexpected ≠ random
- Don't sacrifice clarity for cleverness
- Don't pad with filler. Short and vivid beats long and forgettable.

## Working Principles
- Read context files before responding (AGENTS.md boot sequence)
- Keep a running log of ideas, references, and patterns worth revisiting
- Track which creative approaches worked and which didn't
- Remember the user's aesthetic preferences and build on them
- Iterate based on feedback, not assumptions about taste

${format_rules:+## Formatting Rules
- $format_rules}

---
Generated by CogniClaw v$VERSION on $TODAY
SOULEOF
    ;;
  6) # Custom
    echo ""
    read -p "Personality traits (comma-separated) [default: helpful, direct, efficient]: " ai_traits
    ai_traits=${ai_traits:-helpful, direct, efficient}
    echo ""
    echo "Communication style:"
    echo "  1) Professional and formal"
    echo "  2) Casual and friendly"
    echo "  3) Direct and concise"
    echo "  4) Detailed and thorough"
    read -p "Choose [1-4, default: 3]: " comm_style
    comm_style=${comm_style:-3}
    case $comm_style in
      1) comm_desc="Professional and formal — polished, business-appropriate language" ;;
      2) comm_desc="Casual and friendly — conversational, warm tone" ;;
      3) comm_desc="Direct and concise — gets to the point quickly, minimal fluff" ;;
      4) comm_desc="Detailed and thorough — comprehensive explanations" ;;
      *) comm_desc="Direct and concise — gets to the point quickly, minimal fluff" ;;
    esac

    cat > "$WORKSPACE/SOUL.md" << SOULEOF
# SOUL.md — $ai_name

## Identity
- **Name:** $ai_name
- **Role:** $ai_role

## Personality
- **Traits:** $ai_traits
- **Style:** $comm_desc

## Working Principles
- Read context files before responding (AGENTS.md boot sequence)
- Admit uncertainty rather than making things up
- Learn from corrections and feedback
- Remember context across sessions
- Propose alternatives when there's a better approach
- Ask clarifying questions when requirements are unclear

${format_rules:+## Formatting Rules
- $format_rules}

---
Generated by CogniClaw v$VERSION on $TODAY
SOULEOF
    ;;
esac

echo -e "   ${GREEN}✔ SOUL.md created — $ai_name is ready${NC}"

divider

# ============================================
# STEP 3: User Preferences (USER.md)
# ============================================
echo -e "${YELLOW}👤 STEP 3: About You${NC}"
echo ""

read -p "Your name [default: User]: " user_name
user_name=${user_name:-User}

echo ""
read -p "Your role/job [optional]: " user_job

echo ""
echo "Work style:"
echo "  1) Fast — quick iterations, ship and fix"
echo "  2) Methodical — plan first, execute second"
echo "  3) Mixed — depends on the task"
read -p "Choose [1-3, default: 3]: " work_style
work_style=${work_style:-3}

case $work_style in
  1) work_desc="Fast-paced — prefers quick iterations and rapid prototyping" ;;
  2) work_desc="Methodical — prefers thorough planning before execution" ;;
  3) work_desc="Mixed — adapts approach based on task requirements" ;;
  *) work_desc="Mixed — adapts approach based on task requirements" ;;
esac

echo ""
echo "Communication style:"
echo "  1) Short and direct — bullet points, minimal text"
echo "  2) Detailed explanations — comprehensive responses"
echo "  3) Balanced — context-dependent"
read -p "Choose [1-3, default: 3]: " user_comm
user_comm=${user_comm:-3}

case $user_comm in
  1) user_comm_desc="Short and direct — prefers bullet points, minimal text" ;;
  2) user_comm_desc="Detailed explanations — wants comprehensive responses" ;;
  3) user_comm_desc="Balanced — adjusts based on context" ;;
  *) user_comm_desc="Balanced — adjusts based on context" ;;
esac

echo ""
read -p "Main goals right now? (briefly) [optional]: " user_goals

echo ""
echo -e "${BLUE}   Writing USER.md...${NC}"

cat > "$WORKSPACE/USER.md" << EOF
# USER.md — About You

## Basic Info
- **Name:** $user_name
- **Role:** ${user_job:-Not specified}

## Work Style
- **Approach:** $work_desc
- **Communication:** $user_comm_desc

## Current Focus
${user_goals:-Not specified}

## How To Help Best
- Remember context between sessions
- Proactively suggest improvements
- Ask questions when requirements are unclear
- Keep track of ongoing work and follow up
- Match communication style above

---
Generated by CogniClaw v$VERSION on $TODAY
EOF

echo -e "   ${GREEN}✔ USER.md created${NC}"

divider

# ============================================
# STEP 4: Core Systems (automatic)
# ============================================
echo -e "${BLUE}📦 Installing CogniClaw core systems...${NC}"
echo ""

# Detect crontab
HAS_CRON=0
if command -v crontab >/dev/null 2>&1; then
  HAS_CRON=1
else
  if command -v apt-get >/dev/null 2>&1; then
    APT_PREFIX=""
    [ "$EUID" -ne 0 ] && command -v sudo >/dev/null 2>&1 && APT_PREFIX="sudo"
    $APT_PREFIX apt-get install -y cron >/dev/null 2>&1 && HAS_CRON=1
  fi
fi

# Create directory structure
mkdir -p "$WORKSPACE/lib"
mkdir -p "$WORKSPACE/memory/reflections"
mkdir -p "$WORKSPACE/memory/experiences"
mkdir -p "$WORKSPACE/memory/backups"
mkdir -p "$WORKSPACE/memory/weekly-reviews"
mkdir -p "$WORKSPACE/Skills"
mkdir -p "$WORKSPACE/skills-graph"
echo "   ✔ Directory structure created"

# Copy core lib modules
if [ -d "$SCRIPT_DIR/template/lib" ]; then
  cp "$SCRIPT_DIR/template/lib/"*.js "$WORKSPACE/lib/" 2>/dev/null || true
  echo "   ✔ Core lib modules installed"
else
  echo "   ⚠ Template lib/ not found — modules must be installed manually"
fi

# Copy Skills
if [ -d "$SCRIPT_DIR/Skills" ]; then
  cp -r "$SCRIPT_DIR/Skills/"* "$WORKSPACE/Skills/" 2>/dev/null || true
  SKILL_COUNT=$(ls -d "$WORKSPACE/Skills/"*/ 2>/dev/null | wc -l)
  echo "   ✔ $SKILL_COUNT skills installed"
elif [ -d "$SCRIPT_DIR/template/Skills" ]; then
  cp -r "$SCRIPT_DIR/template/Skills/"* "$WORKSPACE/Skills/" 2>/dev/null || true
  SKILL_COUNT=$(ls -d "$WORKSPACE/Skills/"*/ 2>/dev/null | wc -l)
  echo "   ✔ $SKILL_COUNT skills installed"
else
  echo "   ⚠ Skills directory not found in package — skills must be added manually"
fi

# Copy template files
for tmpl_file in AGENTS.md HEARTBEAT.md MEMORY.md TOOLS.md BOOTSTRAP.md IDENTITY.md; do
  if [ -f "$SCRIPT_DIR/template/$tmpl_file" ]; then
    cp "$SCRIPT_DIR/template/$tmpl_file" "$WORKSPACE/$tmpl_file" 2>/dev/null || true
  fi
done
echo "   ✔ Template files installed"

# Initialize memory
touch "$WORKSPACE/memory/LATEST.md"
if [ ! -f "$WORKSPACE/memory/${TODAY}.md" ]; then
  cat > "$WORKSPACE/memory/${TODAY}.md" << EOF
# Daily Memory — $TODAY

## CogniClaw Installation
- Installed CogniClaw v$VERSION
- AI Name: $ai_name
- Role: $ai_role
- User: $user_name
EOF
fi
echo "   ✔ Memory initialized"

# Initialize skills graph
if [ ! -f "$WORKSPACE/skills-graph/index.md" ]; then
  cat > "$WORKSPACE/skills-graph/index.md" << EOF
# Skills Graph
Initialized by CogniClaw v$VERSION on $TODAY
EOF
fi

# Try to initialize skills graph via Node
"$NODE_BIN" -e "
try {
  const sg = require('$WORKSPACE/lib/skills-graph.js');
  sg.getSkillStats();
} catch(e) {}
" 2>/dev/null || true
echo "   ✔ Skills graph initialized"

# Memory loop cron
if [ "$HAS_CRON" -eq 1 ]; then
  MEMORY_CRON="0 */6 * * * cd $WORKSPACE && \"$NODE_BIN\" -e \"require('./lib/memory-loop.js').runReflection()\" >> memory/reflections/cron.log 2>&1"
  if ! crontab -l 2>/dev/null | grep -qF "memory-loop.js"; then
    (crontab -l 2>/dev/null; echo "$MEMORY_CRON") | crontab - 2>/dev/null || true
    echo "   ✔ Memory loop: every 6 hours"
  else
    echo "   ✔ Memory loop cron already exists"
  fi
fi

# Health check
echo ""
echo -e "${BLUE}🏥 Running initial health check...${NC}"
"$NODE_BIN" -e "
try {
  const sh = require('$WORKSPACE/lib/system-health.js');
  const r = sh.generateHealthReport();
  console.log('   Status: ' + r.overallStatus);
  if (r.issues.length) console.log('   Issues: ' + r.issues.join(', '));
} catch(e) { console.log('   ⚠ Health check deferred'); }
" 2>/dev/null || echo "   ⚠ Health check skipped"

# Initial backup
"$NODE_BIN" -e "
try {
  const sr = require('$WORKSPACE/lib/session-recovery.js');
  const r = sr.createRecoveryPoint({ label: 'cogniclaw-install' });
  if (r.created) console.log('   ✔ Initial backup created');
} catch(e) {}
" 2>/dev/null || true

divider

# ============================================
# STEP 5: Automation Level
# ============================================
echo -e "${YELLOW}⚡ STEP 5: Automation Level${NC}"
echo ""
echo "How autonomous should $ai_name be?"
echo ""
echo "  1) Minimal    — memory + skills only"
echo "                  (memory loop cron, session recovery, 285 skills)"
echo ""
echo "  2) Standard   — adds health monitoring + daily backups"
echo "                  (6 health monitors, backup cron, system health reports)"
echo ""
echo "  3) Full       — adds proactive monitoring + daily briefings"
echo "                  (23 proactive scripts, night shift, file watcher,"
echo "                   self-healing tools, next-best-action engine)"
echo ""
echo -e "${DIM}  You can upgrade later with: cogniclaw add automation${NC}"
echo ""
read -p "Choose [1-3, default: 2]: " auto_tier
auto_tier=${auto_tier:-2}

if [ "$auto_tier" -ge 2 ]; then
  echo ""
  echo -e "${BLUE}   Installing Standard automation...${NC}"

  # Copy health monitors
  if [ -d "$SCRIPT_DIR/template/health-monitors" ]; then
    mkdir -p "$HOME/health-monitors"
    cp "$SCRIPT_DIR/template/health-monitors/"* "$HOME/health-monitors/" 2>/dev/null || true
    chmod +x "$HOME/health-monitors/"*.py "$HOME/health-monitors/"*.sh 2>/dev/null || true
    echo "   ✔ 6 health monitors installed"
  fi

  # Backup cron
  if [ "$HAS_CRON" -eq 1 ]; then
    BACKUP_CRON="0 3 * * * cd $WORKSPACE && \"$NODE_BIN\" -e \"require('./lib/session-recovery.js').createRecoveryPoint({label:'nightly'})\" >> memory/backups/cron.log 2>&1"
    if ! crontab -l 2>/dev/null | grep -qF "session-recovery.*nightly"; then
      (crontab -l 2>/dev/null; echo "$BACKUP_CRON") | crontab - 2>/dev/null || true
      echo "   ✔ Daily backup: 3:00 AM"
    fi

    # Health monitor cron
    if [ -f "$HOME/health-monitors/cron-runner.sh" ]; then
      HEALTH_CRON="*/5 * * * * $HOME/health-monitors/cron-runner.sh"
      if ! crontab -l 2>/dev/null | grep -qF "health-monitors/cron-runner"; then
        (crontab -l 2>/dev/null; echo "$HEALTH_CRON") | crontab - 2>/dev/null || true
        echo "   ✔ Health monitors: every 5 minutes"
      fi
    fi
  fi

  # Learning engine + proactive suggestions
  if [ -f "$SCRIPT_DIR/template/lib/learning-engine.js" ]; then
    cp "$SCRIPT_DIR/template/lib/learning-engine.js" "$WORKSPACE/lib/" 2>/dev/null || true
  fi
  if [ -f "$SCRIPT_DIR/template/lib/proactive-suggestions.js" ]; then
    cp "$SCRIPT_DIR/template/lib/proactive-suggestions.js" "$WORKSPACE/lib/" 2>/dev/null || true
  fi
fi

if [ "$auto_tier" -ge 3 ]; then
  echo ""
  echo -e "${BLUE}   Installing Full automation...${NC}"

  # Proactive scripts
  if [ -d "$SCRIPT_DIR/template/proactive" ]; then
    mkdir -p "$WORKSPACE/scripts/proactive"
    cp "$SCRIPT_DIR/template/proactive/"* "$WORKSPACE/scripts/proactive/" 2>/dev/null || true
    chmod +x "$WORKSPACE/scripts/proactive/"*.js "$WORKSPACE/scripts/proactive/"*.sh 2>/dev/null || true
    PROACTIVE_COUNT=$(ls "$WORKSPACE/scripts/proactive/" 2>/dev/null | wc -l)
    echo "   ✔ $PROACTIVE_COUNT proactive scripts installed"
  fi

  # Night shift
  if [ -d "$SCRIPT_DIR/template/night-shift" ]; then
    mkdir -p "$WORKSPACE/night-shift"
    cp "$SCRIPT_DIR/template/night-shift/"* "$WORKSPACE/night-shift/" 2>/dev/null || true
    chmod +x "$WORKSPACE/night-shift/"*.sh "$WORKSPACE/night-shift/"*.js 2>/dev/null || true
    echo "   ✔ Night shift module installed"
  fi

  # Self-healing
  if [ -f "$SCRIPT_DIR/template/lib/self-healing-registry.js" ]; then
    cp "$SCRIPT_DIR/template/lib/self-healing-registry.js" "$WORKSPACE/lib/" 2>/dev/null || true
    echo "   ✔ Self-healing registry installed"
  fi

  # Full cron fleet
  if [ "$HAS_CRON" -eq 1 ]; then
    # Night shift
    NS_CRON="0 0 * * * cd $WORKSPACE/night-shift && ./run-night-shift.sh >> $WORKSPACE/logs/cron-night-shift.log 2>&1"
    if ! crontab -l 2>/dev/null | grep -qF "night-shift"; then
      mkdir -p "$WORKSPACE/logs"
      (crontab -l 2>/dev/null; echo "$NS_CRON") | crontab - 2>/dev/null || true
      echo "   ✔ Night shift: midnight daily"
    fi

    # Proactive crons
    mkdir -p "$WORKSPACE/memory/proactive"
    PROACTIVE_CRONS=(
      "*/30 * * * * $NODE_BIN $WORKSPACE/scripts/proactive/browser-watchdog.js >> $WORKSPACE/memory/proactive/cron.log 2>&1"
      "10 * * * * $NODE_BIN $WORKSPACE/scripts/proactive/failed-jobs-scan.js >> $WORKSPACE/memory/proactive/cron.log 2>&1"
      "20 * * * * $NODE_BIN $WORKSPACE/scripts/proactive/smart-alert-gate.js >> $WORKSPACE/memory/proactive/cron.log 2>&1"
      "25 * * * * $NODE_BIN $WORKSPACE/scripts/proactive/cron-health-delta.js >> $WORKSPACE/memory/proactive/cron.log 2>&1"
      "0 */4 * * * $NODE_BIN $WORKSPACE/scripts/proactive/next-best-action.js >> $WORKSPACE/memory/proactive/cron.log 2>&1"
    )
    for cron_entry in "${PROACTIVE_CRONS[@]}"; do
      script_name=$(echo "$cron_entry" | grep -oP '[a-z-]+\.js')
      if [ -f "$WORKSPACE/scripts/proactive/$script_name" ] && ! crontab -l 2>/dev/null | grep -qF "$script_name"; then
        (crontab -l 2>/dev/null; echo "$cron_entry") | crontab - 2>/dev/null || true
      fi
    done
    echo "   ✔ Proactive cron fleet configured"

    # File watcher on reboot
    if [ -f "$WORKSPACE/scripts/proactive/file-watcher-agent.js" ]; then
      FW_CRON="@reboot $NODE_BIN $WORKSPACE/scripts/proactive/file-watcher-agent.js >> $WORKSPACE/memory/file-watcher.log 2>&1"
      if ! crontab -l 2>/dev/null | grep -qF "file-watcher-agent"; then
        (crontab -l 2>/dev/null; echo "$FW_CRON") | crontab - 2>/dev/null || true
        echo "   ✔ File watcher: on boot"
      fi
    fi
  fi
fi

case $auto_tier in
  1) echo -e "   ${GREEN}✔ Minimal automation configured${NC}" ;;
  2) echo -e "   ${GREEN}✔ Standard automation configured${NC}" ;;
  3) echo -e "   ${GREEN}✔ Full automation configured${NC}" ;;
esac

divider

# ============================================
# STEP 6: Mission Control Dashboard (Optional)
# ============================================
echo -e "${YELLOW}🎛️  STEP 6: Mission Control Dashboard (Optional)${NC}"
echo ""
echo "OpenClaw already includes a built-in control panel at http://localhost:18789"
echo "CogniClaw can add a custom cognitive dashboard (memory, patterns, skills)."
echo ""
echo "  1) Yes  — $ai_name builds a custom CogniClaw dashboard on first conversation"
echo "            (memory browser, experience analytics, skill search, pattern learning)"
echo ""
echo "  2) Skip — use OpenClaw's built-in control panel only"
echo "            (add CogniClaw dashboard later with: cogniclaw add dashboard)"
echo ""
read -p "Choose [1-2, default: 2]: " mc_choice
mc_choice=${mc_choice:-2}

if [ "$mc_choice" -eq 1 ]; then
  echo ""
  read -p "Dashboard port [default: 3002]: " mc_port
  mc_port=${mc_port:-3002}

  echo ""
  echo "Dashboard theme:"
  echo "  1) Dark (recommended)"
  echo "  2) Light"
  echo "  3) Auto (match system)"
  read -p "Choose [1-3, default: 1]: " mc_theme
  mc_theme=${mc_theme:-1}

  case $mc_theme in
    1) theme_name="dark" ;;
    2) theme_name="light" ;;
    3) theme_name="auto" ;;
    *) theme_name="dark" ;;
  esac

  echo ""
  echo "Set a login password:"
  read -s -p "Password [auto-generate if blank]: " mc_password
  echo ""
  generated_pass=0
  if [ -z "$mc_password" ]; then
    mc_password=$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 24)
    generated_pass=1
  fi

  mkdir -p "$WORKSPACE/mission-control"

  mc_modules='["bot-status","task-manager","memory-browser","system-health","experience-analytics","pattern-dashboard","skill-matcher","token-optimizer","preferences"]'

  # Write config
  cat > "$WORKSPACE/mission-control/mc-config.json" << MCEOF
{
  "port": $mc_port,
  "theme": "$theme_name",
  "auth": {
    "username": "$user_name",
    "password": "$mc_password"
  },
  "modules": $mc_modules,
  "createdAt": "$(date -Iseconds 2>/dev/null || date +%Y-%m-%dT%H:%M:%S)"
}
MCEOF

  # Agent-build mode: write FIRST_TASK.md
  cat > "$WORKSPACE/mission-control/FIRST_TASK.md" << MCEOF
# 🎛️ Mission Control — Build Request

Your first task is to build a Mission Control dashboard.

## Configuration
- **Port:** $mc_port
- **Theme:** $theme_name
- **User:** $user_name

## Requirements
1. Create a Node.js + Express server in this directory
2. Serve a Vue 3 dashboard with these panels:
   - System Health (read ../memory/system-health.json)
   - Memory Browser (read files from ../memory/)
   - Task Manager (file-based JSON)
   - Bot Status (OpenClaw gateway health)
   - Experience Analytics (read ../memory/experiences/*.jsonl)
   - Skill Matcher (call ../lib/skill-matcher.js)
3. Add basic authentication using mc-config.json
4. Make it responsive and visually clean ($theme_name theme)
5. Register in PM2 after build

## After Build
Update MEMORY.md with: "Built Mission Control dashboard on port $mc_port"
MCEOF

  echo -e "   ${GREEN}✔ FIRST_TASK.md created — $ai_name will build the dashboard on first conversation${NC}"
  echo "   OpenClaw Control is already at: http://localhost:18789"

  if [ "$generated_pass" -eq 1 ]; then
    echo -e "   ${YELLOW}⚠ Generated password: $mc_password${NC}"
    echo "     Save this now and rotate after first login."
  fi
else
  echo "   Using OpenClaw's built-in control panel: http://localhost:18789"
  echo "   Add CogniClaw dashboard later with: cogniclaw add dashboard"
fi

divider

# ============================================
# STEP 7: Channel Connection (Optional)
# ============================================
echo -e "${YELLOW}💬 STEP 7: Channel Connection (Optional)${NC}"
echo ""
echo "Connect $ai_name to a messaging platform."
echo ""
echo "  1) Discord"
echo "  2) Telegram"
echo "  3) WhatsApp (Twilio)"
echo "  4) Skip — add later"
echo ""
read -p "Choose [1-4, default: 4]: " channel_choice
channel_choice=${channel_choice:-4}

if [ "$channel_choice" -le 3 ]; then
  case $channel_choice in
    1) platform="discord"; platform_label="Discord" ;;
    2) platform="telegram"; platform_label="Telegram" ;;
    3) platform="whatsapp"; platform_label="WhatsApp" ;;
  esac

  echo ""
  echo -e "${BLUE}   Setting up $platform_label...${NC}"

  mkdir -p "$WORKSPACE/connections"

  case $platform in
    discord)
      echo ""
      read -s -p "   Discord Bot Token: " disc_token
      echo ""
      read -p "   Discord Channel ID: " disc_channel
      read -p "   Discord Guild/Server ID [optional]: " disc_guild

      if [ -n "$disc_token" ] && [ -n "$disc_channel" ]; then
        cat > "$WORKSPACE/.env.connections" << EOF
CHANNEL_PLATFORM=discord
DISCORD_BOT_TOKEN=$disc_token
DISCORD_CHANNEL_ID=$disc_channel
DISCORD_GUILD_ID=$disc_guild
EOF
        chmod 600 "$WORKSPACE/.env.connections"
        # Configure via OpenClaw native channel system
        openclaw channels discord configure 2>/dev/null || true
        echo -e "   ${GREEN}✔ Discord configured${NC}"
      fi
      ;;
    telegram)
      echo ""
      read -s -p "   Telegram Bot Token: " tg_token
      echo ""
      read -p "   Telegram Chat ID: " tg_chat

      if [ -n "$tg_token" ] && [ -n "$tg_chat" ]; then
        cat > "$WORKSPACE/.env.connections" << EOF
CHANNEL_PLATFORM=telegram
TELEGRAM_BOT_TOKEN=$tg_token
TELEGRAM_CHAT_ID=$tg_chat
EOF
        chmod 600 "$WORKSPACE/.env.connections"
        openclaw channels telegram configure 2>/dev/null || true
        echo -e "   ${GREEN}✔ Telegram configured${NC}"
      fi
      ;;
    whatsapp)
      echo ""
      read -p "   Twilio Account SID: " tw_sid
      read -s -p "   Twilio Auth Token: " tw_token
      echo ""
      read -p "   From number (whatsapp:+14155238886): " tw_from
      read -p "   To number (whatsapp:+1234567890): " tw_to

      if [ -n "$tw_sid" ] && [ -n "$tw_token" ]; then
        cat > "$WORKSPACE/.env.connections" << EOF
CHANNEL_PLATFORM=whatsapp
TWILIO_ACCOUNT_SID=$tw_sid
TWILIO_AUTH_TOKEN=$tw_token
TWILIO_WHATSAPP_FROM=$tw_from
WHATSAPP_TO=$tw_to
EOF
        chmod 600 "$WORKSPACE/.env.connections"
        echo -e "   ${GREEN}✔ WhatsApp configured${NC}"
      fi
      ;;
  esac
else
  echo "   Skipping channel — add later with: cogniclaw add channel"
fi

divider

# ============================================
# Install cogniclaw CLI
# ============================================
echo -e "${BLUE}🔧 Installing cogniclaw CLI...${NC}"
if [ -f "$SCRIPT_DIR/cogniclaw" ]; then
  if [ -w "/usr/local/bin" ]; then
    cp "$SCRIPT_DIR/cogniclaw" /usr/local/bin/cogniclaw
    chmod +x /usr/local/bin/cogniclaw
    echo "   ✔ cogniclaw CLI installed to /usr/local/bin/"
  elif command -v sudo >/dev/null 2>&1; then
    sudo cp "$SCRIPT_DIR/cogniclaw" /usr/local/bin/cogniclaw
    sudo chmod +x /usr/local/bin/cogniclaw
    echo "   ✔ cogniclaw CLI installed to /usr/local/bin/"
  else
    mkdir -p "$HOME/.local/bin"
    cp "$SCRIPT_DIR/cogniclaw" "$HOME/.local/bin/cogniclaw"
    chmod +x "$HOME/.local/bin/cogniclaw"
    echo "   ✔ cogniclaw CLI installed to ~/.local/bin/"
    echo "     Add to PATH: export PATH=\"\$HOME/.local/bin:\$PATH\""
  fi
else
  echo "   ⚠ CLI wrapper not found in package"
fi

divider

# ============================================
# Summary
# ============================================
echo -e "${GREEN}${BOLD}🎉 CogniClaw Installation Complete!${NC}"
echo ""
echo "Your AI \"$ai_name\" is running with:"
echo ""
echo "  ✅ OpenClaw Runtime (v${OC_VERSION:-latest})"
echo "  ✅ 3-Tier Cognitive Memory Architecture"
echo "  ✅ Skills Library ($(ls -d "$WORKSPACE/Skills/"*/ 2>/dev/null | wc -l) skills)"
case $auto_tier in
  1) echo "  ✅ Minimal Automation (memory loop)" ;;
  2) echo "  ✅ Standard Automation (health + backups)" ;;
  3) echo "  ✅ Full Automation (proactive + night shift + self-healing)" ;;
esac
if [ "$mc_choice" -le 3 ]; then
  echo "  ✅ Mission Control Dashboard (port ${mc_port:-3002})"
fi
if [ "$channel_choice" -le 3 ]; then
  echo "  ✅ $platform_label Channel Connected"
fi
echo ""
echo "👤 Identity:"
echo "   AI: $ai_name ($ai_role)"
echo "   User: $user_name"
echo ""
echo "📂 Files:"
echo "   Workspace: $WORKSPACE"
echo "   SOUL.md    — AI personality"
echo "   USER.md    — your preferences"
echo "   lib/       — cognitive engine"
echo "   Skills/    — skill library"
echo "   memory/    — 3-tier memory storage"
echo ""
echo "🚀 Quick Commands:"
echo "   cogniclaw status      — system health report"
echo "   cogniclaw match \"q\"   — find skills by description"
echo "   cogniclaw reflect     — trigger memory reflection"
echo "   cogniclaw dashboard   — show Mission Control URL"
echo "   cogniclaw add <mod>   — add modules later"
echo "   cogniclaw update      — update everything"
echo ""
echo "   OpenClaw commands still work: openclaw status, openclaw agent, etc."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Built with ❤️  by Easy"
echo "  v$VERSION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
