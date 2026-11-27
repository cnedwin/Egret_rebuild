// SPDX-License-Identifier: Apache-2.0
// Original 5.x game code. Both hosts load these exact bytes as a classic script.
globalThis.AtlasStation = class AtlasStation extends egret.DisplayObjectContainer {
  constructor() {
    super();
    this.ready = false;
    this.turns = Number(egret.localStorage.getItem('atlas-station.turns') || 0);
    this.once(egret.Event.ADDED_TO_STAGE, this.openStation, this);
  }

  async openStation() {
    try {
      const ground = new egret.Shape();
      ground.graphics.beginFill(0x142638);
      ground.graphics.drawRect(0, 0, 192, 128);
      ground.graphics.endFill();
      this.addChild(ground);
      await RES.loadConfig('assets/station.res.json', 'assets/');
      const sheet = new egret.SpriteSheet(await RES.getResAsync('station'));
      this.amber = sheet.createTexture('amber', 0, 0, 8, 8);
      this.aqua = sheet.createTexture('aqua', 8, 0, 8, 8);
      const rail = new eui.Group();
      rail.x = 30;
      rail.y = 28;
      this.addChild(rail);
      this.badge = new eui.Image();
      this.badge.width = 60;
      this.badge.height = 48;
      rail.addChild(this.badge);
      this.token = new eui.Image();
      this.token.width = 34;
      this.token.height = 32;
      this.token.y = 18;
      rail.addChild(this.token);
      this.control = new eui.Image(this.amber);
      this.control.x = 116;
      this.control.y = 86;
      this.control.width = 56;
      this.control.height = 28;
      this.label = new eui.Label();
      this.label.x = 10;
      this.label.y = 89;
      this.label.width = 98;
      this.label.height = 22;
      this.label.size = 14;
      this.label.fontFamily = 'sans-serif';
      this.addChild(this.label);
      this.control.touchEnabled = true;
      this.addChild(this.control);
      this.control.addEventListener(egret.TouchEvent.TOUCH_TAP, this.moveToken, this);
      const round = new egret.Shape();
      round.x = 163;
      round.y = 28;
      round.graphics.beginFill(0xd17dbd);
      round.graphics.drawCircle(0, 0, 12);
      round.graphics.endFill();
      round.touchEnabled = true;
      round.addEventListener(egret.TouchEvent.TOUCH_TAP, this.moveToken, this);
      this.addChild(round);
      this.ready = true;
      this.paint();
    } catch (error) {
      this.failure = String(error);
      this.dispatchEventWith('stationChanged');
    }
  }

  moveToken() {
    this.turns++;
    egret.localStorage.setItem('atlas-station.turns', String(this.turns));
    this.paint();
  }

  paint() {
    const odd = this.turns % 2 === 1;
    this.badge.source = odd ? this.amber : this.aqua;
    this.token.source = odd ? this.aqua : this.amber;
    this.token.x = odd ? 58 : 32;
    this.label.textFlow = [
      {text: '驿站', style: {textColor: 0xf3c342}},
      {text: ' ' + this.turns, style: {textColor: 0x64cce0}}
    ];
    this.dispatchEventWith('stationChanged');
  }
};
