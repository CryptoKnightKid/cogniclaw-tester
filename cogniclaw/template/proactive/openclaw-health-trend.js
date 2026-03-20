#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const workspace = process.env.WORKSPACE || '/home/ubuntu/.openclaw/workspace';
const researchDir = path.join(workspace, 'memory', 'research');
const dateUtc = new Date().toISOString().slice(0, 10);
const outPath = path.join(researchDir, `openclaw-health-trend-${dateUtc}.md`);

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function listMetricFiles() {
  if (!fs.existsSync(researchDir)) return [];
  return fs.readdirSync(researchDir)
    .filter((f) => /^openclaw-health-metrics-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .map((f) => path.join(researchDir, f));
}

function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function trendArrow(curr, prev) {
  if (prev == null) return '→';
  if (curr > prev) return '↑';
  if (curr < prev) return '↓';
  return '→';
}

const records = listMetricFiles()
  .map((fp) => safeReadJson(fp))
  .filter(Boolean)
  .map((m) => ({
    date: m.dateUtc || 'unknown',
    riskScore: toInt(m.riskScore),
    warningLines: toInt(m?.counts?.warningLines),
    errorLines: toInt(m?.counts?.errorLines),
    securityMentions: toInt(m?.counts?.securityMentions),
    flags: m.flags || {},
  }))
  .sort((a, b) => a.date.localeCompare(b.date));

if (records.length === 0) {
  console.error('No openclaw health metric files found.');
  process.exit(1);
}

const recent = records.slice(-7);
const riskSeries = recent.map((r) => r.riskScore);
const avgRisk = riskSeries.reduce((a, b) => a + b, 0) / recent.length;

const latest = recent[recent.length - 1];
const prev = recent.length > 1 ? recent[recent.length - 2] : null;

let consecutiveIncrease = 1;
for (let i = recent.length - 1; i > 0; i -= 1) {
  if (recent[i].riskScore > recent[i - 1].riskScore) {
    consecutiveIncrease += 1;
  } else {
    break;
  }
}

const topFlags = Object.entries(latest.flags)
  .filter(([, v]) => Boolean(v))
  .map(([k]) => k);

const alerts = [];
if (latest.riskScore >= 6) alerts.push('High current riskScore (>=6).');
if (consecutiveIncrease >= 3) alerts.push('riskScore increased 3+ consecutive snapshots.');
if (latest.errorLines >= 3) alerts.push('Error lines elevated (>=3).');
if (topFlags.length >= 3) alerts.push('Multiple persistent risk flags detected.');

const lines = [];
lines.push(`# OpenClaw Health Trend - ${dateUtc}`);
lines.push('');
lines.push('## Scope');
lines.push(`Aggregated last ${recent.length} daily metric snapshots from \`memory/research/openclaw-health-metrics-YYYY-MM-DD.json\`.`);
lines.push('');
lines.push('## Trend table');
lines.push('');
lines.push('| Date | Risk | Warn | Err | Security | Δ Risk |');
lines.push('|---|---:|---:|---:|---:|---:|');
for (let i = 0; i < recent.length; i += 1) {
  const row = recent[i];
  const prevRow = i > 0 ? recent[i - 1] : null;
  const delta = prevRow ? row.riskScore - prevRow.riskScore : 0;
  const deltaStr = prevRow ? `${delta > 0 ? '+' : ''}${delta}` : '0';
  lines.push(`| ${row.date} | ${row.riskScore} | ${row.warningLines} | ${row.errorLines} | ${row.securityMentions} | ${deltaStr} |`);
}
lines.push('');
lines.push('## Snapshot summary');
lines.push(`- Latest riskScore: **${latest.riskScore}** ${trendArrow(latest.riskScore, prev ? prev.riskScore : null)} (previous: ${prev ? prev.riskScore : 'n/a'})`);
lines.push(`- 7-day average riskScore: **${avgRisk.toFixed(2)}**`);
lines.push(`- Active risk flags: ${topFlags.length ? topFlags.map((f) => `\`${f}\``).join(', ') : 'none'}`);
lines.push('');
lines.push('## Alerts');
if (alerts.length) {
  for (const alert of alerts) lines.push(`- ⚠️ ${alert}`);
} else {
  lines.push('- No immediate trend alerts triggered.');
}
lines.push('');
lines.push('## Next actions');
lines.push('- Keep generating nightly metrics via `scripts/proactive/openclaw-health-metrics.js`.');
lines.push('- Review this trend daily for drift, not one-off spikes.');
if (alerts.length) {
  lines.push('- Open a focused hardening checklist for top flags within 24h.');
}
lines.push('');

fs.writeFileSync(outPath, lines.join('\n') + '\n');
console.log(`Wrote ${outPath}`);
