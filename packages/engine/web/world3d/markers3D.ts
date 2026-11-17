// SPDX-License-Identifier: Apache-2.0
// Page elements that follow points of a World3D scene: names over heads,
// damage numbers, objective markers that cling to the edge of the screen when
// their target is off it. The interface of a 3D game is usually ordinary page
// elements laid over the canvas; this places them each frame.
import { World3DError } from '../../rendering/world3d/core3D.js';
import type { Camera3D } from '../../rendering/world3d/Camera3D.js';
import type { Object3D } from '../../rendering/world3d/Object3D.js';
import { projectToViewport3D } from '../../rendering/world3d/GeometryBuilder3D.js';
import type { ViewportPoint3D } from '../../rendering/world3d/GeometryBuilder3D.js';

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
export interface ScreenMarkersOptions3D {
  /** The element markers are placed in; it should cover the canvas and have `position: relative` or similar. */
  readonly container: HTMLElement;
  readonly camera: Camera3D;
}
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
