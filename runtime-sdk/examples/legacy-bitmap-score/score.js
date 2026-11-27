// SPDX-License-Identifier: Apache-2.0
class ScoreBoard extends eui.Group {
  constructor() {
    super();
    this.width = 160;
    this.height = 90;
    this.addChild(new eui.Rect(160, 90, 0x183048));
    const face = this.addChild(new egret.Sprite());
    face.x = 10;
    face.y = 8;
    face.clipRect = { x: 0, y: 0, width: 23, height: 20 };
    this.caption = face.addChild(new eui.BitmapLabel('12'));
    this.caption.scaleX = this.caption.scaleY = 4;
    this.meter = this.addChild(new eui.ProgressBar());
    this.meter.x = 10;
    this.meter.y = 38;
    this.meter.slideDuration = 0;
    this.meter.maximum = 80;
    this.meter.thumb = this.meter.addChild(new eui.Rect(80, 10, 0x30e090));
    this.meter.value = 40;
    this.toggle = this.addChild(new eui.Rect(46, 24, 0xe08038));
    this.toggle.x = 94;
    this.toggle.y = 54;
    this.toggle.touchEnabled = true;
    this.toggle.addEventListener(egret.TouchEvent.TOUCH_TAP, () => this.switchFont(), this);
  }
  async start() {
    await RES.loadConfig('score-res.json', '');
    await RES.loadGroup('board');
    this.caption.font = 'digits';
    this.publish(1);
  }
  async switchFont() {
    if (this.phase === 1) {
      RES.destroyRes('digits');
      this.meter.direction = eui.Direction.RTL;
      this.publish(2);
    } else {
      const font = await RES.getResAsync('digits');
      this.caption.font = font;
      this.meter.direction = eui.Direction.LTR;
      this.publish(1);
    }
  }
  publish(phase) {
    this.phase = phase;
    globalThis.scoreObservation = {
      phase,
      text: this.caption.text,
      measured:[this.caption.width,this.caption.height],
      active: !!RES.getRes('digits'),
      children: this.caption.numChildren,
      clip: this.meter.thumb.clipRect
    };
  }
}
globalThis.ScoreBoard = ScoreBoard;
