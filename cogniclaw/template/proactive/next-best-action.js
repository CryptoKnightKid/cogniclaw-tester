#!/usr/bin/env node
const fs = require('node:fs');

function readSafe(path) {
  try { return fs.readFileSync(path, 'utf8'); } catch { return ''; }
}

const tasks = readSafe('/home/ubuntu/.openclaw/workspace/mission-control/active/tasks.md');
const hb = readSafe('/home/ubuntu/.openclaw/workspace/HEARTBEAT.md');
const today = new Date().toISOString().slice(0,10);
const daily = readSafe(`/home/ubuntu/.openclaw/workspace/memory/${today}.md`);

const suggestions = [];

if (/\[ \]/.test(tasks)) suggestions.push('There are open tasks in mission-control/active/tasks.md. Recommend: pick top 3 and assign ETA now.');
if (/error/i.test(daily)) suggestions.push('Daily memory mentions errors. Recommend: run quick reliability sweep and close top blocker.');
if (!daily.trim()) suggestions.push('No daily memory log yet. Recommend: create quick operating log for continuity.');
if (/Run proactive suggestions/i.test(hb)) suggestions.push('Heartbeat includes proactive suggestions check. Recommend: run proactive pass and post concise status.');

if (!suggestions.length) suggestions.push('System stable. Recommend: focus on highest leverage BD task and ship one visible deliverable this block.');

const out = {
  ts: new Date().toISOString(),
  suggestions
};

const outPath = '/home/ubuntu/.openclaw/workspace/memory/proactive/next-best-action.json';
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
