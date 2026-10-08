import { createCanvasHost } from '@egret/engine/web';
import type { CanvasHost, CanvasHostOptions } from '@egret/engine/web';
import type { RenderHostAdapter } from '@egret/engine';
declare const canvas: HTMLCanvasElement;
const options: CanvasHostOptions = { canvas, pixelRatio: 1.5, maxBackingPixels: 100000 };
const host: CanvasHost = createCanvasHost(options);
const port: RenderHostAdapter = host;
const surface: HTMLCanvasElement = host.surface;
void port; void surface;
// @ts-expect-error fixed borrowed surface
host.surface = canvas;
// @ts-expect-error browser canvas is required
createCanvasHost({canvas:{}});
