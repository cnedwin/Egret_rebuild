// SPDX-License-Identifier: Apache-2.0
// Page elements that follow points of a World3D scene: names over heads,
// damage numbers, objective markers that cling to the edge of the screen when
// their target is off it. The interface of a 3D game is usually ordinary page
// elements laid over the canvas; this places them each frame.
import { World3DError } from '../../rendering/world3d/core3D.js';
import type { Camera3D } from '../../rendering/world3d/Camera3D.js';
import { Object3D } from '../../rendering/world3d/Object3D.js';
import { DisplayObject, DisplayObjectContainer, EgretError } from '@egret/runtime';
import type { World3DOverlay } from './overlay3D.js';
import { projectToViewport3D } from '../../rendering/world3d/GeometryBuilder3D.js';
import type { ViewportPoint3D } from '../../rendering/world3d/GeometryBuilder3D.js';

/** A screen marker to add: what it points at, its offset, whether it sticks to the screen's edge, and how far it shows. */
export interface ScreenMarkerOptions3D {
  /** What the element follows: a node's world position, or a fixed world point. */
  readonly target: Object3D | readonly [number, number, number];
  /** Added to the target's position in world units, as for a label above a head. */
  readonly offset?: readonly [number, number, number];
  /** Keep the element at the edge of the screen when its target is off it, `margin` pixels in. */
  readonly clampToEdge?: boolean;
  readonly margin?: number;
  /** Hide the element beyond this distance from the camera. */
  readonly maxDistance?: number;
}
/** A marker over the screen that follows a point of the scene: its element and where it is. */
export interface ScreenMarker3D {
  readonly element: HTMLElement;
  /** Where the element was placed last; `onEdge` when it was clamped. */
  readonly point: Readonly<ViewportPoint3D>;
  readonly onEdge: boolean;
  /** The direction from the screen's centre to the target, in radians, for an arrow on a clamped marker. */
  readonly angle: number;
  /** Replaces what the marker follows. */
  retarget(target: Object3D | readonly [number, number, number]): void;
  /** Takes the marker off; the element is removed from its container when the layer added it. */
  dispose(): void;
}
/** Screen markers to make: the container they go in, and the camera they follow. */
export interface ScreenMarkersOptions3D {
  /** The element markers are placed in; it should cover the canvas and have `position: relative` or similar. */
  readonly container: HTMLElement;
  readonly camera: Camera3D;
}
/** Elements over the screen that follow points of the scene: add them, and update them each frame. */
export interface ScreenMarkers3D {
  readonly markers: readonly ScreenMarker3D[];
  /** The camera markers are projected through; may be replaced. */
  camera: Camera3D;
  /** Follows a target with `element`, which is appended to the container when it has no parent. */
  add(element: HTMLElement, options: ScreenMarkerOptions3D): ScreenMarker3D;
  /** Places every marker; call once a frame after the camera moved, before or after drawing. */
  update(): void;
  /** Takes every marker off. */
  dispose(): void;
}

/**
 * A layer of page elements that follow scene points. Each element is moved with a CSS transform, so give it
 * `position: absolute; left: 0; top: 0` and centre it with a negative margin or a translate of its own child.
 * A marker gets `data-on-edge` while clamped and `hidden` while its target is behind the camera without clamping.
 */
