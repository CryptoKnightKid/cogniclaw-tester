#!/usr/bin/env node
const fs = require('node:fs');
const crypto = require('node:crypto');

const base = '/home/ubuntu/.openclaw/workspace/memory/proactive';
const statePath = `${base}/alert-state.json`;
const outPath = `${base}/alert-gate.json`;

function read(path, fallback = '') {
  try { return fs.readFileSync(path, 'utf8'); } catch { return fallback; }
}

function hash(s) {
  return crypto.createHash('sha1').update(s).digest('hex');
}

function lastJsonl(path) {
  const raw = read(path, '').trim();
  if (!raw) return null;
  const lines = raw.split('\n');
  try { return JSON.parse(lines[lines.length - 1]); } catch { return null; }
}

const failed = lastJsonl(`${base}/failed-jobs.jsonl`) || { failedCount: 0, failed: [] };
const nextBestRaw = read(`${base}/next-best-action.json`, '{}');
let nextBest = { suggestions: [] };
try { nextBest = JSON.parse(nextBestRaw); } catch {}

const fingerprint = hash(JSON.stringify({ failedCount: failed.failedCount, failed: failed.failed, suggestions: nextBest.suggestions }));
let prev = { fingerprint: '', lastLevel: 'none' };
try { prev = JSON.parse(read(statePath, '{}')); } catch {}

let level = 'none';
let reason = 'No material change';

if (failed.failedCount > 0) {
  level = 'high';
  reason = `Detected ${failed.failedCount} failed cron jobs`;
} else if (fingerprint !== prev.fingerprint) {
  level = 'normal';
  reason = 'Operational recommendations changed';
}

const payload = {
  ts: new Date().toISOString(),
  level,
  reason,
  changed: fingerprint !== prev.fingerprint,
  failedCount: failed.failedCount,
  topSuggestion: (nextBest.suggestions || [])[0] || null
};

fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
fs.writeFileSync(statePath, JSON.stringify({ fingerprint, lastLevel: level, ts: payload.ts }, null, 2));

console.log(JSON.stringify(payload));
