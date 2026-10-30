import type { ContentGroup } from '@egret/engine/resources';
import type { SpriteSheet, SequenceClip, AssetLease, Texture } from '@egret/engine';
declare const group: ContentGroup;
const pages: readonly string[] = group.getAtlasPages('atlas');
const page: SpriteSheet = group.getAtlasPage('atlas', pages[0]!);
const oldAtlas: SpriteSheet = group.getAtlas('single');
const oldSequence: SequenceClip = group.getSequence('sequence');
const oldImage: AssetLease<Texture> = group.getImage('image');
void [page, oldAtlas, oldSequence, oldImage];
