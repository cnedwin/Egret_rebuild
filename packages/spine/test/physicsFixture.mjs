// SPDX-License-Identifier: Apache-2.0
// Original numerical fixture with one physics constraint; not an Editor export or commercial artwork.
import { source } from './fixtures.mjs';

/**
 * A root that swings, a child on it, and a tail on the child that physics drags behind. The tail
 * lags the swing, so where it stands depends on every step that was simulated, not on the time alone.
 */
export function physicsSource({ constrained = true } = {}) {
  const data = source();
  data.bones = [{ name: 'root' }, { name: 'child', parent: 'root', x: 1 }, { name: 'tail', parent: 'child', x: 10 }];
  if (constrained) data.constraints = [{ type: 'physics', name: 'sway', bone: 'tail', x: 1, y: 1, rotate: 1, inertia: 0.6, strength: 80, damping: 0.9, mass: 1, gravity: 4, wind: 0, mix: 1 }];
  data.events = { beat: {} };
  data.animations = {
    idle: {},
    swing: { bones: { root: { translate: [{ time: 0, x: 0 }, { time: 0.1, x: 40 }, { time: 0.2, x: 0 }], rotate: [{ time: 0, value: 0 }, { time: 0.1, value: 60 }, { time: 0.2, value: 0 }] } }, events: [{ time: 0.05, name: 'beat' }, { time: 0.15, name: 'beat' }] },
    lift: { bones: { child: { translate: [{ time: 0, y: 0 }, { time: 0.08, y: 12 }, { time: 0.16, y: 0 }] } } },
  };
  return data;
}
