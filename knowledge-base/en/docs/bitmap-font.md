# Bitmap fonts

English | [简体中文](../../Cns/docs/bitmap-font.md)

`@egret/engine/bitmapfont` draws text from a font made of pictures — the numbers of a score, a title in the game's own lettering, damage that floats up — instead of from the fonts of the system. It reads the fonts that BMFont and the tools like it write (AngelCode's generator, Hiero, Glyph Designer, Littera, and the text, XML and JSON forms they save in) and the fonts of frames that Egret's own texture merger wrote, lays text out in them with kerning, line breaks and alignment, and draws it as one mesh for each page of the font. It is an optional entry: a game that does not import it loads nothing of it.

**What is checked and what is not.** The fonts and the layout are checked in Node, the meshes on a real Engine, and the [example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/bitmap-font/README.md) in headless Chromium with software WebGL2, where colours are read from the canvas. No hardware GPU or phone was run, and no font saved by a generator itself was read: the fonts of the tests and the example are written in the generators' forms by hand and by the page. See [What was run](#what-was-run).

## Use

```js
import { createBitmapText, parseBitmapFont } from '@egret/engine/bitmapfont';

const font = parseBitmapFont(await (await fetch('fonts/score.fnt')).text());
const pages = font.pages.map(file => scope.use(await engine.assets.acquire(createAssetRef(TEXTURE, file))));
const score = scope.use(createBitmapText({ font, pages, text: '0', maxWidth: 120, align: 'right', color: 0xffd34d }));
hud.addChild(score.display);
score.text = String(points);
```

`parseBitmapFont(source)` takes a string or a parsed object. A string is read as XML when it starts with `<`, as JSON when it starts with `{`, and as BMFont's text form otherwise. An object with `frames` is Egret's form, one page named by `file`, each frame named by its character: its `x`, `y`, `w`, `h` on the page, its `offX` and `offY`, and its `sourceW` (the advance) and `sourceH` (the tallest is the height of a line). Any other object is BMFont's JSON: `pages`, `chars`, `common`, and `info` and `kernings` where it has them. The font is frozen: `face`, `size`, `lineHeight`, `base`, `pages` (the file names), `glyphs`, `format`, `glyph(codePoint)` and `kerning(first, second)`.

| Text option | Meaning | Default |
| --- | --- | --- |
| `font`, `pages` | A font this entry read, and a leased texture for each of its pages, in order; every character must lie on its page | — |
| `text`, `color` | What it says; the tint its pages are multiplied by, `0xRRGGBB` as it is seen: white in the pages shows as this colour | `''`, white |
| `maxWidth` | Lines are broken to fit: after spaces, between ideographs (Chinese, Japanese, Korean), never before a closing mark such as `，。！？」` nor after an opening one; a word wider than the width is broken between its characters | none |
| `align` | Each line `left`, `center` or `right` within `maxWidth`, or within the widest line | `left` |
| `letterSpacing`, `lineSpacing` | Added between characters, and between lines | 0, 0 |
| `kerning` | Whether the font's kerning is used | true |
| `fallback` | The character drawn for one the font lacks; `null` draws nothing | `?` where the font has it |

`text`, `color`, `maxWidth`, `align`, `letterSpacing` and `lineSpacing` can be set at any time and the text is laid out and drawn again; a value refused leaves it as it was. `width`, `height`, `layout` (its lines and each character placed), `meshes` and `dispose()` are read. `layoutBitmapText(font, text, options)` lays text out without drawing it, to measure it or to place things beside it. Lines break at `\n`, `\r\n` and `\r`. A font without a space still has one, a third of the height of its line wide, as Egret's bitmap text had; a character missing from the font is counted in `layout.missing`.

A page draws up to 16,384 characters of one text. The pages are drawn as they are, with the renderer's ordinary blending: a font with an outline or a shadow has them in its pictures.

## Errors

| Code | When |
| --- | --- |
| `BITMAP_FONT_INVALID` | A font cannot be read, or a character lies outside its page; the cause says where |
| `BITMAP_TEXT_OPTIONS_INVALID` | An option or a value set is not what it may be |
| `BITMAP_TEXT_TOO_LONG` | More characters on one page than a mesh can hold |
| `BITMAP_TEXT_CLOSED` | The text was disposed |
| `BITMAP_TEXT_CLEANUP_FAILED` | Letting go of a mesh or the display failed |

## What was run

| What | Where | Result |
| --- | --- | --- |
| The three forms of BMFont read alike, escaped XML, Egret's frames, fonts refused for each part that is wrong, advances and kerning, offsets, lines and their spacing, wrapping after spaces, between ideographs and around closing marks, words too wide, alignment, missing characters and the fallback, options, the meshes page by page with their positions, texture coordinates and tint in linear light, the edges of the scripts broken between characters and of what a font may name, setters that refuse without changing anything, pages that do not fit, the most characters on a page, disposal, a strict TypeScript consumer with five refused misuses, and the exports | Node, [`tests/bitmap-font.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/bitmap-font.test.mjs) | 15 cases |
| Every comparison, boolean, logical and arithmetic operator of the two built modules changed one at a time | Node | 227 changes, 223 caught; the rest change nothing that can be seen |
| The example: a BMFont read from XML and an Egret font of frames painted by the page, the title in white, a score that grows from its right edge in gold, a dialog wrapped, aligned three ways and tinted, a missing character drawn as `?`, kerning, a tap on a phone profile | Headless Chromium 153, software WebGL2 | 5 scenarios |
| Fonts saved by the generators themselves, Chinese in the example, a hardware GPU, a real phone | — | Not run |

## Not in this slice

- Distance-field fonts; colours or sizes changing within one text; outlines and shadows other than drawn into the pictures; vertical text; right-to-left scripts.
