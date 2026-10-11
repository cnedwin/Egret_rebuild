// Compile with the retained ES2022-only core configuration.
// MOUSE_INPUT_CASE no-core-html-canvas-global
declare const canvas:HTMLCanvasElement;
// MOUSE_INPUT_CASE no-core-pointer-global
declare const pointer:PointerEvent;
// MOUSE_INPUT_CASE no-core-window-global
declare const ownerWindow:Window;
// MOUSE_INPUT_CASE no-dom-free-root-input
import {createMouseInput} from '@egret/engine';
// MOUSE_INPUT_CASE no-dom-free-default-input
import type {MouseInputPayload} from '@egret/engine';
void canvas;void pointer;void ownerWindow;void createMouseInput;
