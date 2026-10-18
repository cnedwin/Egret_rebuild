import { isImageData2D } from "@egret/contracts";
import type { ImageData2D, TextureRegion2D, TextureViewRegionInput2D, TextureViewRegion2D } from "@egret/contracts";
import { EgretError } from "./EgretError.js";

// Capture the original intrinsic before descriptor callbacks can replace it;
// Texture snapshots must not introduce late callbacks inside resource checkpoints.
const freeze = Object.freeze;
const apply = Reflect.apply;
const isArray = Array.isArray;
const safeInteger = Number.isSafeInteger;
const TypeFault = TypeError;
const RangeFault = RangeError;
const weakGet = WeakMap.prototype.get;
const weakSet = WeakMap.prototype.set;
const weakHas = WeakMap.prototype.has;
const CREATION_TOKEN: unique symbol = Symbol("egret.textureFactory");
interface TextureState {
  readonly image: ImageData2D | undefined;
  readonly sourceRect: TextureRegion2D;
  readonly viewRegion: TextureViewRegion2D | null;
}
const states = new WeakMap<object, TextureState>();
let createInstance: (image: ImageData2D, sourceRect: TextureRegion2D, viewRegion?: TextureViewRegion2D | null) => Texture;

function stateOf(value: unknown): TextureState {
  const state = apply(weakGet, states, [value]) as TextureState | undefined;
  if (state === undefined) throw new EgretError("TEXTURE_INVALID");
  return state;
}

/** Snapshot every known field before validation; no callbacks occur at commit. */
function copyRegion(image: ImageData2D, input: TextureRegion2D | undefined): TextureRegion2D {
  if (input === undefined) return freeze({ x: 0, y: 0, width: image.width, height: image.height });
  try {
    if (input === null || typeof input !== "object") throw new TypeError("Texture region must be a record");
    const x = input.x, y = input.y, width = input.width, height = input.height;
    for (const [value, positive] of [[x, false], [y, false], [width, true], [height, true]] as const) {
      if (typeof value !== "number") throw new TypeError("Texture region fields must be numbers");
      if (!Number.isSafeInteger(value) || (positive ? value <= 0 : value < 0)) throw new RangeError("Texture region integer range");
    }
    const right = x + width, bottom = y + height;
    if (!Number.isSafeInteger(right) || !Number.isSafeInteger(bottom) || right > image.width || bottom > image.height) {
      throw new RangeError("Texture region exceeds its image");
    }
    return freeze({ x: x === 0 ? 0 : x, y: y === 0 ? 0 : y, width, height });
  } catch (cause) {
    throw new EgretError("TEXTURE_REGION_INVALID", { cause });
  }
}

function viewInteger(value: unknown, positive: boolean, maximum: number): number {
  if (typeof value !== 'number') throw new TypeFault("Texture view region fields must be numbers");
  if (!safeInteger(value) || (positive ? value <= 0 : value < 0) || value > maximum) {
    throw new RangeFault("Texture view region integer range");
  }
  return value === 0 ? 0 : value;
}

/** Stage the entire region before validation, then own both immutable records. */
function copyViewRegion(image: ImageData2D, input: TextureViewRegionInput2D): TextureViewRegion2D {
  try {
    if (typeof input !== 'object' || input === null || isArray(input)) {
      throw new TypeFault("Texture view region must be a record");
    }
    const packedInput = input.packed;
    const logicalWidthInput = input.logicalWidth;
    const logicalHeightInput = input.logicalHeight;
    const trimXInput = input.trimX;
    const trimYInput = input.trimY;
    const quarterTurnInput = input.quarterTurn;
    // A late top-level getter outranks an earlier malformed packed record.
    if (typeof packedInput !== 'object' || packedInput === null || isArray(packedInput)) {
      throw new TypeFault("Texture view region must be a record");
    }
    const xInput = packedInput.x;
    const yInput = packedInput.y;
    const widthInput = packedInput.width;
    const heightInput = packedInput.height;
    const x = viewInteger(xInput, false, 1048576);
    const y = viewInteger(yInput, false, 1048576);
    const width = viewInteger(widthInput, true, 1048576);
    const height = viewInteger(heightInput, true, 1048576);
    const logicalWidth = viewInteger(logicalWidthInput, true, 1048576);
    const logicalHeight = viewInteger(logicalHeightInput, true, 1048576);
    const trimX = viewInteger(trimXInput, false, 1048576);
    const trimY = viewInteger(trimYInput, false, 1048576);
    const quarterTurn = viewInteger(quarterTurnInput, false, 3);
    const right = x + width, bottom = y + height;
    if (!safeInteger(right) || !safeInteger(bottom) || right > image.width || bottom > image.height) {
      throw new RangeFault("Texture view region exceeds its image");
    }
    const rotated = quarterTurn === 1 || quarterTurn === 3;
    const contentWidth = rotated ? height : width;
    const contentHeight = rotated ? width : height;
    if (trimX + contentWidth > logicalWidth || trimY + contentHeight > logicalHeight) {
      throw new RangeFault("Texture view content exceeds its logical region");
    }
    const packed = freeze({ x, y, width, height });
    return freeze({ packed, logicalWidth, logicalHeight, trimX, trimY,
      quarterTurn: quarterTurn as 0 | 1 | 2 | 3 });
  } catch (cause) {
    throw new EgretError("TEXTURE_VIEW_REGION_INVALID", { cause });
  }
}

