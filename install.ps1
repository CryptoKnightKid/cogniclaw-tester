$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Join-Path $Root 'cogniclaw'
$ControlPlane = Join-Path $AppDir 'hosted-control-plane'

function Test-Cmd($name) { return $null -ne (Get-Command $name -ErrorAction SilentlyContinue) }
function Ensure-WingetPkg($id, $cmdName) {
  if (-not (Test-Cmd $cmdName)) {
    Write-Host "Installing $id via winget..." -ForegroundColor Yellow
    winget install --accept-source-agreements --accept-package-agreements -e --id $id
  }
}

Write-Host '== CogniClaw Tester Bootstrap ==' -ForegroundColor Cyan

if (-not (Test-Cmd 'winget')) {
  throw 'winget is required for automatic dependency installs on Windows.'
}

Ensure-WingetPkg 'OpenJS.NodeJS.LTS' 'node'
Ensure-WingetPkg 'Git.Git' 'git'
Ensure-WingetPkg 'Python.Python.3.12' 'python'

if (-not (Test-Path (Join-Path $ControlPlane '.env')) -and (Test-Path (Join-Path $ControlPlane '.env.example'))) {
  Copy-Item (Join-Path $ControlPlane '.env.example') (Join-Path $ControlPlane '.env')
  Write-Host 'Created hosted-control-plane/.env from template' -ForegroundColor Green
}

if (Test-Path (Join-Path $ControlPlane 'package.json')) {
  Push-Location $ControlPlane
  npm install
  Pop-Location
}

Write-Host ''
Write-Host 'CogniClaw tester bootstrap complete.' -ForegroundColor Green
Write-Host 'Next steps:'
Write-Host '1. Run doctor.sh from Git Bash/WSL or inspect files manually'
Write-Host '2. Review cogniclaw/hosted-control-plane/.env'
Write-Host '3. Start app: cd cogniclaw/hosted-control-plane ; npm run dev'
