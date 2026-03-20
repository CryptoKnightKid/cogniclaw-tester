#!/usr/bin/env node
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const crypto = require('node:crypto');

const base = '/home/ubuntu/.openclaw/workspace/memory/proactive';
const statePath = `${base}/cron-health-state.json`;
const outPath = `${base}/cron-health-delta.json`;

function sh(cmd){
  try { return execSync(cmd,{encoding:'utf8'}).trim(); }
  catch(e){ return (e.stdout||e.stderr||e.message||'').toString().trim(); }
}
function hash(s){ return crypto.createHash('sha1').update(s).digest('hex'); }

const raw = sh('openclaw cron status || true');
const lines = raw.split('\n').filter(Boolean);
const err = lines.filter(l=>/\berror\b/i.test(l));
const ok = lines.filter(l=>/\bok\b/i.test(l));

const snapshot = { errCount: err.length, okCount: ok.length, errLines: err.slice(0,10) };
const fp = hash(JSON.stringify(snapshot));
let prev = { fp:'' };
try { prev = JSON.parse(fs.readFileSync(statePath,'utf8')); } catch {}

const changed = fp !== prev.fp;
const payload = {
  ts: new Date().toISOString(),
  changed,
  summary: changed ? `Cron state changed: errors=${snapshot.errCount}, ok=${snapshot.okCount}` : 'No cron state change',
  ...snapshot
};

fs.writeFileSync(outPath, JSON.stringify(payload,null,2));
if (changed) fs.writeFileSync(statePath, JSON.stringify({fp,ts:payload.ts},null,2));
console.log(JSON.stringify(payload,null,2));
