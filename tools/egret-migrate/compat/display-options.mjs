// SPDX-License-Identifier: Apache-2.0
export const BlendMode = Object.freeze({ ADD: 'add', NORMAL: 'normal' });
export const EventPhase = Object.freeze({ CAPTURING_PHASE: 1, AT_TARGET: 2, BUBBLING_PHASE: 3 });
export const HorizontalAlign = Object.freeze({ LEFT: 'left', CENTER: 'center', RIGHT: 'right' });
export const VerticalAlign = Object.freeze({ TOP: 'top', MIDDLE: 'middle', BOTTOM: 'bottom' });

export function legacyTouchEvent(Event) {
  class TouchEvent extends Event {
    constructor(type, bubbles = false, cancelable = false, stageX = 0, stageY = 0, touchPointID = 0) {
      super(type, bubbles, cancelable);
      this.stageX = stageX;
      this.stageY = stageY;
      this.touchPointID = touchPointID;
      this.touchDown = false;
    }
    get localX() {
      return this.target?.globalToLocal?.(this.stageX, this.stageY).x ?? this.stageX;
    }
    get localY() {
      return this.target?.globalToLocal?.(this.stageX, this.stageY).y ?? this.stageY;
    }
    static dispatchTouchEvent(target, type, bubbles = false, cancelable = false, x = 0, y = 0, id = 0, down = false) {
      const event = new TouchEvent(type, bubbles, cancelable, x, y, id);
      event.touchDown = down;
      return target.dispatchEvent(event);
    }
  }
  return Object.assign(TouchEvent, {
    TOUCH_TAP: 'touchTap',
    TOUCH_BEGIN: 'touchBegin',
    TOUCH_MOVE: 'touchMove',
    TOUCH_END: 'touchEnd',
    TOUCH_CANCEL: 'touchCancel'
  });
}
