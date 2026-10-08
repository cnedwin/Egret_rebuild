import { runIntegrationTests } from './integration-tests.mjs';
import { createReferenceChain } from './reference-chain.mjs';
const token=new URLSearchParams(location.search).get('token');
const report=await runIntegrationTests();
document.querySelector('#results').replaceChildren(...report.results.map(r=>{const li=document.createElement('li');li.textContent=`${r.status==='passed'?'通过':'未通过'} · ${r.id}${r.actual.error?'：'+r.actual.error:''}`;return li;}));
window.probeReport=report;
if(token){const response=await fetch('/report',{method:'POST',headers:{'Content-Type':'application/json','X-Run-Token':token},body:JSON.stringify(report)});if(!response.ok)throw new Error('Report save rejected');}
document.querySelector('#state').textContent=`已保存：${report.counts.passed}/${report.counts.executed} 项通过`;
let demoChain,raf=0;
const button=document.querySelector('#demo');button.disabled=false;
button.addEventListener('click',async()=>{if(demoChain){cancelAnimationFrame(raf);demoChain.dispose();demoChain=null;button.textContent='查看动画示例';return;}demoChain=await createReferenceChain(document.querySelector('#demo-canvas'),{assetUrl:'./assets/RiggedSimple/RiggedSimple.gltf',fontEpoch:0});demoChain.acquireInstance();demoChain.setText('白鹭 · 真实骨骼动画',{font:'20px sans-serif',resolution:1,fontEpoch:0});const start=performance.now();const tick=now=>{if(demoChain.diagnostics.status==='ready')demoChain.renderAt((now-start)/1000);raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);button.textContent='停止动画示例';});
window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);demoChain?.dispose();});
