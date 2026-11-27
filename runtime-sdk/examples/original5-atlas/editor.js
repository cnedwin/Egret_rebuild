// SPDX-License-Identifier: Apache-2.0
// An original-engine field. The same class also runs in the reference browser.
globalThis.AtlasStation = class AtlasStation extends egret.DisplayObjectContainer {
  constructor() {
    super();
    this.turns = 0;
    this.addEventListener(egret.Event.ADDED_TO_STAGE, this.open, this);
  }
  open() {
    const field = new egret.TextField();
    field.type = egret.TextFieldType.INPUT;
    field.width = 140;
    field.height = 42;
    field.x = 18;
    field.y = 30;
    field.size = 20;
    field.text = '12';
    field.inputType = egret.TextFieldInputType.TEL;
    field.maxChars = 6;
    this.addChild(field);
    const stage = this;
    field.addEventListener(egret.Event.FOCUS_IN, function () { stage.focusCount++; stage.report(); }, this);
    field.addEventListener(egret.Event.FOCUS_OUT, function () { stage.blurCount++; stage.report(); }, this);
    field.addEventListener(egret.Event.CHANGE, function () { stage.turns++; stage.report(); }, this);
    this.field = field;
    this.focusCount = this.blurCount = 0;
    this.ready = true;
    this.report();
  }
  report() { this.dispatchEventWith('stationChanged'); }
};
