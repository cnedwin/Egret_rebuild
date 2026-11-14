# Bitmap fonts

English | [简体中文](README.zh-CN.md)

Text in `@egret/engine/bitmapfont`: a title and a dialog in a BMFont read from its XML form, and a score in Egret's own form of frames. Both fonts are painted by the page from a small pixel alphabet, and their files are written by the page in the forms the tools save, so the repository carries no picture.

## Run

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

Open `/examples/bitmap-font/index.html` on the host and port the server prints. Add `?backend=webgl2` for WebGL2.

## What to try

- Press +100: the gold score grows to the left, its right edge staying where it is.
- Press Align: the dialog's lines go to the centre of its width, then to its right, then back.
- Press Tint: the same white pictures are drawn in another colour.
- Press Next: a text with a character the font lacks shows a question mark in its place, and a short text is one line.

## How it works

| Part | From |
| --- | --- |
| The pixel alphabet | Digits, capitals and a few marks, five by seven dots, painted into one image at two pixels a dot (white) and at three (gold, with a darker lower row) |
| The title and the dialog | A BMFont written by the page as XML, with kerning between A and V, T and A, L and T, read by `parseBitmapFont` |
| The score | An Egret font of frames, read by the same function, drawn right-aligned in a box of 100 |
| The dialog | `maxWidth` of 280, `lineSpacing` of 4, a tint, and `align` and `text` set by the buttons |

See the [bitmap font guide](../../knowledge-base/en/docs/bitmap-font.md).

## Check

```text
node examples/bitmap-font/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
```

Colours are read from screenshots of the canvas. No person pressed anything and no phone was used.
