// SPDX-License-Identifier: Apache-2.0
// Reflection probes: capture the scene around a point into a cube texture
// that can be used as `scene.environment` or a background. The capture reads
// pixels back from the GPU, so it is meant for baking when a level loads or
// changes, not for every frame.
import { Camera3D } from '../../rendering/world3d/Camera3D.js';
import { World3DError, requireCount3D } from '../../rendering/world3d/core3D.js';
import { CubeTexture3D, RenderTarget3D } from '../../rendering/world3d/Texture3D.js';
// Face axes in +X, -X, +Y, -Y, +Z, -Z order with the up vector that puts each image's top row where a cube map expects it.
const FACES = [
    [1, 0, 0, 0, 1, 0],
    [-1, 0, 0, 0, 1, 0],
    [0, 1, 0, 0, 0, -1],
    [0, -1, 0, 0, 0, 1],
    [0, 0, 1, 0, 1, 0],
    [0, 0, -1, 0, 1, 0]
];
/** Render six 90-degree views from `position` and return them as a cube texture with mipmaps. */
export async function captureCubeTexture3D(renderer, scene, position, options = {}) {
    if (!renderer || !scene || !position || position.length < 3)
        throw new World3DError('WORLD3D_INPUT_INVALID', 'cube capture');
    const size = requireCount3D(options.size ?? 128, 'cube size', 2048);
    if (size < 2)
        throw new World3DError('WORLD3D_INPUT_INVALID', 'cube size');
    const camera = new Camera3D('perspective'), target = new RenderTarget3D(size, size, { name: 'world3d.probe' });
    camera.fov = 90;
    camera.aspect = 1;
    camera.near = options.near ?? 0.1;
    camera.far = options.far ?? 1000;
    if (options.layerMask !== undefined)
        camera.layerMask = options.layerMask;
    // The probe draws plain views: post-processing, viewports and partial clears belong to the main view.
    const post = renderer.postProcess.enabled, viewport = renderer.viewport, autoClear = renderer.autoClear;
    renderer.postProcess.enabled = false;
    renderer.viewport = undefined;
    renderer.autoClear = true;
    const faces = [], px = position[0], py = position[1], pz = position[2];
    try {
        for (const [dx, dy, dz, ux, uy, uz] of FACES) {
            camera.setPosition(px, py, pz).lookAt(px + dx, py + dy, pz + dz, [ux, uy, uz]);
            camera.updateWorldMatrices();
            if (!renderer.render(scene, camera, target))
                throw new World3DError('WORLD3D_CONTEXT_LOST', 'cube capture');
            const data = await renderer.readRenderTargetPixels(target);
            // Cube faces are stored as seen from outside the cube: mirror each row.
            for (let y = 0; y < size; y++)
                for (let x = 0; x < size >> 1; x++) {
                    const a = (y * size + x) * 4, b = (y * size + size - 1 - x) * 4;
                    for (let c = 0; c < 4; c++) {
                        const swap = data[a + c];
                        data[a + c] = data[b + c];
                        data[b + c] = swap;
                    }
                }
            faces.push({ width: size, height: size, data });
        }
    }
    finally {
        renderer.postProcess.enabled = post;
        renderer.viewport = viewport;
        renderer.autoClear = autoClear;
        target.dispose();
    }
    return new CubeTexture3D(faces, { colorSpace: 'srgb', mipmaps: true, name: 'probe' });
}
//# sourceMappingURL=probe3D.js.map