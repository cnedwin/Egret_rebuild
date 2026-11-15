import type { DisplayObject } from "./DisplayObject.js";
import type { AssetLease } from "./AssetLease.js";
import type { Texture } from "./Texture.js";
import type { LineCaps, LineJoints } from "./graphicsShape.js";
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
/**
 * Drawing state belongs to one node; every shape snapshots its fill and its line. A node that draws only filled
 * rectangles keeps them as rectangles. Any other shape, and any line, makes the node's drawing one list of triangles
 * in drawing order, and a curve is drawn as straight pieces within a quarter unit of it. Edges are a stair of pixels
 * unless `smoothing` is set.
 */
export declare class Graphics {
    private readonly owner;
    private fill;
    private line;
    private soft;
    constructor(owner: DisplayObject);
    /**
     * How far, in the node's units, the edge of each shape and line drawn from now on fades to nothing: 0, which it is
     * at first, to 8. One unit smooths an edge at the size it was drawn. A band of triangles is added around the shape,
     * which is that much larger. A fill under a line has no band of its own. Filled rectangles alone stay rectangles,
     * and an image fill has no band.
     */
    get smoothing(): number;
    set smoothing(value: number);
    private edged;
    beginFill(value: number, alpha?: number): this;
    /** The line of the shapes drawn after it: its width in the node's units, colour and alpha. No width, or 0, ends the line. */
    lineStyle(thickness?: number, value?: number, alpha?: number, options?: LineStyleOptions): this;
    /** A fill whose colour runs along the line from one point to another, and stays the end colours beyond them. */
    beginLinearGradientFill(x0: number, y0: number, x1: number, y1: number, stops: readonly GradientColorStop[]): this;
    /** A fill whose colour runs from a centre out to a circle, or to an ellipse when `radiusY` is given, and stays the last colour beyond it. */
    beginRadialGradientFill(x: number, y: number, radius: number, stops: readonly GradientColorStop[], radiusY?: number): this;
    /**
     * A gradient fill as older code gives it: "linear" or "radial", colours, alphas, ratios from 0 to 255, and a matrix
     * that places the gradient's square of 1638.4 units, centred on the origin, in the node. Without a matrix that
     * square is where it is.
     */
    beginGradientFill(type: "linear" | "radial", colors: readonly number[], alphas: readonly number[], ratios: readonly number[], matrix?: GradientBoxMatrix): this;
    drawRect(x: number, y: number, width: number, height: number): this;
    drawCircle(x: number, y: number, radius: number): this;
    /** An ellipse inside the rectangle of this corner and size. */
    drawEllipse(x: number, y: number, width: number, height: number): this;
    /** A rectangle whose corners are quarter ellipses: `ellipseWidth` and `ellipseHeight` are the whole widths and heights of those ellipses. */
    drawRoundRect(x: number, y: number, width: number, height: number, ellipseWidth: number, ellipseHeight?: number): this;
    /** Starts a new part of the path at a point. A path is filled and lined with the fill and line it was begun under. */
    moveTo(x: number, y: number): this;
    lineTo(x: number, y: number): this;
    /** A curve from where the path is to an anchor, bent towards one control point. */
    curveTo(controlX: number, controlY: number, anchorX: number, anchorY: number): this;
    /** A curve from where the path is to an anchor, bent towards two control points. */
    cubicCurveTo(controlX1: number, controlY1: number, controlX2: number, controlY2: number, anchorX: number, anchorY: number): this;
    /** An arc of a circle, in radians from the positive x axis, clockwise on the screen unless `anticlockwise`. A path already begun is joined to its start by a line. */
    drawArc(x: number, y: number, radius: number, startAngle: number, endAngle: number, anticlockwise?: boolean): this;
    /** Ends the fill. A path drawn under it is filled as it stands. */
    endFill(): this;
    clear(): void;
    /**
     * A fill of an image. `lease` is the lease of a texture that is a whole image, not a part of an atlas. `matrix`
     * places the image in the node: its pixel (x, y) is drawn at `a·x + c·y + tx`, `b·x + d·y + ty`; without it a pixel
     * is one unit and the image starts at the node's origin. The image repeats unless `repeat` is false, and then its
     * edge pixels go on outwards. Keep the lease for as long as the drawing is shown.
     */
    beginBitmapFill(lease: AssetLease<Texture>, matrix?: GradientBoxMatrix, repeat?: boolean): this;
    private gradient;
    private paintRequired;
    /** The node's triangles, begun with the rectangles it has drawn so far. */
    private shape;
    private path;
    /** The part of the path being drawn; a path that was not begun with moveTo begins at the origin. */
    private current;
    /** A path becomes triangles when its fill or line ends, or another shape is drawn over it. */
    private finishPath;
    private outline;
    /** What the node's drawing is before a shape or a point is added, so that one that does not fit can be taken back. */
    private mark;
    /** Refuses a drawing one geometry could not hold, leaving the node as it was, then publishes the change. */
    private changed;
}
//# sourceMappingURL=Graphics.d.ts.map