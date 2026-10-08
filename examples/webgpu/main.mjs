import * as fixtures from './fixtures.mjs';
window.fixtures=fixtures;
// The ordinary example renders publicly; the runner starts each named fixture itself.
if(!new URL(location.href).searchParams.has('harness')) {
  try{await fixtures.boot('painter',false);}
  catch(error){const message=document.createElement('p');message.textContent=`WebGPU unavailable or failed / WebGPU 不可用或失败: ${error.message}`;document.body.append(message);throw error;}
}
window.ready=true;
