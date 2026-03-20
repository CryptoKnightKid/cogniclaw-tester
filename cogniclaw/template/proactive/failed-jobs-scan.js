#!/usr/bin/env node
const { execSync } = require('node:child_process');
const fs = require('node:fs');

function sh(cmd) {
  try { return execSync(cmd, { encoding: 'utf8' }).trim(); }
  catch (e) { return (e.stdout || e.stderr || e.message || '').toString().trim(); }
}

const ts = new Date().toISOString();
const status = sh('openclaw cron status || true');
const lines = status.split('\n');
const failed = lines.filter(l => /\berror\b/i.test(l));

const payload = { ts, failedCount: failed.length, failed };
const path = '/home/ubuntu/.openclaw/workspace/memory/proactive/failed-jobs.jsonl';
fs.appendFileSync(path, JSON.stringify(payload) + '\n');

if (failed.length) {
  console.log('FAILED_JOBS_DETECTED');
  console.log(failed.join('\n'));
} else {
  console.log('FAILED_JOBS_NONE');
}
