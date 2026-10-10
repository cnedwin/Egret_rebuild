import * as fixtures from './fixtures.mjs';
window.texturedFixtures=fixtures;
if(!new URL(location.href).searchParams.has('harness')) {
  try{window.exampleObservation=await fixtures.runCase('N04-empty');}
  catch(cause){const node=document.createElement('p');node.textContent=`Textured WebGPU unavailable or failed / 纹理 WebGPU 不可用或失败: ${cause.message}`;document.body.append(node);throw cause;}
}
window.ready=true;
