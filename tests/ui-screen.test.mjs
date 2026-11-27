// SPDX-License-Identifier: Apache-2.0
// planScreen of @egret/engine/web/screen: which design applies, the scale, how much stage a screen shows and the part
// no notch covers, for screens of several shapes. Pure arithmetic; what a page does with it is checked in a browser by
// examples/play/verify.mjs.
import assert from 'node:assert/strict';
import test from 'node:test';
import { isScreenPin, pinBox, planScreen } from '@egret/engine/web/screen';

const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-9, label + ': ' + actual);

// Break caught: a design that is cut off, or bars that are not centred, on a screen of another shape.
test('SCR01 contain: the design whole, centred, at the scale that fits', () => {
  const plan = planScreen({ box: { width: 1000, height: 400 }, design: { width: 640, height: 360 } });
  assert.equal(plan.orientation, 'landscape');
  assert.deepEqual([plan.width, plan.height], [640, 360]);
  near(plan.scale, 400 / 360, 'scale');
  near(plan.left, (1000 - 640 * plan.scale) / 2, 'left');
  assert.equal(plan.top, 0);
  assert.deepEqual(plan.designRect, { x: 0, y: 0, width: 640, height: 360 });
  assert.deepEqual(plan.safe, { x: 0, y: 0, width: 640, height: 360 });
});

// Break caught: an expanded stage that changes the scale, so a button is a different size on a wider phone.
test('SCR02 expand: the same scale, a larger stage, and the design in its middle', () => {
  const wide = planScreen({ box: { width: 1200, height: 540 }, design: { width: 640, height: 360 }, fit: 'expand' });
  assert.equal(wide.scale, 1.5);
  assert.deepEqual([wide.width, wide.height], [800, 360]);
  assert.deepEqual([wide.left, wide.top], [0, 0]);
  assert.deepEqual(wide.designRect, { x: 80, y: 0, width: 640, height: 360 });
  const tall = planScreen({ box: { width: 960, height: 720 }, design: { width: 640, height: 360 }, fit: 'expand' });
  assert.equal(tall.scale, 1.5);
  assert.deepEqual([tall.width, tall.height], [640, 480]);
  assert.deepEqual(tall.designRect, { x: 0, y: 60, width: 640, height: 360 });
  // A space that does not hold a whole number of units: the stage is whole, and the rest is a bar under a unit wide.
  const odd = planScreen({ box: { width: 1001, height: 540 }, design: { width: 640, height: 360 }, fit: 'expand' });
  assert.equal(odd.width, 667);
  assert.ok(odd.left >= 0 && odd.left < 1);
});

// Break caught: a portrait phone given the landscape layout squeezed small, or a portrait size used on a wide screen.
test('SCR03 a portrait design applies while the space is taller than wide', () => {
  const design = { width: 1920, height: 1080 },
    portrait = { width: 1080, height: 1920 };
  const up = planScreen({ box: { width: 390, height: 844 }, design, portrait, fit: 'expand' });
  assert.equal(up.orientation, 'portrait');
  assert.deepEqual(up.design, portrait);
  near(up.scale, 390 / 1080, 'portrait scale');
  assert.equal(up.width, 1080);
  assert.ok(up.height >= 1920);
  const across = planScreen({ box: { width: 844, height: 390 }, design, portrait, fit: 'expand' });
  assert.equal(across.orientation, 'landscape');
  assert.deepEqual(across.design, design);
  // Both designs share their short side, so a thing of the design is as large on the screen held either way.
  near(up.scale, across.scale, 'the same scale turned');
  // Without a portrait size the landscape design is used, smaller, and the orientation is still said.
  const only = planScreen({ box: { width: 390, height: 844 }, design, fit: 'expand' });
  assert.equal(only.orientation, 'portrait');
  assert.deepEqual(only.design, design);
});

// Break caught: a button placed under a notch or a home bar, or a safe part that reaches outside the stage.
test('SCR04 the safe part is the stage less what the insets cover', () => {
  const plan = planScreen({
    box: { width: 844, height: 390 },
    design: { width: 844, height: 390 },
    fit: 'expand',
    insets: { top: 0, right: 47, bottom: 21, left: 47 }
  });
  assert.equal(plan.scale, 1);
  assert.deepEqual(plan.safe, { x: 47, y: 0, width: 750, height: 369 });
  // With bars, an inset that the bar already takes covers nothing of the stage.
  const barred = planScreen({
    box: { width: 1000, height: 400 },
    design: { width: 400, height: 400 },
    insets: { top: 0, right: 0, bottom: 0, left: 120 }
  });
  assert.equal(barred.left, 300);
  assert.deepEqual(barred.safe, { x: 0, y: 0, width: 400, height: 400 });
  // An inset deeper than the bar covers the rest, in stage units.
  const deep = planScreen({
    box: { width: 1000, height: 400 },
    design: { width: 400, height: 400 },
    insets: { top: 0, right: 0, bottom: 0, left: 350 }
  });
  assert.deepEqual(deep.safe, { x: 50, y: 0, width: 350, height: 400 });
});

