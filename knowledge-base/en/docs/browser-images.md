# Pictures as textures in any browser

English | [简体中文](../../Cns/docs/browser-images.md)

There are two routes from a picture to a `Texture`: the strict one in `@egret/engine/web/image` and the forgiving one in `@egret/engine/web/kit`.

| Route | Takes | Use it for |
| --- | --- | --- |
| `createBrowserTextureProvider` | PNG only, read with exact options, refused when the browser does not give them | Manifests that pin exact bytes and must look the same everywhere |
| `decodeBrowserImage`, `textureFromCanvas`, `createBrowserImageTextureProvider` | PNG, JPEG, WebP, GIF and AVIF, whatever the browser can show; canvases the game painted | Everything else: photographs, compressed art, pictures drawn in code |

**What is checked and what is not.** The forgiving route is checked in Node with stand-in canvases and decoders, including the fallback to an image element. In headless Chromium it read a painted canvas, decoded PNG, JPEG and WebP made by that browser with a smaller `maxPixels`, scaled a 5,000 by 1,000 canvas to 4,096 by 819, and decoded through the image element with `createImageBitmap` removed. Safari and phones were not run.

## Bytes to a texture

```js
import { decodeBrowserImage } from '@egret/engine/web/kit';

const bytes = new Uint8Array(await (await fetch('art/hall.webp')).arrayBuffer());
const texture = await decodeBrowserImage(bytes);
```

The format is read from the first bytes, not from the name. The browser decodes the picture with `createImageBitmap(blob)` and no options, which every current browser accepts. Where that call is missing or refuses the picture, an `<img>` element decodes it. The picture is drawn onto a canvas and read back as straight RGBA bytes.

## A canvas to a texture

```js
import { textureFromCanvas } from '@egret/engine/web/kit';

const canvas = new OffscreenCanvas(512, 256);
paintPanel(canvas.getContext('2d'));
const texture = textureFromCanvas(canvas);
```

`textureFromCanvas` also takes an `<img>` or an `ImageBitmap`. The source is not changed.

## Size

A picture larger than the 2D image limits (4,194,304 pixels, 4,096 pixels on the longer edge) is scaled down evenly to fit instead of being refused. `maxPixels` and `maxEdge` set smaller limits, as for phones. `fitBrowserImageSize(width, height, options)` gives the size that would be used.

## As an asset provider

```js
import { createAssetRef, createAssetType, isTexture } from '@egret/engine';
import { createBrowserImageTextureProvider } from '@egret/engine/web/kit';

const picture = createAssetType('picture', isTexture);
engine.assets.register(picture, createBrowserImageTextureProvider({
  readBytes: async ref => new Uint8Array(await (await fetch(ref.id)).arrayBuffer()),
  maxPixels: 2048 * 1024,
}));
const lease = await engine.assets.acquire(createAssetRef(picture, 'art/hall.webp'));
```

Cancelling the acquisition after the bytes arrive stops before decoding. Releasing the last lease disposes the texture.

## Errors

| Code | Meaning |
| --- | --- |
| `BROWSER_IMAGE_BYTES_INVALID` | Not a non-empty `Uint8Array` |
| `BROWSER_IMAGE_FORMAT_UNKNOWN` | The bytes start like none of the five formats |
| `BROWSER_IMAGE_DECODE_FAILED` | The browser could not decode them; `cause` holds its error |
| `BROWSER_IMAGE_UNAVAILABLE` | No canvas or no decoder, as outside a page |
| `BROWSER_IMAGE_SIZE_INVALID` | A size or limit that is not a positive number |
| `BROWSER_IMAGE_PROVIDER_INVALID` | `readBytes` is missing |

## Limits

Colours are read back as the browser gives them. A browser may convert colour profiles and rounds colours where alpha is low, so two browsers can differ by a step in a few pixels. Animated GIF and WebP give their first frame. Use the PNG route where exact bytes matter.
