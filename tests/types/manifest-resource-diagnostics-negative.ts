// SPDX-License-Identifier: Apache-2.0
// Unsuppressed refusals. Root records actual compiler tuples after implementation.
import type { ManifestByteSourceStatus, ManifestTextureProviderStatus, ManifestTextureProvider, ManifestByteSource } from '@egret/engine/web/resources';
import type { BrowserTextureProvider } from '@egret/engine/web/image';
import type { ManifestByteSourceStatus as ForbiddenCoreStatus } from '@egret/engine'; // MDR-N01 optional types are not core exports.
declare const source:ManifestByteSource;
declare const provider:ManifestTextureProvider;
declare const ordinary:BrowserTextureProvider;
declare const s:ManifestByteSourceStatus;
declare const p:ManifestTextureProviderStatus;
// MDR-N02 ordinary providers do not gain the new method.
ordinary.getStatus();
// MDR-N03 the manifest subtype requires diagnostics.
const inventedSubtype:ManifestTextureProvider=ordinary;
// MDR-N04 source buckets are readonly.
s.current.jobs=1;
// MDR-N05 source maxima are readonly.
s.highWater.ownedEncodedBytes=0;
// MDR-N06 provider buckets are readonly.
p.current.activeDecodes=0;
// MDR-N07 provider maxima are readonly.
p.highWater.materializedCpuBytes=0;
// MDR-N08 the whole snapshot is readonly.
s.current=s.highWater;
// MDR-N09 saturation cannot be reset.
p.saturated=false;
// MDR-N10 no counter reset argument.
source.getStatus({reset:true});
// MDR-N11 no callback observation argument.
provider.getStatus(()=>{});
// MDR-N12 no events, refs or identity ledger.
s.current.refs;
// MDR-N13 numeric values do not reveal native objects.
p.current.bitmapLogicalBytes.close();
// MDR-N14 no unbounded event history.
p.events;
// MDR-N15 saturation is a Boolean, not a numeric byte counter.
const byteCount:number=s.saturated;
// MDR-N16 a synchronous immutable status is not a Promise.
const asyncStatus:Promise<ManifestTextureProviderStatus>=provider.getStatus();
