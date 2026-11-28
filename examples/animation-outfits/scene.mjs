// SPDX-License-Identifier: Apache-2.0
// Public SDK composition; all rendering belongs to the single Engine scene.
import { Sprite } from '@egret/engine';
import { createSequenceController } from '@egret/engine/animation';
import { createSpineInstance, createSpineDisplay } from '@egret/spine';
import { counts } from './content.mjs';
// A committed CPU scene outlives any failed GPU submission. The caller releases a candidate
// only while its ticket still belongs to the preparation, even if retiring its predecessor threw.
export async function presentOutfitPair(pending, host, frameOptions, live) {
  const frame = pending.ticket.capture(frameOptions);
  pending.upload = host.stageSharedFrame(frame);
  const ready = await pending.upload.ready;
  const currentDevice = () => {
    const session = host.getSessionStatus();
    if (session.state !== 'ready' || session.generation !== ready.generation) throw Error('PAIR_DEVICE_CHANGED');
  };
  live();
  currentDevice();
  try {
    try {
      pending.ticket.commit();
    } finally {
      pending.committed = pending.ticket.committed;
    }
    currentDevice();
    const submission = pending.upload.submit();
    await submission.completed;
    await host.whenIdle();
  } catch (cause) {
    if (!pending.committed) throw cause;
    throw Object.assign(new Error('The new outfit pair is active; presenting it did not finish.', { cause }), {
      code: 'PAIR_POSTCOMMIT_FAILED'
    });
  }
}
export function createOutfitScene(engine, asset, sheet, clip) {
  const scope = engine.createScope(),
    players = [],
    sequences = [],
    events = [];
  const pairTarget = scope.use(new Sprite());
  let pairOwner = engine.createScope(),
    pairVersion = 'original',
    pendingPair;
  const firstPair = pairOwner.use(new Sprite());
  pairTarget.addChild(firstPair);
  let disposed = false;
  const record = event => {
    events.push(event);
    if (events.length > 80) events.shift();
  };
  // The last character and first spark of row zero are neighbors in painter order.
  // A single prepared subtree can replace those two without reordering the other 218 animations.
  function character(index, owner, source, container) {
    const player = createSpineInstance(source, owner, {
      maxSegments: 16,
      onEvent: event => record({ owner: index, ...event })
    });
    const display = createSpineDisplay(player, owner, { colorProfile: 'egret-shared-linear/1' });
    display.node.x = 64 + (index % 5) * 128;
    display.node.y = 55 + Math.floor(index / 5) * 96;
    container.addChild(display.node);
    player.setAnimation(0, 'sway', { loop: true });
    player.setRate(index % 2 === 0 ? 1 : 0.5);
    const subscription = engine.clock.onTick(owner, tick => {
      if (players[index]?.player === player) player.advance(tick);
    });
    return { owner, player, display, subscription };
  }
  function spark(index, owner, sourceSheet, sourceClip, container) {
    const bitmap = owner.use(sourceSheet.createBitmap('spark'));
    bitmap.x = 16 + (index % 50) * 12;
    bitmap.y = 83 + Math.floor(index / 50) * 96;
    bitmap.scaleX = bitmap.scaleY = 6;
    container.addChild(bitmap);
    const controller = createSequenceController(engine, owner, bitmap, sourceClip, {
      profile: 'egret.sequence-control/1',
      totalPlays: 'infinite',
      rate: index % 2 === 0 ? 1 : 2
    });
    return { owner, bitmap, controller };
  }
  try {
    const background = scope.use(new Sprite());
    background.graphics.beginFill(0x18243a).drawRect(0, 0, 640, 400).endFill();
    engine.stage.addChild(background);
    // Each row interleaves five Spine nodes, fifty sequence nodes, then an Engine rail.
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 5; col++) {
        const index = row * 5 + col;
        if (index === 4) engine.stage.addChild(pairTarget);
        const owner = index === 4 ? pairOwner : scope.use(engine.createScope());
        players.push(character(index, owner, asset, index === 4 ? firstPair : engine.stage));
      }
      for (let col = 0; col < 50; col++) {
        const index = row * 50 + col;
        const owner = index === 0 ? pairOwner : scope.use(engine.createScope());
        const entry = spark(index, owner, sheet, clip, index === 0 ? firstPair : engine.stage);
        entry.controller.start();
        sequences.push(entry);
      }
      const rail = scope.use(new Sprite());
      rail.graphics
        .beginFill(0x506580)
        .drawRect(12, 94 + row * 96, 616, 2)
        .endFill();
      engine.stage.addChild(rail);
    }
    if (players.length !== counts.spine || sequences.length !== counts.sequences) throw Error('SCENE_COUNTS');
  } catch (error) {
    pairOwner.dispose();
    scope.dispose();
    throw error;
  }
  const selected = index => {
    if (!Number.isInteger(index) || index < 0 || index >= players.length) throw Error('PLAYER_SELECTION');
    if (disposed) throw Error('SCENE_CLOSED');
    return players[index].player;
  };
  return Object.freeze({
    edit(index, { outfit, animation, plays, paused, rate } = {}) {
      const p = selected(index);
      if (outfit !== undefined) {
        if (!['default', 'cool-coat', 'warm-hat', 'both'].includes(outfit)) throw Error('OUTFIT');
        p.setSkins(
          outfit === 'default'
            ? ['default']
            : outfit === 'both'
              ? ['default', 'cool-coat', 'warm-hat']
              : ['default', outfit]
        );
      }
      if (animation !== undefined)
        p.setAnimation(0, animation, plays === 'infinite' ? { loop: true } : { plays: plays ?? 2 });
      if (paused !== undefined) p.setPaused(paused);
      if (rate !== undefined) p.setRate(rate);
    },
    // The caller transfers the resource scope. Until commit the live scene keeps both predecessors.
    preparePair(owner, source, sourceSheet, sourceClip, version) {
      if (disposed || pendingPair) throw Error('SCENE_PAIR_UNAVAILABLE');
      let tree,
        actor,
        effect,
        state = 'loading';
      const ticket = {
        get committed() {
          return state === 'committed';
        },
        capture(options) {
          if (state !== 'ready') throw Error('SCENE_PAIR_NOT_READY');
          const frame = engine.capturePreparedDisplaySharedFrame(tree, options);
          state = 'prepared';
          return frame;
        },
        commit() {
          if (state !== 'prepared') throw Error('SCENE_PAIR_NOT_PREPARED');
          tree.commit();
          const previous = pairOwner;
          pairOwner = owner;
          players[4] = actor;
          sequences[0] = effect;
          pairVersion = version;
          state = 'committed';
          pendingPair = undefined;
          // start() writes to the bitmap, so it follows publication of the staged geometry.
          try {
            effect.controller.start();
          } finally {
            previous.dispose();
          }
        },
        dispose() {
          if (state === 'committed' || state === 'discarded') return;
          state = 'discarded';
          if (pendingPair === ticket) pendingPair = undefined;
          owner.dispose();
        }
      };
      try {
        const layer = owner.use(new Sprite());
        actor = character(4, owner, source, layer);
        effect = spark(0, owner, sourceSheet, sourceClip, layer);
        tree = engine.prepareDisplaySubtree(owner, pairTarget, layer);
        state = 'ready';
        pendingPair = ticket;
        return ticket;
      } catch (cause) {
        ticket.dispose();
        throw cause;
      }
    },
    inspect() {
      return {
        disposed,
        pairVersion,
        counts: {
          spine: players.filter(p => !p.player.isDisposed).length,
          sequences: sequences.filter(s => !s.controller.getStatus().isDisposed).length
        },
        players: players.map(p => p.player.getSnapshot()),
        sequences: sequences.map(s => s.controller.getStatus()),
        events: [...events],
        ownership: {
          scope: scope.state,
          playerScopes: players.map(p => p.owner.state),
          sequenceScopes: sequences.map(s => s.owner.state),
          displaysDisposed: players.map(p => p.display.getStatus().isDisposed),
          bitmapsDisposed: sequences.map(s => s.bitmap.isDisposed),
          subscriptionsDisposed: players.map(p => p.subscription.isDisposed)
        }
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      pendingPair?.dispose();
      pairOwner.dispose();
      scope.dispose();
    }
  });
}
