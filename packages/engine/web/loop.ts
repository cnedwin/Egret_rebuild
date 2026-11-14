// SPDX-License-Identifier: Apache-2.0
// Optional browser frame loop entry keeps the display's frame callback out of the default Engine graph.
export { createBrowserFrameLoop } from './BrowserFrameLoop.js';
export type { BrowserFrameLoop, BrowserFrameLoopOptions, BrowserFrameLoopSnapshot, BrowserFrameLoopState, FrameLoopEngine, FrameLoopHost } from './BrowserFrameLoop.js';
