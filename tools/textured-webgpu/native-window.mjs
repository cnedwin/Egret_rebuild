// First-party Apache-2.0 browser-side tooling. Uses the public fixture; contains no renderer.
// Actual device ownership remains here, outside the host's documented borrowed policy.
let lastWindow;
const observe=promise=>{promise.catch(()=>{});return promise;};
const fault=(cause,depth=0)=>({name:typeof cause?.name==='string'?cause.name:'Unknown',message:String(cause?.message??cause).slice(0,16000),
  code:typeof cause?.code==='string'?cause.code:null,stack:typeof cause?.stack==='string'?cause.stack.slice(0,16000):null,
  cause:depth<2&&cause?.cause!==undefined?fault(cause.cause,depth+1):null}); // Retained evidence only; public spellings never classify sensitivity.
const limits=value=>Object.fromEntries(Object.keys(Object.getPrototypeOf(value)).filter(key=>typeof value[key]==='number').map(key=>[key,value[key]]));
export function lastNativeWindow(){return lastWindow;}
export async function runNativeCase(caseId){
  const report={caseId,status:'INCOMPLETE',deviceAcquired:false,adapter:null,device:null,uncaptured:[],deviceLoss:null,scene:null,failure:null,
    environment:{userAgent:navigator.userAgent,platform:navigator.platform,browserDPR:devicePixelRatio,isSecureContext,preferredFormat:null},
    cleanup:{deviceDestroyed:false,lossSettled:false,failures:[]}};lastWindow=report;
  let device,loss,destroyRequested=false;
  const uncaptured=event=>{if(report.uncaptured.length>=128){report.eventOverflow=true;return;}report.uncaptured.push(fault(event.error));};
  try{
    if(!navigator.gpu){report.status='UNSUPPORTED';report.capability='navigator.gpu absent';return report;}
    report.environment.preferredFormat=navigator.gpu.getPreferredCanvasFormat();
    const adapter=await observe(navigator.gpu.requestAdapter());
    if(adapter===null){report.status='UNSUPPORTED';report.capability='default adapter unavailable';return report;}
    const info=adapter.info;report.adapter={info:info?{vendor:info.vendor,architecture:info.architecture,device:info.device,description:info.description}:null,
      isFallbackAdapter:adapter.isFallbackAdapter??null,features:[...adapter.features],limits:limits(adapter.limits)};
    device=await observe(adapter.requestDevice());report.deviceAcquired=true;
    report.device={label:device.label,features:[...device.features],limits:limits(device.limits)};
    device.addEventListener('uncapturederror',uncaptured);
    loss=observe(device.lost.then(info=>{report.deviceLoss={reason:info.reason,message:info.message,destroyRequested};
      report.unexpectedDeviceLoss=!destroyRequested;return info;}));
    // Each observation is acknowledged only after Node retains raw bytes and native canvas PNGs.
    const callback=async(id,role,row)=>{
      if(typeof globalThis.__retainTexturedObservation!=='function')throw Error('NATIVE_COLLECTOR_BINDING_MISSING');
      await observe(globalThis.__retainTexturedObservation({caseId:id,role,row}));
    };
    report.scene=await observe(globalThis.texturedFixtures.runCase(caseId,device,callback));
    report.status='SCENE_COMPLETED';
  }catch(cause){report.failure=fault(cause);report.scene=globalThis.texturedFixtures?.lastObservation()??null;}
  finally{
    if(device){try{destroyRequested=true;device.destroy();report.cleanup.deviceDestroyed=true;}catch(cause){report.cleanup.failures.push(fault(cause));}
      if(loss)try{await loss;report.cleanup.lossSettled=true;}catch(cause){report.cleanup.failures.push(fault(cause));}
      device.removeEventListener('uncapturederror',uncaptured);}
    // Public fixture cleanup is actual evidence; timeout or missing reports cannot substitute for it.
    if(report.scene){const close=report.scene.cleanup;
      if(!close||close.status?.state!=='closed'||close.status?.cleanupOutcome!=='safe'||close.failures?.length){
        report.cleanup.failures.push({name:'HostCleanupUnproven',message:'Actual public host safe-close receipt missing'});}}
    if(report.eventOverflow||report.uncaptured.length||report.unexpectedDeviceLoss||report.cleanup.failures.length||
      (report.deviceAcquired&&(!report.cleanup.deviceDestroyed||!report.cleanup.lossSettled)))report.status='INCOMPLETE';
  }
  return report;
}
