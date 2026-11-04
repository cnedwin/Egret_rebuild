// SPDX-License-Identifier: Apache-2.0
// Compile emitted public declarations and retain exact unsuppressed diagnostic tuples.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const base="import type {Engine,Scope,DisplayObjectContainer,DisplayObject,DisplaySubtreeTicket,SharedRenderFrame2D} from '@egret/engine';\ndeclare const engine:Engine, scope:Scope, target:DisplayObjectContainer, candidate:DisplayObject;\n";
test('emitted prepared-subtree type surface and unsuppressed refusal diagnostics',()=>{
 fs.mkdirSync(path.join(root,'work'),{recursive:true});const dir=fs.mkdtempSync(path.join(root,'work/subtree-types-'));try{
  const config={compilerOptions:{strict:true,noEmit:true,target:'ES2022',lib:['ES2022'],module:'NodeNext',moduleResolution:'NodeNext',skipLibCheck:false,types:[]},files:['case.ts']};fs.writeFileSync(path.join(dir,'tsconfig.json'),JSON.stringify(config));
  const run=source=>{fs.writeFileSync(path.join(dir,'case.ts'),base+source);const r=spawnSync(process.execPath,[path.join(root,'node_modules/typescript/bin/tsc'),'--project',path.join(dir,'tsconfig.json'),'--pretty','false'],{cwd:root,encoding:'utf8'});if(r.error)throw r.error;return {status:r.status,output:r.stdout+r.stderr};};
  const positive="const ticket:DisplaySubtreeTicket=engine.prepareDisplaySubtree(scope,target,candidate);\nconst frame:SharedRenderFrame2D=engine.capturePreparedDisplaySharedFrame(ticket,{width:64,height:64});\nticket.commit();ticket.dispose();void frame;\n";
  assert.equal(run(positive).status,0);
  const cases=[['forged','const ticket:DisplaySubtreeTicket={commit(){},dispose(){}};',2741],['leaf-target','engine.prepareDisplaySubtree(scope,candidate,candidate);',2740],['missing-scope','engine.prepareDisplaySubtree(target,candidate);',2554],['wrong-ticket','engine.capturePreparedDisplaySharedFrame(candidate,{width:64,height:64});',2739]];
  for(const [name,source,expected]of cases){assert.equal(run(positive).status,0,'fresh complete baseline '+name);const result=run(source);assert.notEqual(result.status,0);const tuples=[...result.output.matchAll(/case\.ts\((\d+),(\d+)\): error TS(\d+): ([^\r\n]+)/g)].map(m=>({line:Number(m[1]),column:Number(m[2]),code:Number(m[3]),message:m[4]}));assert.equal(tuples.length,1,result.output);assert.equal(tuples[0].line,3);assert.equal(tuples[0].column,{forged:7,'leaf-target':36,'missing-scope':8,'wrong-ticket':42}[name]);console.log(JSON.stringify({case:name,diagnostics:tuples}));assert.equal(tuples[0].code,expected);}
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
