import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { createUIPass } from './ui-pass.mjs';
// Deliberate integration profile: no Draco, KTX2 or meshopt decoder installed.
const requiredProfile=new Set(['KHR_materials_unlit','KHR_texture_transform','KHR_mesh_quantization','KHR_lights_punctual','KHR_materials_clearcoat','KHR_materials_sheen','KHR_materials_transmission','KHR_materials_volume','KHR_materials_ior','KHR_materials_specular','KHR_materials_iridescence','KHR_materials_anisotropy','KHR_materials_emissive_strength','KHR_materials_dispersion','EXT_mesh_gpu_instancing']);
const aborted=()=>new DOMException('Asset owner aborted','AbortError');
function collect(root){const geometry=new Set(),material=new Set(),skeleton=new Set();root.traverse(o=>{if(o.geometry)geometry.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])material.add(m);if(o.skeleton)skeleton.add(o.skeleton);});return {geometry,material,skeleton};}
function disposeBundle(resources){const textures=new Set();for(const m of resources.material){for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose();}for(const t of textures)t.dispose();for(const g of resources.geometry)g.dispose();for(const s of resources.skeleton)s.dispose();resources.geometry.clear();resources.material.clear();resources.skeleton.clear();}
export async function createReferenceChain(canvas,{assetUrl,fontEpoch=0,signal}={}){
  if(signal?.aborted)throw aborted();
  const response=await fetch(assetUrl,{signal});if(!response.ok)throw new Error(`Asset fetch rejected ${response.status}`);
  const json=await response.json();if(signal?.aborted)throw aborted();
  for(const name of json.extensionsRequired||[])if(!requiredProfile.has(name))throw new Error(`Unsupported required extension: ${name}`);
  const sourceURL=new URL(assetUrl,location.href),base=sourceURL.protocol==='data:'?new URL('.',location.href).href:new URL('.',sourceURL).href;
  const gltf=await new GLTFLoader().parseAsync(JSON.stringify(json),base);
  let bundleRoot=gltf.scene,resources=collect(bundleRoot),clips=gltf.animations;
  gltf.scene=null;gltf.scenes.length=0;gltf.animations=[];
  if(signal?.aborted){disposeBundle(resources);bundleRoot.clear();throw aborted();}
  const gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:false,preserveDrawingBuffer:true});
  if(!gl){disposeBundle(resources);throw new Error('WebGL2 unavailable');}
  const renderer=new THREE.WebGLRenderer({canvas,context:gl,alpha:true,premultipliedAlpha:true,antialias:false});
  renderer.setPixelRatio(1);renderer.setSize(canvas.width,canvas.height,false);renderer.setClearColor(0x000000,0);renderer.autoClear=false;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,canvas.width/canvas.height,.01,100);
  camera.position.set(3,2,5);camera.lookAt(0,0,0);scene.add(new THREE.HemisphereLight(0xffffff,0x668899,3));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(4,6,5);scene.add(light);
  const bounds=new THREE.Box3().setFromObject(bundleRoot),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()),scale=2.5/Math.max(size.x,size.y,size.z);
  const instances=new Set();let ui=createUIPass(gl,canvas,{fontEpoch}),restoreResolve=null,restoreReject=null,restorePromise=Promise.resolve();
  const diagnostics={status:'ready',instances:0,bundleRoot,sharedDisposed:false,rendererDisposed:false,ui:ui.diagnostics,contextAttributes:gl.getContextAttributes(),animationClips:clips.length};
  function ready(){if(diagnostics.status==='disposed')throw new Error('Reference chain disposed');if(diagnostics.status==='lost'||diagnostics.status==='restoring')throw new Error('WebGL context lost');}
  function releaseShared(){if(diagnostics.sharedDisposed)return;disposeBundle(resources);bundleRoot?.clear();bundleRoot=null;clips=[];diagnostics.bundleRoot=null;diagnostics.sharedDisposed=true;}
  function acquireInstance(){ready();if(diagnostics.sharedDisposed)throw new Error('Shared asset bundle released');const root=clone(bundleRoot);root.scale.multiplyScalar(scale);root.position.sub(center).multiplyScalar(scale);scene.add(root);const mixer=new THREE.AnimationMixer(root);for(const clip of clips)mixer.clipAction(clip).play();const instance={root,mixer,timeOffset:0,released:false};instances.add(instance);diagnostics.instances=instances.size;return instance;}
  function releaseInstance(instance){if(!instances.has(instance))return;const root=instance.root;instance.mixer.stopAllAction();instance.mixer.uncacheRoot(root);root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});scene.remove(root);root.clear();renderer.renderLists.dispose();instance.root=null;instance.mixer=null;instance.released=true;instances.delete(instance);diagnostics.instances=instances.size;releaseShared();}
  function renderAt(seconds,{ui:withUI=true}={}){ready();if(!Number.isFinite(seconds))throw new Error('Frame time must be finite');for(const instance of instances)instance.mixer.setTime(seconds+instance.timeOffset);
    // Direct GL UI state is outside Three's cached state.
    renderer.resetState();renderer.setRenderTarget(null);renderer.clear(true,true,true);renderer.render(scene,camera);if(withUI)ui.draw();
  }
  function onLost(e){e.preventDefault();if(diagnostics.status==='disposed')return;diagnostics.status='lost';
    // r186 geometries retain old WebGLGeometries disposal listeners across initGLContext.
    // Invalidate GPU allocation while lost (GL deletes are no-ops), leaving CPU bundle owned.
    // Three's public dispose events detach those listeners and Three reuploads on restore.
    for(const geometry of resources.geometry)geometry.dispose();
    for(const instance of instances)instance.root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});
    restorePromise=new Promise((resolve,reject)=>{restoreResolve=resolve;restoreReject=reject;});restorePromise.catch(()=>{});
  }
  function onRestored(){if(diagnostics.status==='disposed')return;diagnostics.status='restoring';try{ui.restore();renderer.resetState();diagnostics.status='ready';restoreResolve?.();}catch(e){diagnostics.status='lost';restoreReject?.(e);}finally{restoreResolve=null;restoreReject=null;}}
  canvas.addEventListener('webglcontextlost',onLost);canvas.addEventListener('webglcontextrestored',onRestored);
  function dispose(){if(diagnostics.status==='disposed')return;diagnostics.status='disposed';signal?.removeEventListener('abort',dispose);canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestored);restoreReject?.(new Error('Reference chain disposed'));restoreResolve=null;restoreReject=null;for(const instance of [...instances])releaseInstance(instance);releaseShared();ui.dispose();renderer.dispose();scene.clear();diagnostics.rendererDisposed=true;}
  signal?.addEventListener('abort',dispose,{once:true});if(signal?.aborted){dispose();throw aborted();}
  return {acquireInstance,releaseInstance,renderAt,dispose,waitForRestore:()=>restorePromise,diagnostics,setText:(text,style={})=>{ready();ui.setText(text,style);}};
}
