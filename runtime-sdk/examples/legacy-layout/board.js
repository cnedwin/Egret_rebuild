// SPDX-License-Identifier: Apache-2.0
// The same original-style business code runs on both hosts.
class LayoutBoard extends egret.DisplayObjectContainer {
  constructor() {
    super();
    this.mode = 0;
    this.trace = [];
    const shape = (color, x, width) => {
      const display = new egret.Sprite();
      display.graphics.beginFill(color).drawRect(0, 0, width, 46).endFill();
      display.x = x;
      display.y = 8;
      return this.addChild(display);
    };
    shape(0x0000ff, 10, 96);
    this.light = shape(0xff0000, 48, 72);
    this.light.blendMode = egret.BlendMode.ADD;
    this.strip = new eui.Group();
    this.strip.x = 135;
    this.strip.y = 8;
    this.strip.width = 170;
    this.strip.height = 64;
    this.addChild(this.strip);
    this.lines = [new eui.HorizontalLayout(), new eui.VerticalLayout(), new eui.TileLayout()];
    this.lines[0].gap = 4;
    this.lines[1].gap = 3;
    this.lines[2].horizontalGap = 4;
    this.lines[2].verticalGap = 3;
    this.lines[2].requestedColumnCount = 2;
    this.strip.layout = this.lines[0];
    for (const color of [0xeed21b, 0x19c297, 0xfe7710]) this.strip.addChild(new eui.Rect(28, 16, color));

    const caption = this.addChild(new egret.TextField());
    caption.x = 12;
    caption.y = 68;
    caption.width = 280;
    caption.height = 28;
    caption.size = 20;
    caption.touchEnabled = true;
    const parser = new egret.HtmlTextParser();
    caption.textFlow = parser.parser(
      '<a href="event:open:gate"><font color="#18f570"><b>北门</b></font></a><font color="#ff9840">驿站</font>'
    );
    this.linkClicks = [];
    caption.addEventListener(
      egret.TextEvent.LINK,
      event => {
        this.linkClicks.push(event.text);
        this.observe();
      },
      this
    );

    const scroller = (this.scroller = new eui.Scroller());
    scroller.x = 12;
    scroller.y = 98;
    scroller.width = 130;
    scroller.height = 54;
    scroller.scrollPolicyH = eui.ScrollPolicy.AUTO;
    scroller.scrollPolicyV = eui.ScrollPolicy.OFF;
    const content = (this.content = new eui.Group());
    content.layout = new eui.HorizontalLayout();
    for (const color of [0xd0c080, 0x68483a, 0x4ab8d0, 0x30d090]) content.addChild(new eui.Rect(80, 48, color));
    scroller.viewport = content;
    this.addChild(scroller);
    scroller.addEventListener(eui.UIEvent.CHANGE_END, this.observe, this);

    this.button = new eui.Rect(94, 40, 0x20865e);
    this.button.x = 190;
    this.button.y = 112;
    this.addChild(this.button);
    this.button.addEventListener(egret.TouchEvent.TOUCH_TAP, this.advance, this);
    for (const [target, capture] of [
      [this, true],
      [this.button, false],
      [this, false]
    ]) {
      target.addEventListener(
        egret.TouchEvent.CHANGE,
        event => {
          this.trace.push([event.eventPhase, event.localX, event.touchPointID, event.target === this.button]);
        },
        this,
        capture
      );
    }
    this.addEventListener(egret.Event.ADDED_TO_STAGE, () => Promise.resolve().then(() => this.observe()), this);
  }

  async loadResources() {
    const image = await RES.getResByUrl('pin.png', null, null, RES.ResourceItem.TYPE_IMAGE);
    const caption = await RES.getResByUrl('caption.txt', null, null, RES.ResourceItem.TYPE_TEXT);
    const bytes = await RES.getResByUrl('palette.bin', null, null, RES.ResourceItem.TYPE_BIN);
    const marker = this.addChild(new egret.Bitmap(image));
    marker.x = 292;
    marker.y = 98;
    marker.width = marker.height = 16;
    this.boardName = RES.projectBoardName();
    this.resources = {
      width: image.textureWidth,
      height: image.textureHeight,
      caption: caption.trim(),
      bytes: Array.from(new Uint8Array(bytes))
    };
    this.observe();
  }

  advance() {
    this.mode = (this.mode + 1) % 3;
    this.light.blendMode = this.mode === 1 ? egret.BlendMode.NORMAL : egret.BlendMode.ADD;
    this.strip.layout = this.lines[this.mode];
    this.trace.length = 0;
    egret.TouchEvent.dispatchTouchEvent(this.button, egret.TouchEvent.CHANGE, true, false, 200, 119, 7, true);
    this.observe();
  }

  observe() {
    globalThis.layoutObservation = {
      boardName: this.boardName,
      linkClicks: this.linkClicks.slice(),
      host: {
        type: egret.Capabilities.runtimeType,
        os: egret.Capabilities.os,
        mobile: egret.Capabilities.isMobile,
        renderer: egret.Capabilities.renderMode,
        sameStage: egret.MainContext.instance.stage === this.stage,
        width: this.stage.stageWidth,
        height: this.stage.stageHeight,
        scale: this.stage.scaleMode,
        orientation: this.stage.orientation
      },
      mode: this.mode,
      blend: this.light.blendMode,
      resources: this.resources,
      scrollH: this.content.scrollH,
      scrollV: this.content.scrollV,
      tiles: Array.from({ length: this.strip.numChildren }, (_, index) => {
        const child = this.strip.getChildAt(index);
        return [child.x, child.y];
      }),
      trace: this.trace.slice()
    };
  }
}
globalThis.LayoutBoard = LayoutBoard;
