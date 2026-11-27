// SPDX-License-Identifier: Apache-2.0
// Authored fixture that runs on both the original stock player and the converted runtime.
globalThis.EditorBoard = class EditorBoard extends egret.DisplayObjectContainer {
  constructor() {
    super();
    const field = new eui.EditableText();
    field.x = 24;
    field.y = 25;
    field.width = 150;
    field.height = 46;
    field.size = 28;
    field.textColor = 0xffffff;
    field.text = '1';
    field.restrict = '0-9';
    field.maxChars = 3;
    field.inputType = egret.TextFieldInputType.TEL;
    this.addChild(field);
    this.quantity = field;
    this.trace = [];
    for (const type of [egret.FocusEvent.FOCUS_IN, egret.FocusEvent.CHANGE, egret.TextEvent.FOCUS_OUT]) {
      this.addEventListener(
        type,
        event => {
          this.trace.push({
            type: event.type,
            value: field.text,
            target: event.target === field,
            bubbles: event.bubbles
          });
        },
        this
      );
    }
    globalThis.editorBoard = this;
  }
};
