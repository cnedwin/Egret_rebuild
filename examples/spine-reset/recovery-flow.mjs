// SPDX-License-Identifier: Apache-2.0
// Application coordination only. The genuine Host retains every native owner.
export function createRecoveryFlow({engine,host,slot,frameOptions}){
 let current,closed=false,serial=0;
 const error=code=>Object.assign(Error(code),{code});
 function live(op){if(closed||current!==op||op.cancelled)throw error('FLOW_CANCELLED');}
 function generation(op){live(op);const session=host.getSessionStatus();if(session.state!=='ready'||session.generation!==op.ready.generation)throw error('FLOW_STALE_GENERATION');}
 function cancelRecord(op){if(!op||op.cancelled)return;op.cancelled=true;op.phase='cancelled';op.abort(error('FLOW_CANCELLED'));op.upload?.dispose();op.ticket?.dispose();}
 function begin(kind,ticket){if(closed){ticket?.dispose();throw error('FLOW_CLOSED');}cancelRecord(current);let abort;const cancelled=new Promise((_,reject)=>{abort=reject;});void cancelled.catch(()=>{});const op={id:++serial,kind,ticket,abort,cancelledPromise:cancelled,cancelled:false,phase:kind==='reset'?'loading':'recovering',cpuPublished:false,nativeSubmitted:false,nativeSettled:false};current=op;return op;}
 function wait(op,promise){return Promise.race([promise,op.cancelledPromise]);}
 function failed(op,cause){op.error=cause?.code??String(cause);if(!op.cancelled)op.phase=op.cpuPublished?'cpu-published-failed':'failed';op.upload?.dispose();if(!op.cpuPublished)op.ticket?.dispose();}
 async function stage(op,frame){live(op);op.frame=frame;op.upload=host.stageSharedFrame(frame);op.phase='uploading';op.ready=await wait(op,op.upload.ready);generation(op);op.phase='staged';return snapshot();}
 function snapshot(){if(!current)return {closed,phase:closed?'closed':'idle'};const {id,kind,phase,cpuPublished,nativeSubmitted,nativeSettled,error:failure,ready,cancelled}=current;return {closed,id,kind,phase,cpuPublished,nativeSubmitted,nativeSettled,error:failure,ready,cancelled};}
 async function prepare(request){
  if(closed)throw error('FLOW_CLOSED');
  // Genuine slot admission occurs before replacing a valid application intent.
  const ticket=slot.request(request),op=begin('reset',ticket);
  try{await wait(op,ticket.ready);live(op);return await stage(op,ticket.capture(frameOptions));}catch(cause){failed(op,cause);throw cause;}
 }
 function commit(){
  const op=current;if(!op||op.kind!=='reset'||op.phase!=='staged')throw error('FLOW_STAGE_FIRST');
  try{generation(op);try{op.ticket.commit();}finally{
   // CPU publication survives cleanup failures and diagnostic-triggered closure.
   op.cpuPublished=op.ticket.state==='committed';if(op.cpuPublished&&!op.cancelled)op.phase='cpu-published';
  }generation(op);return snapshot();}catch(cause){failed(op,cause);throw cause;}
 }
 function submit(){
  const op=current;if(!op||!['staged','cpu-published'].includes(op.phase)||(op.kind==='reset'&&!op.cpuPublished))throw error('FLOW_COMMIT_FIRST');
  try{
   // Recheck after CPU cleanup callbacks, before entering native submission.
   generation(op);op.nativeSubmitted='unknown';op.phase='submitting';
   const submission=op.upload.submit();op.nativeSubmitted=true;op.submission=submission;op.phase='submitted';
   // Observe actual settlement even if the caller cancels or replaces this intent.
   const settled=submission.completed.then(()=>{op.nativeSettled=true;if(current===op&&!op.cancelled)op.phase='settled';return snapshot();},cause=>{op.nativeSettled='failed';failed(op,cause);throw cause;});
   void settled.catch(()=>{});return wait(op,settled);
  }catch(cause){failed(op,cause);throw cause;}
 }
 async function replace(request){const pending=prepare(request),op=current;await pending;live(op);commit();return submit();}
 async function replay(){
  const op=begin('replay');
  try{await wait(op,host.whenReady());live(op);await stage(op,engine.captureSharedFrame(frameOptions));live(op);return await submit();}catch(cause){failed(op,cause);throw cause;}
 }
 function cancel(){cancelRecord(current);return snapshot();}
 function close(){if(!closed){closed=true;cancelRecord(current);}return snapshot();}
 return Object.freeze({prepare,commit,submit,replace,replay,cancel,close,inspect:snapshot});
}
