import type { DisplayObject } from "./DisplayObject.js";
import { EgretError } from "./EgretError.js";
import {
  assertVisualMutable,
  color,
  alphaOf,
  finite,
  copyRect,
  visualOf,
  recordVisualChange,
  VISUAL_CONTENT
} from "./displayVisualState.js";
import {
  GRAPHICS_SHAPE_LIMITS,
  addOutline,
  addPath,
  arcPoints,
  bezierPoints,
  copyDrawing,
  createShapeState,
  curveSegments,
  drawingFits,
  ellipseOutline,
  roundRectOutline,
  shapeFits
} from "./graphicsShape.js";
import { isAssetLease, readAssetLeaseValue } from "./AssetLease.js";
import type { AssetLease } from "./AssetLease.js";
import { isTexture, readTextureSnapshot } from "./Texture.js";
import type { Texture } from "./Texture.js";
import type { LineCaps, LineJoints, ShapeLine, ShapePaint, ShapeState } from "./graphicsShape.js";
import type { GradientStop, ShapeGradient } from "./graphicsFill.js";

/** How a line's ends and corners are drawn, and its dashes. */
export interface LineStyleOptions {
  /** The ends of an open line: flat at the point ("none", as before), a half circle, or a half square. */
  readonly caps?: LineCaps;
  /** The outside of a corner: a point ("miter", as before), an arc, or a flat cut. */
  readonly joints?: LineJoints;
  /** A mitre longer than this many half-widths is cut flat. 4 unless given; at least 1. */
  readonly miterLimit?: number;
  /** The lengths of a dash and of a gap, in turn, in the node's units. An odd count is taken twice over. */
  readonly dash?: readonly number[];
}
/** A colour of a gradient: where it is, from 0 at the start to 1 at the end, its colour, and its alpha, 1 unless given. */
export interface GradientColorStop {
  readonly offset: number;
  readonly color: number;
  readonly alpha?: number;
}
/** The matrix of an older gradient call: it places a square 1638.4 units wide, centred on the origin, in the node. */
export interface GradientBoxMatrix {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly tx: number;
  readonly ty: number;
}

const invalid = (): EgretError => new EgretError("GRAPHICS_VALUE_INVALID");
const numbers = (...values: readonly unknown[]): void => {
  for (const value of values) if (!finite(value)) throw invalid();
};
const size = (...values: readonly unknown[]): void => {
  for (const value of values) if (!finite(value) || (value as number) < 0) throw invalid();
};

/**
 * Drawing state belongs to one node; every shape snapshots its fill and its line. A node that draws only filled
 * rectangles keeps them as rectangles. Any other shape, and any line, makes the node's drawing one list of triangles
 * in drawing order, and a curve is drawn as straight pieces within a quarter unit of it. Edges are a stair of pixels
 * unless `smoothing` is set.
 */
export class Graphics {
  private fill: ShapePaint | undefined;
  private line: ShapeLine | undefined;
  private soft = 0;

  public constructor(private readonly owner: DisplayObject) {}

  /**
   * How far, in the node's units, the edge of each shape and line drawn from now on fades to nothing: 0, which it is
   * at first, to 8. One unit smooths an edge at the size it was drawn. A band of triangles is added around the shape,
   * which is that much larger. A fill under a line has no band of its own. Filled rectangles alone stay rectangles,
   * and an image fill has no band.
   */
  public get smoothing(): number {
    return this.soft;
  }
  public set smoothing(value: number) {
    assertVisualMutable(this.owner);
    if (!finite(value) || value < 0 || value > 8) throw invalid();
    this.finishPath();
    this.soft = value;
  }
  private edged<T extends ShapePaint>(paint: T | undefined): T | undefined {
    return paint === undefined || this.soft === 0 ? paint : { ...paint, feather: this.soft };
  }

  public beginFill(value: number, alpha = 1): this {
    assertVisualMutable(this.owner);
    const held = alphaOf(alpha);
    if (!color(value) || held === undefined) throw invalid();
    this.finishPath();
    this.fill = { color: value, alpha: held };
    return this;
  }

