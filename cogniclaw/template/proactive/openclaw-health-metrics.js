#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const workspace = process.env.WORKSPACE || '/home/ubuntu/.openclaw/workspace';
const dateUtc = new Date().toISOString().slice(0, 10);
const researchDir = path.join(workspace, 'memory', 'research');
const healthPath = path.join(researchDir, `openclaw-health-${dateUtc}.md`);
const outPath = path.join(researchDir, `openclaw-health-metrics-${dateUtc}.json`);

function countMatches(text, regex) {
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

if (!fs.existsSync(healthPath)) {
  console.error(`Missing health snapshot: ${healthPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(healthPath, 'utf8');
const lower = raw.toLowerCase();

const metrics = {
  dateUtc,
  source: path.relative(workspace, healthPath),
  generatedAtUtc: new Date().toISOString(),
  counts: {
    warningLines: countMatches(raw, /^.*\b(warn|warning|⚠)\b.*$/gim),
    errorLines: countMatches(raw, /^.*\b(error|failed|failure|critical|✖|x )\b.*$/gim),
    securityMentions: countMatches(raw, /\bsecurity\b/gim),
  },
  flags: {
    shortTokenWarning: /short\s+gateway\s+token|token\s+too\s+short/i.test(raw),
    multiUserRisk: /multi-user|adversarial|shared gateway/i.test(lower),
    browserExposureRisk: /browser control exposure|browser exposure/i.test(lower),
    authExposureRisk: /auth exposure|gateway auth exposure/i.test(lower),
    permissionRisk: /elevated allowlist|least privilege|permissions?/i.test(lower),
  }
};

metrics.riskScore = [
  metrics.flags.shortTokenWarning,
  metrics.flags.multiUserRisk,
  metrics.flags.browserExposureRisk,
  metrics.flags.authExposureRisk,
  metrics.flags.permissionRisk,
].filter(Boolean).length + Math.min(5, metrics.counts.errorLines);

fs.writeFileSync(outPath, JSON.stringify(metrics, null, 2) + '\n');
console.log(`Wrote ${outPath}`);
