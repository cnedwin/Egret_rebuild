// SPDX-License-Identifier: Apache-2.0
// WebGL2 side of the world3d post-processing chain. The renderer draws the
// scene into `scene`, then run() blooms, grades and anti-aliases it into the
// canvas or the caller's target.
import {World3DError} from '../../rendering/world3d/core3D.js';
import {Material3D} from '../../rendering/world3d/Material3D.js';
import {RenderTarget3D} from '../../rendering/world3d/Texture3D.js';
import type {ToneMapping3D} from './frame3D.js';
import type {GpuResources3D, Program3D} from './gpuResources3D.js';
import {POST_DOF_GLSL_3D, POST_DOWN_GLSL_3D, POST_FXAA_GLSL_3D, POST_SSAO_GLSL_3D, POST_UP_GLSL_3D, POST_VERTEX_GLSL_3D, bloomLevelCount3D, postCompositeGlsl3D, writeCompositeParams3D} from './post3D.js';
import type {PostProcessSettings3D, PostView3D} from './post3D.js';

interface Surface { texture: WebGLTexture; framebuffer: WebGLFramebuffer; width: number; height: number }

export class PostChainWebGL23D {
    /** Half-float scene target the renderer draws into before run(). */
    readonly scene = new RenderTarget3D(1, 1, {format: 'rgba16f', depthTexture: true, name: 'world3d.post.scene'});
    /** Target and flat white material for the outline mask. */
    readonly mask = new RenderTarget3D(1, 1, {name: 'world3d.post.mask'});
    readonly maskMaterial = (() => { const material = new Material3D('unlit', {side: 'double'}); material.fog = false; material.toneMapped = false; return material; })();
    readonly #gl: WebGL2RenderingContext;
    readonly #resources: GpuResources3D;
    readonly #float: boolean;
    readonly #levels: Surface[] = [];
    #ldr: Surface | undefined;
    #ao: Surface | undefined;
    #dof: Surface | undefined;
    #black: WebGLTexture | null = null;
    readonly #params = new Float32Array(8);
    #view: PostView3D | undefined;
    #aoOn = false;
    #custom: Float32Array | undefined;
    #outline: PostProcessSettings3D | undefined;

