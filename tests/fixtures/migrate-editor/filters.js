// SPDX-License-Identifier: Apache-2.0
// The original and converted player receive the same first-party pixels and material.
globalThis.FilterBoard = class FilterBoard extends egret.DisplayObjectContainer {
  constructor() {
    super();
    const group = new egret.Sprite();
    group.graphics.beginFill(0xff0000);
    group.graphics.drawRect(24, 24, 32, 32);
    group.graphics.endFill();
    this.addChild(group);
    this.panel = group;
    this.tint = new egret.ColorMatrixFilter([0, 0, 0, 0, 0, 0, 1, 0, 0, 32, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0]);
    globalThis.filterBoard = this;
  }
  addBadge(texture) {
    const badge = new egret.Bitmap(texture);
    badge.x = 90;
    badge.y = 30;
    this.panel.addChild(badge);
  }
  setMode(mode) {
    if (mode === 'matrix') this.panel.filters = [this.tint];
    else if (mode === 'blur') this.panel.filters = [new egret.BlurFilter(10, 10, egret.BitmapFilterQuality.MEDIUM)];
    else if (mode === 'glow')
      this.panel.filters = [
        new egret.GlowFilter(0xee8800, 0.8, 35, 35, 2, egret.BitmapFilterQuality.HIGH, false, false)
      ];
    else this.panel.filters = null;
  }
};
