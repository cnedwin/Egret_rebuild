import { IMAGE_LIMITS_2D } from "@egret/contracts";
import type { ImageData2D, TextureRegion2D } from "@egret/contracts";
import { EgretError } from "./EgretError.js";

function bounded(value: number, limit: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > limit) throw new EgretError("FRAME_IMAGE_BUDGET");
  return value;
}

/** Per-capture identity ledger: payload and cropped-view charges are independent. */
export class CaptureImageBudget {
  private readonly images: ImageData2D[] = [];
  private readonly entries = new Map<ImageData2D, { readonly index: number; readonly views: Set<string> }>();
  private tableBytes = 0;
  private viewCount = 0;
  private projectionBytes = 0;

  public constructor() {}

  public register(image: ImageData2D, region: TextureRegion2D): number {
    let entry = this.entries.get(image);
    if (entry === undefined) {
      bounded(this.images.length + 1, IMAGE_LIMITS_2D.maxImagesPerFrame);
      this.tableBytes = bounded(this.tableBytes + image.byteLength, IMAGE_LIMITS_2D.maxImageTableBytes);
      entry = { index: this.images.length, views: new Set() };
      this.entries.set(image, entry);
      this.images.push(image);
    }
    // Regions arrive from authenticated, frozen Bitmap selections contained in
    // their Texture view; the key retains coordinates and the Map image identity.
    const key = `${region.x},${region.y},${region.width},${region.height}`;
    if (!entry.views.has(key)) {
      const bytes = bounded(4 * region.width * region.height, IMAGE_LIMITS_2D.maxProjectionBytes);
      this.viewCount = bounded(this.viewCount + 1, IMAGE_LIMITS_2D.maxViewsPerFrame);
      this.projectionBytes = bounded(this.projectionBytes + bytes, IMAGE_LIMITS_2D.maxProjectionBytes);
      entry.views.add(key);
    }
    return entry.index;
  }

  public finish(): readonly ImageData2D[] | undefined {
    return this.images.length === 0 ? undefined : Object.freeze(this.images);
  }
}
