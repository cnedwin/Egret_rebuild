import { IMAGE_LIMITS_2D, TEXTURED_FRAME_PROFILE_2D, isImageData2D, isTexturedGeometry2D } from '@egret/contracts';
import type { ClipRectangle2D, Matrix2D, Rectangle2D, TexturedRenderFrame2D, TextureRegion2D, ImageData2D } from '@egret/contracts';
import type { AdmittedTexturedCommand2D, TexturedFrameAdmission2D } from './prepareTexturedDraws2D.js';
import { coordinate } from './prepareRectangles2D.js';
import type { TexturedPreparationBudget2D } from './texturedPreparationBudget2D.js';
import { noteOwnedPreparationFailure } from './ownedPreparationFailure2D.js';

export interface TexturedFrameAdmissionOptions2D {
    readonly pixelRatio: number;
    readonly maxBackingPixels: number;
    readonly maxCommands: number;
    readonly maxClipRectangles: number;
    readonly maxSourceTriangles: number;
    readonly maxFrameGeometryBytes: number;
}
/** Private metadata classification; the host also requires current-invocation provenance. */
export class TexturedFrameAdmissionError2D extends Error {
    public constructor(public readonly reason: 'invalid' | 'backing' | 'budget') { super(`Textured frame admission ${reason}`); }
}
function fail(reason: 'invalid' | 'backing' | 'budget'): never {
    throw noteOwnedPreparationFailure(new TexturedFrameAdmissionError2D(reason));
}
function length(value: number, maximum: number): number {
    if (!Number.isSafeInteger(value) || value < 0) fail('invalid');
    if (value > maximum) fail('budget');
    return value;
}
function index(value: number, count: number): number {
    if (!Number.isSafeInteger(value) || value < 0 || value >= count) fail('invalid');
    return value;
}
function alpha(value: number): void { if (!Number.isFinite(value) || value < 0 || value > 1) fail('invalid'); }
function color(value: number): void { if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffff) fail('invalid'); }
function matrix(value: Matrix2D): void { for (const component of [value.a, value.b, value.c, value.d, value.tx, value.ty]) coordinate(component); }
/** Validate every affine arithmetic intermediate without predicates or triangle payload reads. */
function rectangle(m: Matrix2D, r: Rectangle2D, ratio: number): void {
    matrix(m);
    for (const component of [r.x, r.y, r.width, r.height]) coordinate(component);
    if (r.width < 0 || r.height < 0) fail('invalid');
    const right = coordinate(r.x + r.width), bottom = coordinate(r.y + r.height);
    for (const [x, y] of [[r.x, r.y], [right, r.y], [right, bottom], [r.x, bottom]] as const) {
        const px = coordinate(coordinate(coordinate(m.a * x) + coordinate(m.c * y)) + m.tx);
        const py = coordinate(coordinate(coordinate(m.b * x) + coordinate(m.d * y)) + m.ty);
        coordinate(px * ratio); coordinate(py * ratio);
    }
}
function crop(region: TextureRegion2D, image: ImageData2D): void {
    const { x, y, width, height } = region;
    if (![x, y, width, height].every(Number.isSafeInteger) || x < 0 || y < 0 || width <= 0 || height <= 0 ||
        !Number.isSafeInteger(x + width) || !Number.isSafeInteger(y + height) || x + width > image.width || y + height > image.height) fail('invalid');
}

/** Admit an already owner-authenticated frame. This helper grants no frame authority. */
export function admitTexturedFrame2D(frame: TexturedRenderFrame2D, options: TexturedFrameAdmissionOptions2D,
    budget: TexturedPreparationBudget2D): TexturedFrameAdmission2D {
    if (frame.profile !== TEXTURED_FRAME_PROFILE_2D || !Number.isSafeInteger(frame.frameId) || frame.frameId <= 0 ||
        !Number.isFinite(frame.width) || frame.width <= 0 || !Number.isFinite(frame.height) || frame.height <= 0) fail('invalid');
    color(frame.clearColor); alpha(frame.clearAlpha);
    // Nominal DPR accepts every finite positive value; backing admission precedes geometry limits.
    const ratio = options.pixelRatio;
    if (!Number.isFinite(ratio) || ratio <= 0) fail('invalid');
    const width = Math.ceil(frame.width * ratio), height = Math.ceil(frame.height * ratio);
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0 ||
        width > 4294967295 || height > 4294967295 || width > Math.floor(options.maxBackingPixels / height)) fail('backing');
    // All three lengths precede indexed payload; iterable or instance callbacks are unnecessary.
    const commandCount = length(frame.commands.length, Math.min(65536, options.maxCommands));
    const imageCount = length(frame.images.length, IMAGE_LIMITS_2D.maxImagesPerFrame);
    const geometryCount = length(frame.geometries.length, 128);
    const geometries = new Set<object>(), images = new Set<object>();
    let uniqueGeometryBytes = 0, imageBytes = 0;
    const geometryLimit = Math.min(16777216, options.maxFrameGeometryBytes);
    for (let i = 0; i < geometryCount; i++) {
        const geometry = frame.geometries[i];
        if (!isTexturedGeometry2D(geometry)) fail('invalid');
        if (!geometries.has(geometry)) {
            if (geometry.logicalByteLength > geometryLimit - uniqueGeometryBytes) fail('budget');
            uniqueGeometryBytes += geometry.logicalByteLength;
            geometries.add(geometry);
        }
    }
    for (let i = 0; i < imageCount; i++) {
        const image = frame.images[i];
        if (!isImageData2D(image)) fail('invalid');
        if (!images.has(image)) {
            if (image.byteLength > IMAGE_LIMITS_2D.maxImageTableBytes - imageBytes) fail('budget');
            imageBytes += image.byteLength; images.add(image);
        }
    }
    const commands: AdmittedTexturedCommand2D[] = [];
    let clipsCharged = 0, sourceCharged = 0;
    for (let commandIndex = 0; commandIndex < commandCount; commandIndex++) {
        const command = frame.commands[commandIndex]!;
        if (command.kind !== 'rect' && command.kind !== 'image' && command.kind !== 'mesh') fail('invalid');
        const geometry = command.kind === 'mesh' ? frame.geometries[index(command.geometryIndex, geometryCount)]! : undefined;
        if (geometry !== undefined) {
            // Storage deduplication never discounts repeated source work; debit before matrix/indices.
            if (geometry.triangleCount > options.maxSourceTriangles - sourceCharged) fail('budget');
            budget.admitSourceTriangles(geometry.triangleCount);
            sourceCharged += geometry.triangleCount;
        }
        matrix(command.matrix); alpha(command.alpha);
        const image = command.kind === 'rect' ? undefined : frame.images[index(command.imageIndex, imageCount)]!;
        if (image !== undefined && command.kind !== 'rect') crop(command.sourceRect, image);
        if (command.kind === 'rect') color(command.color);
        if (command.kind !== 'mesh') rectangle(command.matrix, command.rect, ratio);
        const clipCount = length(command.clips.length, Math.min(262144, options.maxClipRectangles) - clipsCharged);
        clipsCharged += clipCount;
        for (let i = 0; i < clipCount; i++) {
            const clip: ClipRectangle2D = command.clips[i]!;
            rectangle(clip.matrix, clip.rect, ratio);
        }
        commands.push({ command, commandIndex, ...(image === undefined ? {} : { image }), ...(geometry === undefined ? {} : { geometry }) });
    }
    return { frame, width, height, uniqueGeometryBytes, commands };
}
