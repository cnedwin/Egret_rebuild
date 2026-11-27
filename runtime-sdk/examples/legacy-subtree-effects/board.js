// SPDX-License-Identifier: Apache-2.0
// Use the same display tree in a classic 5.x browser and in the Android player.
globalThis.SubtreeBoard = class SubtreeBoard extends egret.DisplayObjectContainer {
  constructor() {
    super();
    this.modes = ['plain', 'matrix', 'nested', 'blur', 'glow', 'clear'];
    this.index = 0;
    const rect = (owner, color, x, y, width, height) => {
      const sprite = new egret.Sprite();
      sprite.x = x;
      sprite.y = y;
      sprite.graphics.beginFill(color);
      sprite.graphics.drawRect(0, 0, width, height);
      sprite.graphics.endFill();
      owner.addChild(sprite);
      return sprite;
    };
    rect(this, 0x102030, 0, 0, 192, 128);
    this.layer = new egret.Sprite();
    this.shared = 'renderEffect' in this.layer;
    if (this.shared) this.modes.splice(5, 0, 'sharedBlur', 'sharedGlow');
    this.layer.x = 32;
    this.layer.y = 30;
    this.addChild(this.layer);
    this.clipGroup = new egret.Sprite();
    if (this.shared) this.clipGroup.clipRect = { x: 0, y: 0, width: 60, height: 48 };
    else this.clipGroup.scrollRect = new egret.Rectangle(0, 0, 60, 48);
    this.layer.addChild(this.clipGroup);
    rect(this.clipGroup, 0xff0000, 0, 0, 42, 34);
    this.front = rect(this.clipGroup, 0x00ff00, 18, 8, 60, 40);
    rect(this, 0x2040d0, 113, 33, 32, 44);
    // Fixed fiducials identify the actual stage, including any Android letterboxing.
    rect(this, 0xff00ff, 4, 4, 6, 6);
    rect(this, 0xff00ff, 182, 118, 6, 6);
    this.pad = rect(this, 0xffd800, 144, 92, 37, 22);
    this.pad.touchEnabled = true;
    this.pad.hitArea = new egret.Rectangle(0, 0, 37, 22);
    this.pad.addEventListener(egret.TouchEvent.TOUCH_TAP, () => {
      this.setMode(this.modes[(this.index + 1) % this.modes.length]);
    }, this);
    this.setMode('plain');
  }

  setMode(mode) {
    const index = this.modes.indexOf(mode);
    if (index < 0) throw new Error('Unknown display mode');
    this.index = index;
    this.layer.filters = null;
    this.front.filters = null;
    if (this.shared) this.layer.renderEffect = undefined;
    this.refusal = '';
    try {
      if (mode === 'matrix' || mode === 'nested') {
        // Half alpha must composite once even where the two fully opaque children overlap.
        this.layer.filters = [new egret.ColorMatrixFilter([
          0,0,0,0,0, 0,0.5,0,0,64, 1,1,0,0,0, 0,0,0,0.5,0
        ])];
        if (mode === 'nested') this.front.filters = [new egret.ColorMatrixFilter([
          0,1,0,0,0, 0,0,0,0,0, 0,0,1,0,0, 0,0,0,1,0
        ])];
      } else if (mode === 'sharedBlur') {
        this.layer.renderEffect = { blurRadius: 5 };
      } else if (mode === 'sharedGlow') {
        this.layer.renderEffect = { glow: { color: 0xee8800, alpha: 0.8, blur: 7, strength: 2 } };
      } else if (mode === 'blur') {
        this.layer.filters = [new egret.BlurFilter(10, 10, 2)];
      } else if (mode === 'glow') {
        this.layer.filters = [new egret.GlowFilter(0xee8800, 0.8, 35, 35, 2, 3, false, false)];
      }
    } catch (error) {
      this.refusal = error.code || String(error);
    }
    this.mode = mode;
  }
};
