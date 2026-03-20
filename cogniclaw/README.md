# 🧠 CogniClaw

**The brain layer for OpenClaw.** One command installs a personality, 3-tier memory architecture, 285+ skills, autonomous monitoring, and a Mission Control dashboard on top of any OpenClaw setup.

## Install

```bash
curl -sSL https://cogniclaw.ai/install.sh | bash
```

Or clone and run:
```bash
git clone https://github.com/cogniclaw/cogniclaw.git
cd cogniclaw
./install.sh
```

## Hosted SaaS Foundation

This repo now includes a hosted control-plane foundation for the Managed + BYOK subscription model:

- `hosted-control-plane/`
  - Multi-tenant API scaffold
  - Single-tenant runtime orchestration hooks (ECS Fargate adapter)
  - Stripe subscription endpoints + webhook handling
  - BYOK provider connection flow with encrypted secret refs
  - Mission Control API endpoints (uptime/services/runs/channels)
  - S3 signed file transfer endpoints
  - Concierge/internal provisioning endpoints

Quick start:

```bash
cd hosted-control-plane
cp .env.example .env
npm install
npm run dev
```

Run tests:

```bash
npm test
```

## What You Get

| Layer | What CogniClaw Adds |
|-------|-------------------|
| **Identity** | Rich SOUL.md with voice rules, anti-patterns, behavioral boundaries |
| **Memory** | 3-tier architecture: Hot → Daily → Core with reflection pipeline |
| **Skills** | 285+ pre-built skills with NL matching and usage tracking |
| **Learning** | Experience logging, pattern analysis, proactive suggestions |
| **Automation** | Up to 14 cron jobs, 23 proactive scripts, self-healing tools |
| **Dashboard** | Mission Control web UI with modular panels |
| **Reliability** | Health monitoring, backups, crash recovery |

## Quick Commands

```bash
cogniclaw status       # System health overview
cogniclaw match "q"    # Find skills by description
cogniclaw reflect      # Trigger memory reflection
cogniclaw health       # Full health report (JSON)
cogniclaw dashboard    # Show Mission Control URL
cogniclaw backup       # Create manual backup
cogniclaw add <mod>    # Add module (automation, dashboard, channel)
cogniclaw update       # Update OpenClaw + CogniClaw
```

All existing OpenClaw commands still work: `openclaw status`, `openclaw agent`, etc.

## Architecture

```
~/.openclaw/workspace/          ← CogniClaw lives here
├── SOUL.md                     ← AI personality
├── USER.md                     ← Your preferences
├── AGENTS.md                   ← Boot sequence
├── MEMORY.md                   ← Long-term context
├── lib/                        ← 9 cognitive engine modules
├── Skills/                     ← 285+ skill folders
├── memory/                     ← 3-tier memory storage
├── scripts/                    ← Proactive monitoring (optional)
├── mission-control/            ← Dashboard (optional)
└── connections/                ← Channel config (optional)
```

## Automation Tiers

| Tier | What You Get |
|------|-------------|
| **Minimal** | Memory loop cron, session recovery, 285 skills |
| **Standard** | + 6 health monitors, daily backups, system health reports |
| **Full** | + 23 proactive scripts, night shift, file watcher, self-healing |

## Personality Archetypes

| Archetype | Style |
|-----------|-------|
| **Operator** | Direct, efficient, no fluff, execution-focused |
| **Advisor** | Thoughtful, explores options, challenges assumptions |
| **Builder** | Hands-on, code-first, ships fast, iterates |
| **Analyst** | Data-driven, thorough, evidence-based |
| **Creative** | Playful, experimental, unexpected connections |
| **Custom** | Define your own traits and style |

## Requirements

- Node.js ≥ 22
- Linux or macOS (Ubuntu recommended)
- OpenClaw (auto-installed if not present)

## License

MIT

---
Built with ❤️ by Easy
