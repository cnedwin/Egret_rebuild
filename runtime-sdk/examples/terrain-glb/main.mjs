// SPDX-License-Identifier: Apache-2.0
import { Scene3D, createAmbientLight3D, createDirectionalLight3D, createPerspectiveCamera3D } from '@egret/engine/world3d';
import { installWorld3DPlayerProject } from '@egret/android-player-world3d';

installWorld3DPlayerProject({
  width: 768, height: 432,
  async create(services) {
    const scene = new Scene3D();
    scene.background = [0.025, 0.045, 0.075];
    const camera = createPerspectiveCamera3D({ fov: 40, near: 0.1, far: 40 });
    camera.setPosition(5.2, 6.1, 8).lookAt(0, 0, 0);
    scene.addChild(camera);
    scene.addChild(createAmbientLight3D({ intensity: 0.6 }));
    const sun = scene.addChild(createDirectionalLight3D({ intensity: 2 }));
    sun.setPosition(3, 5, 2).lookAt(0, 0, 0);

    const controller = new AbortController();
    let canceledAt = 0, reads = 0;
    try {
      const unexpected = await services.loadGlb('terrain.glb', {
        firstPage: 1, signal: controller.signal,
        onProgress(read, total) {
          if (++reads === 2 && read < total) {
            canceledAt = read;
            controller.abort();
          }
        }
      });
      unexpected.dispose();
      throw new Error('Expected cancellation during terrain import');
    } catch (error) {
      if (!controller.signal.aborted || error !== controller.signal.reason || !canceledAt) throw error;
    }

    let asset, loading = false, closed = false, loadedBytes = 0, imports = 0, retirements = 0;
    function release() {
      if (!asset) return;
      scene.removeChild(asset.scene);
      asset.dispose();
      retirements++;
      asset = undefined;
    }
    async function load() {
      loading = true;
      try {
        const result = await services.loadGlb('terrain.glb', {
          firstPage: 1,
          onProgress(read) { loadedBytes = read; }
        });
        if (closed) { result.dispose(); return; }
        imports++;
        asset = result;
        scene.addChild(asset.scene);
        services.state({ phase: 'visible', canceledAt, loadedBytes, vertices: asset.geometries[0].vertexCount });
      } finally {
        loading = false;
      }
    }
    await load();
    return {
      world3D() { return { scene, camera }; },
      input(event) {
        if (event.type !== 'up' || loading || closed) return;
        if (asset) {
          release();
          services.state({ phase: 'released', canceledAt, loadedBytes });
        } else {
          load().catch(error => { if (!closed) services.state({ phase: 'failed', message: String(error) }); });
        }
      },
      close() { closed = true; release(); },
      closedSnapshot() { return { canceledAt, loadedBytes, imports, retirements }; }
    };
  }
});
