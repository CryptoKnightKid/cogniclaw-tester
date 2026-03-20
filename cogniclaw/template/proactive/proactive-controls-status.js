#!/usr/bin/env node
const fs=require('fs');
const paths={
 think:'/home/ubuntu/.openclaw/workspace/memory/proactive/task-mode-last.json',
 gate:'/home/ubuntu/.openclaw/workspace/memory/proactive/critical-gate-last.json',
 rubric:'/home/ubuntu/.openclaw/workspace/memory/proactive/reliability-log.jsonl',
 sandbox:'/home/ubuntu/.openclaw/workspace/memory/proactive/sandbox-check-last.json',
 evidence:'/home/ubuntu/.openclaw/workspace/memory/evidence'
};
const out={ts:new Date().toISOString(),controls:{}};
for(const [k,p] of Object.entries(paths)){
  try{const s=fs.statSync(p); out.controls[k]={running:true,lastUpdated:s.mtime.toISOString()};}
  catch{out.controls[k]={running:false};}
}
console.log(JSON.stringify(out,null,2));
