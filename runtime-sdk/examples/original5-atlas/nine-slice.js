// SPDX-License-Identifier: Apache-2.0
// Both the original browser and the native player advance this exact scene by TOUCH_TAP.
globalThis.AtlasStation = class AtlasStation extends egret.DisplayObjectContainer {
  constructor() {
    super();
    this.turns = 0;
    this.ready = false;
    this.once(egret.Event.ADDED_TO_STAGE, this.open, this);
  }
  async open() {
    try {
      const background = new egret.Shape();
      background.graphics.beginFill(0x142638);
      background.graphics.drawRect(0, 0, 192, 128);
      background.graphics.endFill();
      this.addChild(background);
      await RES.loadConfig('assets/station.res.json', 'assets/');
      this.sheet = new egret.SpriteSheet(await RES.getResAsync('station'));
      this.first = this.sheet.createTexture('first', 0, 0, 8, 8);
      this.second = this.sheet.createTexture('second', 8, 0, 8, 8);
      this.panel = new egret.Bitmap(this.first);
      this.panel.smoothing = false;
      this.panel.x = 38;
      this.panel.y = 30;
      this.addChild(this.panel);
      const button = new egret.Shape();
      button.graphics.beginFill(0xffd800);
      button.graphics.drawRect(118, 84, 50, 28);
      button.graphics.endFill();
      button.touchEnabled = true;
      this.addChild(button);
      button.addEventListener(egret.TouchEvent.TOUCH_TAP, this.advance, this);
      this.ready = true;
      this.dispatchEventWith('stationChanged');
    } catch (error) {
      this.failure = String(error);
      this.dispatchEventWith('stationChanged');
    }
  }
  advance() {
    switch (++this.turns) {
      case 1:
        this.panel.scale9Grid = new egret.Rectangle(2, 2, 4, 4);
        this.panel.width = 44;
        this.panel.height = 32;
        break;
      case 2:
        this.panel.width = 3;
        this.panel.height = 3;
        break;
      case 3:
        this.panel.texture = this.second;
        this.panel.width = 44;
        this.panel.height = 32;
        break;
      case 4:
        this.panel.scale9Grid = null;
        this.panel.width = 8;
        this.panel.height = 8;
        break;
      case 5:
        // Disposal while still displayed must clear the visible GPU consumer.
        this.sheet.dispose();
        break;
    }
    this.dispatchEventWith('stationChanged');
  }
};
