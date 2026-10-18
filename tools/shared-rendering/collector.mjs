// SPDX-License-Identifier: Apache-2.0
// Finite native execution of independently frozen shared-profile pixel targets.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {collectSharedNativeInputs} from './native-source.mjs';
import {samePhysicalPath,ownerRelativePath,fingerprintFile,canonicalTextBytes} from '../lib/file-identity.mjs';

const root=fs.realpathSync(fileURLToPath(new URL('../..',import.meta.url)));
const hash=body=>createHash('sha256').update(body).digest('hex');
const errorRecord=error=>({name:error?.name??'Error',message:String(error?.message??error).slice(0,16000)});
const idPattern=/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/;
class NumericFailure extends Error {}
function requireNumeric(value,message){if(!value)throw new NumericFailure(message);}
// Playwright's default timeout does not cover page.evaluate. Every asynchronous
// browser operation also has a Node-owned deadline, including final cleanup.
async function bounded(label,operation,deadline){
  const remaining=deadline-performance.now();
  assert.ok(remaining>0,'Native deadline: '+label);
  let timer;
  const work=Promise.resolve().then(operation);
  try{return await Promise.race([work,new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(Error('Native deadline: '+label)),remaining);
  })]);}finally{clearTimeout(timer);}
}
function options(args){
  assert.equal(args.length,6);const result={};
  for(let i=0;i<args.length;i+=2){assert.ok(['--playwright','--channel','--output'].includes(args[i]));assert.ok(!Object.hasOwn(result,args[i]));result[args[i]]=args[i+1];}
  assert.equal(result['--channel'],'msedge');
  assert.ok(path.isAbsolute(result['--playwright'])&&path.isAbsolute(result['--output']));return result;
}
function compareCase(definition,readback){
  assert.deepEqual([readback.width,readback.height,readback.format,readback.colorSpace,readback.alphaMode],
    [definition.width,definition.height,'rgba8unorm','srgb',definition.outputAlpha]);
  assert.ok(['rgba8unorm','bgra8unorm'].includes(readback.sourceFormat));
  assert.ok(Number.isSafeInteger(readback.serial)&&readback.serial>0&&Number.isSafeInteger(readback.frameId)&&readback.frameId>0);
  assert.ok(Array.isArray(readback.bytes)&&readback.bytes.length===4*definition.width*definition.height);
  assert.ok(readback.bytes.every(value=>Number.isInteger(value)&&value>=0&&value<=255));
  const bytes=Buffer.from(readback.bytes),samples=[],representationFailures=[];
  for(let offset=0;offset<bytes.length;offset+=4){
    const alpha=bytes[offset+3];
    if(definition.outputAlpha==='opaque'?alpha!==255:
      bytes[offset]>alpha||bytes[offset+1]>alpha||bytes[offset+2]>alpha){
      if(representationFailures.length<16)representationFailures.push({pixel:offset/4,rgba:[...bytes.subarray(offset,offset+4)]});
    }
  }
  for(const point of definition.points){
    const offset=4*(point.y*definition.width+point.x),actual=[...bytes.subarray(offset,offset+4)];
    const differences=actual.map((value,index)=>Math.abs(value-point.expectedRGBA[index]));
    const failedChannels=point.channels.filter(channel=>differences[channel]>point.tolerance[channel]);
    const bleedFailure=point.bleed?actual[point.bleed.channel]>point.bleed.max:false;
    samples.push({id:point.id,actual,expected:point.expectedRGBA,tolerance:point.tolerance,
      channels:point.channels,differences,failedChannels,bleedFailure,coverageOnly:point.coverageOnly===true,
      pass:failedChannels.length===0&&!bleedFailure});
  }
  return {bytes,samples,representationFailures,pass:samples.every(row=>row.pass)&&representationFailures.length===0};
}
function validateManifest(manifest,controls){
  assert.ok(Array.isArray(manifest.cases)&&manifest.cases.length>0&&manifest.cases.length<=96);
  assert.ok(Array.isArray(manifest.pages)&&Array.isArray(manifest.regions));
  const ids=new Set();let points=0;
  for(const def of manifest.cases){
    assert.ok(idPattern.test(def.id)&&!ids.has(def.id));ids.add(def.id);
    assert.deepEqual([def.width,def.height],[256,256]);assert.ok(['opaque','premultiplied'].includes(def.outputAlpha));
    assert.ok(Array.isArray(def.points)&&def.points.length>0);
    const names=new Set();
    for(const sample of def.points){
      assert.ok(idPattern.test(sample.id)&&!names.has(sample.id));names.add(sample.id);
      assert.ok(Number.isInteger(sample.x)&&sample.x>=0&&sample.x<def.width&&Number.isInteger(sample.y)&&sample.y>=0&&sample.y<def.height);
      assert.ok(sample.expectedRGBA.length===4&&sample.expectedRGBA.every(value=>Number.isInteger(value)&&value>=0&&value<=255));
      assert.ok(sample.tolerance.length===4&&sample.tolerance.every(value=>Number.isInteger(value)&&value>=0&&value<=3)&&sample.tolerance[3]<=2);
      assert.ok(sample.channels.length>0&&new Set(sample.channels).size===sample.channels.length&&sample.channels.every(value=>Number.isInteger(value)&&value>=0&&value<=3));
      assert.ok(Number.isInteger(sample.maxEffectiveWrites)&&sample.maxEffectiveWrites>=0&&sample.maxEffectiveWrites<=4);
      if(sample.bleed){assert.ok(sample.bleed.max===0||sample.bleed.max===1);assert.ok(Number.isInteger(sample.bleed.channel)&&sample.bleed.channel>=0&&sample.bleed.channel<=3);}
      points++;
    }
  }
  assert.ok(points<=4096);assert.ok(Array.isArray(controls)&&controls.length>0&&controls.length<=16);
  const negatives=new Map(manifest.negatives.map(row=>[row.id,row]));
  assert.equal(new Set(controls.map(row=>row.id)).size,controls.length);
  assert.deepEqual([...negatives.keys()].sort(),controls.map(row=>row.id).sort());
  for(const control of controls){
    assert.ok(idPattern.test(control.id));assert.ok(ids.has(control.caseId));
    assert.ok(typeof control.file==='string'&&/^packages\/engine\/dist\/(?:web|rendering)\/[A-Za-z0-9]+\.js$/.test(control.file),'control must alter a product emission');
    assert.ok(typeof control.from==='string'&&control.from.length>0&&typeof control.to==='string'&&control.to!==control.from);
    const witness=negatives.get(control.id),def=manifest.cases.find(row=>row.id===control.caseId);
    assert.equal(witness.caseId,control.caseId);assert.equal(witness.pointId,control.pointId);
    const point=def.points.find(row=>row.id===witness.pointId);assert.ok(point&&point.channels.includes(witness.channel));
    assert.equal(witness.T,point.tolerance[witness.channel]);
    assert.deepEqual(witness.expectedCorrectRGBA,point.expectedRGBA);
    assert.equal(witness.delta,Math.abs(witness.expectedCorrectRGBA[witness.channel]-witness.expectedWrongRGBA[witness.channel]));
    assert.ok(witness.delta>=16&&witness.delta>=4*witness.T+4);
  }
  return {cases:manifest.cases.length,points,controls:controls.length};
}

