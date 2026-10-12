// First-party Apache-2.0 artifact admission probe, not an Egret adapter.
import { AnimationState, AnimationStateData, AtlasAttachmentLoader, Physics,
  Skeleton, SkeletonJson, SkeletonRendererCore, Texture, TextureAtlas,
  TextureFilter, TextureWrap } from '@esotericsoftware/spine-core';
import type { RenderCommand } from '@esotericsoftware/spine-core';

class OriginalPageTexture extends Texture {
  public constructor() { super(Object.freeze({ width: 16, height: 16 })); }
  public setFilters(min: TextureFilter, mag: TextureFilter): void {
    if (min !== TextureFilter.Nearest || mag !== TextureFilter.Nearest)
      throw new Error('Canonical fixture requires nearest sampling.');
  }
  public setWraps(u: TextureWrap, v: TextureWrap): void {
    if (u !== TextureWrap.ClampToEdge || v !== TextureWrap.ClampToEdge)
      throw new Error('Canonical fixture requires clamp wrapping.');
  }
  public dispose(): void { /* CPU dimension envelope owns no GPU resource. */ }
}

export function inspectCanonicalSpine(skeletonText: string, atlasText: string) {
  if (Skeleton.yDown !== false) throw new Error('Canonical Y-up precondition failed.');
  const texture = new OriginalPageTexture();
  const atlas = new TextureAtlas(atlasText);
  if (atlas.pages.length !== 1) throw new Error('Canonical page count failed.');
  const page = atlas.pages[0];
  if (page === undefined || page.name !== 'egret-original-page.png')
    throw new Error('Canonical page identity failed.');
  page.setTexture(texture);
  const data = new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(skeletonText);
  const mix = new AnimationStateData(data); mix.defaultMix = 0;
  function instance() {
    const skeleton = new Skeleton(data), state = new AnimationState(mix);
    const renderer = new SkeletonRendererCore();
    state.setAnimation(0, 'slide', false);
    state.apply(skeleton); skeleton.updateWorldTransform(Physics.none);
    return { skeleton, state, renderer };
  }
  const a = instance(), b = instance();
  let originalPositions: Float32Array | undefined;
  let firstOwnedPositions: number[] | undefined;
  function snapshot(actor: ReturnType<typeof instance>, time: number) {
    let command: RenderCommand | undefined = actor.renderer.render(actor.skeleton, false, undefined, 2);
    if (command === undefined) throw new Error('Canonical core returned no geometry.');
    const seen = new Set<RenderCommand>(), commands = [];
    while (command !== undefined) {
      if (seen.has(command) || seen.size >= 4) throw new Error('Canonical linked traversal failed.');
      seen.add(command);
      const actualTexture: unknown = command.texture;
      if (actualTexture !== texture) throw new Error('Canonical texture identity failed.');
      if (originalPositions === undefined) {
        originalPositions = command.positions;
        firstOwnedPositions = Array.from(command.positions.subarray(0, command.numVertices * 2));
      }
      commands.push({ numVertices: command.numVertices, numIndices: command.numIndices,
        positions: Array.from(command.positions.subarray(0, command.numVertices * 2)),
        uvs: Array.from(command.uvs.subarray(0, command.numVertices * 2)),
        colors: Array.from(command.colors.subarray(0, command.numVertices)),
        darkColors: Array.from(command.darkColors.subarray(0, command.numVertices)),
        indices: Array.from(command.indices.subarray(0, command.numIndices)), blendMode: command.blendMode });
      command = command.next;
    }
    return { time, commands };
  }
  const frames = [snapshot(a, 0)];
  for (let step = 1; step <= 4; step++) {
    a.skeleton.update(0.25); a.state.update(0.25); a.state.apply(a.skeleton);
    a.skeleton.updateWorldTransform(Physics.none);
    frames.push(snapshot(a, step * 0.25));
  }
  const independentB = snapshot(b, 0);
  const retainedPoolAfterAdvancement = originalPositions === undefined ? []
    : Array.from(originalPositions.subarray(0, firstOwnedPositions?.length ?? 0));
  texture.dispose();
  return { status: 'CANONICAL_CORE_PARSE_POSE_COMMANDS_OBSERVED', frames, independentB,
    initialOwnedPositions: firstOwnedPositions, retainedPoolAfterAdvancement,
    rendererAcceptance: 'not_run', egretAdapterAcceptance: 'not_run', distributionQualification: 'unverified' };
}
