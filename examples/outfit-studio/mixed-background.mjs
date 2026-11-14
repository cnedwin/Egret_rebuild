// SPDX-License-Identifier: Apache-2.0
import {
  Mesh3D, Scene3D, World3DError, colorFromHex, createGeometry3D, createOrthographicCamera3D,
  createUnlitMaterial3D
} from '@egret/engine/world3d';

const restoreTimeoutMs = 10000;

function quad(left, right, bottom, top, z, color) {
  return createGeometry3D({
    positions:[left,top,z, right,top,z, right,bottom,z, left,bottom,z],
    colors:[...color,...color,...color,...color],
    indices:[0,1,2,0,2,3]
  });
}

export async function createMixedBackground({canvas,backend,onLost,signal}) {
  if (backend !== 'webgl2' && backend !== 'webgpu') throw new Error('Choose WebGPU or WebGL2');
  signal?.throwIfAborted();

  const scene = new Scene3D();
  scene.background = Array.from(colorFromHex(new Float32Array(3),0x10192c));
  // Keep the original square projection across both orientations, including its clockwise indices.
  const camera = createOrthographicCamera3D({height:2,aspect:1,near:1,far:9});
  const material = createUnlitMaterial3D({
    color:[1,1,1],side:'double',alphaMode:'opaque',vertexColors:true,depthTest:true,depthWrite:true,toneMapped:false
  });
  const geometries = [
    quad(-.125,.875,-.625,.5,-3,[.1875,.3125,.5]),
    quad(-.25,.9375,-.75,.6875,-7,[.125,.1875,.3125])
  ];
  for (const geometry of geometries) scene.addChild(new Mesh3D(geometry,material));

  // This fixture has no shadows. The one-pixel binding keeps WebGPU's required fallback texture small.
  const options = {canvas,antialias:false,alpha:false,toneMapping:'none',exposure:1,shadows:false,shadowAtlasSize:1};
  let renderer, device, glRestore, glFailure, gpuRestore, gpuFailure;
  let width = canvas.width, height = canvas.height, generation = 0, state = 'lost';
  let submissions = 0, drawCalls = 0, triangles = 0, totalDrawCalls = 0, totalTriangles = 0, disposals = 0;

  function assertOpen() {
    signal?.throwIfAborted();
    if (state === 'closed') throw new DOMException('World3D backdrop closed','AbortError');
  }

  function recordLoss(message) {
    if (state !== 'ready') return;
    state = 'lost';
    onLost?.(new World3DError('WORLD3D_CONTEXT_LOST',message));
  }

  function retire() {
    const old = renderer;
    const owned = device;
    renderer = device = undefined;
    if (old) disposals++;
    // Unconfigure the canvas before releasing its device or creating the next renderer.
    try { old?.dispose(); }
    finally { owned?.destroy(); }
  }

  function finishGlRestore(error) {
    const pending = glRestore;
    if (!pending) return;
    glRestore = undefined;
    clearTimeout(pending.timer);
    if (error) pending.reject(error);
    else pending.resolve();
  }

  function close() {
    if (state === 'closed') return;
    state = 'closed';
    signal?.removeEventListener('abort',close);
    finishGlRestore(signal?.reason ?? new DOMException('World3D backdrop closed','AbortError'));
    try { retire(); }
    finally {
      scene.removeChildren();
      for (const geometry of geometries) geometry.dispose();
      material.dispose();
    }
  }

  function publish(next) {
    next.setSize(width,height);
    renderer = next;
    generation++;
    state = 'ready';
  }

  function createGpu() {
    const attempt = new AbortController();
    const boundary = signal ? AbortSignal.any([signal,attempt.signal]) : attempt.signal;
    const timer = setTimeout(() => {
      gpuFailure = new World3DError('WORLD3D_CONTEXT_LOST','WebGPU backdrop acquisition timed out');
      attempt.abort(gpuFailure);
    },restoreTimeoutMs);
    return new Promise((resolve,reject) => {
      const stop = () => {
        clearTimeout(timer);
        reject(boundary.reason);
      };
      boundary.addEventListener('abort',stop,{once:true});
      void acquireGpu(boundary).then(resolve,reject).finally(() => {
        boundary.removeEventListener('abort',stop);
        clearTimeout(timer);
      });
    });
  }

  async function acquireGpu(boundary) {
    boundary.throwIfAborted();
    const {createWebGPURenderer3D} = await import('@egret/engine/webgpu/world3d');
    boundary.throwIfAborted();
    assertOpen();
    const adapter = await navigator.gpu?.requestAdapter({powerPreference:'high-performance'});
    boundary.throwIfAborted();
    assertOpen();
    if (!adapter) throw new Error('World3D WebGPU adapter unavailable');
    // The overlay Host has its own device and recovery. This device belongs to the backdrop only.
    const candidate = await adapter.requestDevice({label:'Outfit Studio World3D'});
    let next;
    try {
      boundary.throwIfAborted();
      assertOpen();
      next = await createWebGPURenderer3D({...options,device:candidate,onDeviceLost:message => {
        if (device === candidate) recordLoss(message || 'World3D WebGPU device lost');
      }});
      boundary.throwIfAborted();
      assertOpen();
      if (next.isDeviceLost) throw new World3DError('WORLD3D_CONTEXT_LOST','WebGPU backdrop acquisition');
      publish(next);
      device = candidate;
    } catch (error) {
      try { next?.dispose(); }
      finally { candidate.destroy(); }
      throw error;
    }
  }

  function restore() {
    if (state === 'closed') return Promise.reject(signal?.reason ?? new DOMException('World3D backdrop closed','AbortError'));
    if (state === 'ready' && !renderer.isContextLost && !renderer.isDeviceLost) return Promise.resolve();
    if (backend === 'webgpu') {
      if (gpuFailure) return Promise.reject(gpuFailure);
      if (!gpuRestore) {
        gpuRestore = Promise.resolve().then(() => {
          assertOpen();
          retire();
          return createGpu();
        }).finally(() => { gpuRestore = undefined; });
      }
      return gpuRestore;
    }
    // WEBGL_lose_context and native browser loss both resume only after World3D restores its resources.
    if (glFailure) return Promise.reject(glFailure);
    if (!glRestore) {
      const {promise,resolve,reject} = Promise.withResolvers();
      const timer = setTimeout(() => {
        glFailure = new World3DError('WORLD3D_CONTEXT_LOST','WebGL2 backdrop restoration timed out');
        finishGlRestore(glFailure);
      },restoreTimeoutMs);
      glRestore = {promise,resolve,reject,timer};
    }
    return glRestore.promise;
  }

  signal?.addEventListener('abort',close,{once:true});
  try {
    if (backend === 'webgpu') {
      await createGpu();
    } else {
      const {createWebGL2Renderer3D} = await import('@egret/engine/webgl2/world3d');
      assertOpen();
      const next = createWebGL2Renderer3D({
        ...options,
        onContextLost:() => recordLoss('World3D WebGL2 context lost'),
        onContextRestored:() => {
          if (state === 'closed') return;
          try {
            if (renderer.isContextLost) throw new World3DError('WORLD3D_CONTEXT_LOST','WebGL2 backdrop is still lost');
            publish(renderer);
            glFailure = undefined;
            finishGlRestore();
          } catch (error) {
            glFailure = error;
            finishGlRestore(error);
          }
        }
      });
      renderer = next;
      if (next.isContextLost) throw new World3DError('WORLD3D_CONTEXT_LOST','WebGL2 backdrop acquisition');
      publish(next);
    }
    assertOpen();
  } catch (error) {
    close();
    throw error;
  }

  return {
    resize(logicalWidth,logicalHeight,ratio) {
      if (state === 'closed') return;
      // Match the SharedFrame2D Host's ceiling rule before calling World3D's integer setter.
      width = Math.ceil(logicalWidth*ratio);
      height = Math.ceil(logicalHeight*ratio);
      if (state === 'ready') renderer.setSize(width,height);
    },
    submit() {
      if (state !== 'ready') return false;
      if (!renderer.render(scene,camera)) {
        recordLoss('World3D backdrop lost during submission');
        return false;
      }
      submissions++;
      ({drawCalls,triangles} = renderer.info);
      totalDrawCalls += drawCalls;
      totalTriangles += triangles;
      return true;
    },
    restore,
    close,
    inspect() {
      return {
        state,generation,width:canvas.width,height:canvas.height,
        submissions,drawCalls,triangles,totalDrawCalls,totalTriangles,disposals
      };
    }
  };
}
