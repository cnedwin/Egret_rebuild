// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../..',import.meta.url));
const base="import {createSpineResetSlot} from '@egret/spine';\nimport type {SpineResetSlot,SpineResetRequest,SpineResetTicket} from '@egret/spine';\ndeclare const slot:SpineResetSlot, request:SpineResetRequest, ticket:SpineResetTicket;\n";
test('RESET emitted types admit CPU flow and reject unsuppressed unsupported policies',()=>{
 fs.mkdirSync(path.join(root,'work'),{recursive:true});const dir=fs.mkdtempSync(path.join(root,'work/reset-types-'));
 try{
  fs.writeFileSync(path.join(dir,'tsconfig.json'),JSON.stringify({compilerOptions:{strict:true,noEmit:true,target:'ES2022',lib:['ES2022'],module:'NodeNext',moduleResolution:'NodeNext',skipLibCheck:false,types:[]},files:['case.ts']}));
  const run=source=>{fs.writeFileSync(path.join(dir,'case.ts'),base+source);const r=spawnSync(process.execPath,[path.join(root,'node_modules/typescript/bin/tsc'),'--project',path.join(dir,'tsconfig.json'),'--pretty','false'],{cwd:root,encoding:'utf8'});if(r.error)throw r.error;return {status:r.status,output:r.stdout+r.stderr};};
  const positive="const t:SpineResetTicket=slot.request(request);t.ready.then(()=>{const f=t.capture({width:64,height:48});const a=t.commit();a.instance.advance({tickId:100,elapsedSeconds:10,deltaSeconds:.01});void f;});";
  for(const [name,source,code]of [
   ['policy',"slot.request({...request,policy:'preserve'});",2322],
   ['clockless',"slot.getActive().instance.advance();",2554],
   ['fake-readiness',"ticket.commit({generation:1});",2554],
   ['readonly',"ticket.state='committed';",2540],
   ['no-hidden-submit',"ticket.submit();",2339]
  ]){assert.equal(run(positive).status,0,'fresh complete baseline '+name);const r=run(source);assert.notEqual(r.status,0);const tuples=[...r.output.matchAll(/case\.ts\((\d+),(\d+)\): error TS(\d+): ([^\r\n]+)/g)].map(m=>({line:+m[1],column:+m[2],code:+m[3],message:m[4]}));console.log(JSON.stringify({name,diagnostics:tuples}));assert.equal(tuples.length,1,r.output);assert.equal(tuples[0].code,code);assert.equal(tuples[0].line,4);assert.equal(tuples[0].column,{policy:26,clockless:27,'fake-readiness':15,readonly:8,'no-hidden-submit':8}[name]);}
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
