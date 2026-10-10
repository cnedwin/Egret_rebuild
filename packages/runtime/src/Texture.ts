import { isImageData2D } from "@egret/contracts";
import type { ImageData2D, TextureRegion2D } from "@egret/contracts";
import { EgretError } from "./EgretError.js";

const CREATION_TOKEN: unique symbol = Symbol("egret.textureFactory");
interface TextureState {
  readonly image: ImageData2D | undefined;
  readonly sourceRect: TextureRegion2D;
}
const states = new WeakMap<object, TextureState>();
let createInstance: (image: ImageData2D, sourceRect: TextureRegion2D) => Texture;

function stateOf(value: unknown): TextureState {
  const state = states.get(value as object);
  if (state === undefined) throw new EgretError("TEXTURE_INVALID");
  return state;
}

/** Snapshot every known field before validation; no callbacks occur at commit. */
function copyRegion(image: ImageData2D, input: TextureRegion2D | undefined): TextureRegion2D {
  if (input === undefined) return Object.freeze({ x: 0, y: 0, width: image.width, height: image.height });
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
    return Object.freeze({ x: x === 0 ? 0 : x, y: y === 0 ? 0 : y, width, height });
  } catch (cause) {
    throw new EgretError("TEXTURE_REGION_INVALID", { cause });
  }
}

/** An immutable CPU image view with a separate, terminal wrapper lifetime. */
export class Texture {
  declare private readonly textureBrand: void;

  private constructor(image: ImageData2D, sourceRect: TextureRegion2D, token: typeof CREATION_TOKEN) {
    if (token !== CREATION_TOKEN) throw new EgretError("TEXTURE_FACTORY_REQUIRED");
    states.set(this, Object.freeze({ image, sourceRect }));
  }

  static {
    createInstance = (image, sourceRect) => new Texture(image, sourceRect, CREATION_TOKEN);
  }

  public get imageData(): ImageData2D { return readTextureSnapshot(this).image; }
  public get sourceRect(): TextureRegion2D { return stateOf(this).sourceRect; }
  public get width(): number { return stateOf(this).sourceRect.width; }
  public get height(): number { return stateOf(this).sourceRect.height; }
  public get isDisposed(): boolean { return stateOf(this).image === undefined; }

  /** Drop only the wrapper reference; saved image values keep their own pixels. */
  public dispose(): void {
    const state = stateOf(this);
    if (state.image !== undefined) states.set(this, Object.freeze({ image: undefined, sourceRect: state.sourceRect }));
  }
}

export function createTexture(image: ImageData2D, sourceRect?: TextureRegion2D): Texture {
  if (!isImageData2D(image)) throw new EgretError("TEXTURE_IMAGE_INVALID", { cause: new TypeError("Authentic ImageData2D required") });
  return createInstance(image, copyRegion(image, sourceRect));
}

/** Brand-only: disposal does not change the identity of a Texture. */
export function isTexture(value: unknown): value is Texture { return states.has(value as object); }

export interface TextureSnapshot2D {
  readonly image: ImageData2D;
  readonly sourceRect: TextureRegion2D;
}

/** Runtime-private authority; never consult subclass-overridable getters. */
export function readTextureSnapshot(texture: Texture): TextureSnapshot2D {
  const state = stateOf(texture);
  if (state.image === undefined) throw new EgretError("TEXTURE_DISPOSED");
  return Object.freeze({ image: state.image, sourceRect: state.sourceRect });
}
