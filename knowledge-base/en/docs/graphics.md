# Graphics: shapes, paths and lines

English | [简体中文](../../Cns/docs/graphics.md)

A `Sprite` draws with its `graphics`: filled rectangles, circles, ellipses and rounded rectangles, paths of lines and curves, arcs, and lines of any width. The names and arguments are Egret's.

**What is checked and what is not.** The triangles each call gives are checked in Node. The [example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/graphics/README.md) is checked from the canvas in headless Chromium with software WebGL2: each shape's colour inside its outline, the background outside it, and a translucent shape over another. WebGPU was not run.

## Use

```js
const g = sprite.graphics;
g.beginFill(0xe05050).drawCircle(60, 60, 40).endFill();
g.beginFill(0x2b3550).lineStyle(4, 0xf0c030).drawRoundRect(240, 30, 120, 60, 24).endFill();
g.lineStyle(4, 0x60d080).moveTo(150, 160).lineTo(220, 160).lineTo(220, 220);
g.beginFill(0x8040c0).moveTo(30, 150).lineTo(120, 150).lineTo(75, 185).endFill();
```

Every call returns the graphics, so calls chain. `clear()` removes everything drawn and ends the fill and the line.

## Calls

| Call | Draws |
| --- | --- |
| `beginFill(color, alpha = 1)` | Sets the fill of what is drawn next |
| `endFill()` | Ends the fill. A path drawn under it is filled as it stands |
| `lineStyle(thickness, color = 0, alpha = 1)` | Sets the line of what is drawn next. No thickness, or 0, ends the line |
| `drawRect(x, y, width, height)` | A rectangle |
| `drawCircle(x, y, radius)` | A circle round a centre |
| `drawEllipse(x, y, width, height)` | An ellipse inside the rectangle of that corner and size |
| `drawRoundRect(x, y, width, height, ellipseWidth, ellipseHeight = ellipseWidth)` | A rectangle with rounded corners. The last two are the whole width and height of a corner's ellipse |
| `moveTo(x, y)` | Starts a part of a path |
| `lineTo(x, y)` | A straight piece of the path |
| `curveTo(controlX, controlY, anchorX, anchorY)` | A curve to an anchor, bent towards one control point |
| `cubicCurveTo(controlX1, controlY1, controlX2, controlY2, anchorX, anchorY)` | A curve bent towards two control points |
| `drawArc(x, y, radius, startAngle, endAngle, anticlockwise = false)` | An arc in radians, as part of the path. A path already begun is joined to its start |

A shape needs a fill or a line: without either, `drawRect` and the others throw `GRAPHICS_FILL_REQUIRED`. A value that is not a finite number, or a negative size, throws `GRAPHICS_VALUE_INVALID`.

## How fills, lines and paths go together

- A shape is drawn with the fill and the line that are set when it is drawn. Its line is centred on its outline and drawn over its fill.
- A path is everything from a `moveTo` up to the next `beginFill`, `endFill`, `lineStyle` or `draw...` shape. It takes the fill and line that were set when it began.
- A filled path is closed for the fill: its last point is joined to its first. Its line is closed only where its ends meet.
- A path is drawn as soon as it has enough points. A line needs no `endFill`.
- Shapes are drawn in the order of the calls, later ones over earlier ones.

## What a frame carries

A sprite that draws only filled rectangles keeps them as rectangles, as before. Any other shape, or any line, turns the sprite's whole drawing into one mesh of coloured triangles, in drawing order, with one white pixel as its texture. It follows the sprite's position, scale, rotation, alpha, clip, blend mode and filters like any other content.

- **Curves are straight pieces**, each within a quarter of a unit of the true curve: 16 for a circle of radius 10, 32 for radius 40, at most 128. A circle scaled up many times shows its corners; draw it larger instead.
- **Edges are not smoothed.** A slanted or curved edge is stepped at the size of a pixel.
- **Lines have flat ends and mitred corners.** A corner sharper than a mitre four half-widths long is cut at that length. Round ends and round corners are not there yet.
- **A path that crosses itself** is filled, but which parts is not promised.

## Limits

| Limit | Value | What happens beyond it |
| --- | --- | --- |
| Different drawings in one frame | 128 | The frame is refused with `FRAME_BUDGET_EXCEEDED` |
| Triangles in one frame, of all meshes | 65,536 | The frame is refused with `FRAME_BUDGET_EXCEEDED` |
| Points of one path being drawn | 8,192 | The call throws `GRAPHICS_BUDGET` and the sprite keeps what it had |
| Width of a line | 1,024 | `GRAPHICS_VALUE_INVALID` |

Sprites that draw exactly the same thing share one drawing, however many they are: 300 bullets drawn as the same circle count once. Sprites that each draw something different count each. For many different shapes, draw them into one sprite, or use bitmaps.

`getBounds()` covers the shapes and the width of their lines. Hit testing does not read the drawing: it uses `hitArea`, as before.
