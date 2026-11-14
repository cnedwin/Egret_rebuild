# Graphics: shapes, paths and lines

English | [简体中文](../../Cns/docs/graphics.md)

A `Sprite` draws with its `graphics`: filled rectangles, circles, ellipses and rounded rectangles, paths of lines and curves with holes, arcs, gradients, image fills, and lines of any width with round or square ends, round or flat corners, and dashes. The names and arguments are Egret's.

The original checks used Node and headless Chromium with software WebGL2. See the [Shared 2D hardware results](shared-2d-hardware-results.md) for the later native Windows and Android evidence and its workload limits.

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
| `beginLinearGradientFill(x0, y0, x1, y1, stops)` | A fill whose colour runs from one point to another |
| `beginRadialGradientFill(x, y, radius, stops, radiusY = radius)` | A fill whose colour runs from a centre out to a circle, or an ellipse |
| `beginGradientFill(type, colors, alphas, ratios, matrix?)` | A gradient fill as older code gives it |
| `beginBitmapFill(lease, matrix?, repeat = true)` | A fill of an image |
| `lineStyle(thickness, color = 0, alpha = 1, options?)` | Sets the line of what is drawn next. No thickness, or 0, ends the line. `options` are below |
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

## Line ends, corners and dashes

The fourth argument of `lineStyle` is an object. Every part of it may be left out.

| Option | Values | Without it |
| --- | --- | --- |
| `caps` | `'none'`: an open line ends flat at its last point. `'round'`: in a half circle. `'square'`: in a half square | `'none'` |
| `joints` | `'miter'`: the outside of a corner is a point. `'round'`: an arc. `'bevel'`: a flat cut | `'miter'` |
| `miterLimit` | A mitre longer than this many half-widths is cut flat, like a bevel. At least 1 | 4 |
| `dash` | Up to 16 lengths in the sprite's units: a dash, a gap, a dash, and so on. An odd count is taken twice over | A solid line |

```js
sprite.graphics.lineStyle(6, 0xffffff, 1, { caps: 'round', joints: 'round', dash: [16, 12] }).moveTo(20, 20).lineTo(200, 20).lineTo(200, 120);
```

- Two pieces of a line meet in one point on the inside of their corner, so a translucent line is not darker at a corner. Where a line is wider than the curve it follows is tight, its pieces do lie over each other.
- The pattern of dashes runs on round corners. Each dash is a line of its own, with the ends that `caps` gives. A dash of no length is not drawn, even with round ends.
- A closed outline, such as `drawRect` or a path that returns to its start, has a corner where it closes and no ends.

## Gradients

A gradient is a fill. Its colours are given as stops: `{ offset, color, alpha }`, with `offset` from 0 at the start to 1 at the end and `alpha` 1 unless given. Two to sixteen stops, in the order of their offsets.

```js
// From red at x = 20 to half transparent blue at x = 120. Left of 20 is red, right of 120 is that blue.
sprite.graphics.beginLinearGradientFill(20, 0, 120, 0, [{ offset: 0, color: 0xff0000 }, { offset: 1, color: 0x0000ff, alpha: 0.5 }]).drawRect(0, 0, 140, 40).endFill();
// White at the centre, green halfway out, black on the circle of radius 40 and beyond.
sprite.graphics.beginRadialGradientFill(50, 50, 40, [{ offset: 0, color: 0xffffff }, { offset: 0.5, color: 0x00ff00 }, { offset: 1, color: 0 }]).drawCircle(50, 50, 48).endFill();
```

- Colours between two stops are mixed as sRGB values, as a canvas mixes them.
- A gradient is drawn as the colours of the corners of triangles. The shape is cut into smaller triangles until the colour between corners is within two parts in 255 of the gradient, so a large gradient with strong colours takes some hundreds to some thousands of triangles. At most 16,384 for one fill; beyond that the cutting stops and the gradient is coarser.
- `beginGradientFill` takes what older code passes: `'linear'` or `'radial'`, colours, alphas, ratios from 0 to 255, and a matrix `{ a, b, c, d, tx, ty }` that places the gradient's own square, 1638.4 units wide and centred on the origin, in the sprite. For a box of a width and height at a corner, with no rotation, that matrix is `{ a: width / 1638.4, b: 0, c: 0, d: height / 1638.4, tx: x + width / 2, ty: y + height / 2 }`.
- A line has one colour. There is no gradient for lines.

