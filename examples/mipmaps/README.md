# Mipmaps: pictures drawn smaller than they are

English | [简体中文](README.zh-CN.md)

A picture drawn much smaller than its texels skips most of them, and moves into stray light and dark as it moves. A material with `mipmapFilter: 'linear'` samples it from smaller copies of its page instead, blended between the two nearest:

```js
bitmap.sharedMaterial = createSharedMaterial2D({ filter: 'linear', mipmapFilter: 'linear' });
```

The top row is a page of one-texel black and white squares at about an eighth of its size, without the copies and then with them; with them it is an even grey. The bottom row is a region of a page that also holds a red region, at about a quarter: the grey stays grey with no red from beside it. The engine makes the copies itself when a frame first samples a page this way; they add about a third to the page's bytes. A region shares its page with others, so it reads only the copies on which each of its edges halves exactly: place regions of an atlas at multiples of 2, 4, 8… texels to let them use deeper copies. The [render profile contract](../../knowledge-base/en/docs/shared-render-profile-contract.md) has the rules.

## Run

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

Open `/examples/mipmaps/index.html` on the host and port the server prints. Add `?backend=webgl2` or `?backend=webgpu` to choose the Host.

## Check

```text
node examples/mipmaps/verify.mjs <absolute Playwright index.mjs> [<new output directory>] [software]
```

It draws the page on both Hosts and reads each square: even grey with the copies, uneven without, and no red in the region. Without `software` it runs the installed Edge headed on the computer's GPU. With `software` it runs headless with software rendering, where a WebGPU adapter that cannot draw is recorded rather than failed. In the development container the WebGL2 checks passed with software rendering; WebGPU there lost its device, also on main, so WebGPU awaits a hardware run.
