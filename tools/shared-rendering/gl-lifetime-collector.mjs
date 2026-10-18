// SPDX-License-Identifier: Apache-2.0
// Finite genuine SDK WebGL2 lifetime, depth and state verifier; source review precedes execution.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {collectSharedNativeInputs} from './gl-lifetime-source.mjs';
import {samePhysicalPath,ownerRelativePath,fingerprintFile,canonicalTextBytes} from '../lib/file-identity.mjs';
const root=fs.realpathSync(fileURLToPath(new URL('../../',import.meta.url)));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const errorRecord=error=>({name:error?.name??'Error',message:String(error?.message??error).slice(0,16000)});
const idPattern=/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/;
class NumericFailure extends Error {}
async function bounded(label,operation,deadline){const remaining=deadline-performance.now();assert.ok(remaining>0,'Native deadline: '+label);let timer;
  const work=Promise.resolve().then(operation);try{return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Native deadline: '+label)),remaining);})]);}finally{clearTimeout(timer);}}
function options(args){assert.equal(args.length,6);const result={};for(let i=0;i<args.length;i+=2){assert.ok(['--playwright','--channel','--output'].includes(args[i]));assert.ok(!Object.hasOwn(result,args[i]));result[args[i]]=args[i+1];}
  assert.equal(result['--channel'],'msedge');assert.ok(path.isAbsolute(result['--playwright'])&&path.isAbsolute(result['--output']));return result;}
function validate(catalog){
  assert.deepEqual([catalog.schemaVersion,catalog.width,catalog.height],[1,256,256]);
  assert.deepEqual(catalog.fixedPolicy,{operationMs:60000,pageTotalMs:90000,restoreMs:10000,fenceMs:30000,maxPendingFrames:2,lossEventMs:5000});
  assert.deepEqual(catalog.cases.map(c=>c.id),['L01-immediate-dirty','L02-depth-planes-order','L03-real-loss-replay','L04-close-versus-real-restore']);
  assert.deepEqual(catalog.cases.map(c=>c.observations.map(o=>o.id)),[['ticket-A','default-B','ticket-B'],['depth'],['restored-saved-A','restored-live-B'],[]]);
  let points=0,observations=0;for(const def of catalog.cases){assert.ok(idPattern.test(def.id));for(const item of def.observations){observations++;assert.ok(idPattern.test(item.id));assert.ok(['premultiplied','opaque'].includes(item.alphaMode));const ids=new Set();
    for(const p of item.points){assert.ok(idPattern.test(p.id)&&!ids.has(p.id));ids.add(p.id);assert.ok(Number.isInteger(p.x)&&p.x>=0&&p.x<256&&Number.isInteger(p.y)&&p.y>=0&&p.y<256);assert.ok(p.rgba.length===4&&p.rgba.every(v=>v===0||v===255));points++;}}}
  assert.deepEqual([observations,points],[6,24]);return {contexts:4,observations,points,channels:points*4};
}
function compare(def,readback){
  assert.deepEqual([readback.width,readback.height,readback.format,readback.sourceFormat,readback.colorSpace,readback.alphaMode],[256,256,'rgba8unorm','rgba8unorm','srgb',def.alphaMode]);
  for(const k of ['frameId','serial','generation'])assert.ok(Number.isSafeInteger(readback[k])&&readback[k]>0);
  assert.ok(Array.isArray(readback.bytes)&&readback.bytes.length===262144&&readback.bytes.every(v=>Number.isInteger(v)&&v>=0&&v<=255));
  const bytes=Buffer.from(readback.bytes),samples=def.points.map(p=>{const at=4*(p.y*256+p.x),actual=[...bytes.subarray(at,at+4)],differences=actual.map((v,i)=>Math.abs(v-p.rgba[i]));return {id:p.id,x:p.x,y:p.y,expected:p.rgba,actual,tolerance:[0,0,0,0],differences,pass:differences.every(v=>v===0)};});
  const representationFailures=[];for(let i=0;i<bytes.length;i+=4){const a=bytes[i+3];if(def.alphaMode==='opaque'?a!==255:bytes[i]>a||bytes[i+1]>a||bytes[i+2]>a)if(representationFailures.length<16)representationFailures.push({pixel:i/4,rgba:[...bytes.subarray(i,i+4)]});}
  return {bytes,samples,representationFailures,pass:samples.every(s=>s.pass)&&representationFailures.length===0};
}
export async function main(args){
  const opt=options(args);assert.equal(process.version,'v26.7.0');assert.equal(process.execArgv.length,0);for(const k of Object.keys(process.env))if(['NODE_OPTIONS','NODE_PATH'].includes(k.toUpperCase()))assert.ok(!process.env[k]);
  const installed=fs.realpathSync(opt['--playwright']),output=path.resolve(opt['--output']);assert.ok(!fs.existsSync(output));
  assert.ok(samePhysicalPath(path.dirname(output),fs.realpathSync(path.dirname(output))));
  const require=createRequire(path.join(installed,'package.json')),core=fs.realpathSync(path.dirname(require.resolve('playwright-core/package.json')));
  const dependencyPins=[];for(const [owner,name] of [[installed,'playwright'],[core,'playwright-core']]){const pkg=JSON.parse(fs.readFileSync(path.join(owner,'package.json')));assert.equal(pkg.name,name);assert.equal(pkg.version,'1.62.1');dependencyPins.push({owner,...fingerprintFile(owner,'package.json')});}
  const input=collectSharedNativeInputs(root),counts=validate(input.cases);
  for(const owner of [root,installed,core,input.owners['robust-predicates']]){assert.ok(!samePhysicalPath(owner,output));let within=false;try{ownerRelativePath(owner,output);within=true;}catch{}assert.equal(within,false);}
  fs.mkdirSync(output);let artifactBytes=0,artifactsSealed=false;const artifacts=[];
  function save(name,body){assert.ok(!artifactsSealed);assert.ok(idPattern.test(name));const bytes=Buffer.isBuffer(body)?body:canonicalTextBytes(JSON.stringify(body,null,2));artifactBytes+=bytes.length;assert.ok(bytes.length<=16*1024*1024&&artifactBytes<=128*1024*1024);fs.writeFileSync(path.join(output,name),bytes,{flag:'wx'});const row={name,bytes:bytes.length,sha256:hash(bytes)};artifacts.push(row);return row;}
  const report={schemaVersion:1,status:'INCOMPLETE',started:new Date().toISOString(),node:process.version,counts,
    scope:'Four finite genuine SDK native contexts: immediate submissions, dirty state, B1 depth, one actual loss/replay and one close-before-actual-restore. No sustained recovery or performance claim.',
    launch:{channel:'msedge',headless:true,additionalFlags:[],deviceScaleFactor:1},inputs:save('input-closure.json',input.record),cases:save('fixed-cases.json',input.cases),runs:[],requests:[],errors:[],cleanupFailures:[]};
  let browser,server,origin,ending=false,launch;const lateClosures=[],deadline=performance.now()+270000;
  const hardStop=setTimeout(()=>{ending=true;report.status='INCOMPLETE';report.cleanupFailures.push({name:'HardDeadline',message:'305000 ms collector lifetime exceeded; cleanup unknown'});report.finished=new Date().toISOString();try{save('hard-stop.json',report);}finally{artifactsSealed=true;process.exit(3);}},305000);
  const html='<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"><style>html,body{margin:0;background:#000}canvas{display:block;width:256px;height:256px}</style><script type="importmap">'+JSON.stringify(input.importMap)+'</script></head><body><canvas id="shared" width="256" height="256"></canvas><script type="module">import {runLifetimeCase} from "/tools/shared-rendering/gl-lifetime-window.mjs";globalThis.runLifetimeCase=runLifetimeCase;</script></body></html>';
  try{
    server=createServer((request,response)=>{if(report.requests.length>=65536){report.eventOverflow=true;response.writeHead(429);response.end();return;}
      const url=new URL(request.url,'http://127.0.0.1'),body=request.method==='GET'&&!url.search&&!url.pathname.includes('%')?(url.pathname==='/'?Buffer.from(html):input.routes.get(url.pathname)):undefined;
      report.requests.push({path:request.url,status:body?200:404});response.writeHead(body?200:404,{'content-type':url.pathname==='/'?'text/html; charset=utf-8':url.pathname.endsWith('.json')?'application/json':'text/javascript; charset=utf-8','cache-control':'no-store'});response.end(body??'not found');});
    await bounded('server.listen',()=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);}),deadline);origin='http://127.0.0.1:'+server.address().port;
    const {chromium}=await import(pathToFileURL(path.join(installed,'index.mjs')).href);input.verifyStable();
    launch=chromium.launch({channel:'msedge',headless:true,timeout:20000}).then(value=>{browser=value;if(ending){const p=value.close();p.catch(()=>{});lateClosures.push(p);}return value;});launch.catch(()=>{});
    await bounded('browser.launch',()=>launch,deadline);report.browser=browser.version();
    for(const def of input.cases.cases){
      input.verifyStable();const prefix=def.id,errors=[],consoleMessages=[],observations=[];let context,native,primary,closed=false,runEnding=false;const until=Math.min(deadline,performance.now()+105000);
      const step=(label,operation)=>{assert.ok(!runEnding&&!ending);return bounded(prefix+':'+label,operation,until);};
      try{
        await step('context',()=>browser.newContext({viewport:{width:256,height:256},deviceScaleFactor:1,serviceWorkers:'block'}).then(value=>{context=value;if(runEnding||ending){const p=value.close();p.catch(()=>{});lateClosures.push(p);}return value;}));
        const page=await step('page',()=>context.newPage());page.setDefaultTimeout(20000);
        page.on('pageerror',error=>{if(errors.length<128)errors.push(errorRecord(error));else report.eventOverflow=true;});page.on('console',message=>{if(consoleMessages.length<128)consoleMessages.push({type:message.type(),text:message.text().slice(0,8000)});else report.eventOverflow=true;});
        await step('route',()=>context.route('**/*',async route=>{if(new URL(route.request().url()).origin!==origin){if(errors.length<128)errors.push({name:'ExternalRequest',message:route.request().url()});else report.eventOverflow=true;await route.abort();}else await route.continue();}));
        await step('binding',()=>page.exposeBinding('__retainLifetimeObservation',async(_source,row)=>{
          assert.ok(!runEnding&&!ending);assert.equal(row.caseId,def.id);const wanted=def.observations[observations.length];assert.ok(wanted);assert.equal(row.id,wanted.id);assert.equal(row.kind,row.id==='default-B'?'native-default-same-task':'sdk');
          const checked=compare(wanted,row.readback),raw=save(prefix+'-'+row.id+'.rgba',checked.bytes),{bytes,...metadata}=row.readback;
          observations.push({id:row.id,kind:row.kind,metadata,raw,samples:checked.samples,representationFailures:checked.representationFailures,pass:checked.pass});return true;
        }));
        await step('goto',()=>page.goto(origin+'/',{waitUntil:'load'}));await step('module',()=>page.waitForFunction(()=>typeof globalThis.runLifetimeCase==='function'));
        native=await step('native',()=>page.evaluate(async value=>globalThis.runLifetimeCase(value),def));
        assert.equal(native.status,'COMPLETE');assert.equal(native.caseId,def.id);assert.equal(native.contextAcquired,true);assert.equal(native.cleanup.hostClosed,true);assert.deepEqual(native.cleanup.failures,[]);assert.deepEqual(native.cleanup.pendingActors,[]);
        assert.equal(observations.length,def.observations.length);assert.ok(native.checks.length>0&&native.checks.every(row=>row.pass));assert.deepEqual(errors,[]);input.verifyStable();
        if(observations.some(row=>!row.pass))throw new NumericFailure('fixed numeric witness failed: '+def.id);
      }catch(error){primary=error;}
      finally{
        runEnding=true;if(context)try{await bounded('context.close',()=>context.close(),performance.now()+10000);closed=true;}catch(error){report.cleanupFailures.push({caseId:def.id,...errorRecord(error)});primary??=error;}
        // Browser callbacks may append errors while context.close is in flight.
        if(errors.length&&!primary)primary=Error('Page error arrived during context close');
        const receipt={caseId:def.id,native:native??null,observations,errors,consoleMessages,contextClosed:closed,failure:primary?errorRecord(primary):null};report.runs.push(receipt);save(prefix+'.json',receipt);
      }
      if(primary)throw primary;
    }
    assert.equal(report.runs.length,4);assert.equal(report.runs.reduce((n,r)=>n+r.observations.length,0),6);assert.equal(report.runs.reduce((n,r)=>n+r.observations.reduce((m,o)=>m+o.samples.length,0),0),24);
    for(const row of report.runs){assert.equal(row.contextClosed,true);assert.equal(row.failure,null);assert.deepEqual(row.errors,[]);assert.equal(row.native?.status,'COMPLETE');}
    for(const pin of dependencyPins)assert.deepEqual(fingerprintFile(pin.owner,pin.path),{path:pin.path,bytes:pin.bytes,sha256:pin.sha256});input.verifyStable();assert.ok(report.requests.every(r=>r.status===200)&&!report.eventOverflow);report.status='PASS';
  }catch(error){report.errors.push(errorRecord(error));report.status=error instanceof NumericFailure?'FAIL':'INCOMPLETE';}
  finally{
    ending=true;if(browser)try{await bounded('browser.close',()=>browser.close(),performance.now()+10000);report.browserClosed=true;}catch(error){report.cleanupFailures.push(errorRecord(error));}
    if(server)try{server.closeAllConnections();await bounded('server.close',()=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve())),performance.now()+5000);report.serverClosed=true;}catch(error){report.cleanupFailures.push(errorRecord(error));}
    if(lateClosures.length)try{await bounded('late acquisition cleanup',()=>Promise.all(lateClosures),performance.now()+10000);}catch(error){report.cleanupFailures.push(errorRecord(error));}
    try{for(const row of report.runs){assert.equal(row.contextClosed,true);assert.deepEqual(row.errors,[]);}report.identitiesStable=input.verifyStable();}catch(error){report.cleanupFailures.push(errorRecord(error));}
    if(report.cleanupFailures.length||!report.browserClosed||!report.serverClosed)report.status='INCOMPLETE';
    try{for(const row of artifacts){const after=fs.readFileSync(path.join(output,row.name));assert.equal(after.length,row.bytes);assert.equal(hash(after),row.sha256);}report.artifactsStable=true;}catch(error){report.cleanupFailures.push(errorRecord(error));report.status='INCOMPLETE';}
    report.finished=new Date().toISOString();save('result.json',report);artifactsSealed=true;clearTimeout(hardStop);
  }
  console.log(JSON.stringify({status:report.status,counts,runs:report.runs.length,errors:report.errors,cleanupFailures:report.cleanupFailures}));if(report.status!=='PASS')throw Error('Native SDK lifetime verification incomplete; inspect retained artifacts');
}