## Image fills

`beginBitmapFill(lease, matrix, repeat)` fills with an image. `lease` is the lease of a texture, as a `Bitmap` takes.

```js
// Each pixel of the image two units wide, the image starting at (140, 104) and repeating across the shape.
sprite.graphics.beginBitmapFill(lease, { a: 2, b: 0, c: 0, d: 2, tx: 140, ty: 104 }).drawRoundRect(140, 104, 96, 32, 16).endFill();
```

- `matrix` places the image in the sprite: its pixel (x, y) is drawn at `a·x + c·y + tx`, `b·x + d·y + ty`. Without it a pixel is one unit and the image starts at the sprite's origin.
- The image repeats in both directions. With `repeat` false its edge pixels go on outwards instead; it is not cut off at its edge.
- The texture must be a whole image. A part of an atlas is refused with `GRAPHICS_VALUE_INVALID`, because the image around it would show when it repeats.
- A repeating image is drawn no farther than 8,192 of its own pixels from where it starts. A shape that reaches beyond that is refused with `GRAPHICS_BUDGET`.
- Keep the lease for as long as the drawing is shown. A frame with a drawing whose lease was released is refused.
- A line has one colour; an image fills, it does not line.

## How fills, lines and paths go together

- A shape is drawn with the fill and the line that are set when it is drawn. Its line is centred on its outline and drawn over its fill.
- A path is everything from a `moveTo` up to the next `beginFill`, `endFill`, `lineStyle` or `draw...` shape. It takes the fill and line that were set when it began.
- A filled path is closed for the fill: its last point is joined to its first. Its line is closed only where its ends meet.
- The parts of one path, each begun with `moveTo`, are filled together by the non-zero rule, as a canvas fills them. A part drawn the other way round inside another is a hole. Parts that overlap, and an outline that crosses itself, are painted once. Shapes drawn with `drawRect`, `drawCircle` and the others are each filled by themselves.
- A path is drawn as soon as it has enough points. A line needs no `endFill`.
- Shapes are drawn in the order of the calls, later ones over earlier ones.

## What a frame carries

A sprite that draws only filled rectangles keeps them as rectangles, as before. Any other shape, or any line, turns the sprite's whole drawing into one mesh of coloured triangles, in drawing order, with one white pixel as its texture. An image fill is a mesh of its own over its image, so a sprite that draws a colour, then an image, then a colour is three meshes in that order; at most 16. It follows the sprite's position, scale, rotation, alpha, clip, blend mode and filters like any other content.

- **Curves are straight pieces**, each within a quarter of a unit of the true curve: 16 for a circle of radius 10, 32 for radius 40, at most 128. A circle scaled up many times shows its corners; draw it larger instead.
- **Edges are not smoothed.** A slanted or curved edge is stepped at the size of a pixel.
- **A path with several parts, or one that crosses itself,** takes more triangles than a simple outline: it is cut into bands at every corner and crossing.

## Limits

| Limit | Value | What happens beyond it |
| --- | --- | --- |
| Different drawings in one frame | 4,096 | The frame is refused with `FRAME_BUDGET_EXCEEDED` |
| Triangles in one frame, of all meshes | 65,536 | The frame is refused with `FRAME_BUDGET_EXCEEDED` |
| Points of one path being drawn | 8,192 | The call throws `GRAPHICS_BUDGET` and the sprite keeps what it had |
| Width of a line | 1,024 | `GRAPHICS_VALUE_INVALID` |
| Meshes of one sprite: each change between an image fill and anything else begins one | 16 | The call throws `GRAPHICS_BUDGET` and the sprite keeps what it had |
| Dashes of one line | 16,384 | The call throws `GRAPHICS_BUDGET` and the sprite keeps what it had |
| Triangles of one fill with holes or crossings | 16,384 | `GRAPHICS_BUDGET` when the path is finished, by `endFill` or the next fill, line or shape. The path is dropped and what was drawn before it stays |

Sprites that draw exactly the same thing share one drawing, however many they are: 300 bullets drawn as the same circle count once. Sprites that each draw something different count each. In practice the triangles are what runs out first: 65,536 in a frame is some 2,000 circles of radius 40, or 500 of radius 600. A drawing is counted once however many sprites show it, but its triangles are counted for each sprite that shows it.

`getBounds()` covers the shapes and the width of their lines. Hit testing does not read the drawing: it uses `hitArea`, as before.
