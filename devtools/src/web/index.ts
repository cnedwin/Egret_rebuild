// SPDX-License-Identifier: Apache-2.0
export { DEBUG_QUERY_PARAMETER, DEBUG_STORAGE_KEY, isDebugMode } from './debugMode.js';
export type { DebugModeEnvironment } from './debugMode.js';
export { attachPerformanceMonitor } from './overlay.js';
export type { AttachPerformanceMonitorOptions, MonitorCorner, MonitorTab, PerformanceMonitorHandle } from './overlay.js';
export { describeWebGLAdapter, recordWorld3DFrame, sharedHostSource, sharedWebGL2TimingSource, world3DSource } from './sources.js';
