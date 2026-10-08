import { createReferenceChain } from './reference-chain.mjs';

// Initial extraction preserves the reviewed handler behavior for the red regression.
export function installDemo(canvas,button,{assetUrl='./assets/RiggedSimple/RiggedSimple.gltf'}={}) {
  let demoChain,raf=0;
  button.disabled=false;
  const stop=()=>{cancelAnimationFrame(raf);demoChain?.dispose();demoChain=null;button.textContent='查看动画示例';};
  const onClick=async()=>{
    if(demoChain){stop();return;}
    demoChain=await createReferenceChain(canvas,{assetUrl,fontEpoch:0});
    demoChain.acquireInstance();demoChain.setText('白鹭 · 真实骨骼动画',{font:'20px sans-serif',resolution:1,fontEpoch:0});
    const start=performance.now();const tick=now=>{if(demoChain.diagnostics.status==='ready')demoChain.renderAt((now-start)/1000);raf=requestAnimationFrame(tick);};
    raf=requestAnimationFrame(tick);button.textContent='停止动画示例';
  };
  button.addEventListener('click',onClick);window.addEventListener('pagehide',stop);
  return {stop,dispose:()=>{stop();button.removeEventListener('click',onClick);window.removeEventListener('pagehide',stop);}};
}
