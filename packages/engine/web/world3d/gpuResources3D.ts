// SPDX-License-Identifier: Apache-2.0
// GPU-side caches for the WebGL2 world3d renderer: linked programs, vertex
// arrays and buffers, textures, bone and morph data. Entries follow the CPU
// resources' version counters and are retired through their onDispose hooks,
// so the scene core never holds a WebGL object.
import {World3DError} from '../../rendering/world3d/core3D.js';
import type {Attribute3D, Geometry3D} from '../../rendering/world3d/Geometry3D.js';
import type {InstancedMesh3D, Skeleton3D} from '../../rendering/world3d/Mesh3D.js';
import {type AnimationTexture3D, SkinnedInstancedMesh3D} from '../../rendering/world3d/AnimationTexture3D.js';
import {RenderTarget3D, isCompressedPixels3D, isTexturePixels3D} from '../../rendering/world3d/Texture3D.js';
import type {CompressedFormat3D, CompressedPixels3D} from '../../rendering/world3d/Texture3D.js';
import type {CubeTexture3D, Texture3D, TextureSource3D} from '../../rendering/world3d/Texture3D.js';
import {ATTRIBUTE_LOCATIONS_3D, TEXTURE_UNITS_3D} from './shaders3D.js';
import type {ShaderSources3D} from './shaders3D.js';

export interface Program3D {
    readonly id: number;
    readonly program: WebGLProgram;
    readonly uniforms: Readonly<Record<string, WebGLUniformLocation>>;
}
export interface GeometryGpu3D {
    readonly vao: WebGLVertexArrayObject;
    indexType: number;
    indexed: boolean;
    morph: {readonly texture: WebGLTexture; readonly width: number; readonly attributes: number; readonly vertexCount: number} | undefined;
}
interface BufferEntry { buffer: WebGLBuffer; version: number; byteLength: number; }
interface GeometryEntry extends GeometryGpu3D {
    readonly buffers: Map<string, BufferEntry>;
    index: BufferEntry | undefined;
    wire: (BufferEntry & {count: number; type: number; vao: WebGLVertexArrayObject}) | undefined;
    layoutVersion: number;
    version: number;
    readonly unsubscribe: () => void;
}
interface InstanceEntry {
    readonly vao: WebGLVertexArrayObject;
    readonly matrices: WebGLBuffer;
    colors: WebGLBuffer | undefined;
    animation?: WebGLBuffer;
    version: number;
    layoutVersion: number;
    geometryId: number;
    capacityBytes: number;
    lastFrame: number;
}
interface TextureEntry { readonly texture: WebGLTexture; version: number; maxMip: number; readonly unsubscribe: () => void; }
interface BoneEntry { readonly texture: WebGLTexture; version: number; count: number; lastFrame: number; }
export interface RenderTargetGpu3D {
    readonly framebuffer: WebGLFramebuffer;
    readonly color: WebGLTexture;
    depth: WebGLRenderbuffer | undefined;
    /** Depth attachment as a texture, for targets created with `depthTexture`. */
    depthTexture: WebGLTexture | undefined;
    version: number;
    readonly unsubscribe: () => void;
}

const ATTRIBUTE_NAMES = ['position', 'normal', 'uv', 'tangent', 'color', 'joints', 'weights', 'uv1'] as const;
const PRUNE_INTERVAL = 600;

export class GpuResources3D {
    readonly #gl: WebGL2RenderingContext;
    readonly #programs = new Map<string, Program3D>();
    readonly #geometries = new Map<Geometry3D, GeometryEntry>();
    readonly #instances = new Map<InstancedMesh3D, InstanceEntry>();
    readonly #animations = new Map<AnimationTexture3D, WebGLTexture>();
    readonly #textures = new Map<Texture3D | CubeTexture3D, TextureEntry>();
    readonly #bones = new Map<Skeleton3D, BoneEntry>();
    readonly #targets = new Map<RenderTarget3D, RenderTargetGpu3D>();
    readonly #anisotropy: {readonly TEXTURE_MAX_ANISOTROPY_EXT: number} | null;
    readonly #maxAnisotropy: number;
    readonly #maxTextureSize: number;
    /** True when half-float color targets can be rendered to. */
    readonly floatTargets: boolean;
    #nextProgramId = 1;

