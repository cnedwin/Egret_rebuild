// SPDX-License-Identifier: Apache-2.0
// Optional entry for a game in a page: one call that puts together what the Host, loop and input entries make, and a
// panel of what a frame takes.
export { createBrowserGame } from './BrowserGame.js';
export type {
  BrowserGame,
  BrowserGameAtlasLabel,
  BrowserGameBackend,
  BrowserGameFit,
  BrowserGameFrameUsage,
  BrowserGameLabel,
  BrowserGameLabelCreateOptions,
  BrowserGameLabelOptions,
  BrowserGameOptions,
  BrowserGameWarning
} from './BrowserGame.js';
export { createBrowserStatsPanel } from './BrowserStatsPanel.js';
export type {
  BrowserStatsPanel,
  BrowserStatsPanelOptions,
  BrowserStatsSample,
  BrowserStatsSnapshot
} from './BrowserStatsPanel.js';
