import type { DisplayObject } from "./DisplayObject.js";
import { EgretError } from "./EgretError.js";
import { assertVisualMutable, color, unit, finite, copyRect, visualOf, recordVisualChange, VISUAL_CONTENT } from "./displayVisualState.js";
import { GRAPHICS_SHAPE_LIMITS, addOutline, addPath, arcPoints, bezierPoints, createShapeState, ellipseOutline, roundRectOutline } from "./graphicsShape.js";
import type { ShapeLine, ShapePaint, ShapeState } from "./graphicsShape.js";

const invalid = (): EgretError => new EgretError("GRAPHICS_VALUE_INVALID");
const numbers = (...values: readonly unknown[]): void => { for (const value of values) if (!finite(value)) throw invalid(); };
const size = (...values: readonly unknown[]): void => { for (const value of values) if (!finite(value) || (value as number) < 0) throw invalid(); };

/**
 * Drawing state belongs to one node; every shape snapshots its fill and its line. A node that draws only filled
 * rectangles keeps them as rectangles. Any other shape, and any line, makes the node's drawing one list of triangles
 * in drawing order: edges are not smoothed, and a curve is drawn as straight pieces within a quarter unit of it.
 */
export class Graphics {
  private fill: ShapePaint | undefined;
  private line: ShapeLine | undefined;

  public constructor(private readonly owner: DisplayObject) {}

  public beginFill(value: number, alpha = 1): this {
    assertVisualMutable(this.owner);
    if (!color(value) || !unit(alpha)) throw invalid();
    this.finishPath();
    this.fill = { color: value, alpha };
    return this;
  }

  /** The line of the shapes drawn after it: its width in the node's units, colour and alpha. No width, or 0, ends the line. */
  public lineStyle(thickness?: number, value = 0, alpha = 1): this {
    assertVisualMutable(this.owner);
    if (thickness !== undefined && (!finite(thickness) || thickness < 0 || thickness > GRAPHICS_SHAPE_LIMITS.maxLineWidth)) throw invalid();
    if (!color(value) || !unit(alpha)) throw invalid();
    this.finishPath();
    this.line = thickness === undefined || thickness === 0 ? undefined : { width: thickness, color: value, alpha };
    return this;
  }

  public drawRect(x: number, y: number, width: number, height: number): this {
    assertVisualMutable(this.owner);
    const rect = copyRect({ x, y, width, height }, "GRAPHICS_VALUE_INVALID");
    this.paintRequired();
    const state = visualOf(this.owner);
    // Filled rectangles alone stay rectangles, which a frame draws without a geometry.
    if (state.shape === undefined && this.line === undefined) { state.primitives.push({ rect, ...this.fill! }); recordVisualChange(this.owner, VISUAL_CONTENT); return this; }
    return this.outline([x, y, x + width, y, x + width, y + height, x, y + height], true);
  }

  public drawCircle(x: number, y: number, radius: number): this {
    assertVisualMutable(this.owner);
    numbers(x, y); size(radius); this.paintRequired();
    return this.outline(ellipseOutline(x, y, radius, radius), true);
  }

  /** An ellipse inside the rectangle of this corner and size. */
  public drawEllipse(x: number, y: number, width: number, height: number): this {
    assertVisualMutable(this.owner);
    numbers(x, y); size(width, height); this.paintRequired();
    return this.outline(ellipseOutline(x + width / 2, y + height / 2, width / 2, height / 2), true);
  }

  /** A rectangle whose corners are quarter ellipses: `ellipseWidth` and `ellipseHeight` are the whole widths and heights of those ellipses. */
  public drawRoundRect(x: number, y: number, width: number, height: number, ellipseWidth: number, ellipseHeight = ellipseWidth): this {
    assertVisualMutable(this.owner);
    numbers(x, y); size(width, height, ellipseWidth, ellipseHeight); this.paintRequired();
    return this.outline(roundRectOutline(x, y, width, height, Math.min(ellipseWidth, width) / 2, Math.min(ellipseHeight, height) / 2), true);
  }

  /** Starts a new part of the path at a point. A path is filled and lined with the fill and line it was begun under. */
  public moveTo(x: number, y: number): this {
    assertVisualMutable(this.owner);
    numbers(x, y);
    const mark = this.mark();
    this.path().subpaths.push([x, y]);
    return this.changed(mark);
  }

  public lineTo(x: number, y: number): this {
    assertVisualMutable(this.owner);
    numbers(x, y);
    const mark = this.mark();
    this.current().push(x, y);
    return this.changed(mark);
  }

  /** A curve from where the path is to an anchor, bent towards one control point. */
  public curveTo(controlX: number, controlY: number, anchorX: number, anchorY: number): this {
    assertVisualMutable(this.owner);
    numbers(controlX, controlY, anchorX, anchorY);
    const mark = this.mark(), points = this.current(), n = points.length;
    points.push(...bezierPoints([points[n - 2]!, points[n - 1]!], [controlX, controlY], [anchorX, anchorY]));
    return this.changed(mark);
  }

