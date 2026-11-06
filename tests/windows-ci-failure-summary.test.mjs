// SPDX-License-Identifier: Apache-2.0
import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import os from'node:os';import path from'node:path';import{spawnSync}from'node:child_process';import{fileURLToPath}from'node:url';
const moduleUrl=new URL('../skills/egret-windows-ci/scripts/summarize-windows-failure.mjs',import.meta.url);
const implementation=await import(moduleUrl.href).catch(error=>({missing:error.code}));
const head='a'.repeat(40);
const job={id:42,run_id:21,run_attempt:1,name:'windows',status:'completed',conclusion:'failure',head_sha:head,html_url:'https://github.com/cnedwin/Egret_rebuild/actions/runs/21/job/42',steps:[{number:1,name:'Setup',status:'completed',conclusion:'success'},{number:2,name:'Full merge checks',status:'completed',conclusion:'failure'}]};
const sourceLog=['2026-11-06T00:00:00Z VERIFY spritesheet-boundary','2026-11-06T00:00:01Z SS1_BOUNDARY_SOURCE_OWNER: M3 pointer whole-group raw identity differs: packages/engine/dist/pointerInput.js','2026-11-06T00:00:02Z ##[error]Process completed with exit code 1.'].join('\n');
function summarize(value=job,log=sourceLog,expected=head){assert.equal(typeof implementation.summarizeWindowsFailure,'function','CI_SUMMARY_IMPLEMENTATION_REQUIRED');return implementation.summarizeWindowsFailure(value,Buffer.from(log),{expectedHead:expected});}

test('Windows CI summary keeps actual source refusal separate from expected negative controls',()=>{
 const log=['not ok 1 - assigned mutant refusal','SS1_BOUNDARY_SOURCE_OWNER: expected negative control',...Array(20).fill('ok restored control'),sourceLog].join('\n');
 const r=summarize(job,log);assert.equal(r.failure.category,'source-identity');assert.match(r.failure.message,/M3 pointer/);assert.equal(r.failedStep.name,'Full merge checks');assert.equal(r.candidate.matches,true);assert.equal(r.rootCause.status,'unconfirmed');
});
test('a successful job is not relabelled as failed because its controls logged errors',()=>{
 const r=summarize({...job,conclusion:'success',steps:job.steps.map(s=>({...s,conclusion:'success'}))});assert.equal(r.failure,null);assert.equal(r.job.conclusion,'success');
});
test('terminal assertion context wins over unrelated earlier source-refusal text',()=>{
 const log=['SS1_BOUNDARY_SOURCE_OWNER: earlier expected control','ok healthy restoration','AssertionError [ERR_ASSERTION]: expected 1, received 0','##[error]Process completed with exit code 1.'].join('\n');
 const r=summarize(job,log);assert.equal(r.failure.category,'test-or-fixture');assert.match(r.failure.message,/expected 1/);assert.equal(r.rootCause.status,'unconfirmed');
});
test('unpublished logs and unfinished jobs cannot establish a test or infrastructure root cause',()=>{
 assert.equal(summarize(job,'').failure.category,'missing-evidence');const pending=summarize({...job,status:'in_progress',conclusion:null},'');assert.equal(pending.failure,null);assert.equal(pending.job.status,'in_progress');
});
test('head mismatch stays visible and raw CRLF input is hashed without normalization',()=>{
 const a=summarize(job,sourceLog,'b'.repeat(40)),b=summarize(job,sourceLog.replaceAll('\n','\r\n'),'b'.repeat(40));assert.equal(a.candidate.matches,false);assert.equal(b.failure.category,a.failure.category);assert.notEqual(a.log.sha256,b.log.sha256);assert.notEqual(a.log.bytes,b.log.bytes);
});
test('offline CLI reads API envelopes and creates a new receipt without overwriting evidence',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'egret-ci-summary-')),jobFile=path.join(dir,'job.json'),logFile=path.join(dir,'log.json'),receipt=path.join(dir,'receipt.json');
 const original=JSON.stringify({status:200,data:job});fs.writeFileSync(jobFile,original);fs.writeFileSync(logFile,JSON.stringify({status:200,data:sourceLog}));
 try{
  const command=fileURLToPath(moduleUrl);const result=spawnSync(process.execPath,[command,'--job',jobFile,'--log',logFile,'--head',head,'--out',receipt],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);const saved=JSON.parse(fs.readFileSync(receipt,'utf8'));assert.equal(saved.failure.category,'source-identity');assert.equal(saved.candidate.matches,true);
  const overwrite=spawnSync(process.execPath,[command,'--job',jobFile,'--log',logFile,'--out',jobFile],{encoding:'utf8'});assert.notEqual(overwrite.status,0);assert.equal(fs.readFileSync(jobFile,'utf8'),original);
 }finally{for(const file of[receipt,logFile,jobFile])if(fs.existsSync(file))fs.unlinkSync(file);fs.rmdirSync(dir);}
});
