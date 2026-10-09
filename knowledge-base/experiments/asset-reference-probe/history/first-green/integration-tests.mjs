import { createReferenceChain } from './reference-chain.mjs';
const assetUrl = './assets/RiggedSimple/RiggedSimple.gltf';
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const equalPixels = (a,b) => a.length === b.length && a.every((v,i) => v === b[i]);
function pixels(canvas, region=[220,0,420,400]) {
  const gl = canvas.getContext('webgl2'), [x,y,w,h] = region;
  const p = new Uint8Array(w*h*4); gl.readPixels(x,y,w,h,gl.RGBA,gl.UNSIGNED_BYTE,p); return p;
}
const colored = p => { let n=0; for(let i=0;i<p.length;i+=4) if(p[i+3]>0 && p[i]+p[i+1]+p[i+2]>15)n++; return n; };
const mesh = instance => { let found; instance.root.traverse(o=>{if(o.isSkinnedMesh)found=o;}); return found; };
async function rejects(fn, pattern) { try { await fn(); } catch(e) { assert(pattern.test(e.message), `Wrong rejection: ${e.message}`); return e.message; } throw new Error('Expected rejection, got success'); }
const wait = ms => new Promise(r=>setTimeout(r,ms));
function event(target,name) { return new Promise((resolve,reject)=>{ const timer=setTimeout(()=>reject(new Error(`Timeout: ${name}`)),8000); target.addEventListener(name,()=>{clearTimeout(timer);resolve();},{once:true}); }); }
export async function runIntegrationTests() {
  const results=[]; const fixture=async(fn,options={})=>{
    const canvas=document.createElement('canvas'); canvas.width=640;canvas.height=400; document.querySelector('#test-canvases').append(canvas);
    let chain; try { chain=await createReferenceChain(canvas,{assetUrl,fontEpoch:0,...options});return await fn(chain,canvas); }
    finally { chain?.dispose();canvas.remove(); }
  };
  async function test(id,input,expected,breakCaught,fn){try{const actual=await fn();results.push({id,input,expected,breakCaught,status:'passed',actual});}catch(e){results.push({id,input,expected,breakCaught,status:'failed',actual:{error:e.message}});} }
  await test('real-skinned-animation','RiggedSimple; fixed seconds 0 and 0.7','1 skinned mesh, 2 bones, >1000 colored pixels and changed pose/pixels','Dropping real loader, scene normalization, or mixer update',()=>fixture(async(c,canvas)=>{
    const a=c.acquireInstance(), m=mesh(a); assert(m && m.skeleton.bones.length===2,'Expected real two-bone skinned asset');
    c.renderAt(0,{ui:false});const before=pixels(canvas), bone=m.skeleton.bones[1].quaternion.toArray();c.renderAt(.7,{ui:false});const after=pixels(canvas);
    assert(colored(before)>1000 && colored(after)>1000,'Real mesh pixels are blank');assert(!equalPixels(before,after),'Animation did not change real pixels');assert(bone.some((v,i)=>Math.abs(v-m.skeleton.bones[1].quaternion.toArray()[i])>.0001),'Bone pose did not change');
    return {bones:2,beforeColored:colored(before),afterColored:colored(after),changedBytes:before.reduce((n,v,i)=>n+(v!==after[i]),0)};
  }));
  await test('independent-shared-instances','2 instances; pose offsets 0 / 0.7','Shared geometry/material, distinct skeleton/bones/mixers and distinct sampled poses','Sharing skeleton or mixer instance',()=>fixture(async(c)=>{
    const a=c.acquireInstance(),b=c.acquireInstance();b.timeOffset=.7;const am=mesh(a),bm=mesh(b);c.renderAt(0,{ui:false});
    assert(am.geometry===bm.geometry && am.material===bm.material,'Geometry/material must be shared');assert(am.skeleton!==bm.skeleton && am.skeleton.bones[1]!==bm.skeleton.bones[1] && a.mixer!==b.mixer,'Instance pose resources must be independent');
    assert(am.skeleton.bones[1].quaternion.toArray().some((v,i)=>Math.abs(v-bm.skeleton.bones[1].quaternion.toArray()[i])>.0001),'Instance poses alias');return {geometryShared:true,materialShared:true,independentPose:true};
  }));
  await test('last-release-lifecycle','Acquire twice, release first, render second, release last','No first-release shared dispose; second visible; exactly 1 final geometry/material dispose; released roots/mixers null','Eager shared disposal or retained instance roots',()=>fixture(async(c,canvas)=>{
    const a=c.acquireInstance(),b=c.acquireInstance(),m=mesh(b);let gd=0,md=0;m.geometry.addEventListener('dispose',()=>gd++);m.material.addEventListener('dispose',()=>md++);
    c.releaseInstance(a);assert(gd===0&&md===0,'Shared assets disposed before last release');assert(a.root===null&&a.mixer===null,'First release retains root/mixer');c.renderAt(.7,{ui:false});assert(colored(pixels(canvas))>1000,'Second instance disappeared');
    c.releaseInstance(b);assert(gd===1&&md===1,'Final release did not dispose shared assets exactly once');assert(b.root===null&&b.mixer===null&&c.diagnostics.instances===0&&c.diagnostics.bundleRoot===null,'Last release retains roots');await rejects(()=>c.acquireInstance(),/released|disposed/i);return {firstReleaseSharedDisposes:0,finalGeometryDisposes:gd,finalMaterialDisposes:md};
  }));
  await test('ui-three-handoff','Clean frame 0.7; 12 UI/3D frame handoffs; no-UI 0.7','Exact 3D-region byte equality, nonblank Canvas UI region, gl.NO_ERROR','Missing renderer.resetState or incomplete explicit UI GL state',()=>fixture(async(c,canvas)=>{
    c.acquireInstance();c.renderAt(.7,{ui:false});const clean=pixels(canvas);assert(colored(clean)>1000,'Clean reference is blank');for(let i=0;i<12;i++)c.renderAt(.7,{ui:true});const withUi=pixels(canvas),up=pixels(canvas,[0,300,200,100]);assert(equalPixels(clean,withUi),'UI handoff altered 3D region');assert(colored(up)>100,'UI pass is blank');c.renderAt(.7,{ui:false});assert(equalPixels(clean,pixels(canvas)),'Return to Three altered pixels');const error=canvas.getContext('webgl2').getError();assert(error===0,`GL error ${error}`);return {handoffs:12,threeRegionEqual:true,uiColored:colored(up),glError:error};
  }));
  await test('native-text-cache-epoch','Exact raw string "白鹭 é 👩‍💻  "; same style/resolution then epoch 1','Native measureText/fillText preserve raw; same cache reused; epoch regenerates Canvas texture','Normalizing raw text or omitting fontEpoch from cache key',()=>fixture(async(c,canvas)=>{
    const raw='白鹭 é 👩‍💻  ';const measured=[],filled=[];const p=CanvasRenderingContext2D.prototype,om=p.measureText,of=p.fillText;
    p.measureText=function(t){measured.push(t);return om.call(this,t);};p.fillText=function(t,...args){filled.push(t);return of.call(this,t,...args);};
    try { c.acquireInstance();c.setText(raw,{font:'20px sans-serif',resolution:1,fontEpoch:0});c.renderAt(0);const first=c.diagnostics.ui.generations;c.setText(raw,{font:'20px sans-serif',resolution:1,fontEpoch:0});c.renderAt(0);assert(c.diagnostics.ui.generations===first,'Identical text/style cache missed');c.setText(raw,{font:'20px sans-serif',resolution:1,fontEpoch:1});c.renderAt(0);assert(c.diagnostics.ui.generations===first+1,'Font epoch did not invalidate cache');assert(measured.length===2&&filled.length===2&&measured.every(t=>t===raw)&&filled.every(t=>t===raw),'Native Canvas calls changed raw text or did not regenerate');return {raw,measureCalls:2,fillCalls:2,epochRegenerated:true}; }
    finally {p.measureText=om;p.fillText=of;}
  }));
  await test('required-extension-policy','Real asset JSON plus Egret_unknown_required in extensionsRequired','Rejected before loader success with unsupported required extension','Ignoring required extension policy',async()=>{
    const json=await (await fetch(assetUrl)).json();json.extensionsRequired=['Egret_unknown_required'];json.extensionsUsed=['Egret_unknown_required'];const message=await fixture(()=>{throw new Error('Unsupported required extension accepted');},{assetUrl:'data:application/json,'+encodeURIComponent(JSON.stringify(json))}).catch(e=>{assert(/unsupported required.*Egret_unknown_required/i.test(e.message),`Wrong rejection: ${e.message}`);return e.message;});return {message};
  });
  await test('optional-extension-policy','Real asset JSON plus Egret_unknown_optional only in extensionsUsed','Ignored optional extension still displays real skinned asset','Over-rejecting optional extensions',async()=>{
    const json=await (await fetch(assetUrl)).json();json.extensionsUsed=['Egret_unknown_optional'];return fixture(async(c,canvas)=>{c.acquireInstance();c.renderAt(.7,{ui:false});const n=colored(pixels(canvas));assert(n>1000,'Optional extension blocked real display');return {colored:n};},{assetUrl:'data:application/json,'+encodeURIComponent(JSON.stringify(json))});
  });
  await test('actual-context-restore','WEBGL_lose_context; render 0.7, lose, restore, render 0.7','Lost render rejects; fixed mesh AND UI pixels return exactly, UI regenerated','Missing lost guard, UI resource recreation, or source text regeneration',()=>fixture(async(c,canvas)=>{
    c.acquireInstance();c.setText('恢复 白鹭',{font:'20px sans-serif',resolution:1,fontEpoch:0});c.renderAt(.7);const before=pixels(canvas),beforeUI=pixels(canvas,[0,300,200,100]),gen=c.diagnostics.ui.generations;const ext=canvas.getContext('webgl2').getExtension('WEBGL_lose_context');assert(ext,'WEBGL_lose_context unavailable');
    const lost=event(canvas,'webglcontextlost');ext.loseContext();await lost;assert(c.diagnostics.status==='lost','Chain reported ready while lost');await rejects(()=>c.renderAt(.7),/lost/i);const restored=event(canvas,'webglcontextrestored');await wait(100);ext.restoreContext();await restored;await c.waitForRestore();c.renderAt(.7);
    assert(colored(pixels(canvas))>1000&&equalPixels(before,pixels(canvas)),'Restored real mesh frame differs or blank');assert(colored(pixels(canvas,[0,300,200,100]))>100&&equalPixels(beforeUI,pixels(canvas,[0,300,200,100])),'Restored Canvas UI differs or blank');assert(c.diagnostics.ui.generations===gen+1,'Restore did not regenerate Canvas texture');return {meshEqual:true,uiEqual:true,regenerated:true,status:c.diagnostics.status};
  }));
  await test('disposed-owner','Acquire, render, dispose twice; render/acquire after disposal','Reject post-dispose operations, no instance/bundle/UI roots; no restore listener effect','Leaving owner roots or listeners alive',()=>fixture(async(c,canvas)=>{
    const a=c.acquireInstance();c.renderAt(0);c.dispose();c.dispose();await rejects(()=>c.renderAt(0),/disposed/i);await rejects(()=>c.acquireInstance(),/disposed/i);canvas.dispatchEvent(new Event('webglcontextrestored'));assert(c.diagnostics.status==='disposed'&&c.diagnostics.bundleRoot===null&&c.diagnostics.instances===0&&c.diagnostics.ui.disposed&&a.root===null&&a.mixer===null,'Disposed owner retained roots or revived');return {status:c.diagnostics.status,instances:0,rootsCleared:true};
  }));
  await test('aborted-initialization','Abort immediately while embedded asset fetch/parse initializes','Creation rejects AbortError; no ready chain','Ignoring cancellation during initialization',async()=>{
    const controller=new AbortController(),canvas=document.createElement('canvas');canvas.width=640;canvas.height=400;const pending=createReferenceChain(canvas,{assetUrl,signal:controller.signal});controller.abort();const message=await rejects(()=>pending,/abort/i);return {message};
  });
  await test('aborted-ready-owner','Abort signal after loaded chain renders','Ready owner disposes and further render rejects','Ignoring cancellation after ownership becomes ready',async()=>{
    const controller=new AbortController();return fixture(async(c,canvas)=>{const a=c.acquireInstance();c.renderAt(0);controller.abort();await rejects(()=>c.renderAt(0),/disposed|abort/i);assert(c.diagnostics.status==='disposed'&&a.root===null,'Abort did not clear ready owner');return {status:c.diagnostics.status};},{signal:controller.signal});
  });
  return {runId:crypto.randomUUID(),createdAt:new Date().toISOString(),counts:{executed:results.length,passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length},results,environment:{userAgent:navigator.userAgent,webgl:'WebGL2',canvas:[640,400],devicePixelRatio},limits:['Desktop browser integration reference only','No timing, power, mobile, production-host, full 2D or engine migration acceptance','System-font Canvas smoke test does not establish CJK coverage, IME correctness or text performance']};
}