export async function main(args){
  const opt=options(args);
  assert.equal(process.version,'v26.7.0');assert.equal(process.execArgv.length,0);
  for(const key of Object.keys(process.env))if(['NODE_OPTIONS','NODE_PATH'].includes(key.toUpperCase()))assert.ok(!process.env[key]);
  const installed=fs.realpathSync(opt['--playwright']),output=path.resolve(opt['--output']);
  assert.ok(!fs.existsSync(output));assert.ok(samePhysicalPath(path.dirname(output),fs.realpathSync(path.dirname(output))));
  for(const owner of [root,installed]){assert.ok(!samePhysicalPath(owner,output));let within=false;try{ownerRelativePath(owner,output);within=true;}catch{}assert.equal(within,false);}
  const require=createRequire(path.join(installed,'package.json'));
  const core=fs.realpathSync(path.dirname(require.resolve('playwright-core/package.json')));
  const dependencyPins=[{owner:installed,...fingerprintFile(installed,'package.json')},{owner:core,...fingerprintFile(core,'package.json')}];
  for(const [owner,name] of [[installed,'playwright'],[core,'playwright-core']]){
    const pkg=JSON.parse(fs.readFileSync(path.join(owner,'package.json')));assert.equal(pkg.name,name);assert.equal(pkg.version,'1.62.1');
  }
  const input=collectSharedNativeInputs(root),counts=validateManifest(input.manifest,input.controls);
  const preparedControls=input.controls.map(control=>{
    assert.ok(input.modules.has(control.file),'control changes one served emitted module');
    const original=input.routes.get('/'+control.file);
    assert.deepEqual({bytes:original.length,sha256:hash(original)},control.original,'reviewed original module identity');
    const text=new TextDecoder('utf-8',{fatal:true}).decode(original);
    assert.equal(text.split(control.from).length,2,'unique source-bound mutation');
    const altered=Buffer.from(text.replace(control.from,control.to));
    assert.deepEqual({bytes:altered.length,sha256:hash(altered)},control.changed,'reviewed changed module identity');
    return {control,original,altered};
  });
  for(const owner of [core,...Object.values(input.owners)]){
    assert.ok(!samePhysicalPath(owner,output));let within=false;
    try{ownerRelativePath(owner,output);within=true;}catch{}assert.equal(within,false);
  }
  fs.mkdirSync(output);
  let artifactBytes=0;
  function save(name,body){
    assert.ok(idPattern.test(name),'artifact basename');const bytes=Buffer.isBuffer(body)?body:canonicalTextBytes(JSON.stringify(body,null,2));
    artifactBytes+=bytes.length;assert.ok(bytes.length<=16*1024*1024&&artifactBytes<=128*1024*1024,'artifact budget');
    fs.writeFileSync(path.join(output,name),bytes,{flag:'wx'});return {name,bytes:bytes.length,sha256:hash(bytes)};
  }
  const report={schemaVersion:1,status:'INCOMPLETE',started:new Date().toISOString(),node:process.version,
    launch:{channel:'msedge',headless:true,additionalFlags:[],deviceScaleFactor:1},counts,
    input:save('input-closure.json',input.record),runs:[],controls:[],requests:[],errors:[],cleanupFailures:[],
    limits:['Finite recorded desktop pixel quality only.','No phones, cross-device, physical display, sustained performance or full Spine acceptance.']};
  let browser,server,origin,currentRoutes=input.routes;
  const operationDeadline=performance.now()+270000;
  const html='<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"><style>html,body{margin:0;background:#000}canvas{display:block;width:256px;height:256px}</style><script type="importmap">'+JSON.stringify(input.importMap)+'</script></head><body><canvas id="shared" width="256" height="256"></canvas><script type="module">import {runSharedNativeCase} from "/tools/shared-rendering/native-window.mjs";globalThis.runSharedNativeCase=runSharedNativeCase;</script></body></html>';
  try{
    server=createServer((request,response)=>{
      if(report.requests.length>=65536){response.writeHead(429);response.end();return;}
      const url=new URL(request.url,'http://127.0.0.1');
      const body=request.method==='GET'&&!url.search&&!url.pathname.includes('%')?(url.pathname==='/'?Buffer.from(html):currentRoutes.get(url.pathname)):undefined;
      report.requests.push({path:request.url,status:body?200:404});
      response.writeHead(body?200:404,{'content-type':url.pathname==='/'?'text/html; charset=utf-8':url.pathname.endsWith('.json')?'application/json':'text/javascript; charset=utf-8','cache-control':'no-store'});
      response.end(body??'not found');
    });
    await bounded('server.listen',()=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);}),operationDeadline);
    origin='http://127.0.0.1:'+server.address().port;
    const {chromium}=await import(pathToFileURL(path.join(installed,'index.mjs')).href);
    browser=await bounded('browser.launch',()=>chromium.launch({channel:'msedge',headless:true,timeout:20000}),operationDeadline);report.browser=browser.version();
    let ordinal=0;
    async function run(def,mode,changed){
      input.verifyStable();currentRoutes=new Map(input.routes);
      if(changed)currentRoutes.set('/'+changed.file,changed.body);
      const prefix=String(++ordinal).padStart(3,'0')+'-'+mode+'-'+def.id;
      assert.ok(prefix.length<=86);
      const errors=[],observations=[];
      const deadline=Math.min(operationDeadline,performance.now()+105000);
      const step=(label,operation)=>bounded(prefix+':'+label,operation,deadline);
      let context,native,primary,closeOk=false;
      try{
        context=await step('context',()=>browser.newContext({viewport:{width:256,height:256},deviceScaleFactor:1}));
        const page=await step('page',()=>context.newPage());page.setDefaultTimeout(20000);
        page.on('pageerror',error=>errors.push(errorRecord(error)));
        await step('route',()=>context.route('**/*',async route=>{
          if(new URL(route.request().url()).origin!==origin){errors.push({name:'ExternalRequest',message:route.request().url()});await route.abort();}
          else await route.continue();
        }));
        await step('binding',()=>page.exposeBinding('__retainSharedObservation',async(_source,row)=>{
          assert.equal(row.caseId,def.id);assert.equal(observations.length,0);
          const checked=compareCase(def,row.readback);
          const raw=save(prefix+'.rgba',checked.bytes),pngs=[];
          const {bytes,...readback}=row.readback;
          observations.push({...checked,bytes:undefined,readback,raw,pngs});
          for(const background of ['black','white']){
            await step('background',()=>page.evaluate(color=>{document.body.style.backgroundColor=color;document.documentElement.style.backgroundColor=color;},background));
            pngs.push(save(prefix+'-'+background+'.png',await step('screenshot',()=>page.screenshot({type:'png'}))));
          }
          return true;
        }));
        await step('goto',()=>page.goto(origin+'/',{waitUntil:'load'}));
        await step('module',()=>page.waitForFunction(()=>typeof globalThis.runSharedNativeCase==='function'));
        native=await step('native',()=>page.evaluate(async({def,pages,regions})=>globalThis.runSharedNativeCase(def,pages,regions),
          {def,pages:input.manifest.pages,regions:input.manifest.regions}));
        assert.equal(observations.length,1,'one retained native observation');
        assert.equal(native.status,'COMPLETE');assert.equal(native.caseId,def.id);
        assert.equal(native.cleanup.hostClosed,true);assert.equal(native.cleanup.deviceDestroyed,true);assert.equal(native.cleanup.lossSettled,true);
        assert.deepEqual(native.cleanup.failures,[]);assert.deepEqual(native.uncaptured,[]);assert.equal(native.unexpectedDeviceLoss,false);
        assert.deepEqual(errors,[]);input.verifyStable();
      }catch(error){primary=error;}
      finally{
        if(context)try{await bounded('context.close',()=>context.close(),performance.now()+10000);closeOk=true;}
        catch(error){report.cleanupFailures.push({context:prefix,...errorRecord(error)});if(!primary)primary=error;}
        // Persist incomplete/unsupported results and callback failures as well as
        // successful observations. Numeric classification happens only afterward.
        const receipt={mode,caseId:def.id,native:native??null,observations,errors,
          contextClosed:closeOk,failure:primary?errorRecord(primary):null};
        report.runs.push(receipt);save(prefix+'.json',receipt);
      }
      if(primary)throw primary;
      return {mode,caseId:def.id,native,observation:observations[0]};
    }
    for(const def of input.manifest.cases){const row=await run(def,'positive');requireNumeric(row.observation.pass,'native pixels '+def.id);}
    for(const {control,original,altered} of preparedControls){
      const def=input.manifest.cases.find(row=>row.id===control.caseId),route='/'+control.file;
      const patch={id:control.id,file:control.file,original:{bytes:original.length,sha256:hash(original)},
        changed:save(control.id+'-module.js',altered),from:control.from,to:control.to};
      const baseline=await run(def,'baseline-'+control.id);requireNumeric(baseline.observation.pass,'control baseline '+control.id);
      let assigned,primary;
      try{assigned=await run(def,control.id,{file:control.file,body:altered});}
      catch(error){primary=error;}
      const restored=await run(def,'restored-'+control.id);requireNumeric(restored.observation.pass,'control restored '+control.id);
      if(primary)throw primary;
      const witness=input.manifest.negatives.find(row=>row.id===control.id);
      const sample=assigned.observation.samples.find(row=>row.id===control.pointId);
      requireNumeric(sample.failedChannels.includes(witness.channel),'assigned numeric witness must fail: '+control.id);
      report.controls.push({...patch,witness:control.pointId,channel:witness.channel,observed:sample.actual,baseline:true,restored:true,assignedFailure:true});
    }
    assert.equal(report.controls.length,counts.controls);input.verifyStable();
    for(const row of dependencyPins)assert.deepEqual(fingerprintFile(row.owner,row.path),{path:row.path,bytes:row.bytes,sha256:row.sha256});
    assert.ok(report.requests.every(row=>row.status===200));report.status='PASS';
  }catch(error){report.errors.push(errorRecord(error));report.status=error instanceof NumericFailure?'FAIL':'INCOMPLETE';}
  finally{
    if(browser)try{await bounded('browser.close',()=>browser.close(),performance.now()+10000);report.browserClosed=true;}catch(error){report.cleanupFailures.push(errorRecord(error));}
    if(server)try{server.closeAllConnections();await bounded('server.close',()=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve())),performance.now()+5000);report.serverClosed=true;}catch(error){report.cleanupFailures.push(errorRecord(error));}
    try{report.identitiesStable=input.verifyStable();}catch(error){report.cleanupFailures.push(errorRecord(error));}
    if(report.cleanupFailures.length||!report.browserClosed||!report.serverClosed)report.status='INCOMPLETE';
    report.finished=new Date().toISOString();save('result.json',report);
  }
  console.log(JSON.stringify({status:report.status,counts:report.counts,runs:report.runs.length,controls:report.controls.length,errors:report.errors,cleanupFailures:report.cleanupFailures}));
  if(report.status!=='PASS')throw Error('Shared native verification incomplete; inspect preserved artifacts');
}
