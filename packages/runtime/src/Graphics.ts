import type { DisplayObject } from "./DisplayObject.js";
import { EgretError } from "./EgretError.js";
import { assertVisualMutable, color, unit, copyRect, visualOf } from "./displayVisualState.js";

/** Drawing state belongs to one node; every primitive snapshots its fill. */
export class Graphics {
  private fill: { color: number; alpha: number } | undefined;

  public constructor(private readonly owner: DisplayObject) {}

  public beginFill(value: number, alpha = 1): this {
    assertVisualMutable(this.owner);
    if (!color(value) || !unit(alpha)) throw new EgretError("GRAPHICS_VALUE_INVALID");
    this.fill = { color: value, alpha };
    return this;
  }

  public drawRect(x: number, y: number, width: number, height: number): this {
    assertVisualMutable(this.owner);
    const rect = copyRect({ x, y, width, height }, "GRAPHICS_VALUE_INVALID");
    if (!this.fill) throw new EgretError("GRAPHICS_FILL_REQUIRED");
    visualOf(this.owner).primitives.push({ rect, ...this.fill });
    return this;
  }

  public endFill(): this {
    assertVisualMutable(this.owner);
    this.fill = undefined;
    return this;
  }

  public clear(): void {
    assertVisualMutable(this.owner);
    visualOf(this.owner).primitives = [];
    this.fill = undefined;
  }
}
