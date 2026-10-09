import { runIntegrationTests } from './integration-tests.mjs';
import { installDemo } from './demo-controller.mjs';
const token=new URLSearchParams(location.search).get('token');
const report=await runIntegrationTests();
const labels={'real-skinned-animation':'真实资产与骨骼动画','independent-shared-instances':'独立姿态与共享资产','last-release-lifecycle':'引用释放与资源清理','ui-three-handoff':'界面与动画交接','native-text-cache-epoch':'原生文字与缓存更新','required-extension-policy':'必需扩展检查','optional-extension-policy':'可选扩展容错','actual-context-restore':'画布丢失与恢复','disposed-owner':'停止后的资源清理','aborted-initialization':'初始化取消','aborted-ready-owner':'运行后取消','late-parsed-owner-abort':'加载完成后的取消'};
document.querySelector('#results').replaceChildren(...report.results.map(r=>{const li=document.createElement('li');li.textContent=`${r.status==='passed'?'通过':'未通过'} · ${labels[r.id]||r.id}`;return li;}));
window.probeReport=report;
if(token){const response=await fetch('/report',{method:'POST',headers:{'Content-Type':'application/json','X-Run-Token':token},body:JSON.stringify(report)});if(!response.ok)throw new Error('Report save rejected');}
document.querySelector('#state').textContent=`${token?'已保存':'验证完成'}：${report.counts.passed}/${report.counts.executed} 项通过`;
window.demoController=installDemo(document.querySelector('#demo-canvas'),document.querySelector('#demo'));
