$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

Write-Host '== CogniClaw One-Command Start ==' -ForegroundColor Cyan
powershell -ExecutionPolicy Bypass -File .\install.ps1
Set-Location .\cogniclaw\hosted-control-plane
Copy-Item .env.example .env -Force
npm run dev