export function createScreenMarkers3D(options: ScreenMarkersOptions3D): ScreenMarkers3D {
  if (!options?.container || typeof options.container.appendChild !== 'function' || !options.camera)
    throw new World3DError('WORLD3D_INPUT_INVALID', 'screen markers');
  const container = options.container;
  const markers: (ScreenMarker3D & { update(width: number, height: number): void })[] = [];
  const world = new Float32Array(3);
  const layer: ScreenMarkers3D = {
    markers,
    camera: options.camera,
    add(element: HTMLElement, marker: ScreenMarkerOptions3D): ScreenMarker3D {
      if (!element || !marker?.target) throw new World3DError('WORLD3D_INPUT_INVALID', 'marker');
      let target = marker.target;
      const added = !element.parentNode;
      if (added) container.appendChild(element);
      const point: ViewportPoint3D = { x: 0, y: 0, depth: 0, inFront: false, onScreen: false };
      let onEdge = false,
        angle = 0,
        disposed = false;
      const margin = marker.margin ?? 24;
      const entry = {
        element,
        point,
        get onEdge() {
          return onEdge;
        },
        get angle() {
          return angle;
        },
        retarget(next: Object3D | readonly [number, number, number]): void {
          if (!next) throw new World3DError('WORLD3D_INPUT_INVALID', 'marker target');
          target = next;
        },
        dispose(): void {
          if (disposed) return;
          disposed = true;
          const at = markers.indexOf(entry);
          if (at >= 0) markers.splice(at, 1);
          if (added) element.remove();
        },
        update(width: number, height: number): void {
          if (Array.isArray(target)) world.set(target as readonly number[]);
          else {
            const node = target as Object3D;
            node.updateWorldMatrix();
            const m = node.matrixWorld;
            world[0] = m[12]!;
            world[1] = m[13]!;
            world[2] = m[14]!;
          }
          if (marker.offset) for (let i = 0; i < 3; i++) world[i]! += marker.offset[i]!;
          const camera = layer.camera;
          projectToViewport3D(camera, world, width, height, point);
          const eye = camera.matrixWorld;
          const far =
            marker.maxDistance !== undefined &&
            Math.hypot(world[0]! - eye[12]!, world[1]! - eye[13]!, world[2]! - eye[14]!) > marker.maxDistance;
          let x = point.x,
            y = point.y;
          angle = Math.atan2(y - height / 2, x - width / 2);
          onEdge = false;
          if (!point.onScreen && marker.clampToEdge) {
            // Push the point out from the centre to the screen's edge along its direction.
            // Behind the camera the projection already keeps the side the target lies on; one straight behind
            // goes to the bottom edge.
            let dx = x - width / 2,
              dy = y - height / 2;
            if (!point.inFront && Math.hypot(dx, dy) < 1) dy = 1;
            if (!point.inFront) {
              // Behind the camera a target is always off the screen, however close to the centre it projects.
              const length = Math.hypot(dx, dy);
              dx /= length;
              dy /= length;
            }
            angle = Math.atan2(dy, dx);
            const halfW = width / 2 - margin,
              halfH = height / 2 - margin;
            const scale = Math.min(halfW / Math.max(Math.abs(dx), 1e-9), halfH / Math.max(Math.abs(dy), 1e-9));
            x = width / 2 + dx * scale;
            y = height / 2 + dy * scale;
            x = Math.min(width - margin, Math.max(margin, x));
            y = Math.min(height - margin, Math.max(margin, y));
            onEdge = true;
          }
          const hidden = far || (!point.onScreen && !marker.clampToEdge);
          element.hidden = hidden;
          if (onEdge) element.dataset['onEdge'] = '';
          else delete element.dataset['onEdge'];
          if (!hidden) element.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
          point.x = x;
          point.y = y;
        }
      };
      markers.push(entry);
      return entry;
    },
    update(): void {
      const width = container.clientWidth,
        height = container.clientHeight;
      if (!(width > 0 && height > 0)) return;
      layer.camera.updateViewMatrices();
      for (const marker of [...markers]) marker.update(width, height);
    },
    dispose(): void {
      for (const marker of [...markers]) marker.dispose();
    }
  };
  return layer;
}

/** CSS-pixel margins for independent edges. Omitted edges have no extra inset. */
export interface ScreenMarkerInsets3D {
  readonly left?: number;
  readonly top?: number;
  readonly right?: number;
  readonly bottom?: number;
}

/** Options for a native display marker; its visible footprint is kept within the selected part of the overlay. */
export interface OverlayScreenMarkerOptions3D extends Omit<ScreenMarkerOptions3D, 'margin'> {
  /** Default 'safe'. 'screen' uses the visible intersection of the scene and the overlay. */
  readonly area?: 'safe' | 'screen';
  /** CSS pixels, either one value for all four edges or independent sides. Defaults to zero. */
  readonly margin?: number | ScreenMarkerInsets3D;
  /** Where the target attaches to the measured display bounds, from 0 to 1. Defaults to the centre. */
  readonly anchor?: { readonly x: number; readonly y: number };
  /** Minimum reserved footprint, in overlay stage units, around the same anchor. Actual artwork may be larger. */
  readonly extent?: { readonly width: number; readonly height: number };
}

/** A borrowed native display marker; the layer owns its holder, not its artwork. */
export interface OverlayScreenMarker3D {
  readonly display: DisplayObject;
  /** Stage coordinates of the anchor (clamped when applicable); the original 3D visibility/depth fields are retained. */
  readonly point: Readonly<ViewportPoint3D>;
  readonly visible: boolean;
  readonly onEdge: boolean;
  /** Direction in the scene canvas, in radians, independent of the overlay's fit. */
  readonly angle: number;
  retarget(target: Object3D | readonly [number, number, number]): void;
  /** Hide/re-enable a pooled marker without removing its display. Re-enabling places it on the next update. */
  setVisible(visible: boolean): void;
  /** Detach the borrowed display without disposing it. */
  dispose(): void;
}

