#!/usr/bin/env node
const fs = require('fs');

const text = (process.argv.slice(2).join(' ') || '').toLowerCase();
const strategicSignals = [
  'architecture','strategy','roadmap','security','risk','hiring','compensation','tokenomics','design decision','tradeoff','governance'
];
const executionSignals = [
  'fix','run','apply','send','update','rename','convert','generate','screenshot','search'
];

let strategicScore = strategicSignals.filter(k => text.includes(k)).length;
let executionScore = executionSignals.filter(k => text.includes(k)).length;
const mode = strategicScore > executionScore ? 'strategic' : 'execution';

const output = {
  ts: new Date().toISOString(),
  mode,
  strategicScore,
  executionScore,
  thinkThenLLMRequired: mode === 'strategic',
  template: mode === 'strategic' ? {
    problem: '', assumptions: [], options: [], tradeoffs: [], recommendation: ''
  } : null
};

const outPath = '/home/ubuntu/.openclaw/workspace/memory/proactive/task-mode-last.json';
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(JSON.stringify(output, null, 2));
