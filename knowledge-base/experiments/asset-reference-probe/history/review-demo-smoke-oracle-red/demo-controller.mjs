import { createReferenceChain } from './reference-chain.mjs';

export function installDemo(canvas,button,{assetUrl='./assets/RiggedSimple/RiggedSimple.gltf'}={}) {
  let active=null,pending=null,raf=0,generation=0,disposed=false;
  const diagnostics={status:'idle',pending:false,activeOwners:0,rafScheduled:false,frames:0,lastError:null};
  button.disabled=false;
  function stop(){
    generation++;
    const loading=pending;pending=null;loading?.controller.abort();
    if(raf)cancelAnimationFrame(raf);raf=0;
    active?.dispose();active=null;
    diagnostics.status=disposed?'disposed':'idle';diagnostics.pending=false;diagnostics.activeOwners=0;diagnostics.rafScheduled=false;
    button.disabled=disposed;button.textContent='查看动画示例';button.removeAttribute('title');
  }
  function showError(error){
    stop();diagnostics.status='error';diagnostics.lastError=error.message;
    button.textContent='重试动画示例';button.title='加载失败，请重试';
  }
  async function start(){
    if(disposed||pending||active)return;
    const ticket={generation:++generation,controller:new AbortController()};
    pending=ticket;diagnostics.status='loading';diagnostics.pending=true;diagnostics.lastError=null;
    button.disabled=true;button.textContent='正在加载示例…';button.removeAttribute('title');
    let candidate=null;
    try {
      candidate=await createReferenceChain(canvas,{assetUrl,fontEpoch:0,signal:ticket.controller.signal});
      if(disposed||generation!==ticket.generation){candidate.dispose();return;}
      candidate.acquireInstance();candidate.setText('白鹭 · 真实骨骼动画',{font:'20px sans-serif',resolution:1,fontEpoch:0});
      if(disposed||generation!==ticket.generation){candidate.dispose();return;}
      const owner=candidate,startTime=performance.now();
      active=owner;pending=null;diagnostics.status='running';diagnostics.pending=false;diagnostics.activeOwners=1;
      button.disabled=false;button.textContent='停止动画示例';
      const tick=now=>{
        raf=0;diagnostics.rafScheduled=false;
        if(disposed||active!==owner||generation!==ticket.generation)return;
        try {
          if(owner.diagnostics.status==='disposed'){stop();return;}
          if(owner.diagnostics.status==='ready'){owner.renderAt((now-startTime)/1000);diagnostics.frames++;}
        } catch(error){showError(error);return;}
        if(active===owner&&generation===ticket.generation){raf=requestAnimationFrame(tick);diagnostics.rafScheduled=true;}
      };
      raf=requestAnimationFrame(tick);diagnostics.rafScheduled=true;
    } catch(error){
      candidate?.dispose();
      // Abort/stale results belong to an invalidated generation, not a new UI state.
      if(!disposed&&pending===ticket&&generation===ticket.generation)showError(error);
    }
  }
  const onClick=()=>{
    if(disposed||pending)return;
    if(active)stop();else void start();
  };
  function dispose(){
    if(disposed)return;disposed=true;stop();
    button.removeEventListener('click',onClick);window.removeEventListener('pagehide',dispose);
  }
  button.addEventListener('click',onClick);window.addEventListener('pagehide',dispose);
  return {stop,dispose,diagnostics};
}