/** The native stage and the actual 3D canvas whose scene the camera projects. */
export interface OverlayScreenMarkersOptions3D {
  readonly overlay: World3DOverlay;
  readonly sceneCanvas: HTMLCanvasElement;
  readonly camera: Camera3D;
}

/** A layer of native display objects over the 3D picture. The layer never admits pointer hits. */
export interface OverlayScreenMarkers3D {
  readonly markers: readonly OverlayScreenMarker3D[];
  camera: Camera3D;
  /** The display must be live and unparented; its own transform and visibility remain caller-owned. */
  add(display: DisplayObject, options: OverlayScreenMarkerOptions3D): OverlayScreenMarker3D;
  /** Place all active markers using the latest camera, scene/overlay rectangles and safe presentation plan. */
  update(): void;
  /** Retire the layer and detach its displays; closing the overlay does this as well. */
  dispose(): void;
}

interface MarkerRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface MarkerProjection {
  scene: DOMRect;
  canvas: DOMRect;
  unitsX: number;
  unitsY: number;
  screen: MarkerRect;
  safe: MarkerRect;
}
interface NativeMarkerRecord extends OverlayScreenMarker3D {
  update(projection: MarkerProjection | undefined): void;
}

const markerInvalid = (detail: string): World3DError => new World3DError('WORLD3D_INPUT_INVALID', detail);
const finiteNonnegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
const finiteMarkerPoint = (value: unknown): value is readonly [number, number, number] =>
  Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const validateNativeTarget = (value: unknown): void => {
  if (!(value instanceof Object3D) && !finiteMarkerPoint(value)) throw markerInvalid('marker target');
};
function markerMargins(value: OverlayScreenMarkerOptions3D['margin']): Required<ScreenMarkerInsets3D> {
  if (value === undefined) return { left: 0, top: 0, right: 0, bottom: 0 };
  if (finiteNonnegative(value)) return { left: value, top: value, right: value, bottom: value };
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw markerInvalid('marker margin');
  const sides = { left: value.left ?? 0, top: value.top ?? 0, right: value.right ?? 0, bottom: value.bottom ?? 0 };
  if (!Object.values(sides).every(finiteNonnegative)) throw markerInvalid('marker margin');
  return sides;
}
function markerIntersection(a: MarkerRect, b: MarkerRect): MarkerRect {
  const x = Math.max(a.x, b.x),
    y = Math.max(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(0, Math.min(a.x + a.width, b.x + b.width) - x),
    height: Math.max(0, Math.min(a.y + a.height, b.y + b.height) - y)
  };
}
const markerClamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

/**
 * A display layer for World3DOverlay. It borrows real displays under a
 * non-interactive stage child, uses the same projectToViewport3D projection as
 * page markers, and maps the CSS scene point into the overlay's current plan.
 */
