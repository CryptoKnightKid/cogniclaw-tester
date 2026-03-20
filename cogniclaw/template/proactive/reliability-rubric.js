#!/usr/bin/env node
const fs = require('fs');

function n(v){ const x=Number(v); return Number.isFinite(x)?Math.max(0,Math.min(2,x)):0; }
const completion=n(process.argv[2]||2);
const correctness=n(process.argv[3]||2);
const safety=n(process.argv[4]||2);
const reproducibility=n(process.argv[5]||1);
const evidence=n(process.argv[6]||1);
const total = completion+correctness+safety+reproducibility+evidence;
const max = 10;

const row = {
  ts: new Date().toISOString(),
  scores:{completion,correctness,safety,reproducibility,evidence},
  total,
  grade: total>=9?'excellent':total>=7?'good':total>=5?'watch':'poor'
};

const path='/home/ubuntu/.openclaw/workspace/memory/proactive/reliability-log.jsonl';
fs.appendFileSync(path, JSON.stringify(row)+'\n');
console.log(JSON.stringify(row,null,2));
