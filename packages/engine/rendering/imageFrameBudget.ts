import { IMAGE_LIMITS_2D } from '@egret/contracts';
import type { ImageData2D, TextureRegion2D } from '@egret/contracts';
import { FrameCopyError } from './copyFrame2D.js';

function bounded(value: number, limit: number): number {
    if (!Number.isSafeInteger(value) || value < 0 || value > limit) throw new FrameCopyError('budget');
    return value;
}

/** Per-copy ledger; authentic table identities and unique crops charge separately. */
export class MixedImageBudget {
    private readonly views = new Map<ImageData2D, Set<string>>();
    private tableBytes = 0;
    private viewCount = 0;
    private projectionBytes = 0;

    public constructor() {}

    public registerTable(images: readonly ImageData2D[]): void {
        bounded(images.length, IMAGE_LIMITS_2D.maxImagesPerFrame);
        // The caller authenticated every admitted table entry before payload accounting.
        for (const image of images) {
            if (!this.views.has(image)) {
                this.tableBytes = bounded(this.tableBytes + image.byteLength, IMAGE_LIMITS_2D.maxImageTableBytes);
                this.views.set(image, new Set());
            }
        }
    }

    public registerView(image: ImageData2D, region: TextureRegion2D): void {
        const views = this.views.get(image);
        if (views === undefined) throw new FrameCopyError('invalid');
        const key = `${region.x},${region.y},${region.width},${region.height}`;
        if (!views.has(key)) {
            const bytes = bounded(4 * region.width * region.height, IMAGE_LIMITS_2D.maxProjectionBytes);
            this.viewCount = bounded(this.viewCount + 1, IMAGE_LIMITS_2D.maxViewsPerFrame);
            this.projectionBytes = bounded(this.projectionBytes + bytes, IMAGE_LIMITS_2D.maxProjectionBytes);
            views.add(key);
        }
    }
}
