#!/usr/bin/env node
const { execSync } = require('node:child_process');
const fs = require('node:fs');

function sh(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim(); }
  catch (e) { return (e.stdout || e.stderr || e.message || '').toString().trim(); }
}

const ts = new Date().toISOString();
const out = {
  ts,
  checks: {
    gateway: sh('openclaw gateway status | head -n 30'),
    browserStatus: sh("node -e \"(async()=>{const {spawnSync}=require('child_process'); const r=spawnSync('openclaw',['status'],{encoding:'utf8'}); process.stdout.write(r.stdout||'');})();\"")
  }
};

const logPath = '/home/ubuntu/.openclaw/workspace/memory/proactive/browser-watchdog.jsonl';
fs.appendFileSync(logPath, JSON.stringify(out) + '\n');

const unhealthy = /timed out|unreachable|failed/i.test(JSON.stringify(out));
if (unhealthy) {
  const fix = sh('openclaw gateway restart && sleep 2 && openclaw gateway status | head -n 40');
  fs.appendFileSync(logPath, JSON.stringify({ ts: new Date().toISOString(), action: 'restart_gateway', result: fix }) + '\n');
  console.log('WATCHDOG_ACTION: restarted gateway');
} else {
  console.log('WATCHDOG_OK');
}
