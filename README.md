# CogniClaw Tester

Public tester repo for trying the CogniClaw install/bootstrap flow.

CogniClaw is a cognitive layer for OpenClaw: memory, skills, automation, personality, and a hosted control-plane foundation.

## Quick start

### Linux / macOS
```bash
git clone https://github.com/CryptoKnightKid/cogniclaw-tester.git
cd cogniclaw-tester
chmod +x start.sh
./start.sh
```

### Windows
```powershell
git clone https://github.com/CryptoKnightKid/cogniclaw-tester.git
cd cogniclaw-tester
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

### Manual flow (if needed)
```bash
chmod +x install.sh doctor.sh
./install.sh
./doctor.sh
cd cogniclaw/hosted-control-plane && npm run dev
```

## What this repo is
- clean tester package
- bootstrap installers
- doctor check
- safe env template
- hosted control plane as the main runnable target

## What is excluded
- secrets / API keys
- private memory and backups
- local databases and machine state
- caches / logs / build junk

## Main runnable target
```bash
cd cogniclaw/hosted-control-plane
cp .env.example .env
npm install
npm run dev
```

## Troubleshooting
If install fails, collect:
- OS
- Node version
- exact command used
- exact error output

## Repo contents
- `install.sh` - Linux/macOS bootstrap
- `install.ps1` - Windows bootstrap
- `doctor.sh` - environment checks
- `cogniclaw/` - clean source bundle

Built for tester validation, not full production rollout.