    constructor(gl: WebGL2RenderingContext, resources: GpuResources3D) {
        this.#gl = gl;
        this.#resources = resources;
        this.#float = resources.floatTargets;
    }
    private surface(existing: Surface | undefined, width: number, height: number, float: boolean): Surface {
        const gl = this.#gl;
        if (existing && existing.width === width && existing.height === height) return existing;
        const texture = existing?.texture ?? gl.createTexture(), framebuffer = existing?.framebuffer ?? gl.createFramebuffer();
        if (!texture || !framebuffer) throw new World3DError('WORLD3D_CONTEXT_LOST', 'post surface');
        gl.bindTexture(gl.TEXTURE_2D, texture);
        if (float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
        else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        return {texture, framebuffer, width, height};
    }
    private pass(program: Program3D, source: WebGLTexture, framebuffer: WebGLFramebuffer | null, width: number, height: number,
        a: readonly [number, number, number, number], b: readonly [number, number, number, number]): void {
        const gl = this.#gl, u = program.uniforms;
        gl.useProgram(program.program);
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.viewport(0, 0, width, height);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, source);
        if (u['uSource']) gl.uniform1i(u['uSource'], 0);
        if (u['uBloom']) gl.uniform1i(u['uBloom'], 1);
        if (u['uA']) gl.uniform4f(u['uA'], a[0], a[1], a[2], a[3]);
        if (u['uB']) gl.uniform4f(u['uB'], b[0], b[1], b[2], b[3]);
        // Depth-reading passes: units 2 and 3 are bound by run().
        if (u['uDepth']) gl.uniform1i(u['uDepth'], 2);
        if (u['uAo']) gl.uniform1i(u['uAo'], 3);
        if (u['uMask']) gl.uniform1i(u['uMask'], 4);
        const outline = this.#outline;
        if (u['uOutline']) gl.uniform4f(u['uOutline'], outline ? outline.outlineColor[0] : 0, outline ? outline.outlineColor[1] : 0, outline ? outline.outlineColor[2] : 0, outline ? outline.outlineThickness : 0);
        const view = this.#view;
        if (u['uInverseProjection'] && view) gl.uniformMatrix4fv(u['uInverseProjection'], false, view.inverseProjection);
        if (u['uFlags']) gl.uniform4f(u['uFlags'], 0, this.#aoOn ? 1 : 0, 1 / width, 1 / height);
        const customLocation = u['uPostCustom[0]'] ?? u['uPostCustom'];
        if (customLocation && this.#custom) gl.uniform4fv(customLocation, this.#custom);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    /**
     * Process `sceneTexture` into `output` (null for the canvas).
     * `outputEncodes` is true when the output converts linear values to sRGB on write.
     */
    run(sceneTexture: WebGLTexture, depthTexture: WebGLTexture | undefined, maskTexture: WebGLTexture | undefined, view: PostView3D, width: number, height: number, output: WebGLFramebuffer | null, outputEncodes: boolean,
        settings: PostProcessSettings3D, toneMapping: ToneMapping3D, vao: WebGLVertexArrayObject | null): number {
        const gl = this.#gl, resources = this.#resources;
        gl.bindVertexArray(vao);
        gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND); gl.disable(gl.SCISSOR_TEST);
        gl.depthMask(false); gl.colorMask(true, true, true, true);
        let draws = 0;
        this.#view = view; this.#aoOn = false; this.#custom = undefined; this.#outline = maskTexture ? settings : undefined;
        const useAo = settings.ssao && depthTexture !== undefined && settings.ssaoIntensity > 0;
        // Allocate before binding the shared units: allocation binds on the active unit.
        const ao = useAo ? this.#ao = this.surface(this.#ao, width, height, false) : undefined;
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, depthTexture ?? null);
        gl.activeTexture(gl.TEXTURE0);
        if (ao) {
            const program = resources.program('post/ssao', () => ({vertex: POST_VERTEX_GLSL_3D, fragment: POST_SSAO_GLSL_3D}));
            this.pass(program, sceneTexture, ao.framebuffer, width, height, [Math.max(settings.ssaoRadius, 0.001), settings.ssaoIntensity, settings.ssaoBias, 0], [0, 0, 0, 0]);
            draws++;
        }
        if (settings.dof && depthTexture !== undefined && settings.dofRadius > 0) {
            // Everything after this reads the blurred image as the scene.
            const dof = this.#dof = this.surface(this.#dof, width, height, this.#float);
            const program = resources.program('post/dof', () => ({vertex: POST_VERTEX_GLSL_3D, fragment: POST_DOF_GLSL_3D}));
            this.pass(program, sceneTexture, dof.framebuffer, width, height, [settings.dofFocus, Math.max(settings.dofRange, 0.001), settings.dofRadius, 0], [0, 0, 0, 0]);
            sceneTexture = dof.texture;
            draws++;
        }
        const levels = bloomLevelCount3D(settings, width, height);
        if (levels > 0) {
            const down = resources.program('post/down', () => ({vertex: POST_VERTEX_GLSL_3D, fragment: POST_DOWN_GLSL_3D}));
            const up = resources.program('post/up', () => ({vertex: POST_VERTEX_GLSL_3D, fragment: POST_UP_GLSL_3D}));
            let w = width, h = height, source = sceneTexture;
            for (let i = 0; i < levels; i++) {
                const sourceWidth = w, sourceHeight = h;
                w = Math.max(w >> 1, 1); h = Math.max(h >> 1, 1);
                const level = this.#levels[i] = this.surface(this.#levels[i], w, h, this.#float);
                this.pass(down, source, level.framebuffer, w, h, [1 / sourceWidth, 1 / sourceHeight, settings.bloomThreshold, Math.min(Math.max(settings.bloomKnee, 0), 1)], [i === 0 ? 1 : 0, 0, 0, 0]);
                source = level.texture; draws++;
            }
            // Walk back up, adding each blurred level onto the next larger one.
            gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
            for (let i = levels - 1; i > 0; i--) {
                const from = this.#levels[i]!, to = this.#levels[i - 1]!;
                this.pass(up, from.texture, to.framebuffer, to.width, to.height, [1 / from.width, 1 / from.height, 0, 0], [0, 0, 0, 0]);
                draws++;
            }
            gl.disable(gl.BLEND);
        }
        if (!this.#black) {
            this.#black = gl.createTexture();
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.#black);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
        }
        // Allocate the intermediate before binding unit 1: allocation binds on the active unit.
        const ldr = settings.fxaa ? this.#ldr = this.surface(this.#ldr, width, height, false) : undefined;
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, levels > 0 ? this.#levels[0]!.texture : this.#black);
        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_2D, maskTexture ?? this.#black);
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, ao ? ao.texture : this.#black);
        this.#aoOn = ao !== undefined;
        // The hook needs depth; without a depth texture it is left out rather than reading garbage.
        const custom = depthTexture !== undefined && settings.custom?.glsl !== undefined ? settings.custom : undefined;
        this.#custom = custom?.uniforms;
        const composite = resources.program('post/composite' + (custom ? '|' + custom.key : ''), () => ({vertex: POST_VERTEX_GLSL_3D, fragment: postCompositeGlsl3D(custom?.glsl)}));
        const p = this.#params;
        if (ldr) {
            // FXAA works on display-encoded color, so the composite always encodes into the intermediate.
            writeCompositeParams3D(p, settings, levels, toneMapping, true);
            this.pass(composite, sceneTexture, ldr.framebuffer, width, height, [p[0]!, p[1]!, p[2]!, p[3]!], [p[4]!, p[5]!, p[6]!, p[7]!]);
            const fxaa = resources.program('post/fxaa', () => ({vertex: POST_VERTEX_GLSL_3D, fragment: POST_FXAA_GLSL_3D}));
            this.pass(fxaa, ldr.texture, output, width, height, [1 / width, 1 / height, outputEncodes ? 1 : 0, 0], [0, 0, 0, 0]);
            draws += 2;
        } else {
            writeCompositeParams3D(p, settings, levels, toneMapping, !outputEncodes);
            this.pass(composite, sceneTexture, output, width, height, [p[0]!, p[1]!, p[2]!, p[3]!], [p[4]!, p[5]!, p[6]!, p[7]!]);
            draws++;
        }
        gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, null);
        gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, null);
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, null);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, null);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindVertexArray(null);
        gl.depthMask(true);
        return draws;
    }
    /** Release GPU objects. Pass `lost` after a context loss, when they are already gone. */
    dispose(lost = false): void {
        const gl = this.#gl;
        if (!lost) {
            for (const surface of [...this.#levels, ...(this.#ldr ? [this.#ldr] : []), ...(this.#ao ? [this.#ao] : []), ...(this.#dof ? [this.#dof] : [])]) { gl.deleteTexture(surface.texture); gl.deleteFramebuffer(surface.framebuffer); }
            if (this.#black) gl.deleteTexture(this.#black);
        }
        this.#levels.length = 0; this.#ldr = undefined; this.#ao = undefined; this.#dof = undefined; this.#black = null;
        this.scene.dispose(); this.mask.dispose(); this.maskMaterial.dispose();
    }
}
