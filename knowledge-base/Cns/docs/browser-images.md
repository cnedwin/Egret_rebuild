# 在任何浏览器里把图片变成纹理

[English](../../en/docs/browser-images.md) | 简体中文

把图片变成 `Texture` 有两条路线：`@egret/engine/web/image` 中的严格路线和 `@egret/engine/web/kit` 中的宽松路线。

| 路线 | 接受 | 用途 |
| --- | --- | --- |
| `createBrowserTextureProvider` | 只接受 PNG，按固定选项读取，浏览器给不出这些选项时拒绝 | 锁定确切字节、要求处处一致的资源清单 |
| `decodeBrowserImage`、`textureFromCanvas`、`createBrowserImageTextureProvider` | PNG、JPEG、WebP、GIF 和 AVIF，浏览器能显示的都行；也接受游戏自己画的画布 | 其他所有情况：照片、压缩过的美术、代码画出来的图 |

**验证了什么、没验证什么。** 宽松路线在 Node 中用替身画布和解码器验证，包括退回到图片元素的路径。在无头 Chromium 中，它读取了画好的画布；用较小的 `maxPixels` 解码了该浏览器生成的 PNG、JPEG 和 WebP；把 5,000 × 1,000 的画布缩到 4,096 × 819；在移除 `createImageBitmap` 后经图片元素完成解码。没有在 Safari 和手机上运行。

## 从字节到纹理

```js
import { decodeBrowserImage } from '@egret/engine/web/kit';

const bytes = new Uint8Array(await (await fetch('art/hall.webp')).arrayBuffer());
const texture = await decodeBrowserImage(bytes);
```

格式从开头的字节判断，不看文件名。浏览器用不带选项的 `createImageBitmap(blob)` 解码，当前所有浏览器都支持这种调用。这个调用不存在或拒绝这张图时，改由 `<img>` 元素解码。图片画到画布上，再读回为非预乘的 RGBA 字节。

## 从画布到纹理

```js
import { textureFromCanvas } from '@egret/engine/web/kit';

const canvas = new OffscreenCanvas(512, 256);
paintPanel(canvas.getContext('2d'));
const texture = textureFromCanvas(canvas);
```

`textureFromCanvas` 也接受 `<img>` 和 `ImageBitmap`。源不会被改动。

## 尺寸

超过 2D 图片上限（4,194,304 像素，长边 4,096 像素）的图片会等比缩小到上限以内，不会被拒绝。`maxPixels` 和 `maxEdge` 可以设更小的上限，比如给手机用。`fitBrowserImageSize(width, height, options)` 给出实际会采用的尺寸。

## 作为资源提供者

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

字节到达后取消获取，会在解码前停下。最后一个租约释放时纹理被销毁。

## 错误

| 错误码 | 含义 |
| --- | --- |
| `BROWSER_IMAGE_BYTES_INVALID` | 不是非空的 `Uint8Array` |
| `BROWSER_IMAGE_FORMAT_UNKNOWN` | 字节的开头不属于这五种格式中的任何一种 |
| `BROWSER_IMAGE_DECODE_FAILED` | 浏览器解码失败；`cause` 是它的错误 |
| `BROWSER_IMAGE_UNAVAILABLE` | 没有画布或解码器，比如不在页面中 |
| `BROWSER_IMAGE_SIZE_INVALID` | 尺寸或上限不是正数 |
| `BROWSER_IMAGE_PROVIDER_INVALID` | 缺少 `readBytes` |

## 限制

颜色按浏览器读回的结果。浏览器可能转换色彩配置，并在 Alpha 很低处对颜色取整，所以不同浏览器之间少数像素可能差一级。动图 GIF 和 WebP 只取第一帧。需要确切字节时用 PNG 路线。
