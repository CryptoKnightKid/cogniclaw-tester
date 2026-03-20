# CogniClaw Tester Package

## Fast start

### macOS / Linux
```bash
chmod +x install.sh doctor.sh
./install.sh
./doctor.sh
cd cogniclaw/hosted-control-plane && npm run dev
```

### Windows
Right click `install.ps1` and run with PowerShell, or:
```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```
Then:
```powershell
cd .\cogniclaw\hosted-control-plane
npm run dev
```

## What this package includes
- `cogniclaw/` source
- bootstrap installers
- doctor script
- safe `.env.example` templates

## What was removed
- secrets / tokens / keys
- private memory / backups
- caches / build junk
- local databases / machine-specific state

## Main tester target
This package is currently optimized to test:
- `cogniclaw/hosted-control-plane`

## Common issues
- Missing Node/npm: run installer again
- Placeholder `.env` values: replace before external integrations
- If npm install fails, send back the exact error and OS/version details
