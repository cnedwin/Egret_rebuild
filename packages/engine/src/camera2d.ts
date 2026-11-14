// SPDX-License-Identifier: Apache-2.0
import { DisplayObject, EgretError } from '@egret/runtime';
import type { Camera2D, Camera2DOptions, CameraFollowOptions, CameraLayerOptions, CameraPoint, CameraRect, CameraShakeOptions, CameraSnapshot, CameraTarget } from './cameraTypes.js';

interface Placed { x: number; y: number; scaleX: number; scaleY: number; rotation: number; anchorOffsetX: number; anchorOffsetY: number; }
interface Layer { readonly object: DisplayObject; readonly fx: number; readonly fy: number; readonly zoomFactor: number; readonly before: Placed; }
interface Follow { readonly target: CameraTarget; readonly smoothing: number; readonly deadWidth: number; readonly deadHeight: number; readonly ox: number; readonly oy: number; }
interface Move { readonly fromX: number; readonly fromY: number; readonly toX: number; readonly toY: number; readonly seconds: number; elapsed: number; }
interface ZoomMove { readonly from: number; readonly to: number; readonly seconds: number; elapsed: number; }

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const point = (value: unknown): value is CameraPoint => record(value) && finite(value['x']) && finite(value['y']);
const rect = (value: unknown): value is CameraRect => record(value) && finite(value['x']) && finite(value['y']) && finite(value['width']) && finite(value['height']) && (value['width'] as number) >= 0 && (value['height'] as number) >= 0;
const smooth = (t: number): number => t * t * (3 - 2 * t);
const read = (object: DisplayObject): Placed => ({ x: object.x, y: object.y, scaleX: object.scaleX, scaleY: object.scaleY, rotation: object.rotation, anchorOffsetX: object.anchorOffsetX, anchorOffsetY: object.anchorOffsetY });
function write(object: DisplayObject, placed: Placed): void {
  object.anchorOffsetX = placed.anchorOffsetX; object.anchorOffsetY = placed.anchorOffsetY;
  object.scaleX = placed.scaleX; object.scaleY = placed.scaleY; object.rotation = placed.rotation;
  object.x = placed.x; object.y = placed.y;
}
/** Smooth noise between -1 and 1: two random values a step apart, eased between. The same seed gives the same shake. */
function noise(seed: number, channel: number, t: number): number {
  const at = Math.floor(t), f = t - at;
  const hash = (n: number): number => {
    let h = Math.imul(n ^ Math.imul(seed, 0x9e3779b1) ^ Math.imul(channel + 1, 0x85ebca6b), 0x27d4eb2d);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
    return ((h >>> 0) / 0xffffffff) * 2 - 1;
  };
  return hash(at) + (hash(at + 1) - hash(at)) * smooth(f);
}

/**
 * A camera over a container that holds the world. It places that container, and the layers given it,
 * so that the world is seen from where the camera looks. It keeps no clock: `update` moves it.
 */