    constructor(gl: WebGL2RenderingContext) {
        this.#gl = gl;
        this.#anisotropy = gl.getExtension('EXT_texture_filter_anisotropic');
        this.#maxAnisotropy = this.#anisotropy ? gl.getParameter(0x84ff) as number : 1;
        this.#maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
        this.floatTargets = gl.getExtension('EXT_color_buffer_float') !== null || gl.getExtension('EXT_color_buffer_half_float') !== null;
    }
    get counts(): {programs: number; geometries: number; textures: number} {
        return {programs: this.#programs.size, geometries: this.#geometries.size, textures: this.#textures.size};
    }

    // ---- programs ------------------------------------------------------------
    program(key: string, sources: () => ShaderSources3D): Program3D {
        const cached = this.#programs.get(key);
        if (cached) return cached;
        const gl = this.#gl;
        const {vertex, fragment} = sources();
        const compile = (type: number, source: string): WebGLShader => {
            const shader = gl.createShader(type);
            if (!shader) throw new World3DError('WORLD3D_CONTEXT_LOST', 'createShader');
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            return shader;
        };
        const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
        const program = gl.createProgram();
        if (!program) throw new World3DError('WORLD3D_CONTEXT_LOST', 'createProgram');
        gl.attachShader(program, vs); gl.attachShader(program, fs);
        gl.linkProgram(program);
        // Compile status is only consulted on failure, keeping the fast path free of sync points.
        if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
            const log = [gl.getShaderInfoLog(vs), gl.getShaderInfoLog(fs), gl.getProgramInfoLog(program)].filter(Boolean).join('\n');
            gl.deleteShader(vs); gl.deleteShader(fs); gl.deleteProgram(program);
            throw new World3DError('WORLD3D_SHADER_FAILED', key + '\n' + log);
        }
        gl.deleteShader(vs); gl.deleteShader(fs);
        const uniforms: Record<string, WebGLUniformLocation> = {};
        const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
        for (let i = 0; i < count; i++) {
            const info = gl.getActiveUniform(program, i);
            if (!info) continue;
            const name = info.name.replace(/\[0\]$/, ''), location = gl.getUniformLocation(program, info.name);
            if (location) uniforms[name] = location;
        }
        const block = gl.getUniformBlockIndex(program, 'Frame');
        if (block !== gl.INVALID_INDEX) gl.uniformBlockBinding(program, block, 0);
        gl.useProgram(program);
        const samplers: Record<string, number> = {
            uMap: TEXTURE_UNITS_3D.map, uNormalMap: TEXTURE_UNITS_3D.normalMap, uMetallicRoughnessMap: TEXTURE_UNITS_3D.metallicRoughnessMap,
            uOcclusionMap: TEXTURE_UNITS_3D.occlusionMap, uEmissiveMap: TEXTURE_UNITS_3D.emissiveMap, uLightMap: TEXTURE_UNITS_3D.lightMap, uReflectionMap: TEXTURE_UNITS_3D.reflectionMap, uEnvironment: TEXTURE_UNITS_3D.environment,
            uShadowMap: TEXTURE_UNITS_3D.shadow, uBoneTexture: TEXTURE_UNITS_3D.bones, uMorphTexture: TEXTURE_UNITS_3D.morph, uSceneColor: TEXTURE_UNITS_3D.sceneColor,
        };
        for (const name in samplers) if (uniforms[name]) gl.uniform1i(uniforms[name]!, samplers[name]!);
        const entry: Program3D = {id: this.#nextProgramId++, program, uniforms};
        this.#programs.set(key, entry);
        return entry;
    }

    // ---- geometry ----------------------------------------------------------------
    private upload(target: number, entry: BufferEntry, attribute: Attribute3D): void {
        if (entry.version === attribute.version) return;
        const gl = this.#gl, data = attribute.data;
        gl.bindBuffer(target, entry.buffer);
        if (entry.byteLength === data.byteLength) gl.bufferSubData(target, 0, data);
        else gl.bufferData(target, data, attribute.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
        entry.byteLength = data.byteLength;
        entry.version = attribute.version;
    }
    private glType(data: ArrayBufferView): number {
        const gl = this.#gl;
        return data instanceof Float32Array ? gl.FLOAT : data instanceof Uint16Array ? gl.UNSIGNED_SHORT : data instanceof Uint32Array ? gl.UNSIGNED_INT
            : data instanceof Uint8Array ? gl.UNSIGNED_BYTE : data instanceof Int16Array ? gl.SHORT : gl.BYTE;
    }
    private buffer(): WebGLBuffer {
        const buffer = this.#gl.createBuffer();
        if (!buffer) throw new World3DError('WORLD3D_CONTEXT_LOST', 'createBuffer');
        return buffer;
    }
    /** Bind every known attribute of a geometry into the currently bound vertex array. */
    private bindAttributes(geometry: Geometry3D, entry: GeometryEntry): void {
        const gl = this.#gl;
        for (const name of ATTRIBUTE_NAMES) {
            const location = ATTRIBUTE_LOCATIONS_3D[name], attribute = geometry.getAttribute(name), buffer = entry.buffers.get(name);
            if (!attribute || !buffer) { gl.disableVertexAttribArray(location); continue; }
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer.buffer);
            gl.enableVertexAttribArray(location);
            if (name === 'joints') gl.vertexAttribIPointer(location, attribute.itemSize, this.glType(attribute.data), 0, 0);
            else gl.vertexAttribPointer(location, attribute.itemSize, this.glType(attribute.data), attribute.normalized, 0, 0);
        }
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, entry.index ? entry.index.buffer : null);
    }
    /** Create or refresh GPU buffers for a geometry and return its vertex array. */
    geometry(geometry: Geometry3D): GeometryGpu3D {
        const gl = this.#gl;
        let entry = this.#geometries.get(geometry);
        if (entry && entry.version === geometry.version && entry.layoutVersion === geometry.layoutVersion) {
            // Attribute data may still have changed through Attribute3D.touch().
            let stale = false;
            for (const [name, buffer] of entry.buffers) if (geometry.getAttribute(name)?.version !== buffer.version) { stale = true; break; }
            if (!stale && (!entry.index || entry.index.version === geometry.index?.version)) return entry;
        }
        if (!entry) {
            const vao = gl.createVertexArray();
            if (!vao) throw new World3DError('WORLD3D_CONTEXT_LOST', 'createVertexArray');
            const created: GeometryEntry = {
                vao, buffers: new Map(), index: undefined, wire: undefined, layoutVersion: -1, version: -1, indexType: gl.UNSIGNED_SHORT, indexed: false, morph: undefined,
                unsubscribe: geometry.onDispose(() => this.releaseGeometry(geometry)),
            };
            this.#geometries.set(geometry, entry = created);
        }
        const layoutChanged = entry.layoutVersion !== geometry.layoutVersion;
        gl.bindVertexArray(null);
        for (const name of ATTRIBUTE_NAMES) {
            const attribute = geometry.getAttribute(name);
            let buffer = entry.buffers.get(name);
            if (!attribute) { if (buffer) { gl.deleteBuffer(buffer.buffer); entry.buffers.delete(name); } continue; }
            if (!buffer) entry.buffers.set(name, buffer = {buffer: this.buffer(), version: -1, byteLength: -1});
            this.upload(gl.ARRAY_BUFFER, buffer, attribute);
        }
        const index = geometry.index;
        if (index) {
            entry.index ??= {buffer: this.buffer(), version: -1, byteLength: -1};
            // Element buffers are vertex-array state: upload with the array bound.
            gl.bindVertexArray(entry.vao);
            this.upload(gl.ELEMENT_ARRAY_BUFFER, entry.index, index);
            entry.indexType = this.glType(index.data);
        } else if (entry.index) { gl.deleteBuffer(entry.index.buffer); entry.index = undefined; }
        entry.indexed = index !== undefined;
        if (layoutChanged) {
            gl.bindVertexArray(entry.vao);
            this.bindAttributes(geometry, entry);
            this.buildMorph(geometry, entry);
            this.releaseWire(entry);
        }
        gl.bindVertexArray(null);
        entry.layoutVersion = geometry.layoutVersion;
        entry.version = geometry.version;
        return entry;
    }
    private buildMorph(geometry: Geometry3D, entry: GeometryEntry): void {
        const gl = this.#gl, targets = geometry.morphTargets;
        if (entry.morph) { gl.deleteTexture(entry.morph.texture); entry.morph = undefined; }
        if (targets.length === 0) return;
        const vertexCount = geometry.vertexCount, attributes = targets.some(target => target.normal) ? 2 : 1;
        const texels = targets.length * attributes * vertexCount;
        const width = Math.min(this.#maxTextureSize, Math.max(1, Math.ceil(Math.sqrt(texels)))), height = Math.ceil(texels / width);
        if (height > this.#maxTextureSize) throw new World3DError('WORLD3D_BUDGET', 'morph target data');
        const data = new Float32Array(width * height * 4);
        targets.forEach((target, t) => {
            [target.position, target.normal].slice(0, attributes).forEach((source, k) => {
                if (!source) return;
                const base = (t * attributes + k) * vertexCount * 4;
                for (let v = 0; v < vertexCount; v++) {
                    data[base + v * 4] = source[v * 3]!; data[base + v * 4 + 1] = source[v * 3 + 1]!; data[base + v * 4 + 2] = source[v * 3 + 2]!;
                }
            });
        });
        const texture = this.dataTexture(width, height, data);
        entry.morph = {texture, width, attributes, vertexCount};
    }
    private dataTexture(width: number, height: number, data: Float32Array | null): WebGLTexture {
        const gl = this.#gl, texture = gl.createTexture();
        if (!texture) throw new World3DError('WORLD3D_CONTEXT_LOST', 'createTexture');
        gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNITS_3D.morph);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return texture;
    }
    /** Vertex array whose element buffer lists every triangle edge, for wireframe drawing. */
    wireframe(geometry: Geometry3D): {vao: WebGLVertexArrayObject; count: number; type: number} {
        const entry = this.#geometries.get(geometry)!;
        if (entry.wire && entry.wire.version === geometry.version) return entry.wire;
        const gl = this.#gl, source = geometry.index?.data, triangles = Math.floor(geometry.drawCount / 3);
        const lines = geometry.vertexCount > 65535 ? new Uint32Array(triangles * 6) : new Uint16Array(triangles * 6);
        for (let t = 0; t < triangles; t++) {
            const a = source ? source[t * 3]! : t * 3, b = source ? source[t * 3 + 1]! : t * 3 + 1, c = source ? source[t * 3 + 2]! : t * 3 + 2;
            lines.set([a, b, b, c, c, a], t * 6);
        }
        this.releaseWire(entry);
        const buffer = this.buffer(), vao = gl.createVertexArray();
        if (!vao) throw new World3DError('WORLD3D_CONTEXT_LOST', 'createVertexArray');
        // A dedicated vertex array keeps the geometry's own element binding untouched.
        gl.bindVertexArray(vao);
        this.bindAttributes(geometry, entry);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, lines, gl.STATIC_DRAW);
        gl.bindVertexArray(null);
        const wire = {vao, buffer, version: geometry.version, byteLength: lines.byteLength, count: lines.length, type: this.glType(lines)};
        entry.wire = wire;
        return wire;
    }
    private releaseWire(entry: GeometryEntry): void {
        if (!entry.wire) return;
        this.#gl.deleteBuffer(entry.wire.buffer);
        this.#gl.deleteVertexArray(entry.wire.vao);
        entry.wire = undefined;
    }
    private releaseGeometry(geometry: Geometry3D): void {
        const entry = this.#geometries.get(geometry), gl = this.#gl;
        if (!entry) return;
        this.#geometries.delete(geometry);
        for (const buffer of entry.buffers.values()) gl.deleteBuffer(buffer.buffer);
        if (entry.index) gl.deleteBuffer(entry.index.buffer);
        this.releaseWire(entry);
        if (entry.morph) gl.deleteTexture(entry.morph.texture);
        gl.deleteVertexArray(entry.vao);
    }

