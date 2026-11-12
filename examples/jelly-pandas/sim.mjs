// SPDX-License-Identifier: Apache-2.0
// The game simulation. It needs no page: pandas walk on the engine's physics
// world, candy enemies follow a lighter model of their own on the same
// island, and everything the screen should show or play is queued in
// `events`. The screen reads this state each frame and never changes it.
import { createCharacterMotor3D, createConvexHullShape3D, createCylinderGeometry3D, createMeshShape3D, createPhysicsWorld3D } from '@egret/engine/world3d';
import { BOSSES, CHARMS, CHARM_BY_KEY, ENEMIES, RUN, SKINS, TOYS, TOY_BY_KEY, experienceFor } from './data.mjs';
import { ISLAND, clampToLand, createIslandGeometry, groundHeight, isWater } from './island.mjs';
import { fireToy, updateShots, updateToyState } from './toys.mjs';

const GRAVITY = 24, PANDA_RADIUS = 0.62, PANDA_HEIGHT = 1.7;
const CELL = 3, GRID = 40, GRID_HALF = CELL * GRID / 2;

/** Small seeded generator so a run can be replayed. */
function createRandom(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function createGame(options = {}) {
  const random = createRandom(options.seed ?? 20261112);
  const world = createPhysicsWorld3D({ gravity: [0, -GRAVITY, 0] });
  const islandGeometry = options.islandGeometry ?? createIslandGeometry();
  world.createBody({ type: 'static', shape: { type: 'mesh', mesh: createMeshShape3D(islandGeometry) }, friction: 0.9 });

  const game = {
    random, world, islandGeometry,
    t: 0, state: 'play', level: 1, xp: 0, xpNeed: 0, kills: 0,
    pandas: [], enemies: [], shots: [], bullets: [], gems: [], pickups: [], props: [], events: [],
    boss: undefined, bossIndex: 0, bossWarned: -1, nextElite: RUN.firstElite, nextSurge: RUN.firstSurge, surgeUntil: 0, spawnDebt: 0,
    nextId: 1, damageDealt: 0,
  };

  // ---- spatial grid over the enemies, rebuilt every step -----------------------------
  const cellHead = new Int32Array(GRID * GRID), cellNext = new Int32Array(1024);
  let gridNext = cellNext;
  const cellOf = (v) => Math.min(GRID - 1, Math.max(0, Math.floor((v + GRID_HALF) / CELL)));
  function rebuildGrid() {
    const list = game.enemies;
    if (list.length > gridNext.length) gridNext = new Int32Array(list.length * 2);
    cellHead.fill(-1);
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.dead) continue;
      const c = cellOf(e.z) * GRID + cellOf(e.x);
      gridNext[i] = cellHead[c]; cellHead[c] = i;
    }
  }
  /** Call `visit(enemy, distance)` for every living enemy whose centre lies within `radius` plus its own radius. */
  game.eachEnemyNear = (x, z, radius, visit) => {
    const list = game.enemies, reach = radius + 3.4;
    const x0 = cellOf(x - reach), x1 = cellOf(x + reach), z0 = cellOf(z - reach), z1 = cellOf(z + reach);
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
      for (let i = cellHead[cz * GRID + cx]; i >= 0; i = gridNext[i]) {
        const e = list[i];
        if (!e || e.dead) continue;
        const d = Math.hypot(e.x - x, e.z - z);
        if (d <= radius + e.r) visit(e, d);
      }
    }
  };
  game.nearestEnemy = (x, z, maxDistance = 60, skip) => {
    let best, bestD = maxDistance;
    for (const e of game.enemies) {
      if (e.dead || e.trapped || e === skip) continue;
      const d = Math.hypot(e.x - x, e.z - z) - e.r;
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  };
  /** A point where enemies stand thickest, found by sampling a few of them. */
  game.densestPoint = (x, z, maxDistance) => {
    const list = game.enemies;
    let best, bestScore = -1;
    for (let k = 0; k < 14 && list.length; k++) {
      const e = list[(random() * list.length) | 0];
      if (e.dead || Math.hypot(e.x - x, e.z - z) > maxDistance) continue;
      let score = e.boss ? 6 : 0;
      game.eachEnemyNear(e.x, e.z, 3.5, () => { score++; });
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return best ?? game.nearestEnemy(x, z, maxDistance);
  };
  const emit = (type, x, y, z, more) => { if (game.events.length < 400) game.events.push({ type, x, y, z, ...more }); };
  game.emit = emit;

  // ---- pandas ---------------------------------------------------------------------
  const party = options.party ?? [{ skin: 0, human: true }];
  // A bigger party squashes more candy, so each shared level costs more.
  const needFor = (level) => Math.round(experienceFor(level) * (1 + (party.length - 1) * 0.5));
  game.xpNeed = needFor(1);
  party.forEach((member, index) => {
    const angle = index / party.length * Math.PI * 2, x = Math.cos(angle) * (party.length > 1 ? 2 : 0), z = Math.sin(angle) * (party.length > 1 ? 2 : 0);
    const motor = createCharacterMotor3D(world, { radius: PANDA_RADIUS, height: PANDA_HEIGHT, position: [x, groundHeight(x, z) + PANDA_HEIGHT / 2 + 0.3, z], jumpSpeed: 8.5, gravity: GRAVITY, acceleration: 70, airControl: 0.35, pushForce: 30, stepHeight: 0.35 });
    const skin = SKINS[member.skin % SKINS.length];
    const panda = {
      index, human: !!member.human, skin: member.skin % SKINS.length, motor,
      x, y: 0, z, facing: 0, headingX: 0, headingZ: -1, speedNow: 0,
      hp: 100, maxHp: 100, toys: [], charms: new Map(), stats: {},
      iframe: 0, down: false, revive: 0, bumpT: 0, bumpCd: 0, stamina: 2.5, rolling: false,
      slamming: false, grounded: true, peakY: 0, charge: 0, jumpHeld: false, hurtFlash: 0,
      pendingPicks: 0, offer: undefined, rerolls: 3, kills: 0, brain: { t: 0, x: 0, z: 0, hop: 0 },
    };
    game.pandas.push(panda);
    refreshStats(panda);
    addToy(panda, TOY_BY_KEY[skin.start]);
  });

  function refreshStats(panda) {
    const s = { maxHp: 0, regen: 0, might: 0, haste: 0, area: 0, duration: 0, speed: 0, magnet: 0, growth: 0, armor: 0, luck: 0, knock: 0 };
    for (const [id, level] of panda.charms) s[CHARMS[id].stat] += CHARMS[id].per * level;
    panda.stats = s;
    const maxHp = Math.round(100 * (1 + s.maxHp));
    if (maxHp !== panda.maxHp) { panda.hp += maxHp - panda.maxHp; panda.maxHp = maxHp; }
    for (const toy of panda.toys) refreshToy(panda, toy);
  }
  function refreshToy(panda, toy) {
    const def = TOYS[toy.id], s = { ...def.base }, stats = panda.stats;
    for (let i = 0; i < toy.level - 1; i++) for (const [key, value] of Object.entries(def.levels[i])) s[key] = (s[key] ?? 0) + value;
    s.damage *= (1 + stats.might) * (toy.evo ? 1.5 : 1);
    if (s.cooldown) s.cooldown = Math.max(0.25, s.cooldown * (1 - Math.min(0.6, stats.haste)));
    s.area = (s.area ?? 1) * (1 + stats.area);
    if (s.duration) s.duration *= 1 + stats.duration;
    s.knock = (s.knock ?? 0) * (1 + stats.knock);
    toy.s = s;
  }
  function addToy(panda, id) {
    const toy = { id, key: TOYS[id].key, level: 1, evo: false, cd: 0.6, s: undefined, angle: 0, active: 0, tick: 0, hits: new Map() };
    panda.toys.push(toy);
    refreshToy(panda, toy);
    return toy;
  }

  // ---- upgrade cards ----------------------------------------------------------------
  function makeOffer(panda) {
    const pool = [];
    for (const toy of panda.toys) {
      const def = TOYS[toy.id];
      if (toy.level < RUN.maxToyLevel) pool.push({ type: 'toy', id: toy.id, level: toy.level + 1, weight: 1.3 });
      else if (!toy.evo && panda.charms.has(CHARM_BY_KEY[def.charm])) pool.push({ type: 'evo', id: toy.id, weight: 50 });
    }
    for (const [id, level] of panda.charms) if (level < RUN.maxCharmLevel) pool.push({ type: 'charm', id, level: level + 1, weight: 1.1 });
    if (panda.toys.length < RUN.toySlots) TOYS.forEach((def, id) => { if (!panda.toys.some((toy) => toy.id === id)) pool.push({ type: 'toy', id, level: 1, weight: 1 }); });
    if (panda.charms.size < RUN.charmSlots) CHARMS.forEach((def, id) => {
      if (panda.charms.has(id)) return;
      // A charm that unlocks an evolution for a toy already owned is offered more often.
      const useful = panda.toys.some((toy) => TOYS[toy.id].charm === def.key);
      pool.push({ type: 'charm', id, level: 1, weight: useful ? 1.6 : 0.8 });
    });
    const cards = [];
    while (cards.length < 3 && pool.length) {
      let total = 0;
      for (const card of pool) total += card.weight;
      let roll = random() * total, pick = 0;
      for (; pick < pool.length - 1; pick++) { roll -= pool[pick].weight; if (roll <= 0) break; }
      cards.push(pool.splice(pick, 1)[0]);
    }
    if (cards.length < 3) cards.push({ type: 'heal' });
    if (cards.length < 3) cards.push({ type: 'bonus' });
    return cards;
  }
  function applyCard(panda, card) {
    if (card.type === 'toy') {
      const owned = panda.toys.find((toy) => toy.id === card.id);
      if (owned) { owned.level = Math.min(RUN.maxToyLevel, owned.level + 1); refreshToy(panda, owned); } else addToy(panda, card.id);
    } else if (card.type === 'evo') {
      const toy = panda.toys.find((entry) => entry.id === card.id);
      if (toy) { toy.evo = true; refreshToy(panda, toy); emit('evolve', panda.x, panda.y + 1, panda.z, { panda: panda.index, toy: toy.id }); }
    } else if (card.type === 'charm') {
      panda.charms.set(card.id, Math.min(RUN.maxCharmLevel, (panda.charms.get(card.id) ?? 0) + 1));
      refreshStats(panda);
    } else if (card.type === 'heal') panda.hp = Math.min(panda.maxHp, panda.hp + panda.maxHp * 0.3);
    else if (card.type === 'bonus') addExperience(game.xpNeed * 0.5);
  }
  /** Take card `index` of the panda's current offer. */
  game.choose = (pandaIndex, index) => {
    const panda = game.pandas[pandaIndex];
    if (!panda?.offer || !panda.offer[index]) return false;
    applyCard(panda, panda.offer[index]);
    panda.offer = undefined; panda.pendingPicks--;
    if (panda.pendingPicks > 0) panda.offer = makeOffer(panda);
    return true;
  };
  game.reroll = (pandaIndex) => {
    const panda = game.pandas[pandaIndex];
    if (!panda?.offer || panda.rerolls <= 0) return false;
    panda.rerolls--; panda.offer = makeOffer(panda);
    return true;
  };
  /** True while the human player has cards to pick; the run waits for the choice. */
  game.waitingForChoice = () => game.pandas.some((panda) => panda.human && panda.offer);
  function grantPick(panda) {
    panda.pendingPicks++;
    if (!panda.offer) panda.offer = makeOffer(panda);
    // Friends choose at once: evolutions first, then whatever they already own.
    if (!panda.human) {
      while (panda.offer) {
        const cards = panda.offer;
        let pick = cards.findIndex((card) => card.type === 'evo');
        if (pick < 0) pick = cards.findIndex((card) => card.type === 'toy' && card.level > 1);
        if (pick < 0) pick = (random() * cards.length) | 0;
        game.choose(panda.index, pick);
      }
    }
  }
  function addExperience(amount) {
    game.xp += amount;
    while (game.xp >= game.xpNeed && game.state === 'play') {
      game.xp -= game.xpNeed; game.level++; game.xpNeed = needFor(game.level);
      for (const panda of game.pandas) { grantPick(panda); if (!panda.down) emit('levelup', panda.x, panda.y, panda.z, { panda: panda.index }); }
    }
  }
  game.addExperience = addExperience;

  // ---- enemies ----------------------------------------------------------------------
  function spawnEnemy(kind, x, z, more = {}) {
    const def = more.boss ?? ENEMIES[kind], scale = 1 + game.t / 60 * 0.32 + (game.pandas.length - 1) * 0.4;
    const elite = !!more.elite, hp = def.hp * (more.boss ? 1 + (game.pandas.length - 1) * 1.5 : scale * (elite ? 14 : 1));
    const enemy = {
      id: game.nextId++, kind, def, boss: more.boss, elite,
      x, y: more.y ?? groundHeight(x, z), z, vx: 0, vy: more.vy ?? 0, vz: 0,
      hp, maxHp: hp, r: def.radius * (elite ? 1.7 : 1), mass: def.mass * (elite ? 4 : 1), speed: def.speed * (0.9 + random() * 0.2), touch: def.touch * (1 + game.t / 900 * 0.8) * (elite ? 1.6 : 1),
      air: !!more.vy, stun: 0, slow: 0, attackCd: 0.4, flash: 0, dead: false, trapped: undefined,
      target: undefined, retarget: random() * 0.5, phase: random() * 6.28, timer: 2 + random() * 3, mode: 0, modeT: 0, dirX: 0, dirZ: 0, lastHitBy: undefined,
      propT: 0, rollT: 0, yaw: 0, summoned: false,
    };
    game.enemies.push(enemy);
    return enemy;
  }
  game.spawnEnemy = spawnEnemy;

  /** Hurt an enemy; `kx`, `kz` push it along the ground and `up` throws it into the air. */
  game.damage = (enemy, amount, panda, kx = 0, kz = 0, up = 0) => {
    if (enemy.dead || !(amount >= 0)) return;
    let crit = false;
    if (panda && random() < panda.stats.luck) { amount *= 2; crit = true; }
    enemy.hp -= amount; enemy.flash = 0.14; enemy.lastHitBy = panda;
    game.damageDealt += amount;
    if (amount >= 1) emit('hit', enemy.x, enemy.y + enemy.r * 1.6, enemy.z, { amount: Math.round(amount), crit });
    const weight = enemy.mass;
    enemy.vx += kx / weight; enemy.vz += kz / weight;
    if (up > 0 && !enemy.boss && !enemy.trapped) { enemy.vy = Math.max(enemy.vy, up / Math.sqrt(weight)); enemy.air = true; }
    if (enemy.hp <= 0) kill(enemy, panda);
  };
  function kill(enemy, panda, quiet = false) {
    if (enemy.dead) return;
    enemy.dead = true; game.kills++;
    if (panda) panda.kills++;
    if (enemy.trapped) { const held = enemy.trapped.held; held.splice(held.indexOf(enemy), 1); enemy.trapped = undefined; }
    const def = enemy.def;
    emit('death', enemy.x, enemy.y + enemy.r, enemy.z, { color: def.color, radius: enemy.r, boss: !!enemy.boss });
    if (enemy.boss) {
      for (let i = 0; i < 40; i++) dropGem(enemy.x + (random() - 0.5) * 8, enemy.z + (random() - 0.5) * 8, 5);
      game.pickups.push({ kind: 'chest', x: enemy.x, y: enemy.y, z: enemy.z, t: 0 });
      game.boss = undefined;
      emit('announce', 0, 0, 0, { key: 'bossDown', name: def });
      if (game.bossIndex >= BOSSES.length && enemy.final) { game.state = 'won'; emit('won', enemy.x, enemy.y, enemy.z); }
      return;
    }
    if (!quiet) dropGem(enemy.x, enemy.z, def.gem * (enemy.elite ? 12 : 1));
    if (enemy.elite) game.pickups.push({ kind: 'chest', x: enemy.x, y: enemy.y, z: enemy.z, t: 0 });
    else if (random() < 0.004 && game.pickups.length < 12) game.pickups.push({ kind: 'heart', x: enemy.x, y: enemy.y, z: enemy.z, t: 0 });
    if (def.split && !enemy.summoned) for (let i = 0; i < 2; i++) { const child = spawnEnemy(1, enemy.x + (random() - 0.5), enemy.z + (random() - 0.5), { vy: 6, y: enemy.y + 0.5 }); child.summoned = true; child.vx = (random() - 0.5) * 6; child.vz = (random() - 0.5) * 6; }
  }
  function dropGem(x, z, value) {
    if (isWater(x, z)) { addExperience(value * 0.5); return; }
    // Past a few hundred loose gems the oldest merge into the new one.
    if (game.gems.length > 500) { const old = game.gems.shift(); value += old.value; }
    game.gems.push({ x, y: groundHeight(x, z) + 0.35, z, value, pull: undefined, t: random() * 6 });
  }

  function hurt(panda, amount, fromX, fromZ, shove = 0) {
    if (panda.down || panda.iframe > 0 || game.state !== 'play') return false;
    amount *= 1 - Math.min(0.6, panda.stats.armor);
    panda.hp -= amount; panda.iframe = 0.5; panda.hurtFlash = 0.3;
    emit('hurt', panda.x, panda.y + 1, panda.z, { panda: panda.index, amount: Math.round(amount) });
    if (shove > 0) {
      const dx = panda.x - fromX, dz = panda.z - fromZ, d = Math.hypot(dx, dz) || 1, v = panda.motor.velocity;
      v[0] += dx / d * shove; v[2] += dz / d * shove; v[1] = Math.max(v[1], shove * 0.45);
    }
    if (panda.hp <= 0) {
      panda.hp = 0; panda.down = true; panda.revive = 0; panda.offer = undefined;
      // A panda that falls in the water washes ashore, where friends can reach it.
      if (isWater(panda.x, panda.z)) {
        const r = Math.hypot(panda.x, panda.z) || 1, k = Math.min(1, (ISLAND.playRadius - 3) / r), x = panda.x * k, z = panda.z * k;
        panda.motor.teleport(x, groundHeight(x, z) + PANDA_HEIGHT / 2 + 0.2, z);
        syncPanda(panda);
      }
      emit('down', panda.x, panda.y, panda.z, { panda: panda.index });
      if (game.pandas.every((other) => other.down)) { game.state = 'lost'; emit('lost', panda.x, panda.y, panda.z); }
    }
    return true;
  }
  game.hurt = hurt;

  /** Shove loose props away from a point. */
  game.pushProps = (x, z, radius, impulse, lift = 0) => {
    for (const prop of game.props) {
      const p = prop.body.position, dx = p[0] - x, dz = p[2] - z, d = Math.hypot(dx, dz);
      if (d > radius + prop.r) continue;
      const k = impulse * prop.body.mass / (d || 1);
      prop.body.wake(); prop.body.applyImpulse(dx * k, lift * prop.body.mass, dz * k);
    }
  };

  // ---- props: beach balls and barrels on the engine's rigid bodies ----------------------
  const barrelHull = createConvexHullShape3D(createCylinderGeometry3D({ radiusTop: 0.62, radiusBottom: 0.62, height: 1.25, radialSegments: 10 }));
  for (let i = 0; i < 12; i++) {
    const ball = i % 2 === 0, angle = i / 12 * Math.PI * 2 + 0.4, reach = 9 + (i % 4) * 6, x = Math.cos(angle) * reach, z = Math.sin(angle) * reach;
    const body = world.createBody(ball
      ? { shape: { type: 'sphere', radius: 0.95 }, position: [x, groundHeight(x, z) + 1.2, z], mass: 0.7, restitution: 0.75, friction: 0.5, linearDamping: 0.25, angularDamping: 0.3 }
      : { shape: { type: 'convex', hull: barrelHull }, position: [x, groundHeight(x, z) + 1, z], quaternion: [Math.SQRT1_2, 0, 0, Math.SQRT1_2], mass: 3, restitution: 0.2, friction: 0.6, linearDamping: 0.15, angularDamping: 0.2 });
    game.props.push({ kind: ball ? 'ball' : 'barrel', body, r: ball ? 0.95 : 0.75, color: i });
  }
  function updateProps(dt) {
    for (const prop of game.props) {
      const body = prop.body, p = body.position, v = body.linearVelocity, speed = Math.hypot(v[0], v[2]);
      if (p[1] < ISLAND.sea - 2 || Math.hypot(p[0], p[2]) > ISLAND.half) {
        // Washed away: a fresh one drops from the sky somewhere on the island.
        const angle = random() * 6.28, reach = 6 + random() * 22, x = Math.cos(angle) * reach, z = Math.sin(angle) * reach;
        emit('splash', p[0], ISLAND.sea, p[2], { radius: 1.5 });
        body.setPosition(x, groundHeight(x, z) + 14, z); body.setLinearVelocity(0, 0, 0); body.setAngularVelocity(0, 0, 0); body.wake();
        continue;
      }
      if (speed < 3.2) continue;
      const power = speed * (prop.kind === 'barrel' ? 2.4 : 1);
      let struck = 0;
      game.eachEnemyNear(p[0], p[2], prop.r + 0.2, (enemy) => {
        if (enemy.propT > game.t || Math.abs(enemy.y - (p[1] - prop.r)) > 2.2) return;
        enemy.propT = game.t + 0.5; struck++;
        game.damage(enemy, power * 1.6 + game.level, prop.owner, v[0] * 0.9, v[2] * 0.9, 5 + speed * 0.3);
      });
      if (struck) { body.setLinearVelocity(v[0] * 0.86, v[1], v[2] * 0.86); emit('thud', p[0], p[1], p[2], { power }); }
    }
  }

  // ---- the horde ----------------------------------------------------------------------
  function spawnPoint(out) {
    const living = game.pandas.filter((panda) => !panda.down), near = living[(random() * living.length) | 0] ?? game.pandas[0];
    for (let attempt = 0; attempt < 8; attempt++) {
      const angle = random() * Math.PI * 2, reach = 17 + random() * 9;
      out[0] = near.x + Math.cos(angle) * reach; out[2] = near.z + Math.sin(angle) * reach;
      clampToLand(out, ISLAND.playRadius + 1.5);
      // Never right on top of a panda.
      if (game.pandas.every((panda) => Math.hypot(panda.x - out[0], panda.z - out[2]) > 11)) break;
    }
    return out;
  }
  const point = [0, 0, 0];
  function pickKind() {
    let total = 0;
    for (const def of ENEMIES) if (game.t >= def.from) total += def.weight * (game.t - def.from < 60 ? 1.6 : 1);
    let roll = random() * total;
    for (let i = 0; i < ENEMIES.length; i++) {
      const def = ENEMIES[i];
      if (game.t < def.from) continue;
      roll -= def.weight * (game.t - def.from < 60 ? 1.6 : 1);
      if (roll <= 0) return i;
    }
    return 0;
  }
  function updateSpawner(dt) {
    const t = game.t, size = game.pandas.length;
    if (game.bossIndex < BOSSES.length) {
      const due = RUN.bossTimes[game.bossIndex];
      if (t >= due - 10 && game.bossWarned < game.bossIndex) { game.bossWarned = game.bossIndex; emit('announce', 0, 0, 0, { key: 'bossIncoming', name: BOSSES[game.bossIndex] }); }
      if (t >= due) {
        spawnPoint(point);
        const boss = spawnEnemy(-1, point[0], point[2], { boss: BOSSES[game.bossIndex], vy: 1, y: groundHeight(point[0], point[2]) + 16 });
        boss.final = game.bossIndex === BOSSES.length - 1;
        game.boss = boss; game.bossIndex++;
        emit('bossSpawn', boss.x, boss.y, boss.z, { name: boss.def });
      }
    }
    if (t >= game.nextSurge) { game.nextSurge += RUN.surgeEvery; game.surgeUntil = t + RUN.surgeSeconds; emit('announce', 0, 0, 0, { key: 'surge' }); }
    if (t >= game.nextElite) {
      game.nextElite += RUN.eliteEvery;
      spawnPoint(point);
      spawnEnemy(pickKind(), point[0], point[2], { elite: true });
      emit('announce', 0, 0, 0, { key: 'elite' });
    }
    let wanted = (12 + t / 60 * 12 + Math.pow(t / 60, 1.5) * 2) * (1 + (size - 1) * 0.7);
    if (t < game.surgeUntil) wanted *= 1.6;
    if (game.boss) wanted *= 0.55;
    wanted = Math.min(wanted, RUN.maxEnemies);
    let alive = 0;
    for (const enemy of game.enemies) if (!enemy.dead) alive++;
    if (alive >= wanted) return;
    game.spawnDebt += (3 + (wanted - alive) * 0.8) * dt;
    let count = Math.min(20, Math.floor(game.spawnDebt));
    game.spawnDebt -= count;
    while (count > 0) {
      // Candy arrives in small clumps.
      spawnPoint(point);
      const kind = pickKind(), clump = Math.min(count, 1 + ((random() * 4) | 0));
      for (let i = 0; i < clump; i++) spawnEnemy(kind, point[0] + (random() - 0.5) * 3, point[2] + (random() - 0.5) * 3);
      count -= clump;
    }
  }

  function updateBoss(enemy, dt, target) {
    const def = enemy.def, dx = target.x - enemy.x, dz = target.z - enemy.z, d = Math.hypot(dx, dz) || 1;
    enemy.timer -= dt;
    if (enemy.mode === 1) {            // winding up a charge
      enemy.modeT -= dt;
      if (enemy.modeT <= 0) { enemy.mode = 2; enemy.modeT = 1.7; enemy.dirX = dx / d; enemy.dirZ = dz / d; }
      return 0;
    }
    if (enemy.mode === 2) {            // charging in a straight line
      enemy.modeT -= dt;
      enemy.x += enemy.dirX * 16 * dt; enemy.z += enemy.dirZ * 16 * dt;
      if (enemy.modeT <= 0 || isWater(enemy.x, enemy.z)) {
        enemy.mode = 0;
        const r = Math.hypot(enemy.x, enemy.z);
        if (r > ISLAND.playRadius) { enemy.x *= ISLAND.playRadius / r; enemy.z *= ISLAND.playRadius / r; }
      }
      return 0;
    }
    if (enemy.timer <= 0 && !enemy.air) {
      const attack = def.attack === 'volley' ? (enemy.phase++ % 3 === 2 ? 'hop' : 'volley') : def.attack;
      if (attack === 'hop') {
        // Leap at the target; the landing sends out a ring that a jump clears.
        const flight = 1.1, reach = Math.min(d, 14);
        enemy.vx = dx / d * reach / flight; enemy.vz = dz / d * reach / flight; enemy.vy = GRAVITY * flight / 2; enemy.air = true; enemy.leap = true;
        enemy.timer = 3.4;
      } else if (attack === 'charge') {
        enemy.mode = 1; enemy.modeT = 0.9; enemy.timer = 5.5;
        emit('telegraph', enemy.x, enemy.y, enemy.z, { boss: true });
        for (let i = 0; i < 4; i++) { const minion = spawnEnemy(1, enemy.x + (random() - 0.5) * 4, enemy.z + (random() - 0.5) * 4); minion.summoned = true; }
      } else {
        const count = 12, turn = random() * 6.28;
        for (let i = 0; i < count; i++) { const a = turn + i / count * Math.PI * 2; game.bullets.push({ x: enemy.x, y: enemy.y + 1.2, z: enemy.z, vx: Math.cos(a) * 9, vz: Math.sin(a) * 9, t: 4, damage: def.touch * 0.7 }); }
        emit('volley', enemy.x, enemy.y + 1.5, enemy.z);
        enemy.timer = 2.6;
        if (enemy.hp < enemy.maxHp * 0.5 && random() < 0.5) for (let i = 0; i < 3; i++) { const minion = spawnEnemy(3, enemy.x + (random() - 0.5) * 6, enemy.z + (random() - 0.5) * 6); minion.summoned = true; }
      }
    }
    return 1;
  }

  function updateEnemies(dt) {
    const list = game.enemies, pandas = game.pandas;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.dead) continue;
      if (e.flash > 0) e.flash -= dt;
      if (e.attackCd > 0) e.attackCd -= dt;
      if (e.slow > 0) e.slow -= dt;
      if (e.trapped) continue;                       // a bubble is carrying it
      // Chase the nearest panda that is still standing.
      e.retarget -= dt;
      if (e.retarget <= 0 || !e.target || e.target.down) {
        e.retarget = 0.5; e.target = undefined;
        let best = 1e9;
        for (const panda of pandas) { if (panda.down) continue; const d = (panda.x - e.x) ** 2 + (panda.z - e.z) ** 2; if (d < best) { best = d; e.target = panda; } }
      }
      const target = e.target;
      if (e.air) {
        e.vy -= GRAVITY * dt;
        e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt;
        const ground = groundHeight(e.x, e.z);
        if (e.y <= ground && e.vy <= 0) {
          const impact = -e.vy;
          e.y = ground; e.air = false; e.vy = 0; e.stun = Math.max(e.stun, 0.35);
          if (e.boss) {
            if (e.leap) { e.leap = false; e.vx = 0; e.vz = 0; shockwave(e, 7.5, e.def.touch); }
            else emit('thud', e.x, e.y, e.z, { power: 30 });
          } else {
            e.vx *= 0.5; e.vz *= 0.5;
            if (ground < ISLAND.sea - 0.25) { emit('splash', e.x, ISLAND.sea, e.z, { radius: e.r * 2 }); kill(e, e.lastHitBy); continue; }
            if (impact > 10) game.damage(e, (impact - 10) * 2.5 * (1 + game.level * 0.06), e.lastHitBy);
          }
        }
        continue;
      }
      if (!target) continue;
      let dx = target.x - e.x, dz = target.z - e.z, d = Math.hypot(dx, dz) || 1, pace = e.speed * (e.slow > 0 ? 0.5 : 1);
      if (e.stun > 0) { e.stun -= dt; pace = 0; }
      if (e.boss) pace *= updateBoss(e, dt, target);
      else if (e.def.dash) {
        // Candy corn stops, shakes, then darts forward.
        e.timer -= dt;
        if (e.mode === 0 && e.timer <= 0 && d < 10) { e.mode = 1; e.modeT = 0.55; e.dirX = dx / d; e.dirZ = dz / d; }
        else if (e.mode === 1) { pace = 0; e.modeT -= dt; if (e.modeT <= 0) { e.mode = 2; e.modeT = 0.55; } }
        else if (e.mode === 2) { pace = 0; e.x += e.dirX * 13 * dt; e.z += e.dirZ * 13 * dt; e.modeT -= dt; if (e.modeT <= 0) { e.mode = 0; e.timer = 3 + random() * 2; } }
      } else if (e.def.bomb) {
        // Peppermints light a fuse when close and burst.
        if (e.mode === 0 && d < 2.4) { e.mode = 1; e.modeT = 0.8; }
        else if (e.mode === 1) {
          pace = 0; e.modeT -= dt; e.flash = 0.1;
          if (e.modeT <= 0) {
            emit('boom', e.x, e.y + 0.5, e.z, { radius: 3.2, hostile: true });
            for (const panda of pandas) if (Math.hypot(panda.x - e.x, panda.z - e.z) < 3.2 && Math.abs(panda.y - e.y) < 2.5) hurt(panda, e.touch * 2.2, e.x, e.z, 9);
            kill(e, undefined); continue;
          }
        }
      }
      // Walk, slide with any knock-back, and keep to dry land unless thrown.
      const kx = e.vx, kz = e.vz, knocked = Math.hypot(kx, kz);
      let nx = e.x + (dx / d * pace + kx) * dt, nz = e.z + (dz / d * pace + kz) * dt;
      const decay = Math.exp(-5 * dt);
      e.vx *= decay; e.vz *= decay;
      if (pace > 0) e.yaw = Math.atan2(dx, dz);
      const ground = groundHeight(nx, nz);
      if (ground < ISLAND.sea - 0.25) {
        if (knocked > 2.5 && !e.boss) { e.x = nx; e.z = nz; e.y = ground; emit('splash', nx, ISLAND.sea, nz, { radius: e.r * 2 }); kill(e, e.lastHitBy); continue; }
        nx = e.x; nz = e.z; e.vx = 0; e.vz = 0;
      }
      e.x = nx; e.z = nz; e.y = groundHeight(nx, nz);
      // Touch a panda: bite it, and never stand inside it.
      for (const panda of pandas) {
        if (panda.down) continue;
        const px = e.x - panda.x, pz = e.z - panda.z, gap = Math.hypot(px, pz), reach = e.r + PANDA_RADIUS;
        if (gap >= reach + 0.25 || Math.abs(panda.y - e.y) > 1.6 + e.r) continue;
        if (e.attackCd <= 0 && e.stun <= 0) { e.attackCd = 0.8; hurt(panda, e.touch * (e.mode === 2 ? 1.5 : 1), e.x, e.z, e.boss ? 14 : e.mode === 2 ? 7 : 0); }
        if (gap < reach && gap > 1e-3 && !e.boss) { e.x = panda.x + px / gap * reach; e.z = panda.z + pz / gap * reach; }
      }
    }
    // Enemies shoulder each other apart so the horde spreads around its prey.
    rebuildGrid();
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.dead || e.air || e.trapped) continue;
      let px = 0, pz = 0;
      game.eachEnemyNear(e.x, e.z, e.r * 0.9, (other, d) => {
        if (other === e || other.air || other.trapped) return;
        const overlap = e.r + other.r - d;
        if (overlap <= 0) return;
        const share = other.boss ? 1 : e.boss ? 0 : other.mass / (e.mass + other.mass);
        if (d > 1e-3) { px += (e.x - other.x) / d * overlap * share; pz += (e.z - other.z) / d * overlap * share; }
        else { px += (random() - 0.5) * 0.2; pz += (random() - 0.5) * 0.2; }
      });
      if (px || pz) { const nx = e.x + px * 0.5, nz = e.z + pz * 0.5; if (!isWater(nx, nz)) { e.x = nx; e.z = nz; e.y = groundHeight(nx, nz); } }
    }
    // Drop the dead from the list now and then, keeping the order of the living.
    if (list.length > 64 && list.length > game.aliveCount * 1.5 + 16 || game.t - (game.lastSweep ?? 0) > 2) {
      game.lastSweep = game.t;
      let w = 0;
      for (let i = 0; i < list.length; i++) if (!list[i].dead) list[w++] = list[i];
      list.length = w;
      rebuildGrid();
    }
    let alive = 0;
    for (const e of list) if (!e.dead) alive++;
    game.aliveCount = alive;
  }
  function shockwave(enemy, radius, power) {
    emit('shock', enemy.x, enemy.y, enemy.z, { radius });
    for (const panda of game.pandas) {
      // Pandas in the air are above the ring.
      if (!panda.grounded || Math.hypot(panda.x - enemy.x, panda.z - enemy.z) > radius) continue;
      hurt(panda, power * 1.1, enemy.x, enemy.z, 11);
    }
    game.pushProps(enemy.x, enemy.z, radius, 8, 5);
  }
  function updateBullets(dt) {
    const list = game.bullets;
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      b.x += b.vx * dt; b.z += b.vz * dt; b.y = groundHeight(b.x, b.z) + 0.9; b.t -= dt;
      let alive = b.t > 0 && !isWater(b.x, b.z);
      if (alive) for (const panda of game.pandas) {
        if (panda.down || Math.hypot(panda.x - b.x, panda.z - b.z) > 1 || panda.y - b.y > 0.9) continue;
        if (hurt(panda, b.damage, b.x - b.vx, b.z - b.vz, 5)) { alive = false; emit('pop', b.x, b.y, b.z, { color: 0xff5577 }); }
        break;
      }
      if (alive) list[w++] = b;
    }
    list.length = w;
  }

  // ---- pandas -------------------------------------------------------------------------
  const bodyDamage = (panda) => (9 + game.level * 1.4) * (1 + 0.2 * (panda.charms.get(CHARM_BY_KEY.jelly) ?? 0)) * (1 + panda.stats.might * 0.5);

  /** Decide what a friend does this step: stay near the player, keep out of the thick of it, help the fallen. */
  function botInput(panda, dt, out) {
    const brain = panda.brain, leader = game.pandas.find((other) => other.human && !other.down) ?? game.pandas.find((other) => !other.down && other !== panda);
    out.moveX = 0; out.moveZ = 0; out.jump = false; out.slam = false; out.roll = false;
    let gx = panda.x, gz = panda.z, urgent = false;
    const fallen = game.pandas.find((other) => other.down && other !== panda);
    if (fallen) { gx = fallen.x; gz = fallen.z; urgent = Math.hypot(gx - panda.x, gz - panda.z) > 1.6; if (!urgent) return out; }
    else {
      brain.t -= dt;
      if (brain.t <= 0) {
        brain.t = 0.8 + random() * 0.8;
        const angle = random() * 6.28, reach = 3 + random() * 4, base = leader ?? panda;
        brain.x = base.x + Math.cos(angle) * reach; brain.z = base.z + Math.sin(angle) * reach;
        // Drift toward a loose gem when one is close.
        let best = 64;
        for (let i = 0; i < game.gems.length; i += 3) { const gem = game.gems[i], d = (gem.x - panda.x) ** 2 + (gem.z - panda.z) ** 2; if (d < best && !gem.pull) { best = d; brain.x = gem.x; brain.z = gem.z; } }
      }
      gx = brain.x; gz = brain.z;
    }
    let ax = gx - panda.x, az = gz - panda.z;
    const far = Math.hypot(ax, az);
    if (far > 0.6) { ax /= far; az /= far; } else { ax = 0; az = 0; }
    // Lean away from the crowd; the closer it presses, the stronger the lean.
    let fx = 0, fz = 0, crowd = 0;
    game.eachEnemyNear(panda.x, panda.z, 6, (enemy, d) => { const k = (enemy.boss ? 4 : 1) / Math.max(0.5, d * d); fx += (panda.x - enemy.x) * k; fz += (panda.z - enemy.z) * k; if (d < 4.5) crowd++; });
    const flee = Math.hypot(fx, fz);
    const fear = Math.min(3, 0.8 + crowd * 0.45) * (panda.hp < panda.maxHp * 0.45 ? 2 : 1);
    if (flee > 0 && !urgent) { ax += fx / flee * fear; az += fz / flee * fear; }
    // Stay off the beach.
    const r = Math.hypot(panda.x, panda.z);
    if (r > ISLAND.playRadius - 6) { ax -= panda.x / r * 2; az -= panda.z / r * 2; }
    const size = Math.hypot(ax, az);
    if (size > 0.05) { out.moveX = ax / size; out.moveZ = az / size; }
    brain.hop -= dt;
    if (crowd >= 5 && brain.hop <= 0 && panda.grounded) { out.jump = true; brain.hop = 2.5 + random() * 2; brain.slam = 0.45; }
    if (brain.slam > 0) { brain.slam -= dt; if (brain.slam <= 0 && !panda.grounded) out.slam = true; }
    // A lone candy in reach gets a belly bump.
    if (crowd > 0 && crowd <= 3 && panda.grounded && panda.bumpCd <= 0 && !urgent) {
      const close = game.nearestEnemy(panda.x, panda.z, 2.6);
      if (close && !close.boss) { const d = Math.hypot(close.x - panda.x, close.z - panda.z) || 1; out.moveX = (close.x - panda.x) / d; out.moveZ = (close.z - panda.z) / d; out.slam = true; }
    }
    out.roll = crowd >= 4 && panda.stamina > 1;
    return out;
  }
  const botScratch = { moveX: 0, moveZ: 0, jump: false, slam: false, roll: false };

  function updatePanda(panda, dt, input) {
    const motor = panda.motor, stats = panda.stats, v = motor.velocity;
    if (panda.iframe > 0) panda.iframe -= dt;
    if (panda.hurtFlash > 0) panda.hurtFlash -= dt;
    if (panda.bumpCd > 0) panda.bumpCd -= dt;
    const wasGrounded = panda.grounded;
    if (panda.down) {
      motor.update(dt, 0, 0, false);
      syncPanda(panda);
      const helper = game.pandas.some((other) => !other.down && Math.hypot(other.x - panda.x, other.z - panda.z) < 2.8);
      panda.revive = helper ? panda.revive + dt : Math.max(0, panda.revive - dt * 0.5);
      if (panda.revive >= 3.5) { panda.down = false; panda.hp = panda.maxHp * 0.5; panda.iframe = 2.5; panda.revive = 0; emit('revived', panda.x, panda.y, panda.z, { panda: panda.index }); if (panda.pendingPicks > 0 && !panda.offer) { panda.pendingPicks--; grantPick(panda); } }
      return;
    }
    panda.hp = Math.min(panda.maxHp, panda.hp + (0.5 + stats.regen) * dt);
    let mx = input.moveX, mz = input.moveZ;
    const size = Math.hypot(mx, mz);
    if (size > 1) { mx /= size; mz /= size; }
    let speed = 6.8 * (1 + stats.speed);
    // Roll: quicker, and it bowls the crowd over, while the breath lasts.
    panda.rolling = input.roll && size > 0.1 && (panda.rolling ? panda.stamina > 0 : panda.stamina > 0.4);
    if (panda.rolling) { panda.stamina -= dt; speed *= 1.75; } else panda.stamina = Math.min(2.5, panda.stamina + dt * 0.55);
    // Hold jump to squash down and store a bigger jump; let go to fly.
    let jump = false;
    if (input.jump && panda.grounded) { panda.charge = Math.min(0.75, panda.charge + dt); if (panda.charge > 0.18) speed *= 0.55; }
    if (panda.jumpHeld && !input.jump && panda.grounded) {
      jump = true;
      const k = Math.max(0, panda.charge - 0.12) / 0.63;
      motor.jumpSpeed = (8.8 + 8.6 * k) * (1 + stats.speed * 0.5);
      emit('jump', panda.x, panda.y, panda.z, { panda: panda.index, power: k });
    }
    if (!input.jump) panda.charge = 0;
    panda.jumpHeld = input.jump;
    // Slam in the air, belly bump on the ground.
    if (input.slam) {
      if (!panda.grounded && !panda.slamming) { panda.slamming = true; v[1] = Math.min(v[1], -30); v[0] *= 0.3; v[2] *= 0.3; }
      else if (panda.grounded && panda.bumpCd <= 0) { panda.bumpT = 0.22; panda.bumpCd = 1.1; panda.bumpHits = new Set(); emit('bump', panda.x, panda.y, panda.z, { panda: panda.index }); }
    }
    let wx = mx * speed, wz = mz * speed;
    if (size > 0.1) { panda.headingX = mx / size; panda.headingZ = mz / size; panda.facing = Math.atan2(mx, mz); }
    if (panda.bumpT > 0) {
      panda.bumpT -= dt; wx = panda.headingX * 19; wz = panda.headingZ * 19; v[0] = wx; v[2] = wz;
      const damage = bodyDamage(panda) * 1.3;
      game.eachEnemyNear(panda.x + panda.headingX * 0.8, panda.z + panda.headingZ * 0.8, 1.5, (enemy) => {
        if (panda.bumpHits.has(enemy.id) || Math.abs(enemy.y - panda.y) > 2) return;
        panda.bumpHits.add(enemy.id);
        game.damage(enemy, damage, panda, panda.headingX * 17 * (1 + stats.knock), panda.headingZ * 17 * (1 + stats.knock), 6);
      });
      game.pushProps(panda.x + panda.headingX, panda.z + panda.headingZ, 1.4, 14, 3);
    }
    if (panda.slamming) { wx = 0; wz = 0; }
    motor.update(dt, wx, wz, jump);
    syncPanda(panda);
    panda.speedNow = Math.hypot(v[0], v[2]);
    panda.grounded = motor.isGrounded;
    if (!panda.grounded) panda.peakY = wasGrounded ? panda.y : Math.max(panda.peakY, panda.y);
    else if (!wasGrounded) {
      const fall = Math.max(0, panda.peakY - panda.y);
      if (panda.slamming) {
        const radius = 3 + Math.min(3.5, fall * 0.3), damage = bodyDamage(panda) * (1.6 + fall * 0.14);
        game.eachEnemyNear(panda.x, panda.z, radius, (enemy, d) => {
          if (Math.abs(enemy.y - panda.y) > 2.5) return;
          const k = 9 * (1 + stats.knock) / (d || 1);
          game.damage(enemy, damage * (1 - 0.4 * Math.min(1, d / radius)), panda, (enemy.x - panda.x) * k, (enemy.z - panda.z) * k, 9 + fall * 0.5);
        });
        game.pushProps(panda.x, panda.z, radius, 9, 6);
        emit('slam', panda.x, panda.y, panda.z, { panda: panda.index, radius });
      } else if (fall > 1) emit('land', panda.x, panda.y, panda.z, { panda: panda.index, fall });
      panda.slamming = false;
    }
    if (panda.rolling) {
      const damage = bodyDamage(panda) * 0.55;
      game.eachEnemyNear(panda.x, panda.z, 0.9, (enemy, d) => {
        if (enemy.rollT > game.t || Math.abs(enemy.y - panda.y) > 1.8) return;
        enemy.rollT = game.t + 0.5;
        const k = 10 * (1 + stats.knock) / (d || 1);
        game.damage(enemy, damage, panda, (enemy.x - panda.x) * k + panda.headingX * 4, (enemy.z - panda.z) * k + panda.headingZ * 4, 4);
      });
    }
    // The sea stings: a dunked panda is tossed back toward the island.
    if (panda.y < ISLAND.sea - 0.55) {
      panda.iframe = 0; hurt(panda, 8, panda.x * 2, panda.z * 2);
      const r = Math.hypot(panda.x, panda.z) || 1;
      v[0] = -panda.x / r * 11; v[2] = -panda.z / r * 11; v[1] = 14; panda.slamming = false;
      emit('splash', panda.x, ISLAND.sea, panda.z, { radius: 2 });
    }
    if (panda.y < -30 || !Number.isFinite(panda.y)) motor.teleport(0, groundHeight(0, 0) + 3, 0);
    // Sprinkles in reach fly to the panda.
    const reach = 2.8 * (1 + stats.magnet);
    for (const gem of game.gems) if (!gem.pull && (gem.x - panda.x) ** 2 + (gem.z - panda.z) ** 2 < reach * reach) gem.pull = panda;
    for (const toy of panda.toys) {
      updateToyState(game, panda, toy, dt);
      if (!toy.s.cooldown) continue;
      toy.cd -= dt;
      if (toy.cd <= 0) { if (fireToy(game, panda, toy)) toy.cd += toy.s.cooldown; else toy.cd = 0.25; }
    }
  }
  function syncPanda(panda) {
    const p = panda.motor.position;
    panda.x = p[0]; panda.y = p[1] - PANDA_HEIGHT / 2; panda.z = p[2];
  }

  function updatePickups(dt) {
    const gems = game.gems;
    let w = 0;
    for (let i = 0; i < gems.length; i++) {
      const gem = gems[i], panda = gem.pull;
      gem.t += dt;
      if (panda) {
        if (panda.down) { gem.pull = undefined; gems[w++] = gem; continue; }
        const dx = panda.x - gem.x, dy = panda.y + 0.8 - gem.y, dz = panda.z - gem.z, d = Math.hypot(dx, dy, dz), step = (14 + gem.t * 6) * dt;
        if (d <= step + 0.5) { addExperience(gem.value * (1 + panda.stats.growth)); emit('gem', panda.x, panda.y + 0.8, panda.z, { value: gem.value }); continue; }
        gem.x += dx / d * step; gem.y += dy / d * step; gem.z += dz / d * step;
      }
      gems[w++] = gem;
    }
    gems.length = w;
    const pickups = game.pickups;
    w = 0;
    for (let i = 0; i < pickups.length; i++) {
      const pickup = pickups[i];
      pickup.t += dt;
      let taken = false;
      for (const panda of game.pandas) {
        if (panda.down || Math.hypot(panda.x - pickup.x, panda.z - pickup.z) > 1.5 || Math.abs(panda.y - pickup.y) > 2.5) continue;
        taken = true;
        if (pickup.kind === 'heart') { for (const other of game.pandas) if (!other.down) other.hp = Math.min(other.maxHp, other.hp + other.maxHp * 0.3); emit('heal', pickup.x, pickup.y + 1, pickup.z, {}); }
        else {
          // A chest levels up something every panda already owns and showers sprinkles.
          for (const other of game.pandas) {
            const cards = makeOffer(other).filter((card) => card.type === 'evo' || ((card.type === 'toy' || card.type === 'charm') && card.level > 1));
            if (cards.length) applyCard(other, cards.find((card) => card.type === 'evo') ?? cards[(random() * cards.length) | 0]);
          }
          addExperience(game.xpNeed * 0.35);
          emit('chest', pickup.x, pickup.y + 1, pickup.z, { panda: panda.index });
        }
        break;
      }
      if (!taken && pickup.t < 90) pickups[w++] = pickup;
    }
    pickups.length = w;
  }

  /**
   * Advance the run by `dt` seconds. `input` is the human player's wish:
   * `moveX`, `moveZ` in world space, and `jump`, `slam`, `roll`.
   */
  game.update = (dt, input) => {
    if (game.state !== 'play' || !(dt > 0)) return;
    dt = Math.min(dt, 1 / 20);
    game.t += dt;
    rebuildGrid();
    world.step(dt);
    for (const panda of game.pandas) updatePanda(panda, dt, panda.human ? input : botInput(panda, dt, botScratch));
    updateSpawner(dt);
    updateEnemies(dt);
    updateShots(game, dt);
    updateBullets(dt);
    updateProps(dt);
    updatePickups(dt);
  };
  syncAll();
  function syncAll() { for (const panda of game.pandas) syncPanda(panda); rebuildGrid(); }
  return game;
}