  /** A curve from where the path is to an anchor, bent towards two control points. */
  public cubicCurveTo(controlX1: number, controlY1: number, controlX2: number, controlY2: number, anchorX: number, anchorY: number): this {
    assertVisualMutable(this.owner);
    numbers(controlX1, controlY1, controlX2, controlY2, anchorX, anchorY);
    const mark = this.mark(), points = this.current(), n = points.length;
    points.push(...bezierPoints([points[n - 2]!, points[n - 1]!], [controlX1, controlY1, controlX2, controlY2], [anchorX, anchorY]));
    return this.changed(mark);
  }

  /** An arc of a circle, in radians from the positive x axis, clockwise on the screen unless `anticlockwise`. A path already begun is joined to its start by a line. */
  public drawArc(x: number, y: number, radius: number, startAngle: number, endAngle: number, anticlockwise = false): this {
    assertVisualMutable(this.owner);
    numbers(x, y, startAngle, endAngle); size(radius);
    if (typeof anticlockwise !== "boolean") throw invalid();
    const mark = this.mark(), path = this.path(), startX = x + radius * Math.cos(startAngle), startY = y + radius * Math.sin(startAngle);
    if (path.subpaths.length === 0) path.subpaths.push([startX, startY]); else path.subpaths[path.subpaths.length - 1]!.push(startX, startY);
    path.subpaths[path.subpaths.length - 1]!.push(...arcPoints(x, y, radius, startAngle, endAngle, anticlockwise));
    return this.changed(mark);
  }

  /** Ends the fill. A path drawn under it is filled as it stands. */
  public endFill(): this {
    assertVisualMutable(this.owner);
    this.finishPath();
    this.fill = undefined;
    return this;
  }

  public clear(): void {
    assertVisualMutable(this.owner);
    const state = visualOf(this.owner), changed = state.primitives.length !== 0 || state.shape !== undefined;
    state.primitives = [];
    state.shape = undefined;
    this.fill = undefined;
    this.line = undefined;
    if (changed) recordVisualChange(this.owner, VISUAL_CONTENT);
  }

  private paintRequired(): void {
    if (this.fill === undefined && this.line === undefined) throw new EgretError("GRAPHICS_FILL_REQUIRED");
  }
  /** The node's triangles, begun with the rectangles it has drawn so far. */
  private shape(): ShapeState {
    const state = visualOf(this.owner);
    if (state.shape === undefined) {
      const shape = createShapeState();
      for (const { rect, color: value, alpha } of state.primitives)
        addOutline(shape, [rect.x, rect.y, rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + rect.height, rect.x, rect.y + rect.height], true, { color: value, alpha }, undefined);
      state.primitives = [];
      state.shape = shape;
    }
    return state.shape;
  }
  private path(): ShapeState["path"] & object {
    const shape = this.shape();
    return shape.path ??= { fill: this.fill, line: this.line, subpaths: [] };
  }
  /** The part of the path being drawn; a path that was not begun with moveTo begins at the origin. */
  private current(): number[] {
    const path = this.path();
    if (path.subpaths.length === 0) path.subpaths.push([0, 0]);
    return path.subpaths[path.subpaths.length - 1]!;
  }
  /** A path becomes triangles when its fill or line ends, or another shape is drawn over it. */
  private finishPath(): void {
    const shape = visualOf(this.owner).shape;
    if (shape === undefined || shape.path === undefined) return;
    addPath(shape, shape.path);
    shape.path = undefined;
    shape.resolved = undefined;
  }
  private outline(points: number[], convex: boolean): this {
    this.finishPath();
    const mark = this.mark();
    addOutline(this.shape(), points, convex, this.fill, this.line);
    return this.changed(mark);
  }
  /** What the node's drawing is before a shape or a point is added, so that one that does not fit can be taken back. */
  private mark(): () => void {
    const state = visualOf(this.owner), shape = state.shape;
    if (shape === undefined) { const primitives = state.primitives; return () => { state.shape = undefined; state.primitives = primitives; }; }
    const positions = shape.positions.length, colors = shape.colors.length, indices = shape.indices.length;
    const path = shape.path, parts = path?.subpaths.length ?? 0, last = parts === 0 ? 0 : path!.subpaths[parts - 1]!.length;
    return () => {
      shape.positions.length = positions; shape.colors.length = colors; shape.indices.length = indices;
      if (path === undefined) shape.path = undefined;
      else { path.subpaths.length = parts; if (parts !== 0) path.subpaths[parts - 1]!.length = last; }
    };
  }
  /** Refuses a drawing one geometry could not hold, leaving the node as it was, then publishes the change. */
  private changed(undo: () => void): this {
    const shape = visualOf(this.owner).shape!;
    let pending = 0;
    if (shape.path !== undefined) for (const points of shape.path.subpaths) pending += points.length / 2;
    // A path point gives at most three vertices and nine indices: its fill, and both sides of its line.
    const vertices = shape.positions.length / 2 + 3 * pending, indices = shape.indices.length + 9 * pending;
    if (pending > GRAPHICS_SHAPE_LIMITS.maxPathPoints || vertices > GRAPHICS_SHAPE_LIMITS.maxVertices || indices > GRAPHICS_SHAPE_LIMITS.maxIndices
      || 88 * vertices + 4 * indices > GRAPHICS_SHAPE_LIMITS.maxLogicalBytes) { undo(); throw new EgretError("GRAPHICS_BUDGET"); }
    shape.resolved = undefined;
    recordVisualChange(this.owner, VISUAL_CONTENT);
    return this;
  }
}
