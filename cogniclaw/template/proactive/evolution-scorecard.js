#!/usr/bin/env node
const fs = require('fs');
const { execSync } = require('child_process');

function sh(cmd){ try{return execSync(cmd,{encoding:'utf8'}).trim();}catch(e){return (e.stdout||'').toString().trim();} }

const now = new Date().toISOString();
const cron = sh('crontab -l 2>/dev/null');
const checks = {
  watchdog: /browser-watchdog\.js/.test(cron),
  jobsScan: /failed-jobs-scan\.js/.test(cron),
  nextAction: /next-best-action\.js/.test(cron),
  alertGate: /smart-alert-gate\.js/.test(cron),
  browserFallback: /browser-mode-fallback\.js/.test(cron),
  cronDelta: /cron-health-delta\.js/.test(cron),
};

const score = Object.values(checks).filter(Boolean).length;
const payload = {
  ts: now,
  score: `${score}/6`,
  checks,
  nextUp: [
    'Add auto-priority classifier for inbound tasks',
    'Add recovery playbook executor for browser failures',
    'Add weekly experiment review with keep/kill decisions'
  ]
};

const out = '/home/ubuntu/.openclaw/workspace/memory/proactive/evolution-scorecard.json';
fs.writeFileSync(out, JSON.stringify(payload,null,2));
console.log(JSON.stringify(payload,null,2));
