#!/usr/bin/env node
const { execSync } = require('node:child_process');
const fs = require('node:fs');

function sh(cmd){
  try { return execSync(cmd,{encoding:'utf8'}).trim(); }
  catch(e){ return (e.stdout||e.stderr||e.message||'').toString().trim(); }
}

const ts = new Date().toISOString();
const report = { ts, checks: {} };

report.checks.openclawProfile = sh("openclaw browser --browser-profile openclaw status || true");
report.checks.chromeRelayTabs = sh("openclaw browser --browser-profile chrome tabs || true");
report.checks.camoufoxRunning = sh("pgrep -af camoufox || true");
report.checks.recommendation = (()=>{
  const o = report.checks.openclawProfile.toLowerCase();
  const c = report.checks.chromeRelayTabs.toLowerCase();
  if (o.includes('running: true') || o.includes('cdpready: true')) return 'Use openclaw managed browser';
  if (!c.includes('tabs: []') && !c.includes('"tabs": []')) return 'Use chrome relay attached tab';
  if (report.checks.camoufoxRunning.trim()) return 'Use direct playwright+camoufox fallback';
  return 'No browser automation path ready; start relay or managed browser';
})();

const out = '/home/ubuntu/.openclaw/workspace/memory/proactive/browser-mode-fallback.json';
fs.writeFileSync(out, JSON.stringify(report,null,2));
console.log(JSON.stringify({out,recommendation:report.checks.recommendation},null,2));
