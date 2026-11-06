// SPDX-License-Identifier: Apache-2.0
// Offline diagnosis of supplied recordings; this module performs no Git, network or retry action.
import fs from'node:fs';
import {createHash} from'node:crypto';

const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
function unwrap(value){
 if(value&&typeof value==='object'&&Object.hasOwn(value,'status')&&Object.hasOwn(value,'data')){
  if(!Number.isInteger(value.status)||value.status<200||value.status>=300)throw new TypeError('CI_RESPONSE_NOT_SUCCESS');
  return value.data;
 }
 return value;
}
function diagnostic(lines){
 // Deliberate compiler/mutant errors may occur earlier in a successful control. Inspect the
 // terminal command refusal, not the first occurrence of an error word anywhere in the log.
 const terminal=lines.findIndex(line=>/##\[error\]Process completed with exit code [1-9]\d*/.test(line));
 const end=terminal<0?lines.length:terminal;
 const context=lines.slice(Math.max(0,end-12),end).map((text,index)=>({line:Math.max(0,end-12)+index+1,text:text.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z\s*/,'')})).filter(x=>x.text.trim().length);
 const patterns=[
  ['source-identity',/\b(?:SS1_BOUNDARY_SOURCE_OWNER|SOURCE_[A-Z_]*IDENTITY|BASELINE_[A-Z_]*MISMATCH)\b/],
  ['repository-hygiene',/\b(?:TEXT_CRLF|TEXT_UTF8_BOM|HYGIENE_[A-Z_]+)\b/],
  ['git-context',/GIT_CONTEXT_(?:WRONG_USER|MISMATCH)|Git provenance read failed|dubious ownership/i],
  ['module-resolution',/ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND|error TS2307\b/],
  ['test-or-fixture',/AssertionError|ERR_ASSERTION|^not ok\b/],
 ];
 for(const match of [...context].reverse())for(const[category,pattern]of patterns)if(pattern.test(match.text))return{category,message:match.text,line:match.line,context};
 return{category:context.length?'unclassified':'missing-evidence',message:context.at(-1)?.text??null,line:context.at(-1)?.line??null,context};
}
export function summarizeWindowsFailure(recording,logBytes,{expectedHead}={}){
 const job=unwrap(recording);
 if(!job||typeof job!=='object'||!Number.isInteger(job.id)||!Number.isInteger(job.run_id)||!Array.isArray(job.steps)||!/^\w{40}$/.test(job.head_sha??'')||!/^[a-f\d]{40}$/i.test(job.head_sha))throw new TypeError('CI_JOB_IDENTITY_REQUIRED');
 if(expectedHead!==undefined&&!/^[a-f\d]{40}$/i.test(expectedHead))throw new TypeError('CI_EXPECTED_HEAD_INVALID');
 if(!Buffer.isBuffer(logBytes))throw new TypeError('CI_LOG_BYTES_REQUIRED');
 if(logBytes.length>32*1024*1024)throw new RangeError('CI_LOG_RECORDING_LIMIT');
 let text=logBytes.toString('utf8');
 if(text.trimStart().startsWith('{')){
  let parsed;try{parsed=JSON.parse(text);}catch{/* A plain log can begin with a JSON-looking line. */}
  if(parsed&&Object.hasOwn(parsed,'status')&&Object.hasOwn(parsed,'data')){text=unwrap(parsed);if(typeof text!=='string')throw new TypeError('CI_LOG_TEXT_REQUIRED');}
 }
 const failedStep=job.steps.find(s=>s.conclusion==='failure'||s.conclusion==='timed_out')??null;
 const failed=job.status==='completed'&&job.conclusion==='failure';
 const failure=failed?diagnostic(text.split(/\r?\n/)):job.status==='completed'&&job.conclusion!=='success'&&job.conclusion!=='skipped'?{category:'execution-incomplete',message:null,line:null,context:[]}:null;
 return{
  schemaVersion:1,scope:'supplied-ci-recordings-only',
  job:{id:job.id,runId:job.run_id,attempt:job.run_attempt??null,name:job.name,status:job.status,conclusion:job.conclusion,head:job.head_sha,url:job.html_url??null},
  candidate:{expectedHead:expectedHead??null,matches:expectedHead===undefined?null:expectedHead.toLowerCase()===job.head_sha.toLowerCase()},
  // This hashes exactly the saved input, including an API envelope or CRLF; it is not an
  // upstream transport-byte claim or permission to normalize a repository source fingerprint.
  log:{bytes:logBytes.length,sha256:sha256(logBytes)},
  failedStep:failedStep?{number:failedStep.number,name:failedStep.name,conclusion:failedStep.conclusion}:null,
  failure,rootCause:{status:'unconfirmed',owner:null,statement:null},
  followup:{reusedEvidence:[],requiredChecks:[],prevention:null},
 };
}
function readBounded(file){const stat=fs.statSync(file);if(!stat.isFile()||stat.size>32*1024*1024)throw new RangeError('CI_RECORDING_LIMIT');return fs.readFileSync(file);}
function cli(args){
 if(args.length===1&&args[0]==='--help'){console.log('Usage: node summarize-windows-failure.mjs --job <saved-job.json> --log <saved-log-or-api-response> [--head <expected-sha>] [--out <new-private-receipt.json>]');return;}
 const options=new Map();for(let i=0;i<args.length;i+=2){const key=args[i],value=args[i+1];if(!['--job','--log','--head','--out'].includes(key)||options.has(key)||!value||value.startsWith('--'))throw new TypeError('CI_SUMMARY_USAGE');options.set(key,value);}
 if(!options.has('--job')||!options.has('--log'))throw new TypeError('CI_SUMMARY_USAGE');
 const jobBytes=readBounded(options.get('--job')),logBytes=readBounded(options.get('--log'));
 const summary=summarizeWindowsFailure(JSON.parse(jobBytes.toString('utf8')),logBytes,{expectedHead:options.get('--head')});
 summary.jobRecording={bytes:jobBytes.length,sha256:sha256(jobBytes)};
 const serialized=JSON.stringify(summary,null,2)+'\n';
 // A receipt is a new private artifact. Never replace an existing source, log or prior receipt.
 if(options.has('--out'))fs.writeFileSync(options.get('--out'),serialized,{flag:'wx'});
 console.log(serialized.trimEnd());
}
if(import.meta.main)try{cli(process.argv.slice(2));}catch(error){console.error(error.message);process.exitCode=1;}