  /** The line of the shapes drawn after it: its width in the node's units, colour and alpha. No width, or 0, ends the line. */
  public lineStyle(thickness?: number, value = 0, alpha = 1, options: LineStyleOptions = {}): this {
    assertVisualMutable(this.owner);
    if (
      thickness !== undefined &&
      (!finite(thickness) || thickness < 0 || thickness > GRAPHICS_SHAPE_LIMITS.maxLineWidth)
    )
      throw invalid();
    const held = alphaOf(alpha);
    if (!color(value) || held === undefined || typeof options !== "object" || options === null) throw invalid();
    const caps = options.caps ?? "none",
      joints = options.joints ?? "miter",
      miterLimit = options.miterLimit ?? 4,
      given = options.dash;
    if (
      (caps !== "none" && caps !== "round" && caps !== "square") ||
      (joints !== "miter" && joints !== "round" && joints !== "bevel") ||
      !finite(miterLimit) ||
      miterLimit < 1
    )
      throw invalid();
    let dash: number[] | undefined;
    if (given !== undefined) {
      if (!Array.isArray(given) || given.length > 16) throw invalid();
      let sum = 0;
      for (const length of given) {
        if (!finite(length) || length < 0) throw invalid();
        sum += length;
      }
      // No lengths, or lengths of nothing, are no dashes.
      if (sum > 0) dash = given.slice();
    }
    this.finishPath();
    this.line =
      thickness === undefined || thickness === 0
        ? undefined
        : { width: thickness, color: value, alpha: held, caps, joints, miterLimit, dash };
    return this;
  }

  /** A fill whose colour runs along the line from one point to another, and stays the end colours beyond them. */
  public beginLinearGradientFill(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    stops: readonly GradientColorStop[]
  ): this {
    assertVisualMutable(this.owner);
    numbers(x0, y0, x1, y1);
    const dx = x1 - x0,
      dy = y1 - y0,
      square = dx * dx + dy * dy;
    if (!(square > 0) || !finite(1 / square)) throw invalid();
    return this.gradient({
      radial: false,
      a: dx / square,
      c: dy / square,
      tx: -(x0 * dx + y0 * dy) / square,
      b: 0,
      d: 0,
      ty: 0,
      stops: gradientStops(stops)
    });
  }

  /** A fill whose colour runs from a centre out to a circle, or to an ellipse when `radiusY` is given, and stays the last colour beyond it. */
  public beginRadialGradientFill(
    x: number,
    y: number,
    radius: number,
    stops: readonly GradientColorStop[],
    radiusY = radius
  ): this {
    assertVisualMutable(this.owner);
    numbers(x, y, radius, radiusY);
    if (!(radius > 0) || !(radiusY > 0) || !finite(1 / radius) || !finite(1 / radiusY)) throw invalid();
    return this.gradient({
      radial: true,
      a: 1 / radius,
      c: 0,
      tx: -x / radius,
      b: 0,
      d: 1 / radiusY,
      ty: -y / radiusY,
      stops: gradientStops(stops)
    });
  }