/** An immutable CPU image view with a separate, terminal wrapper lifetime. */
export class Texture {
  declare private readonly textureBrand: void;

  private constructor(image: ImageData2D, sourceRect: TextureRegion2D, token: typeof CREATION_TOKEN, viewRegion: TextureViewRegion2D | null) {
    if (token !== CREATION_TOKEN) throw new EgretError("TEXTURE_FACTORY_REQUIRED");
    // The original registry operation prevents descriptor callbacks from adding
    // a new callback between completed CPU ownership and identity publication.
    apply(weakSet, states, [this, freeze({ image, sourceRect, viewRegion })]);
  }

  static {
    createInstance = (image, sourceRect, viewRegion = null) => new Texture(image, sourceRect, CREATION_TOKEN, viewRegion);
  }

  public get imageData(): ImageData2D { return readTextureSnapshot(this).image; }
  public get sourceRect(): TextureRegion2D { return stateOf(this).sourceRect; }
  public get viewRegion(): TextureViewRegion2D | null { return stateOf(this).viewRegion; }
  public get width(): number { return stateOf(this).sourceRect.width; }
  public get height(): number { return stateOf(this).sourceRect.height; }
  public get isDisposed(): boolean { return stateOf(this).image === undefined; }

  /** Drop only the wrapper reference; saved image values keep their own pixels. */
  public dispose(): void {
    const state = stateOf(this);
    if (state.image !== undefined) apply(weakSet, states, [this, freeze({ image: undefined, sourceRect: state.sourceRect, viewRegion: state.viewRegion })]);
  }
}

export function createTexture(image: ImageData2D, sourceRect?: TextureRegion2D): Texture {
  if (!isImageData2D(image)) throw new EgretError("TEXTURE_IMAGE_INVALID", { cause: new TypeError("Authentic ImageData2D required") });
  return createInstance(image, copyRegion(image, sourceRect));
}

/** Create an explicit logical view over an authentic straight CPU image. */
export function createTextureView(image: ImageData2D, region: TextureViewRegionInput2D): Texture {
  if (!isImageData2D(image)) throw new EgretError("TEXTURE_IMAGE_INVALID", { cause: new TypeFault("Authentic ImageData2D required") });
  const viewRegion = copyViewRegion(image, region);
  // Instance allocation/registry failures are outside region-error wrapping.
  return createInstance(image, viewRegion.packed, viewRegion);
}

/** Brand-only: disposal does not change the identity of a Texture. */
export function isTexture(value: unknown): value is Texture { return apply(weakHas, states, [value]); }

export interface TextureSnapshot2D {
  readonly image: ImageData2D;
  readonly sourceRect: TextureRegion2D;
  readonly viewRegion: TextureViewRegion2D | null;
}

/** Runtime-private authority; never consult subclass-overridable getters. */
export function readTextureSnapshot(texture: Texture): TextureSnapshot2D {
  const state = stateOf(texture);
  if (state.image === undefined) throw new EgretError("TEXTURE_DISPOSED");
  return freeze({ image: state.image, sourceRect: state.sourceRect, viewRegion: state.viewRegion });
}
