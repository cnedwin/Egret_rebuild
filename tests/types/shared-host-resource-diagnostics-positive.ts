// SPDX-License-Identifier: Apache-2.0
import type { SharedHostResourceStatus as GPUResources, SharedWebGPUHost, WebGPUHostStatus } from '@egret/engine/webgpu';
import type { SharedHostResourceStatus as GLResources, SharedWebGL2Host } from '@egret/engine/webgl2';
type Equal<A,B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type SameBackends = Assert<Equal<GPUResources, GLResources>>;
type ExactKeys = Assert<Equal<keyof GPUResources, 'current' | 'highWater' | 'totals' | 'saturated'>>;
type LegacyStatus = Assert<Equal<Extract<keyof WebGPUHostStatus, 'resources'>, never>>;
declare const gpu: SharedWebGPUHost, gl: SharedWebGL2Host;
const snapshots: readonly GPUResources[] = [gpu.getSharedStatus().resources, gl.getSharedStatus().resources];
for (const snapshot of snapshots) {
  const pending: number = snapshot.current.pending.readbackCreditBytes;
  const cpu: number = snapshot.highWater.cpu.temporaryBytes;
  const ready: number = snapshot.current.images.pinnedReadyEntries;
  const leased: number = snapshot.current.reusable.leasedBytes;
  const unknown: number = snapshot.current.unknownNative.objects;
  const writes: number = snapshot.totals.pageWriteBytes;
  const saturated: boolean = snapshot.saturated;
  void [pending, cpu, ready, leased, unknown, writes, saturated];
}
void snapshots;
