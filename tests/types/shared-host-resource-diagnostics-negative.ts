// SPDX-License-Identifier: Apache-2.0
// Unsuppressed refusals are frozen from actual compiler output after build.
import type { SharedHostResourceStatus, WebGPUHost } from '@egret/engine/webgpu';
import type { Engine } from '@egret/engine';
declare const status: SharedHostResourceStatus, ordinary: WebGPUHost, engine: Engine;
status.current.pending.frames = 0;
status.current.cpu.temporaryBytes = 0;
status.current.images.readyBytes = 0;
status.current.reusable.leasedEntries = 0;
status.current.unknownNative.objects = 0;
status.highWater.cpu.scratchBytes = 0;
status.totals.pageWriteCalls = 0;
status.saturated = false;
status.reset();
status.current.images.device;
ordinary.getStatus().resources;
engine.getResourceStatus();
const nativeObject: object = status.current.images.allocatedLogicalBytes;
void nativeObject;
