// SPDX-License-Identifier: Apache-2.0
// Fixed collector only; original native observation implementation is reused unchanged.
import {installOwnedRequestDeviceObservation} from '../../tools/shared-rendering/resource-recovery-observations.mjs';
export function install(backend){
 const canvas=document.querySelector('canvas'),events=[],observation=backend==='webgpu'?installOwnedRequestDeviceObservation():undefined;
 let extension;
 const onEvent=e=>events.push({type:e.type,trusted:e.isTrusted,at:performance.now()});
 canvas.addEventListener('webglcontextlost',onEvent);canvas.addEventListener('webglcontextrestored',onEvent);
 const until=async(test)=>{const deadline=performance.now()+15000;while(!test()){if(performance.now()>deadline)throw Error('NATIVE_OBSERVATION_TIMEOUT');await new Promise(resolve=>setTimeout(resolve,10));}};
 return {
  async lose(generation){
   if(backend==='webgpu'){observation.destroyArmedGeneration(generation);await until(()=>observation.snapshot().devices.some(d=>d.id===generation&&d.lostAt!==null));}
   else{const gl=canvas.getContext('webgl2');extension=gl.getExtension('WEBGL_lose_context');if(!extension)throw Error('WEBGL_LOSS_UNAVAILABLE');const n=events.length;extension.loseContext();await until(()=>events.length>n);if(!gl.isContextLost()||!events.at(-1).trusted)throw Error('NOT_ACTUAL_NATIVE_LOSS');}
   return this.snapshot();
  },
  async restore(){if(backend==='webgl2'){const n=events.length;extension.restoreContext();await until(()=>events.length>n);if(events.at(-1).type!=='webglcontextrestored'||!events.at(-1).trusted)throw Error('NOT_ACTUAL_NATIVE_RESTORE');}},
  snapshot(){return {events:[...events],gpu:observation?.snapshot()};},
  closing(){observation?.markClosing();},
  async close(){canvas.removeEventListener('webglcontextlost',onEvent);canvas.removeEventListener('webglcontextrestored',onEvent);return observation?await observation.drainAndRestore():this.snapshot();}
 };
}
