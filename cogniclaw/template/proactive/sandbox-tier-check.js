#!/usr/bin/env node
const fs = require('fs');
const policyPath='/home/ubuntu/.openclaw/workspace/memory/proactive/sandbox-policy.json';
const policy=JSON.parse(fs.readFileSync(policyPath,'utf8'));

const tier=(process.argv[2]||'A').toUpperCase();
const action=(process.argv[3]||'read').toLowerCase();
const allowed=(policy[tier]||[]).includes(action);
const payload={ts:new Date().toISOString(),tier,action,allowed};
fs.writeFileSync('/home/ubuntu/.openclaw/workspace/memory/proactive/sandbox-check-last.json',JSON.stringify(payload,null,2));
console.log(JSON.stringify(payload,null,2));