export function createCamera2D(options: Camera2DOptions): Camera2D {
  if (!record(options)) throw new EgretError('CAMERA_OPTIONS_INVALID');
  const { world, width: w0, height: h0, center: c0, zoom: z0 = 1, minZoom = 0.25, maxZoom = 4, rotation: r0 = 0, bounds: b0,
    shakeOffset = 16, shakeRotation = 0, shakeDecay = 1, shakeFrequency = 15, seed = 1, roundToPixel = false } = options;
  if (!(world instanceof DisplayObject) || world.isDisposed || !positive(w0) || !positive(h0) || (c0 !== undefined && !point(c0)) || !positive(minZoom) || !positive(maxZoom) || minZoom > maxZoom
    || !finite(z0) || z0 < minZoom || z0 > maxZoom || !finite(r0) || (b0 !== undefined && !rect(b0)) || !finite(shakeOffset) || shakeOffset < 0 || !finite(shakeRotation) || shakeRotation < 0
    || !finite(shakeDecay) || shakeDecay < 0 || !positive(shakeFrequency) || !Number.isSafeInteger(seed) || typeof roundToPixel !== 'boolean') throw new EgretError('CAMERA_OPTIONS_INVALID');
  const before = read(world);
  const layers: Layer[] = [];
  let width = w0, height = h0, zoom = z0, rotation = r0, bounds: CameraRect | undefined = b0 === undefined ? undefined : { ...b0 };
  let cx = c0?.x ?? width / 2, cy = c0?.y ?? height / 2, trauma = 0, time = 0, closed = false;
  let follow: Follow | undefined, move: Move | undefined, zoomMove: ZoomMove | undefined;
  let shakeX = 0, shakeY = 0, shakeAngle = 0;

  function open(): void { if (closed) throw new EgretError('CAMERA_CLOSED'); }
  function clamp(): void {
    if (bounds === undefined) return;
    const halfW = width / zoom / 2, halfH = height / zoom / 2;
    cx = bounds.width <= halfW * 2 ? bounds.x + bounds.width / 2 : Math.min(Math.max(cx, bounds.x + halfW), bounds.x + bounds.width - halfW);
    cy = bounds.height <= halfH * 2 ? bounds.y + bounds.height / 2 : Math.min(Math.max(cy, bounds.y + halfH), bounds.y + bounds.height - halfH);
  }
  function targetOf(target: CameraTarget): CameraPoint {
    if (target instanceof DisplayObject) {
      if (target.isDisposed) throw new EgretError('CAMERA_TARGET_INVALID');
      // The target's place in world units, wherever it is nested inside the world: out to the stage and back.
      const onStage = target.localToGlobal(0, 0);
      return world.globalToLocal(onStage.x, onStage.y);
    }
    const value = target();
    if (!point(value)) throw new EgretError('CAMERA_TARGET_INVALID');
    return value;
  }
  function place(): void {
    const sx = viewX(), sy = viewY();
    write(world, { anchorOffsetX: cx, anchorOffsetY: cy, scaleX: zoom, scaleY: zoom, rotation: rotation + shakeAngle, x: sx, y: sy });
    for (const layer of layers) {
      const scale = 1 + (zoom - 1) * layer.zoomFactor;
      // At the middle of the view a layer is where it was put; it moves the part of the camera's way its factor says.
      write(layer.object, { anchorOffsetX: width / 2 + (cx - width / 2) * layer.fx, anchorOffsetY: height / 2 + (cy - height / 2) * layer.fy, scaleX: scale, scaleY: scale, rotation: rotation + shakeAngle, x: sx, y: sy });
    }
  }
  const viewX = (): number => { const x = width / 2 + shakeX; return roundToPixel ? Math.round(x - cx * zoom) + cx * zoom : x; };
  const viewY = (): number => { const y = height / 2 + shakeY; return roundToPixel ? Math.round(y - cy * zoom) + cy * zoom : y; };
  function settle(): void { clamp(); place(); }

  clamp();
  try { place(); } catch (cause) { write(world, before); throw cause; }

  const camera: Camera2D = Object.freeze({
    get state(): 'active' | 'closed' { return closed ? 'closed' : 'active'; },
    get center(): CameraPoint { return Object.freeze({ x: cx, y: cy }); },
    get zoom(): number { return zoom; },
    get rotation(): number { return rotation; },
    get width(): number { return width; },
    get height(): number { return height; },
    lookAt(x: number, y: number): void {
      if (!finite(x) || !finite(y)) throw new EgretError('CAMERA_OPTIONS_INVALID');
      open(); move = undefined; cx = x; cy = y; settle();
    },
    panTo(x: number, y: number, seconds: number): void {
      if (!finite(x) || !finite(y) || !finite(seconds) || seconds < 0) throw new EgretError('CAMERA_OPTIONS_INVALID');
      open(); follow = undefined;
      if (seconds === 0) { move = undefined; cx = x; cy = y; settle(); return; }
      move = { fromX: cx, fromY: cy, toX: x, toY: y, seconds, elapsed: 0 };
    },
    setZoom(value: number): void {
      if (!finite(value) || value < minZoom || value > maxZoom) throw new EgretError('CAMERA_OPTIONS_INVALID');
      open(); zoomMove = undefined; zoom = value; settle();
    },
    zoomTo(value: number, seconds: number): void {
      if (!finite(value) || value < minZoom || value > maxZoom || !finite(seconds) || seconds < 0) throw new EgretError('CAMERA_OPTIONS_INVALID');
      open();
      if (seconds === 0) { zoomMove = undefined; zoom = value; settle(); return; }
      zoomMove = { from: zoom, to: value, seconds, elapsed: 0 };
    },
    setRotation(degrees: number): void {
      if (!finite(degrees)) throw new EgretError('CAMERA_OPTIONS_INVALID');
      open(); rotation = degrees; place();
    },
    follow(target: CameraTarget, followOptions: CameraFollowOptions = {}): void {
      if (!(target instanceof DisplayObject) && typeof target !== 'function') throw new EgretError('CAMERA_TARGET_INVALID');
      if (!record(followOptions)) throw new EgretError('CAMERA_OPTIONS_INVALID');
      const { smoothing = 0.15, deadZone, offset } = followOptions;
      if (!finite(smoothing) || smoothing < 0 || (deadZone !== undefined && (!record(deadZone) || !finite(deadZone.width) || !finite(deadZone.height) || deadZone.width < 0 || deadZone.height < 0))
        || (offset !== undefined && !point(offset))) throw new EgretError('CAMERA_OPTIONS_INVALID');
      open();
      move = undefined;
      follow = { target, smoothing, deadWidth: deadZone === undefined ? 0 : deadZone.width as number, deadHeight: deadZone === undefined ? 0 : deadZone.height as number, ox: offset?.x ?? 0, oy: offset?.y ?? 0 };
    },
    stopFollowing(): void { follow = undefined; },
    setBounds(value: CameraRect | undefined): void {
      if (value !== undefined && !rect(value)) throw new EgretError('CAMERA_OPTIONS_INVALID');
      open(); bounds = value === undefined ? undefined : { ...value }; settle();
    },
    resize(newWidth: number, newHeight: number): void {
      if (!positive(newWidth) || !positive(newHeight)) throw new EgretError('CAMERA_OPTIONS_INVALID');
      open(); width = newWidth; height = newHeight; settle();
    },
    shake(shakeOptions: CameraShakeOptions = {}): void {
      if (!record(shakeOptions)) throw new EgretError('CAMERA_OPTIONS_INVALID');
      const { trauma: added = 0.5 } = shakeOptions;
      if (!finite(added) || added < 0 || added > 1) throw new EgretError('CAMERA_OPTIONS_INVALID');
      open(); trauma = Math.min(1, trauma + added);
    },
    addLayer(layer: DisplayObject, layerOptions: CameraLayerOptions = {}): () => void {
      if (!(layer instanceof DisplayObject) || layer.isDisposed || layer === world || layers.some(other => other.object === layer)) throw new EgretError('CAMERA_LAYER_INVALID');
      if (!record(layerOptions)) throw new EgretError('CAMERA_OPTIONS_INVALID');
      const { factor = 0.5, zoomFactor = 1 } = layerOptions;
      const fx = typeof factor === 'number' ? factor : point(factor) ? factor.x : NaN, fy = typeof factor === 'number' ? factor : point(factor) ? factor.y : NaN;
      if (!finite(fx) || !finite(fy) || !finite(zoomFactor) || zoomFactor < 0 || zoomFactor > 1) throw new EgretError('CAMERA_OPTIONS_INVALID');
      open();
      const entry: Layer = { object: layer, fx, fy, zoomFactor, before: read(layer) };
      layers.push(entry);
      place();
      return (): void => {
        const index = layers.indexOf(entry);
        if (index < 0) return;
        layers.splice(index, 1);
        if (!layer.isDisposed) write(layer, entry.before);
      };
    },
    update(seconds: number): void {
      if (!finite(seconds) || seconds < 0) throw new EgretError('CAMERA_OPTIONS_INVALID');
      open();
      time += seconds;
      if (zoomMove !== undefined) {
        zoomMove.elapsed = Math.min(zoomMove.seconds, zoomMove.elapsed + seconds);
        zoom = zoomMove.from + (zoomMove.to - zoomMove.from) * smooth(zoomMove.elapsed / zoomMove.seconds);
        if (zoomMove.elapsed >= zoomMove.seconds) { zoom = zoomMove.to; zoomMove = undefined; }
      }
      if (move !== undefined) {
        move.elapsed = Math.min(move.seconds, move.elapsed + seconds);
        const t = smooth(move.elapsed / move.seconds);
        cx = move.fromX + (move.toX - move.fromX) * t; cy = move.fromY + (move.toY - move.fromY) * t;
        if (move.elapsed >= move.seconds) { cx = move.toX; cy = move.toY; move = undefined; }
      } else if (follow !== undefined) {
        const target = targetOf(follow.target), tx = target.x + follow.ox, ty = target.y + follow.oy;
        // Inside the dead zone the target moves alone; outside it the camera is pulled to its edge.
        const halfW = follow.deadWidth / 2, halfH = follow.deadHeight / 2;
        const wantX = tx > cx + halfW ? tx - halfW : tx < cx - halfW ? tx + halfW : cx;
        const wantY = ty > cy + halfH ? ty - halfH : ty < cy - halfH ? ty + halfH : cy;
        // The same distance closed in the same time, whatever the frames.
        const pull = follow.smoothing === 0 ? 1 : 1 - Math.exp(-seconds / follow.smoothing);
        cx += (wantX - cx) * pull; cy += (wantY - cy) * pull;
      }
      trauma = Math.max(0, trauma - shakeDecay * seconds);
      const strength = trauma * trauma, t = time * shakeFrequency;
      shakeX = shakeOffset * strength * noise(seed, 0, t);
      shakeY = shakeOffset * strength * noise(seed, 1, t);
      shakeAngle = shakeRotation * strength * noise(seed, 2, t);
      settle();
    },
    worldToScreen(x: number, y: number): CameraPoint {
      if (!finite(x) || !finite(y)) throw new EgretError('CAMERA_OPTIONS_INVALID');
      const angle = (rotation + shakeAngle) * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
      const dx = (x - cx) * zoom, dy = (y - cy) * zoom;
      return Object.freeze({ x: viewX() + dx * cos - dy * sin, y: viewY() + dx * sin + dy * cos });
    },
    screenToWorld(x: number, y: number): CameraPoint {
      if (!finite(x) || !finite(y)) throw new EgretError('CAMERA_OPTIONS_INVALID');
      const angle = (rotation + shakeAngle) * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
      const dx = x - viewX(), dy = y - viewY();
      return Object.freeze({ x: cx + (dx * cos + dy * sin) / zoom, y: cy + (-dx * sin + dy * cos) / zoom });
    },
    isVisible(value: CameraRect): boolean {
      if (!rect(value)) throw new EgretError('CAMERA_OPTIONS_INVALID');
      const halfW = width / zoom / 2, halfH = height / zoom / 2;
      return value.x <= cx + halfW && value.x + value.width >= cx - halfW && value.y <= cy + halfH && value.y + value.height >= cy - halfH;
    },
    snapshot(): CameraSnapshot {
      const halfW = width / zoom / 2, halfH = height / zoom / 2;
      return Object.freeze({ center: Object.freeze({ x: cx, y: cy }), zoom, rotation, trauma, view: Object.freeze({ x: cx - halfW, y: cy - halfH, width: halfW * 2, height: halfH * 2 }), following: follow !== undefined, time });
    },
    dispose(): void {
      if (closed) return;
      closed = true; follow = undefined; move = undefined; zoomMove = undefined;
      const failures: unknown[] = [];
      for (const layer of layers.splice(0)) try { if (!layer.object.isDisposed) write(layer.object, layer.before); } catch (cause) { failures.push(cause); }
      try { if (!world.isDisposed) write(world, before); } catch (cause) { failures.push(cause); }
      if (failures.length > 0) throw new EgretError('CAMERA_CLEANUP_FAILED', { cause: failures[0], cleanupErrors: failures.slice(1) });
    },
  });
  return camera;
}