    // ---- instancing ---------------------------------------------------------------
    /** Vertex array combining a geometry's attributes with per-instance transforms and colors. */
    instances(mesh: InstancedMesh3D, frame: number): WebGLVertexArrayObject {
        const gl = this.#gl, geometry = mesh.geometry;
        this.geometry(geometry);
        const base = this.#geometries.get(geometry)!;
        let entry = this.#instances.get(mesh);
        if (!entry) {
            const vao = gl.createVertexArray();
            if (!vao) throw new World3DError('WORLD3D_CONTEXT_LOST', 'createVertexArray');
            this.#instances.set(mesh, entry = {vao, matrices: this.buffer(), colors: undefined, version: -1, layoutVersion: -1, geometryId: -1, capacityBytes: -1, lastFrame: frame});
        }
        entry.lastFrame = frame;
        const animated = mesh instanceof SkinnedInstancedMesh3D ? mesh.instanceAnimation : undefined;
        const rebind = entry.layoutVersion !== geometry.layoutVersion || entry.geometryId !== geometry.id || (mesh.instanceColors !== undefined && !entry.colors) || (animated !== undefined && !entry.animation);
        if (entry.version !== mesh.instanceVersion) {
            gl.bindBuffer(gl.ARRAY_BUFFER, entry.matrices);
            if (entry.capacityBytes === mesh.instanceMatrices.byteLength) gl.bufferSubData(gl.ARRAY_BUFFER, 0, mesh.instanceMatrices, 0, mesh.count * 16);
            else { gl.bufferData(gl.ARRAY_BUFFER, mesh.instanceMatrices, gl.DYNAMIC_DRAW); entry.capacityBytes = mesh.instanceMatrices.byteLength; }
            if (mesh.instanceColors) {
                const created = !entry.colors;
                entry.colors ??= this.buffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, entry.colors);
                if (created) gl.bufferData(gl.ARRAY_BUFFER, mesh.instanceColors, gl.DYNAMIC_DRAW);
                else gl.bufferSubData(gl.ARRAY_BUFFER, 0, mesh.instanceColors, 0, mesh.count * mesh.instanceColorSize);
            }
            if (animated) {
                const created = !entry.animation;
                entry.animation ??= this.buffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, entry.animation);
                if (created) gl.bufferData(gl.ARRAY_BUFFER, animated, gl.DYNAMIC_DRAW);
                else gl.bufferSubData(gl.ARRAY_BUFFER, 0, animated, 0, mesh.count * 4);
            }
            entry.version = mesh.instanceVersion;
        }
        if (rebind) {
            gl.bindVertexArray(entry.vao);
            this.bindAttributes(geometry, base);
            gl.bindBuffer(gl.ARRAY_BUFFER, entry.matrices);
            for (let column = 0; column < 4; column++) {
                const location = ATTRIBUTE_LOCATIONS_3D.instanceMatrix + column;
                gl.enableVertexAttribArray(location);
                gl.vertexAttribPointer(location, 4, gl.FLOAT, false, 64, column * 16);
                gl.vertexAttribDivisor(location, 1);
            }
            if (entry.colors) {
                gl.bindBuffer(gl.ARRAY_BUFFER, entry.colors);
                gl.enableVertexAttribArray(ATTRIBUTE_LOCATIONS_3D.instanceColor);
                gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS_3D.instanceColor, mesh.instanceColorSize, gl.FLOAT, false, 0, 0);
                gl.vertexAttribDivisor(ATTRIBUTE_LOCATIONS_3D.instanceColor, 1);
            }
            if (entry.animation) {
                gl.bindBuffer(gl.ARRAY_BUFFER, entry.animation);
                gl.enableVertexAttribArray(ATTRIBUTE_LOCATIONS_3D.instanceAnimation);
                gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS_3D.instanceAnimation, 4, gl.FLOAT, false, 0, 0);
                gl.vertexAttribDivisor(ATTRIBUTE_LOCATIONS_3D.instanceAnimation, 1);
            }
            gl.bindVertexArray(null);
            entry.layoutVersion = geometry.layoutVersion;
            entry.geometryId = geometry.id;
        }
        return entry.vao;
    }

    // ---- skinning ------------------------------------------------------------------
    /** Float texture holding one 4x4 matrix per row (four RGBA texels). */
    bones(skeleton: Skeleton3D, frame: number): WebGLTexture {
        const gl = this.#gl, count = skeleton.bones.length;
        let entry = this.#bones.get(skeleton);
        if (!entry || entry.count !== count) {
            if (entry) gl.deleteTexture(entry.texture);
            this.#bones.set(skeleton, entry = {texture: this.dataTexture(4, Math.max(count, 1), null), version: -1, count, lastFrame: frame});
        }
        entry.lastFrame = frame;
        if (entry.version !== skeleton.version && count > 0) {
            gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNITS_3D.bones);
            gl.bindTexture(gl.TEXTURE_2D, entry.texture);
            // Row order here is data, not an image: never let an earlier image upload's flip apply.
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 4, count, gl.RGBA, gl.FLOAT, skeleton.boneMatrices);
            entry.version = skeleton.version;
        }
        return entry.texture;
    }

    /** Float texture holding every baked frame: four texels per bone matrix, wrapped into rows of 2048. */
    animations(source: AnimationTexture3D): WebGLTexture {
        let texture = this.#animations.get(source);
        if (!texture) {
            const width = 2048, height = Math.max(1, Math.ceil(source.data.length / 4 / width));
            let data = source.data;
            if (data.length !== width * height * 4) { data = new Float32Array(width * height * 4); data.set(source.data); }
            texture = this.dataTexture(width, height, data);
            this.#animations.set(source, texture);
            const gl = this.#gl, created = texture;
            source.onDispose(() => { if (this.#animations.get(source) === created) { gl.deleteTexture(created); this.#animations.delete(source); } });
        }
        return texture;
    }

    // ---- textures ----------------------------------------------------------------------
    private applySampler(target: number, texture: Texture3D | CubeTexture3D): void {
        const gl = this.#gl;
        const wrap = (mode: string): number => mode === 'clamp' ? gl.CLAMP_TO_EDGE : mode === 'mirror' ? gl.MIRRORED_REPEAT : gl.REPEAT;
        gl.texParameteri(target, gl.TEXTURE_WRAP_S, wrap(texture.wrapS));
        gl.texParameteri(target, gl.TEXTURE_WRAP_T, wrap(texture.wrapT));
        gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, texture.magFilter === 'nearest' ? gl.NEAREST : gl.LINEAR);
        const min = texture.mipmaps ? (texture.minFilter === 'nearest' ? gl.NEAREST_MIPMAP_LINEAR : gl.LINEAR_MIPMAP_LINEAR)
            : (texture.minFilter === 'nearest' ? gl.NEAREST : gl.LINEAR);
        gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, min);
        if (this.#anisotropy && texture.anisotropy > 1) {
            gl.texParameterf(target, this.#anisotropy.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(texture.anisotropy, this.#maxAnisotropy));
        }
    }
    private image(target: number, source: TextureSource3D, internalFormat: number): number {
        const gl = this.#gl;
        if (isTexturePixels3D(source)) {
            gl.texImage2D(target, 0, internalFormat, source.width, source.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, source.data);
            return Math.max(source.width, source.height);
        }
        gl.texImage2D(target, 0, internalFormat, gl.RGBA, gl.UNSIGNED_BYTE, source as TexImageSource);
        const size = source as {width?: number; height?: number; videoWidth?: number; videoHeight?: number};
        return Math.max(size.videoWidth ?? size.width ?? 1, size.videoHeight ?? size.height ?? 1);
    }
    private textureEntry(texture: Texture3D | CubeTexture3D): TextureEntry {
        let entry = this.#textures.get(texture);
        if (!entry) {
            const handle = this.#gl.createTexture();
            if (!handle) throw new World3DError('WORLD3D_CONTEXT_LOST', 'createTexture');
            const created: TextureEntry = {texture: handle, version: -1, maxMip: 0, unsubscribe: texture.onDispose(() => {
                if (this.#textures.delete(texture)) this.#gl.deleteTexture(handle);
            })};
            this.#textures.set(texture, entry = created);
        }
        return entry;
    }
    /** Bind a 2D texture to a unit, uploading new content first when its version changed. */
    bindTexture(unit: number, texture: Texture3D): void {
        const gl = this.#gl;
        if (texture.source instanceof RenderTarget3D) {
            // A target's texture samples the framebuffer color attachment directly.
            const color = this.target(texture.source).color;
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, color);
            return;
        }
        const entry = this.textureEntry(texture);
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, entry.texture);
        if (entry.version === texture.version) return;
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, texture.flipY);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        if (isCompressedPixels3D(texture.source)) this.compressedImage(texture.source, texture.colorSpace === 'srgb');
        else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, 1000);
            this.image(gl.TEXTURE_2D, texture.source, texture.colorSpace === 'srgb' ? gl.SRGB8_ALPHA8 : gl.RGBA8);
            if (texture.mipmaps) gl.generateMipmap(gl.TEXTURE_2D);
        }
        this.applySampler(gl.TEXTURE_2D, texture);
        // The flip belongs to this upload only; leave the context as every other upload expects it.
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        entry.version = texture.version;
    }
    /** Internal format for a compressed format on this context, or undefined when its extension is missing. */
    compressedFormat(format: CompressedFormat3D, srgb: boolean): number | undefined {
        const gl = this.#gl;
        // Enumerants are fixed by the extension specifications; the extension only has to be enabled.
        const table: Record<CompressedFormat3D, [string[], number, number]> = {
            'bc1': [['WEBGL_compressed_texture_s3tc', 'WEBGL_compressed_texture_s3tc_srgb'], 0x83f1, 0x8c4d],
            'bc3': [['WEBGL_compressed_texture_s3tc', 'WEBGL_compressed_texture_s3tc_srgb'], 0x83f3, 0x8c4f],
            'bc7': [['EXT_texture_compression_bptc'], 0x8e8c, 0x8e8d],
            'etc2-rgb8': [['WEBGL_compressed_texture_etc'], 0x9274, 0x9275],
            'etc2-rgba8': [['WEBGL_compressed_texture_etc'], 0x9278, 0x9279],
            'astc-4x4': [['WEBGL_compressed_texture_astc'], 0x93b0, 0x93d0],
        };
        const entry = table[format];
        if (!entry) return undefined;
        const needed = entry[0].length === 2 ? [entry[0][srgb ? 1 : 0]!] : entry[0];
        for (const name of needed) if (!gl.getExtension(name)) return undefined;
        return srgb ? entry[2] : entry[1];
    }
    private compressedImage(source: CompressedPixels3D, srgb: boolean): void {
        const gl = this.#gl, internal = this.compressedFormat(source.format, srgb);
        if (internal === undefined) throw new World3DError('WORLD3D_RESOURCE_FAILED', 'compressed format ' + source.format + ' is not supported by this device');
        let width = source.width, height = source.height;
        source.levels.forEach((level, index) => {
            gl.compressedTexImage2D(gl.TEXTURE_2D, index, internal, width, height, 0, level);
            width = Math.max(1, width >> 1); height = Math.max(1, height >> 1);
        });
        // Sampling must stay inside the stored chain: no further levels can be generated.
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, source.levels.length - 1);
    }
    /** Bind a cube texture and return its highest mip level (used as a roughness scale). */
    bindCube(unit: number, texture: CubeTexture3D): number {
        const gl = this.#gl, entry = this.textureEntry(texture);
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, entry.texture);
        if (entry.version === texture.version) return entry.maxMip;
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        let size = 1;
        texture.faces.forEach((face, i) => {
            size = this.image(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, face, texture.colorSpace === 'srgb' ? gl.SRGB8_ALPHA8 : gl.RGBA8);
        });
        if (texture.mipmaps) gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
        this.applySampler(gl.TEXTURE_CUBE_MAP, texture);
        entry.maxMip = texture.mipmaps ? Math.floor(Math.log2(size)) : 0;
        entry.version = texture.version;
        return entry.maxMip;
    }

    // ---- render targets -----------------------------------------------------------------
    /** Create or resize the framebuffer of a render target. */
    target(target: RenderTarget3D): RenderTargetGpu3D {
        const gl = this.#gl;
        if (target.isDisposed) throw new World3DError('WORLD3D_DISPOSED', 'render target');
        let entry = this.#targets.get(target);
        if (entry && entry.version === target.version) return entry;
        if (target.width > this.#maxTextureSize || target.height > this.#maxTextureSize) throw new World3DError('WORLD3D_BUDGET', 'render target size');
        const isNew = !entry;
        if (!entry) {
            const framebuffer = gl.createFramebuffer(), color = gl.createTexture();
            if (!framebuffer || !color) {
                if (framebuffer) gl.deleteFramebuffer(framebuffer);
                if (color) gl.deleteTexture(color);
                throw new World3DError('WORLD3D_CONTEXT_LOST', 'createFramebuffer');
            }
            entry = {framebuffer, color, depth: undefined, depthTexture: undefined, version: -1, unsubscribe: target.onDispose(() => this.releaseTarget(target))};
            this.#targets.set(target, entry);
        }
        // A sampled target can allocate here while a different target is being drawn.
        // Keep the current texture unit and preserve both the draw target and its bindings.
        const previousDraw = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
        const previousTexture = gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture | null;
        const previousDepth = gl.getParameter(gl.RENDERBUFFER_BINDING) as WebGLRenderbuffer | null;
        try {
            gl.bindTexture(gl.TEXTURE_2D, entry.color);
            // Mutable storage lets setSize() reallocate the same texture object.
            if (target.format === 'rgba16f' && this.floatTargets) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, target.width, target.height, 0, gl.RGBA, gl.HALF_FLOAT, null);
            else gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, target.width, target.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            this.applySampler(gl.TEXTURE_2D, target.texture);
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, entry.framebuffer);
            gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, entry.color, 0);
            if (target.depthTexture) {
                entry.depthTexture ??= gl.createTexture() ?? undefined;
                if (!entry.depthTexture) throw new World3DError('WORLD3D_CONTEXT_LOST', 'createTexture');
                gl.bindTexture(gl.TEXTURE_2D, entry.depthTexture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, target.width, target.height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
                // Depth textures cannot be filtered; they are read texel by texel.
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, entry.depthTexture, 0);
            } else if (target.depth) {
                entry.depth ??= gl.createRenderbuffer() ?? undefined;
                if (!entry.depth) throw new World3DError('WORLD3D_CONTEXT_LOST', 'createRenderbuffer');
                gl.bindRenderbuffer(gl.RENDERBUFFER, entry.depth);
                gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, target.width, target.height);
                gl.framebufferRenderbuffer(gl.DRAW_FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, entry.depth);
            }
            if (gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE && !gl.isContextLost()) {
                throw new World3DError('WORLD3D_RESOURCE_FAILED', 'render target is incomplete');
            }
            entry.version = target.version;
            return entry;
        } catch (error) {
            if (isNew) {
                entry.unsubscribe();
                this.releaseTarget(target);
            }
            throw error;
        } finally {
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, previousDraw);
            gl.bindTexture(gl.TEXTURE_2D, previousTexture);
            gl.bindRenderbuffer(gl.RENDERBUFFER, previousDepth);
        }
    }
    private releaseTarget(target: RenderTarget3D): void {
        const entry = this.#targets.get(target), gl = this.#gl;
        if (!entry) return;
        this.#targets.delete(target);
        gl.deleteFramebuffer(entry.framebuffer);
        gl.deleteTexture(entry.color);
        if (entry.depth) gl.deleteRenderbuffer(entry.depth);
        if (entry.depthTexture) gl.deleteTexture(entry.depthTexture);
    }

    // ---- lifetime -----------------------------------------------------------------------
    /** Retire per-mesh and per-skeleton data that has not been drawn recently. */
    prune(frame: number): void {
        if (frame % PRUNE_INTERVAL !== 0) return;
        const gl = this.#gl;
        for (const [mesh, entry] of this.#instances) {
            if (frame - entry.lastFrame < PRUNE_INTERVAL) continue;
            gl.deleteBuffer(entry.matrices);
            if (entry.colors) gl.deleteBuffer(entry.colors);
            if (entry.animation) gl.deleteBuffer(entry.animation);
            gl.deleteVertexArray(entry.vao);
            this.#instances.delete(mesh);
        }
        for (const [skeleton, entry] of this.#bones) {
            if (frame - entry.lastFrame < PRUNE_INTERVAL) continue;
            gl.deleteTexture(entry.texture);
            this.#bones.delete(skeleton);
        }
    }
    /** Forget every GPU handle without deleting it; used after the context was lost. */
    reset(): void {
        for (const entry of this.#geometries.values()) entry.unsubscribe();
        for (const entry of this.#textures.values()) entry.unsubscribe();
        for (const entry of this.#targets.values()) entry.unsubscribe();
        this.#programs.clear(); this.#geometries.clear(); this.#instances.clear(); this.#textures.clear(); this.#bones.clear();
        this.#targets.clear(); this.#animations.clear();
    }
    /** Delete every GPU object owned by this cache. */
    dispose(): void {
        const gl = this.#gl;
        for (const geometry of [...this.#geometries.keys()]) { this.#geometries.get(geometry)!.unsubscribe(); this.releaseGeometry(geometry); }
        for (const entry of this.#textures.values()) { entry.unsubscribe(); gl.deleteTexture(entry.texture); }
        for (const entry of this.#instances.values()) { gl.deleteBuffer(entry.matrices); if (entry.colors) gl.deleteBuffer(entry.colors); if (entry.animation) gl.deleteBuffer(entry.animation); gl.deleteVertexArray(entry.vao); }
        for (const texture of this.#animations.values()) gl.deleteTexture(texture);
        this.#animations.clear();
        for (const entry of this.#bones.values()) gl.deleteTexture(entry.texture);
        for (const target of [...this.#targets.keys()]) { this.#targets.get(target)!.unsubscribe(); this.releaseTarget(target); }
        for (const entry of this.#programs.values()) gl.deleteProgram(entry.program);
        this.#programs.clear(); this.#textures.clear(); this.#instances.clear(); this.#bones.clear();
    }
}