export function createOverlayScreenMarkers3D(options: OverlayScreenMarkersOptions3D): OverlayScreenMarkers3D {
  if (
    !options?.overlay?.game ||
    !(options.overlay.game.stage instanceof DisplayObjectContainer) ||
    options.overlay.game.scope.state !== 'open' ||
    options.overlay.game.scope.signal.aborted ||
    typeof options.overlay.canvas?.getBoundingClientRect !== 'function' ||
    typeof options.sceneCanvas?.getBoundingClientRect !== 'function' ||
    typeof options.camera?.updateViewMatrices !== 'function'
  )
    throw markerInvalid('overlay screen markers');
  const { overlay, sceneCanvas } = options,
    { stage, scope } = overlay.game;
  const root = new DisplayObjectContainer();
  root.touchEnabled = false;
  root.touchChildren = false;
  stage.addChild(root);
  const records: NativeMarkerRecord[] = [],
    world = new Float32Array(3);
  let closed = false,
    stageRetires = false;
  const layer: OverlayScreenMarkers3D = {
    get markers() {
      return records.slice();
    },
    camera: options.camera,
    add(display, marker) {
      if (
        closed ||
        !(display instanceof DisplayObject) ||
        display.isDisposed ||
        display.parent !== undefined ||
        !marker ||
        typeof marker !== 'object'
      )
        throw markerInvalid('overlay marker display or options');
      validateNativeTarget(marker.target);
      const offset = marker.offset ?? [0, 0, 0];
      if (!finiteMarkerPoint(offset)) throw markerInvalid('marker offset');
      const area = marker.area ?? 'safe',
        margin = markerMargins(marker.margin),
        anchor = marker.anchor ?? { x: 0.5, y: 0.5 },
        extent = marker.extent ?? { width: 0, height: 0 },
        clamp = marker.clampToEdge ?? false,
        maxDistance = marker.maxDistance ?? Infinity;
      if (
        (area !== 'safe' && area !== 'screen') ||
        !finiteNonnegative(anchor.x) ||
        !finiteNonnegative(anchor.y) ||
        anchor.x > 1 ||
        anchor.y > 1 ||
        !finiteNonnegative(extent.width) ||
        !finiteNonnegative(extent.height) ||
        typeof clamp !== 'boolean' ||
        (maxDistance !== Infinity && !finiteNonnegative(maxDistance))
      )
        throw markerInvalid('overlay marker placement');
      // A holder keeps the caller's own position, scale, pivots and children
      // intact. Measuring it also includes rotation, skew and descendant artwork.
      const holder = new DisplayObjectContainer();
      holder.visible = false;
      root.addChild(holder);
      try {
        holder.addChild(display);
      } catch (cause) {
        holder.dispose();
        throw cause;
      }
      let target = marker.target,
        enabled = true,
        onEdge = false,
        angle = 0,
        disposed = false;
      const point: ViewportPoint3D = { x: 0, y: 0, depth: 0, onScreen: false, inFront: false },
        cssPoint: ViewportPoint3D = { x: 0, y: 0, depth: 0, onScreen: false, inFront: false };
      const anchorX = anchor.x,
        anchorY = anchor.y,
        extentW = extent.width,
        extentH = extent.height;
      const entry: NativeMarkerRecord = {
        display,
        point,
        get visible() {
          return !disposed && holder.visible;
        },
        get onEdge() {
          return onEdge;
        },
        get angle() {
          return angle;
        },
        retarget(next) {
          if (disposed) throw markerInvalid('disposed overlay marker');
          validateNativeTarget(next);
          target = next;
        },
        setVisible(next) {
          if (disposed || typeof next !== 'boolean') throw markerInvalid('overlay marker visibility');
          enabled = next;
          if (!enabled) holder.visible = false;
        },
        dispose() {
          if (disposed) return;
          disposed = true;
          const at = records.indexOf(entry);
          if (at >= 0) records.splice(at, 1);
          if (!holder.isDisposed && !stageRetires) {
            if (!display.isDisposed && display.parent === holder) {
              try {
                holder.removeChild(display);
              } catch (cause) {
                // Engine.dispose() closes public tree mutations before sending
                // Scope cancellation. Its ensuing Scope/Stage teardown is the
                // authority then; do not recursively dispose borrowed artwork.
                if (cause instanceof EgretError && cause.code === 'ENGINE_CLOSED') {
                  stageRetires = true;
                  return;
                }
                throw cause;
              }
            }
            holder.dispose();
          }
        },
        update(projection) {
          if (disposed) return;
          // A caller is allowed to retire or reclaim its borrowed object. Do
          // not silently steal it back, or keep an empty holder in the layer.
          if (holder.isDisposed || display.isDisposed || display.parent !== holder) {
            entry.dispose();
            return;
          }
          onEdge = false;
          if (!enabled || projection === undefined) {
            holder.visible = false;
            return;
          }
          if (Array.isArray(target)) world.set(target);
          else {
            const node = target as Object3D;
            node.updateWorldMatrix();
            world.set(node.matrixWorld.subarray(12, 15));
          }
          for (let i = 0; i < 3; i++) world[i]! += offset[i]!;
          const camera = layer.camera,
            { scene, canvas, unitsX, unitsY } = projection;
          projectToViewport3D(camera, world, scene.width, scene.height, cssPoint);
          const rawX = (scene.left - canvas.left + cssPoint.x) * unitsX,
            rawY = (scene.top - canvas.top + cssPoint.y) * unitsY;
          point.x = rawX;
          point.y = rawY;
          point.depth = cssPoint.depth;
          point.inFront = cssPoint.inFront;
          point.onScreen = cssPoint.onScreen;
          const eye = camera.matrixWorld,
            far = Math.hypot(world[0]! - eye[12]!, world[1]! - eye[13]!, world[2]! - eye[14]!) > maxDistance;
          if (!Number.isFinite(rawX) || !Number.isFinite(rawY) || far) {
            holder.visible = false;
            return;
          }
          const part = area === 'safe' ? projection.safe : projection.screen;
          const drawn = holder.getBounds(),
            width = Math.max(drawn.width, extentW),
            height = Math.max(drawn.height, extentH);
          // The region is expressed in anchor coordinates: reserve the actual
          // drawing on both sides of its normalised anchor, not just its centre.
          const left = part.x + margin.left * unitsX + width * anchorX,
            right = part.x + part.width - margin.right * unitsX - width * (1 - anchorX),
            top = part.y + margin.top * unitsY + height * anchorY,
            bottom = part.y + part.height - margin.bottom * unitsY - height * (1 - anchorY);
          if (!(part.width > 0 && part.height > 0 && right >= left && bottom >= top)) {
            holder.visible = false;
            return;
          }
          let dx = cssPoint.x - scene.width / 2,
            dy = cssPoint.y - scene.height / 2;
          // For a target directly behind the camera, preserve the historic
          // marker behaviour: use the bottom edge, not a random direction.
          if (Math.hypot(dx, dy) < 1e-6) dy = 1;
          angle = Math.atan2(dy, dx);
          const inside = cssPoint.onScreen && rawX >= left && rawX <= right && rawY >= top && rawY <= bottom;
          if (!inside && !clamp) {
            holder.visible = false;
            return;
          }
          let x = rawX,
            y = rawY;
          if (!inside) {
            // Cast a ray from the scene centre (inside the feasible region if
            // asymmetric margins displaced it) to the marker's allowed edge.
            const cx = markerClamp((scene.left + scene.width / 2 - canvas.left) * unitsX, left, right),
              cy = markerClamp((scene.top + scene.height / 2 - canvas.top) * unitsY, top, bottom);
            dx *= unitsX;
            dy *= unitsY;
            const sx = dx > 0 ? (right - cx) / dx : dx < 0 ? (left - cx) / dx : Infinity,
              sy = dy > 0 ? (bottom - cy) / dy : dy < 0 ? (top - cy) / dy : Infinity,
              k = Math.min(sx, sy);
            x = markerClamp(cx + dx * k, left, right);
            y = markerClamp(cy + dy * k, top, bottom);
            onEdge = true;
          }
          holder.x = x - (drawn.x + drawn.width * anchorX);
          holder.y = y - (drawn.y + drawn.height * anchorY);
          holder.visible = true;
          point.x = x;
          point.y = y;
        }
      };
      records.push(entry);
      return entry;
    },
    update() {
      if (closed) return;
      const scene = sceneCanvas.getBoundingClientRect(),
        canvas = overlay.canvas.getBoundingClientRect(),
        plan = overlay.game.screen;
      let projection: MarkerProjection | undefined;
      if (
        scene.width > 0 &&
        scene.height > 0 &&
        canvas.width > 0 &&
        canvas.height > 0 &&
        plan.width > 0 &&
        plan.height > 0
      ) {
        layer.camera.updateViewMatrices();
        const unitsX = plan.width / canvas.width,
          unitsY = plan.height / canvas.height;
        // For both contain and cover, only the part shared by the two actual
        // canvases is visible. Filling fits naturally have the same rectangle.
        const visible = markerIntersection(
          {
            x: (scene.left - canvas.left) * unitsX,
            y: (scene.top - canvas.top) * unitsY,
            width: scene.width * unitsX,
            height: scene.height * unitsY
          },
          { x: 0, y: 0, width: plan.width, height: plan.height }
        );
        projection = { scene, canvas, unitsX, unitsY, screen: visible, safe: markerIntersection(visible, plan.safe) };
      }
      for (const record of [...records]) record.update(projection);
    },
    dispose() {
      if (closed) return;
      closed = true;
      scope.signal.removeEventListener('abort', retire);
      let failed = false,
        error: unknown;
      for (const entry of [...records]) {
        try {
          entry.dispose();
        } catch (cause) {
          if (!failed) {
            failed = true;
            error = cause;
          }
        }
      }
      if (!stageRetires) {
        try {
          root.dispose();
        } catch (cause) {
          if (!failed) {
            failed = true;
            error = cause;
          }
        }
      }
      if (failed) throw error;
    }
  };
  const retire = () => layer.dispose();
  scope.signal.addEventListener('abort', retire, { once: true });
  return layer;
}