// Break caught: a size of 0, a fractional design or a negative inset accepted, and a stage of no size planned.
test('SCR05 what is not a screen is refused', () => {
  const refused = options => assert.throws(() => planScreen(options), { code: 'UI_SCREEN_OPTIONS_INVALID' });
  const design = { width: 640, height: 360 };
  refused(null);
  refused({ box: { width: 0, height: 100 }, design });
  refused({ box: { width: 100, height: 100 }, design: { width: 640.5, height: 360 } });
  refused({ box: { width: 100, height: 100 }, design, portrait: { width: 0, height: 10 } });
  refused({ box: { width: 100, height: 100 }, design, fit: 'cover' });
  refused({ box: { width: 100, height: 100 }, design, fit: 'noScale' });
  refused({ box: { width: 100, height: 100 }, design, wholeScale: 'yes' });
  refused({ box: { width: 100, height: 100 }, design, wholeScale: true, pixelRatio: 0 });
  refused({ box: { width: 100, height: 100 }, design, insets: { top: -1, right: 0, bottom: 0, left: 0 } });
  refused({ box: { width: 100, height: 100 }, design, insets: { top: 0, right: 0, bottom: 0 } });
  assert.ok(Object.isFrozen(planScreen({ box: { width: 100, height: 100 }, design })));
});

// Break caught: an Egret 5 project moved here with fixedWidth, fixedHeight, fixedNarrow or fixedWide given a stage of
// another size than it had, bars where Egret 5 filled the screen, or a design not centred on the stage.
test('SCR06 the four fixed modes of Egret 5 fill the space, each with the scale of its side', () => {
  const design = { width: 400, height: 300 };
  const plan = (box, fit) => {
    const { width, height, scale, left, top, designRect } = planScreen({ box, design, fit });
    return { width, height, scale, left, top, x: designRect.x, y: designRect.y };
  };
  // A space taller than the design: the width fixed shows more below and above; the height fixed shows less across.
  const tall = { width: 800, height: 800 };
  assert.deepEqual(plan(tall, 'fixedWidth'), { width: 400, height: 400, scale: 2, left: 0, top: 0, x: 0, y: 50 });
  const byHeight = plan(tall, 'fixedHeight');
  assert.deepEqual([byHeight.width, byHeight.height, byHeight.x, byHeight.y], [300, 300, -50, 0]);
  assert.equal(byHeight.scale, 800 / 300);
  assert.deepEqual(plan(tall, 'fixedWide'), byHeight, 'the larger scale, and the stage is what the space shows');
  // A space wider than the design: the width fixed now shows less from top to bottom.
  const wide = { width: 1000, height: 600 };
  assert.deepEqual(plan(wide, 'fixedWidth'), { width: 400, height: 240, scale: 2.5, left: 0, top: 0, x: 0, y: -30 });
  assert.deepEqual(plan(wide, 'fixedHeight'), { width: 500, height: 300, scale: 2, left: 0, top: 0, x: 50, y: 0 });
  assert.deepEqual(plan(wide, 'fixedWide'), plan(wide, 'fixedWidth'));
  // fixedNarrow is expand, on every shape.
  for (const box of [tall, wide, { width: 390, height: 844 }, { width: 400, height: 300 }])
    assert.deepEqual(
      planScreen({ box, design, fit: 'fixedNarrow' }),
      planScreen({ box, design, fit: 'expand' }),
      JSON.stringify(box)
    );
  // The safe part stays within a stage smaller than the design.
  const safe = planScreen({
    box: tall,
    design,
    fit: 'fixedWide',
    insets: { top: 40, right: 0, bottom: 0, left: 0 }
  }).safe;
  assert.deepEqual(safe, { x: 0, y: 15, width: 300, height: 285 });
});

// Break caught: pixel art drawn at a scale between two whole numbers of device pixels, and so blurred or uneven, or
// whole steps taken where the space cannot hold the design at one device pixel a unit.
test('SCR07 wholeScale gives each unit a whole number of device pixels, with bars for the rest', () => {
  const design = { width: 320, height: 180 };
  const exact = planScreen({ box: { width: 1280, height: 720 }, design, wholeScale: true });
  assert.deepEqual([exact.scale, exact.left, exact.top], [4, 0, 0]);
  const over = planScreen({ box: { width: 1300, height: 740 }, design, wholeScale: true });
  assert.deepEqual([over.scale, over.left, over.top, over.width, over.height], [4, 10, 10, 320, 180]);
  // On a page of two device pixels to a CSS pixel the steps are of device pixels: here 4 of them, 2 CSS pixels.
  const dense = planScreen({ box: { width: 650, height: 370 }, design, wholeScale: true, pixelRatio: 2 });
  assert.deepEqual([dense.scale, dense.left, dense.top], [2, 5, 5]);
  // With expand the stage fills what the whole steps reach.
  const grown = planScreen({ box: { width: 1400, height: 720 }, design, fit: 'expand', wholeScale: true });
  assert.deepEqual([grown.scale, grown.width, grown.height, grown.left], [4, 350, 180, 0]);
  // Below one device pixel a unit, the scale is as the fit makes it.
  const small = planScreen({ box: { width: 300, height: 170 }, design, wholeScale: true });
  assert.equal(small.scale, 300 / 320);
});

