#!/usr/bin/env node
const fs=require('fs');
const day=new Date().toISOString().slice(0,10);
const id=process.argv[2]||`task-${Date.now()}`;
const summary=process.argv.slice(3).join(' ')||'No summary provided';
const dir=`/home/ubuntu/.openclaw/workspace/memory/evidence/${day}`;
fs.mkdirSync(dir,{recursive:true});
const file=`${dir}/${id}.md`;
const body=`# Evidence Pack: ${id}\n\n- Timestamp: ${new Date().toISOString()}\n- Summary: ${summary}\n\n## What changed\n- (fill)\n\n## Proof\n- (screenshots/files/links)\n\n## Risks\n- (fill)\n\n## Rollback\n- (fill)\n\n## Cost\n- (tokens/time estimate)\n`;
fs.writeFileSync(file,body);
console.log(JSON.stringify({ok:true,file},null,2));
