import { Bitmap, createAssetRef, createAssetType } from '@egret/engine';
import type { AssetGroup, AssetGroupOptions, AssetGroupState, AssetLease, AssetRef, Engine, Scope, Texture } from '@egret/engine';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;
type ExactFactory = Expect<Equal<Engine['createAssetGroup'], <T>(scope: Scope, refs: readonly AssetRef<T>[], options?: AssetGroupOptions) => AssetGroup<T>>>;
declare const engine: Engine;
declare const scope: Scope;
declare const textureRef: AssetRef<Texture>;
const numbers = createAssetType('RG1 positive', (value): value is number => typeof value === 'number');
const ref: AssetRef<number> = createAssetRef(numbers, 'number');
const options: AssetGroupOptions = { concurrency: 4 };
const group: AssetGroup<number> = engine.createAssetGroup(scope, [ref, ref], options);
const empty: AssetGroup<number> = engine.createAssetGroup<number>(scope, []);
const state: AssetGroupState = group.state;
const readiness: Promise<readonly AssetLease<number>[]> = group.ready;
async function borrow(): Promise<void> {
  const textures: AssetGroup<Texture> = engine.createAssetGroup(scope, [textureRef]);
  const leases = await textures.ready;
  const bitmap = scope.use(new Bitmap(leases[0]!));
  engine.stage.addChild(bitmap);
  textures.dispose();
}
void group; void empty; void state; void readiness; void borrow;
export type { ExactFactory };
