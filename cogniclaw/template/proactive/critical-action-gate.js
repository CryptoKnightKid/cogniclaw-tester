#!/usr/bin/env node
const fs = require('fs');

const action = (process.argv[2] || '').toLowerCase();
const target = (process.argv[3] || '').toLowerCase();

const gatedActions = ['delete','rm','credential','password','token','public-post','external-send','apply-job','mass-message'];
const autoActions = ['read','diagnostic','local-edit','local-write','status-check'];

let decision = 'allow';
let reason = 'Low-risk internal action';

if (gatedActions.some(k => action.includes(k) || target.includes(k))) {
  decision = 'require_approval';
  reason = 'Critical/external/high-impact action';
} else if (autoActions.some(k => action.includes(k))) {
  decision = 'allow';
}

const payload = {
  ts: new Date().toISOString(),
  action, target, decision, reason,
  checkpoint: decision === 'require_approval' ? ['action','impact','rollback','approve yes/no'] : null
};

fs.writeFileSync('/home/ubuntu/.openclaw/workspace/memory/proactive/critical-gate-last.json', JSON.stringify(payload, null, 2));
console.log(JSON.stringify(payload, null, 2));
