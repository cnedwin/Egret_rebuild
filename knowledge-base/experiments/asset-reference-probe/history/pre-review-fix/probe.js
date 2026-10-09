import { runIntegrationTests } from './integration-tests.mjs';
import { createReferenceChain } from './reference-chain.mjs';
const token=new URLSearchParams(location.search).get('token');
const report=await runIntegrationTests();
const labels={'real-skinned-animation':'真实资产与骨骼动画','independent-shared-instances':'独立姿态与共享资产','last-release-lifecycle':'引用释放与资源清理','ui-three-handoff':'界面与动画交接','native-text-cache-epoch':'原生文字与缓存更新','required-extension-policy':'必需扩展检查','optional-extension-policy':'可选扩展容错','actual-context-restore':'画布丢失与恢复','disposed-owner':'停止后的资源清理','aborted-initialization':'初始化取消','aborted-ready-owner':'运行后取消','late-parsed-owner-abort':'加载完成后的取消'};
document.querySelector('#results').replaceChildren(...report.results.map(r=>{const li=document.createElement('li');li.textContent=`${r.status==='passed'?'通过':'未通过'} · ${labels[r.id]||r.id}`;return li;}));
window.probeReport=report;
if(token){const response=await fetch('/report',{method:'POST',headers:{'Content-Type':'application/json','X-Run-Token':token},body:JSON.stringify(report)});if(!response.ok)throw new Error('Report save rejected');}
document.querySelector('#state').textContent=`${token?'已保存':'验证完成'}：${report.counts.passed}/${report.counts.executed} 项通过`;
let demoChain,raf=0;
const button=document.querySelector('#demo');button.disabled=false;
button.addEventListener('click',async()=>{if(demoChain){cancelAnimationFrame(raf);demoChain.dispose();demoChain=null;button.textContent='查看动画示例';return;}demoChain=await createReferenceChain(document.querySelector('#demo-canvas'),{assetUrl:'./assets/RiggedSimple/RiggedSimple.gltf',fontEpoch:0});demoChain.acquireInstance();demoChain.setText('白鹭 · 真实骨骼动画',{font:'20px sans-serif',resolution:1,fontEpoch:0});const start=performance.now();const tick=now=>{if(demoChain.diagnostics.status==='ready')demoChain.renderAt((now-start)/1000);raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);button.textContent='停止动画示例';});
window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);demoChain?.dispose();});
