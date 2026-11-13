// SPDX-License-Identifier: Apache-2.0
// The default engine entry with one optional entry, in Node: a row of three panels is planned by
// `@egret/engine/layout` and applied to display objects, then planned again as a column. Nothing is drawn.
import assert from 'node:assert/strict';
import { DisplayObjectContainer, createEngine } from '@egret/engine';
import { planLinearLayout } from '@egret/engine/layout';

const timers = new Set();
const host = {
  surface: {},
  start() {},
  stop() {},
  async close() {},
  setTimeout(callback, delayMs) {
    const timer = setTimeout(() => { timers.delete(timer); callback(); }, delayMs);
    timers.add(timer);
    return () => { timers.delete(timer); clearTimeout(timer); };
  },
};
const engine = await createEngine({ host });
const screen = engine.createScope();
const sizes = [{ width: 40, height: 20 }, { width: 24, height: 32 }, { width: 16, height: 16 }];
const panels = sizes.map(() => screen.use(new DisplayObjectContainer()));
const row = screen.use(new DisplayObjectContainer());
for (const panel of panels) row.addChild(panel);
engine.stage.addChild(row);

/** The planner returns numbers. Writing them to the scene is the caller's step. */
function arrange(axis) {
  const plan = planLinearLayout({ axis, items: sizes, gap: 4, padding: 2, crossAlign: 'center' });
  for (const { index, x, y } of plan.placements) Object.assign(panels[index], { x, y });
  return { axis, width: plan.width, height: plan.height, positions: panels.map(panel => [panel.x, panel.y]) };
}
const horizontal = arrange('horizontal');
assert.deepEqual(horizontal, { axis: 'horizontal', width: 92, height: 36, positions: [[2, 8], [46, 2], [74, 10]] });
const vertical = arrange('vertical');
assert.deepEqual(vertical, { axis: 'vertical', width: 44, height: 80, positions: [[2, 2], [10, 26], [14, 62]] });
// A planner refuses what it cannot place, and the scene keeps the last arrangement.
let refused;
try { planLinearLayout({ axis: 'vertical', items: sizes, gap: -1 }); } catch (error) { refused = error.code; }
assert.equal(refused, 'LAYOUT_OPTIONS_INVALID');
assert.deepEqual(panels.map(panel => [panel.x, panel.y]), vertical.positions);

screen.dispose();
await engine.dispose();
console.log(JSON.stringify({ horizontal, vertical, refused, scopeState: screen.state, pendingTimers: timers.size }, null, 2));