  /**
   * A gradient fill as older code gives it: "linear" or "radial", colours, alphas, ratios from 0 to 255, and a matrix
   * that places the gradient's square of 1638.4 units, centred on the origin, in the node. Without a matrix that
   * square is where it is.
   */
  public beginGradientFill(
    type: "linear" | "radial",
    colors: readonly number[],
    alphas: readonly number[],
    ratios: readonly number[],
    matrix?: GradientBoxMatrix
  ): this {
    assertVisualMutable(this.owner);
    if (
      (type !== "linear" && type !== "radial") ||
      !Array.isArray(colors) ||
      !Array.isArray(alphas) ||
      !Array.isArray(ratios) ||
      colors.length !== alphas.length ||
      colors.length !== ratios.length
    )
      throw invalid();
    const m = matrix ?? { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
    if (typeof m !== "object" || m === null) throw invalid();
    numbers(m.a, m.b, m.c, m.d, m.tx, m.ty);
    for (const ratio of ratios) if (!finite(ratio) || ratio < 0 || ratio > 255) throw invalid();
    const det = m.a * m.d - m.b * m.c,
      stops = gradientStops(
        colors.map((value, i) => ({ offset: (ratios[i] as number) / 255, color: value, alpha: alphas[i] as number }))
      );
    if (det === 0 || !finite(1 / det)) throw invalid();
    // The node's point in the square's units, then along the square for a linear gradient or out from its centre for a radial one.
    const ia = m.d / det,
      ic = -m.c / det,
      itx = (m.c * m.ty - m.d * m.tx) / det,
      ib = -m.b / det,
      id = m.a / det,
      ity = (m.b * m.tx - m.a * m.ty) / det;
    if (type === "linear")
      return this.gradient({
        radial: false,
        a: ia / 1638.4,
        c: ic / 1638.4,
        tx: itx / 1638.4 + 0.5,
        b: 0,
        d: 0,
        ty: 0,
        stops
      });
    return this.gradient({
      radial: true,
      a: ia / 819.2,
      c: ic / 819.2,
      tx: itx / 819.2,
      b: ib / 819.2,
      d: id / 819.2,
      ty: ity / 819.2,
      stops
    });
  }

  public drawRect(x: number, y: number, width: number, height: number): this {
    assertVisualMutable(this.owner);
    const rect = copyRect({ x, y, width, height }, "GRAPHICS_VALUE_INVALID");
    this.paintRequired();
    const state = visualOf(this.owner);
    // Filled rectangles alone stay rectangles, which a frame draws without a geometry.
    if (
      state.shape === undefined &&
      this.line === undefined &&
      this.fill!.gradient === undefined &&
      this.fill!.bitmap === undefined
    ) {
      state.primitives.push({ rect, ...this.fill! });
      recordVisualChange(this.owner, VISUAL_CONTENT);
      return this;
    }
    return this.outline([x, y, x + width, y, x + width, y + height, x, y + height], true);
  }

  public drawCircle(x: number, y: number, radius: number): this {
    assertVisualMutable(this.owner);
    numbers(x, y);
    size(radius);
    this.paintRequired();
    return this.outline(ellipseOutline(x, y, radius, radius), true);
  }

  /** An ellipse inside the rectangle of this corner and size. */
  public drawEllipse(x: number, y: number, width: number, height: number): this {
    assertVisualMutable(this.owner);
    numbers(x, y);
    size(width, height);
    this.paintRequired();
    return this.outline(ellipseOutline(x + width / 2, y + height / 2, width / 2, height / 2), true);
  }

  /** A rectangle whose corners are quarter ellipses: `ellipseWidth` and `ellipseHeight` are the whole widths and heights of those ellipses. */
  public drawRoundRect(
    x: number,
    y: number,
    width: number,
    height: number,
    ellipseWidth: number,
    ellipseHeight = ellipseWidth
  ): this {
    assertVisualMutable(this.owner);
    numbers(x, y);
    size(width, height, ellipseWidth, ellipseHeight);
    this.paintRequired();
    return this.outline(
      roundRectOutline(x, y, width, height, Math.min(ellipseWidth, width) / 2, Math.min(ellipseHeight, height) / 2),
      true
    );
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
    const mark = this.mark(),
      points = this.current(),
      n = points.length;
    points.push(...bezierPoints([points[n - 2]!, points[n - 1]!], [controlX, controlY], [anchorX, anchorY]));
    return this.changed(mark);
  }

  /** A curve from where the path is to an anchor, bent towards two control points. */
  public cubicCurveTo(
    controlX1: number,
    controlY1: number,
    controlX2: number,
    controlY2: number,
    anchorX: number,
    anchorY: number
  ): this {
    assertVisualMutable(this.owner);
    numbers(controlX1, controlY1, controlX2, controlY2, anchorX, anchorY);
    const mark = this.mark(),
      points = this.current(),
      n = points.length;
    points.push(
      ...bezierPoints(
        [points[n - 2]!, points[n - 1]!],
        [controlX1, controlY1, controlX2, controlY2],
        [anchorX, anchorY]
      )
    );
    return this.changed(mark);
  }

  /** An arc of a circle, in radians from the positive x axis, clockwise on the screen unless `anticlockwise`. A path already begun is joined to its start by a line. */
  public drawArc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    anticlockwise = false
  ): this {
    assertVisualMutable(this.owner);
    numbers(x, y, startAngle, endAngle);
    size(radius);
    if (typeof anticlockwise !== "boolean") throw invalid();
    const mark = this.mark(),
      path = this.path(),
      startX = x + radius * Math.cos(startAngle),
      startY = y + radius * Math.sin(startAngle);
    if (path.subpaths.length === 0) path.subpaths.push([startX, startY]);
    else path.subpaths[path.subpaths.length - 1]!.push(startX, startY);
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

  /** Removes everything drawn and ends the fill and the line. Returns the graphics, so drawing can follow at once. */
  public clear(): this {
    assertVisualMutable(this.owner);
    const state = visualOf(this.owner),
      changed = state.primitives.length !== 0 || state.shape !== undefined;
    state.primitives = [];
    state.shape = undefined;
    this.fill = undefined;
    this.line = undefined;
    if (changed) recordVisualChange(this.owner, VISUAL_CONTENT);
    return this;
  }

  /**
   * A fill of an image. `lease` is the lease of a texture that is a whole image, not a part of an atlas. `matrix`
   * places the image in the node: its pixel (x, y) is drawn at `a·x + c·y + tx`, `b·x + d·y + ty`; without it a pixel
   * is one unit and the image starts at the node's origin. The image repeats unless `repeat` is false, and then its
   * edge pixels go on outwards. Keep the lease for as long as the drawing is shown.
   */
  public beginBitmapFill(lease: AssetLease<Texture>, matrix?: GradientBoxMatrix, repeat = true): this {
    assertVisualMutable(this.owner);
    if (!isAssetLease(lease) || typeof repeat !== "boolean") throw invalid();
    const texture = readAssetLeaseValue(lease);
    if (!isTexture(texture)) throw invalid();
    const snapshot = readTextureSnapshot(texture),
      width = snapshot.image.width,
      height = snapshot.image.height,
      rect = snapshot.sourceRect;
    // A part of an atlas cannot repeat by itself: the image around it would show.
    if (snapshot.viewRegion !== null || rect.x !== 0 || rect.y !== 0 || rect.width !== width || rect.height !== height)
      throw invalid();
    const m = matrix ?? { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
    if (typeof m !== "object" || m === null) throw invalid();
    numbers(m.a, m.b, m.c, m.d, m.tx, m.ty);
    const det = m.a * m.d - m.b * m.c;
    if (det === 0 || !finite(1 / det)) throw invalid();
    // The node's point as a pixel of the image, then as a part of its width and height.
    const bitmap = {
      lease,
      repeat,
      width,
      height,
      a: m.d / det / width,
      c: -m.c / det / width,
      tx: (m.c * m.ty - m.d * m.tx) / det / width,
      b: -m.b / det / height,
      d: m.a / det / height,
      ty: (m.b * m.tx - m.a * m.ty) / det / height
    };
    for (const value of [bitmap.a, bitmap.b, bitmap.c, bitmap.d, bitmap.tx, bitmap.ty])
      if (!finite(value)) throw invalid();
    this.finishPath();
    this.fill = { color: 0xffffff, alpha: 1, bitmap };
    return this;
  }

  private gradient(gradient: ShapeGradient): this {
    for (const value of [gradient.a, gradient.b, gradient.c, gradient.d, gradient.tx, gradient.ty])
      if (!finite(value)) throw invalid();
    this.finishPath();
    const first = gradient.stops[0]!;
    this.fill = { color: first.color, alpha: first.alpha, gradient };
    return this;
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
        addOutline(
          shape,
          [
            rect.x,
            rect.y,
            rect.x + rect.width,
            rect.y,
            rect.x + rect.width,
            rect.y + rect.height,
            rect.x,
            rect.y + rect.height
          ],
          true,
          { color: value, alpha },
          undefined
        );
      state.primitives = [];
      state.shape = shape;
    }
    return state.shape;
  }
  private path(): ShapeState["path"] & object {
    const shape = this.shape();
    return (shape.path ??= { fill: this.edged(this.fill), line: this.edged(this.line), subpaths: [] });
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
    const path = shape.path;
    shape.path = undefined;
    shape.resolved = undefined;
    const undo = this.mark();
    if (addPath(shape, path) && drawingFits(shape)) return;
    // A path that became more than the node may hold is dropped whole; what was drawn before it stays.
    undo();
    recordVisualChange(this.owner, VISUAL_CONTENT);
    throw new EgretError("GRAPHICS_BUDGET");
  }
  private outline(points: number[], convex: boolean): this {
    this.finishPath();
    const mark = this.mark();
    if (!addOutline(this.shape(), points, convex, this.edged(this.fill), this.edged(this.line))) {
      mark();
      throw new EgretError("GRAPHICS_BUDGET");
    }
    return this.changed(mark);
  }
  /** What the node's drawing is before a shape or a point is added, so that one that does not fit can be taken back. */
  private mark(): () => void {
    const state = visualOf(this.owner),
      shape = state.shape;
    if (shape === undefined) {
      const primitives = state.primitives;
      return () => {
        state.shape = undefined;
        state.primitives = primitives;
      };
    }
    const positions = shape.positions.length,
      colors = shape.colors.length,
      uvs = shape.uvs.length,
      indices = shape.indices.length,
      done = shape.done.length,
      bitmap = shape.bitmap;
    const path = shape.path,
      parts = path?.subpaths.length ?? 0,
      last = parts === 0 ? 0 : path!.subpaths[parts - 1]!.length;
    return () => {
      // A batch begun since is given up, and the one that was being added to is added to again.
      if (shape.done.length > done) {
        const batch = shape.done[done]!;
        shape.positions = batch.positions;
        shape.colors = batch.colors;
        shape.uvs = batch.uvs;
        shape.indices = batch.indices;
        shape.done.length = done;
      }
      shape.bitmap = bitmap;
      shape.positions.length = positions;
      shape.colors.length = colors;
      shape.uvs.length = uvs;
      shape.indices.length = indices;
      if (path === undefined) shape.path = undefined;
      else {
        path.subpaths.length = parts;
        if (parts !== 0) path.subpaths[parts - 1]!.length = last;
      }
    };
  }
  /** Refuses a drawing one geometry could not hold, leaving the node as it was, then publishes the change. */
  private changed(undo: () => void): this {
    const shape = visualOf(this.owner).shape!,
      path = shape.path;
    let pending = 0,
      parts = 0,
      length = 0;
    if (path !== undefined)
      for (const points of path.subpaths) {
        pending += points.length / 2;
        parts++;
        if (path.line?.dash !== undefined)
          for (let i = 2; i < points.length; i += 2)
            length += Math.hypot(points[i]! - points[i - 2]!, points[i + 1]! - points[i - 1]!);
      }
    if (pending > GRAPHICS_SHAPE_LIMITS.maxPathPoints) {
      undo();
      throw new EgretError("GRAPHICS_BUDGET");
    }
    // The most a path point can give: a vertex and a triangle of its fill, and for its line the two triangles of a
    // piece and its corner. A dash adds two ends. A fill by the non-zero rule, or of a gradient, has no such count
    // before it is made.
    let vertices = shape.positions.length / 2,
      indices = shape.indices.length;
    if (path !== undefined) {
      const line = path.line,
        round = line === undefined ? 0 : curveSegments(line.width / 2) / 2 + 2;
      if (path.fill !== undefined) {
        vertices += pending;
        indices += 3 * pending;
      }
      if (line !== undefined) {
        const corner = line.joints === "round" ? round : line.joints === "miter" ? 2 : 1,
          end = line.caps === "round" ? round : 0;
        let dashes = 0;
        if (line.dash !== undefined) {
          let period = 0;
          for (const part of line.dash) period += part;
          dashes = Math.ceil(length / period + 1) * Math.ceil(line.dash.length / 2) + parts;
        }
        const ends = 2 * (parts + dashes);
        vertices += pending * (2 + corner) + ends * (2 + end);
        indices += pending * (6 + 3 * corner) + ends * 3 * end;
      }
    }
    // Past that count the path is made, to see what it really takes.
    let fits = shapeFits(vertices, indices) && drawingFits(shape);
    if (!fits && path !== undefined) {
      const trial = copyDrawing(shape);
      fits = addPath(trial, path) && drawingFits(trial);
    }
    if (!fits) {
      undo();
      throw new EgretError("GRAPHICS_BUDGET");
    }
    shape.resolved = undefined;
    recordVisualChange(this.owner, VISUAL_CONTENT);
    return this;
  }
}

/** Two to sixteen colours in order of their places, as a gradient keeps them. */
function gradientStops(stops: readonly GradientColorStop[]): GradientStop[] {
  if (!Array.isArray(stops) || stops.length < 2 || stops.length > GRAPHICS_SHAPE_LIMITS.maxGradientStops)
    throw invalid();
  const out: GradientStop[] = [];
  let before = 0;
  for (const stop of stops) {
    if (typeof stop !== "object" || stop === null) throw invalid();
    const offset = stop.offset,
      alpha = alphaOf(stop.alpha ?? 1);
    if (!finite(offset) || offset < before || offset > 1 || !color(stop.color) || alpha === undefined) throw invalid();
    out.push({ offset, color: stop.color, alpha });
    before = offset;
  }
  return out;
}