// Break caught: a score pinned to the right edge drawn at the left, a bar held at the bottom that leaves the bottom
// when its height changes, two pins of one axis taken, or an axis without a pin moved.
test('SCR08 pinBox holds a box against an edge or the middle of an area, on each axis apart', () => {
  const area = { x: 10, y: 20, width: 400, height: 300 },
    box = { x: 0, y: 0, width: 50, height: 30 };
  assert.deepEqual(pinBox(area, box, { right: 16, top: 16 }), { x: 344, y: 36 });
  assert.deepEqual(pinBox(area, box, { left: 0, bottom: 0 }), { x: 10, y: 290 });
  assert.deepEqual(pinBox(area, box, { centerX: 0, centerY: -10 }), { x: 185, y: 145 });
  // An axis without a pin keeps the box where it is.
  assert.deepEqual(pinBox(area, { ...box, x: 77, y: 5 }, { bottom: 4 }), { x: 77, y: 286 });
  assert.ok(isScreenPin({ right: 1, centerY: 0 }));
  assert.ok(isScreenPin({}));
  for (const bad of [null, 5, { left: 1, right: 1 }, { top: 0, centerY: 0 }, { left: '1' }, { up: 1 }, { left: NaN }])
    assert.equal(isScreenPin(bad), false, JSON.stringify(bad));
  assert.throws(() => pinBox(area, box, { left: 1, centerX: 0 }), { code: 'UI_SCREEN_OPTIONS_INVALID' });
  assert.throws(() => pinBox({ ...area, width: -1 }, box, {}), { code: 'UI_SCREEN_OPTIONS_INVALID' });
});

// The overlay's own stage is resized when its native unit is clamped, not the World3D view behind it.
test('SCR10 UI scale clamps a filling stage while keeping every reported coordinate in the same units', () => {
  const design = { width: 800, height: 420 },
    portrait = { width: 380, height: 680 };
  const uiScale = { min: 1, max: 1.35 };
  const up = planScreen({
    box: { width: 375, height: 667 },
    design,
    portrait,
    fit: 'expand',
    uiScale,
    insets: { left: 7, top: 30, right: 5, bottom: 20 }
  });
  assert.deepEqual([up.width, up.height, up.scale], [375, 667, 1]);
  assert.deepEqual(up.designRect, { x: -2.5, y: -6.5, width: 380, height: 680 });
  assert.deepEqual(up.safe, { x: 7, y: 30, width: 363, height: 617 });
  const desk = planScreen({ box: { width: 1920, height: 1080 }, design, fit: 'expand', uiScale });
  assert.deepEqual([desk.width, desk.height, desk.scale], [1422, 800, 1.35]);
  near(desk.left, (1920 - 1422 * 1.35) / 2, 'centred remainder');
  assert.deepEqual(desk.designRect, { x: 311, y: 190, width: 800, height: 420 });
  const options = { box: { width: 1000, height: 500 }, design, fit: 'fixedWidth' };
  assert.deepEqual(
    planScreen({ ...options, uiScale }),
    planScreen(options),
    'inside the bounds, the original fit stays'
  );
  const fixed = planScreen({ ...options, uiScale: { max: 1 } });
  assert.deepEqual([fixed.width, fixed.height, fixed.scale], [1000, 500, 1]);
});

test('SCR11 UI scale is validated, only for filling fits and without whole-pixel quantization', () => {
  const options = { box: { width: 1000, height: 500 }, design: { width: 800, height: 420 }, fit: 'expand' };
  for (const uiScale of [null, [], 'large', { min: 0 }, { max: NaN }, { min: 2, max: 1 }, { max: 1e-300 }])
    assert.throws(() => planScreen({ ...options, uiScale }), { code: 'UI_SCREEN_OPTIONS_INVALID' });
  assert.throws(() => planScreen({ ...options, fit: 'contain', uiScale: { min: 1 } }), {
    code: 'UI_SCREEN_OPTIONS_INVALID'
  });
  assert.throws(() => planScreen({ ...options, wholeScale: true, uiScale: { max: 1 } }), {
    code: 'UI_SCREEN_OPTIONS_INVALID'
  });
});
