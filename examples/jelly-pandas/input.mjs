// SPDX-License-Identifier: Apache-2.0
// Keyboard, mouse and gamepad. The mouse turns the camera while the pointer
// is captured; without capture, dragging does the same.

const KEYS = {
  forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  jump: ['Space'], slam: ['ControlLeft', 'ControlRight', 'KeyQ'], roll: ['ShiftLeft', 'ShiftRight', 'KeyE'],
};

export function createInput(canvas) {
  const down = new Set(), listeners = [];
  const input = {
    // Per-frame values, filled by poll().
    forward: 0, right: 0, jump: false, slam: false, roll: false, lookX: 0, lookY: 0, zoom: 0,
    /** Called with 'pick1'..'pick3', 'reroll' or 'menu' when those keys or buttons are pressed. */
    onCommand: undefined,
    enabled: true,
    get captured() { return document.pointerLockElement === canvas; },
  };
  let lookX = 0, lookY = 0, zoom = 0, slamQueued = false, mouseSlam = false, mouseRoll = false, dragging = false;
  const pad = { slam: false, menu: false, pick: -1, reroll: false };
  const on = (target, type, handler, options) => { target.addEventListener(type, handler, options); listeners.push([target, type, handler, options]); };
  const held = (name) => KEYS[name].some((code) => down.has(code));

  on(window, 'keydown', (event) => {
    if (event.repeat) return;
    down.add(event.code);
    if (KEYS.slam.includes(event.code)) slamQueued = true;
    if (/^Digit[1-3]$/.test(event.code)) input.onCommand?.('pick' + event.code.slice(5));
    else if (event.code === 'KeyR') input.onCommand?.('reroll');
    else if (event.code === 'Escape' || event.code === 'KeyP') input.onCommand?.('menu');
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  });
  on(window, 'keyup', (event) => { down.delete(event.code); });
  on(window, 'blur', () => { down.clear(); mouseRoll = false; dragging = false; });
  on(canvas, 'pointerdown', (event) => {
    if (!input.enabled) return;
    if (!input.captured) { dragging = true; canvas.requestPointerLock?.()?.catch?.(() => {}); return; }
    if (event.button === 0) { slamQueued = true; mouseSlam = true; } else if (event.button === 2) mouseRoll = true;
  });
  on(window, 'pointerup', (event) => { dragging = false; if (event.button === 2) mouseRoll = false; if (event.button === 0) mouseSlam = false; });
  on(window, 'pointermove', (event) => {
    if (!input.enabled || !(input.captured || dragging)) return;
    lookX += event.movementX; lookY += event.movementY;
  });
  on(canvas, 'wheel', (event) => { zoom += Math.sign(event.deltaY); event.preventDefault(); }, { passive: false });
  on(canvas, 'contextmenu', (event) => event.preventDefault());
  on(document, 'pointerlockchange', () => { if (!input.captured) { mouseRoll = false; mouseSlam = false; } });

  /** Read the devices once per frame. */
  input.poll = () => {
    let forward = (held('forward') ? 1 : 0) - (held('back') ? 1 : 0), right = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
    let jump = held('jump'), roll = held('roll') || mouseRoll, slam = slamQueued;
    slamQueued = false;
    const gamepad = navigator.getGamepads?.().find((entry) => entry && entry.connected);
    if (gamepad) {
      const dead = (v) => (Math.abs(v) < 0.18 ? 0 : v), buttons = gamepad.buttons;
      right += dead(gamepad.axes[0] ?? 0); forward -= dead(gamepad.axes[1] ?? 0);
      lookX += dead(gamepad.axes[2] ?? 0) * 14; lookY += dead(gamepad.axes[3] ?? 0) * 9;
      jump ||= !!buttons[0]?.pressed; roll ||= !!buttons[2]?.pressed;
      const padSlam = !!buttons[1]?.pressed, padMenu = !!buttons[9]?.pressed;
      if (padSlam && !pad.slam) slam = true;
      if (padMenu && !pad.menu) input.onCommand?.('menu');
      // The direction pad picks a card: left, up, right for the first three; Y rerolls.
      const pick = buttons[14]?.pressed ? 1 : buttons[12]?.pressed ? 2 : buttons[15]?.pressed ? 3 : -1, padReroll = !!buttons[3]?.pressed;
      if (pick > 0 && pad.pick < 0) input.onCommand?.('pick' + pick);
      if (padReroll && !pad.reroll) input.onCommand?.('reroll');
      pad.slam = padSlam; pad.menu = padMenu; pad.pick = pick; pad.reroll = padReroll;
    }
    input.forward = Math.max(-1, Math.min(1, forward)); input.right = Math.max(-1, Math.min(1, right));
    input.jump = jump; input.roll = roll; input.slam = slam;
    input.lookX = lookX; input.lookY = lookY; input.zoom = zoom;
    lookX = 0; lookY = 0; zoom = 0;
    return input;
  };
  input.release = () => { if (input.captured) document.exitPointerLock?.(); };
  input.dispose = () => { for (const [target, type, handler, options] of listeners) target.removeEventListener(type, handler, options); };
  return input;
}
