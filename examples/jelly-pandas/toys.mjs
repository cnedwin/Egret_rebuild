// SPDX-License-Identifier: Apache-2.0
// The twelve toys. Each fires on its own timer and most leave something in
// `game.shots` that lives for a while: a rolling ball, a bubble, a puddle.
// Stats come from `toy.s`, already scaled by level, charms and evolution.
import { ISLAND, groundHeight, groundSlope, isWater } from './island.mjs';

const GRAVITY = 24;
const slope = [0, 0];

function addShot(game, panda, toy, kind, x, y, z, more) {
  const shot = { id: game.nextId++, kind, panda, toy, s: toy.s, evo: toy.evo, x, y, z, vx: 0, vy: 0, vz: 0, t: 0, life: 5, r: 0.4, dead: false, ...more };
  game.shots.push(shot);
  return shot;
}
/** Up to `count` distinct enemies nearest to a point, closest first. */
function nearestFew(game, x, z, count, maxDistance) {
  const found = [];
  for (const e of game.enemies) {
    if (e.dead || e.trapped) continue;
    const d = Math.hypot(e.x - x, e.z - z);
    if (d < maxDistance) found.push([d, e]);
  }
  found.sort((a, b) => a[0] - b[0]);
  return found.slice(0, count).map((entry) => entry[1]);
}
const aimScratch = [0, 0];
/** Unit direction from the panda to the nearest enemy in range, or its heading when none is near. */
function aimAt(game, panda, range) {
  const target = game.nearestEnemy(panda.x, panda.z, range);
  if (!target) { aimScratch[0] = panda.headingX; aimScratch[1] = panda.headingZ; return aimScratch; }
  const dx = target.x - panda.x, dz = target.z - panda.z, d = Math.hypot(dx, dz) || 1;
  aimScratch[0] = dx / d; aimScratch[1] = dz / d;
  return aimScratch;
}
/** Damage everything in a circle, pushing it away from the centre. */
function blast(game, panda, x, y, z, radius, damage, knock, up) {
  game.eachEnemyNear(x, z, radius, (enemy, d) => {
    if (Math.abs(enemy.y - y) > radius + 2) return;
    const k = knock / (d || 1);
    game.damage(enemy, damage, panda, (enemy.x - x) * k, (enemy.z - z) * k, up);
  });
  game.pushProps(x, z, radius, knock * 0.6, up * 0.4);
}

/** Fire a toy. Returns false when there is nothing to aim at, so the toy tries again shortly. */
export function fireToy(game, panda, toy) {
  const s = toy.s, random = game.random, px = panda.x, py = panda.y, pz = panda.z;
  switch (toy.key) {
    case 'lobber': {
      const targets = nearestFew(game, px, pz, s.amount, s.range);
      if (!targets.length) return false;
      for (let i = 0; i < s.amount; i++) {
        const target = targets[i % targets.length], flight = 0.75, tx = target.x + (random() - 0.5) * (i >= targets.length ? 3 : 0.6), tz = target.z + (random() - 0.5) * (i >= targets.length ? 3 : 0.6);
        const ty = groundHeight(tx, tz), y0 = py + 1.4;
        addShot(game, panda, toy, 'glob', px, y0, pz, { vx: (tx - px) / flight, vz: (tz - pz) / flight, vy: (ty - y0 + 0.5 * GRAVITY * flight * flight) / flight, r: 0.35, life: 4 });
      }
      return true;
    }
    case 'ripple': {
      const reach = s.range * s.area;
      let any = false;
      // Breathe in: everything in reach slides toward the panda.
      game.eachEnemyNear(px, pz, reach, (enemy, d) => { any = true; if (!enemy.boss && d > 1.5) { enemy.vx += (px - enemy.x) / d * 7 / enemy.mass; enemy.vz += (pz - enemy.z) / d * 7 / enemy.mass; } });
      if (!any) return false;
      game.emit('inhale', px, py, pz, { radius: reach, panda: panda.index });
      addShot(game, panda, toy, 'ring', px, py, pz, { delay: 0.4, radius: 0.5, max: reach, life: 3, lift: 0, follow: true });
      if (toy.evo) addShot(game, panda, toy, 'ring', px, py, pz, { delay: 0.85, radius: 0.5, max: reach * 1.15, life: 3, lift: 11, follow: true });
      return true;
    }
    case 'bowler': {
      // Aim at the nearest candy; with none in sight the ball rolls the way the panda faces.
      const aim = aimAt(game, panda, 16);
      for (let i = 0; i < s.amount; i++) {
        const turn = (i - (s.amount - 1) / 2) * 0.32, c = Math.cos(turn), n = Math.sin(turn), dx = aim[0] * c - aim[1] * n, dz = aim[0] * n + aim[1] * c;
        addShot(game, panda, toy, 'bowl', px + dx * 1.2, py + s.extra, pz + dz * 1.2, { vx: dx * s.speed, vz: dz * s.speed, r: s.extra, life: s.duration, hits: new Map(), split: toy.evo });
      }
      return true;
    }
    case 'yoyo': {
      const targets = nearestFew(game, px, pz, s.amount, s.range + 2);
      if (!targets.length) return false;
      for (let i = 0; i < s.amount; i++) {
        const target = targets[i % targets.length];
        let dx = target.x - px, dz = target.z - pz;
        const d = Math.hypot(dx, dz) || 1, turn = i >= targets.length ? (random() - 0.5) * 1.4 : 0, c = Math.cos(turn), n = Math.sin(turn);
        dx /= d; dz /= d;
        addShot(game, panda, toy, 'yoyo', px, py + 0.9, pz, { dirX: dx * c - dz * n, dirZ: dx * n + dz * c, out: 0, reach: Math.min(s.range, d + 1.5), phase: 0, r: 0.45, life: 8, hits: new Map(), stringT: 0 });
      }
      return true;
    }
    case 'rocket': {
      if (!game.nearestEnemy(px, pz, s.range)) return false;
      for (let i = 0; i < s.amount; i++) addShot(game, panda, toy, 'rocket', px, py + 1.4, pz, { vx: (random() - 0.5) * 5, vz: (random() - 0.5) * 5, phase: 0, delay: i * 0.12, r: 0.3, life: 6 });
      return true;
    }
    case 'bubble': {
      if (!game.nearestEnemy(px, pz, 16)) return false;
      for (let i = 0; i < s.amount; i++) {
        const angle = random() * 6.28;
        addShot(game, panda, toy, 'bubble', px + Math.cos(angle) * 0.8, py + 1, pz + Math.sin(angle) * 0.8, { vx: Math.cos(angle) * 3, vz: Math.sin(angle) * 3, r: 0.85 * s.area, life: s.duration + 2.5, held: [], lift: 0, child: false });
      }
      return true;
    }
    case 'chomper': {
      if (!game.nearestEnemy(px, pz, 22)) return false;
      const mine = game.shots.filter((shot) => shot.kind === 'chomper' && shot.panda === panda && !shot.dead);
      for (let i = 0; i < s.amount; i++) {
        // The oldest teeth wind down when there are too many.
        if (mine.length >= s.extra) { const old = mine.shift(); old.life = Math.min(old.life, old.t + 0.01); }
        const angle = random() * 6.28;
        mine.push(addShot(game, panda, toy, 'chomper', px + Math.cos(angle), py, pz + Math.sin(angle), { r: toy.evo ? 0.75 : 0.45, life: s.duration, bite: 0, hop: random() }));
      }
      return true;
    }
    case 'box': {
      for (let i = 0; i < s.amount; i++) {
        const angle = random() * 6.28, reach = i === 0 ? 0.2 : 2 + random() * 2.5, x = px + Math.cos(angle) * reach, z = pz + Math.sin(angle) * reach;
        if (isWater(x, z)) continue;
        addShot(game, panda, toy, 'box', x, groundHeight(x, z), z, { r: 0.5, life: s.duration, arm: 0.5, uses: toy.evo ? 4 : 1 + s.extra, width: s.area * (toy.evo ? 2 : 1) });
      }
      return true;
    }
    case 'popper': {
      if (!game.nearestEnemy(px, pz, s.range + 4)) return false;
      const aim = aimAt(game, panda, s.range + 4), count = toy.evo ? s.amount * 3 : s.amount, spread = toy.evo ? Math.PI * 2 : s.extra * Math.PI / 180 * 2, base = Math.atan2(aim[0], aim[1]);
      for (let i = 0; i < count; i++) {
        const angle = base + (count > 1 ? (i / (count - 1) - 0.5) * spread : 0) + (random() - 0.5) * 0.08, speed = s.speed * (0.85 + random() * 0.3);
        addShot(game, panda, toy, 'pellet', px, py + 0.9, pz, { vx: Math.sin(angle) * speed, vz: Math.cos(angle) * speed, r: 0.22, life: s.range / s.speed, pierce: s.pierce, look: i % 5, hits: new Set() });
      }
      game.emit('popper', px + aim[0], py + 1, pz + aim[1], { panda: panda.index });
      return true;
    }
    case 'top': {
      if (!game.nearestEnemy(px, pz, 18)) return false;
      for (let i = 0; i < s.amount; i++) {
        const angle = random() * 6.28;
        addShot(game, panda, toy, 'top', px + Math.cos(angle), py, pz + Math.sin(angle), { vx: Math.cos(angle) * s.speed, vz: Math.sin(angle) * s.speed, r: s.extra, life: s.duration, hits: new Map(), seek: undefined, pullT: 0 });
      }
      return true;
    }
    case 'hose': {
      if (!game.nearestEnemy(px, pz, s.range + 3)) return false;
      toy.active = s.duration; toy.tick = 0;
      return true;
    }
    default: return true;
  }
}

/** Toys with a standing effect: the flail keeps swinging and the hose keeps spraying. */
export function updateToyState(game, panda, toy, dt) {
  const s = toy.s;
  if (toy.key === 'flail') {
    toy.angle += s.speed * dt;
    const count = s.amount, radius = s.extra * (toy.evo ? 1.9 : 1), reach = s.range * s.area, balls = toy.balls ?? (toy.balls = []);
    balls.length = count;
    for (let i = 0; i < count; i++) {
      const angle = toy.angle + i / count * Math.PI * 2, x = panda.x + Math.cos(angle) * reach, z = panda.z + Math.sin(angle) * reach, y = panda.y + 0.9;
      const ball = balls[i] ?? (balls[i] = { x, y, z, r: radius });
      ball.x = x; ball.y = y; ball.z = z; ball.r = radius;
      const tx = -Math.sin(angle), tz = Math.cos(angle), swing = s.speed * reach;
      game.eachEnemyNear(x, z, radius, (enemy) => {
        if ((toy.hits.get(enemy.id) ?? 0) > game.t || Math.abs(enemy.y - panda.y) > 2.5) return;
        toy.hits.set(enemy.id, game.t + 0.45);
        game.damage(enemy, s.damage * (0.7 + swing * 0.03), panda, tx * s.knock + (enemy.x - panda.x) * 0.6, tz * s.knock + (enemy.z - panda.z) * 0.6, toy.evo ? 9 : 3);
      });
      game.pushProps(x, z, radius, 0.5, 0);
    }
    if (toy.hits.size > 600) toy.hits.clear();
  } else if (toy.key === 'hose') {
    if (toy.evo) toy.active = 1;
    if (toy.active <= 0) return;
    toy.active -= dt; toy.tick -= dt;
    if (toy.tick > 0) return;
    toy.tick = 0.07;
    const target = game.nearestEnemy(panda.x, panda.z, s.range + 3);
    if (target) toy.aim = Math.atan2(target.x - panda.x, target.z - panda.z);
    if (toy.aim === undefined) return;
    for (let i = 0; i < s.amount; i++) {
      const sweep = Math.sin(game.t * 4 + i * Math.PI) * 0.45 + (i > 0 ? Math.PI * (i % 2 ? 1 : 0.5) : 0), angle = toy.aim + sweep;
      addShot(game, panda, toy, 'pellet', panda.x, panda.y + 1, panda.z, { vx: Math.sin(angle) * s.speed, vz: Math.cos(angle) * s.speed, r: 0.26, life: s.range / s.speed, pierce: toy.evo ? 99 : s.pierce, look: 5, hits: new Set(), drop: true });
    }
  }
}

function explodeRocket(game, shot) {
  const s = shot.s, radius = 2.8 * s.area;
  blast(game, shot.panda, shot.x, shot.y, shot.z, radius, s.damage, s.knock, 7);
  game.emit('boom', shot.x, shot.y + 0.3, shot.z, { radius });
  if (shot.evo && !shot.child) for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2 + game.random() * 0.8;
    addShot(game, shot.panda, shot.toy, 'bomblet', shot.x, shot.y + 0.5, shot.z, { vx: Math.cos(angle) * 5, vz: Math.sin(angle) * 5, vy: 9, r: 0.25, life: 4 });
  }
}
function popBubble(game, shot) {
  const s = shot.s;
  for (const enemy of shot.held.slice()) { enemy.trapped = undefined; enemy.air = true; enemy.vy = -2; game.damage(enemy, s.damage + s.extra, shot.panda); }
  shot.held.length = 0;
  blast(game, shot.panda, shot.x, shot.y - shot.lift, shot.z, shot.r * 2.2, s.damage * 0.6, 4, 0);
  game.emit('pop', shot.x, shot.y, shot.z, { color: 0xbfe9ff, radius: shot.r });
  if (shot.evo && !shot.child) for (let i = 0; i < 2; i++) {
    const angle = game.random() * 6.28;
    addShot(game, shot.panda, shot.toy, 'bubble', shot.x, shot.y - shot.lift + 1, shot.z, { vx: Math.cos(angle) * 4, vz: Math.sin(angle) * 4, r: shot.r * 0.85, life: s.duration + 2, held: [], lift: 0, child: true });
  }
}

/** Advance everything the toys have left on the island. */
export function updateShots(game, dt) {
  const shots = game.shots, random = game.random;
  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i], s = shot.s, panda = shot.panda;
    if (shot.dead) continue;
    if (shot.delay > 0) { shot.delay -= dt; if (shot.follow) { shot.x = panda.x; shot.y = panda.y; shot.z = panda.z; } continue; }
    shot.t += dt;
    switch (shot.kind) {
      case 'glob': case 'bomblet': {
        shot.vy -= GRAVITY * dt; shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.z += shot.vz * dt;
        const ground = groundHeight(shot.x, shot.z);
        if (shot.y > ground || shot.vy > 0) break;
        shot.dead = true; shot.y = ground;
        if (shot.kind === 'bomblet') { blast(game, panda, shot.x, ground, shot.z, 1.7 * s.area, s.damage * 0.4, s.knock * 0.6, 4); game.emit('boom', shot.x, ground + 0.2, shot.z, { radius: 1.7 * s.area }); break; }
        const radius = 2.1 * s.area;
        blast(game, panda, shot.x, ground, shot.z, radius, s.damage, 3, 2);
        game.emit('splat', shot.x, ground, shot.z, { radius });
        if (!isWater(shot.x, shot.z)) addShot(game, panda, shot.toy, 'puddle', shot.x, ground + 0.05, shot.z, { r: radius * (shot.evo ? 1.7 : 1), life: s.duration * (shot.evo ? 1.5 : 1), tick: 0 });
        break;
      }
      case 'puddle': {
        shot.tick -= dt;
        if (shot.tick <= 0) {
          shot.tick = 0.4;
          game.eachEnemyNear(shot.x, shot.z, shot.r, (enemy) => { if (enemy.air) return; game.damage(enemy, s.extra * 0.4, panda); if (shot.evo) enemy.slow = 0.6; });
        }
        break;
      }
      case 'ring': {
        if (shot.t <= dt * 1.5) { shot.x = panda.x; shot.y = panda.y; shot.z = panda.z; game.emit('ring', shot.x, shot.y, shot.z, { radius: shot.max, speed: s.speed, lift: shot.lift, panda: panda.index }); }
        const before = shot.radius;
        shot.radius = Math.min(shot.max, shot.radius + s.speed * dt);
        game.eachEnemyNear(shot.x, shot.z, shot.radius, (enemy, d) => {
          if (d + enemy.r < before || Math.abs(enemy.y - shot.y) > 3) return;
          const k = s.knock / (d || 1);
          game.damage(enemy, s.damage, panda, (enemy.x - shot.x) * k, (enemy.z - shot.z) * k, shot.lift);
        });
        game.pushProps(shot.x, shot.z, shot.radius, 0.6, shot.lift * 0.2);
        if (shot.radius >= shot.max) shot.dead = true;
        break;
      }
      case 'bowl': {
        // The ball speeds up downhill and bends with the ground under it.
        groundSlope(shot.x, shot.z, slope);
        shot.vx += slope[0] * 16 * dt; shot.vz += slope[1] * 16 * dt;
        shot.x += shot.vx * dt; shot.z += shot.vz * dt; shot.y = groundHeight(shot.x, shot.z) + shot.r;
        if (isWater(shot.x, shot.z)) { game.emit('splash', shot.x, ISLAND.sea, shot.z, { radius: 1.6 }); shot.dead = true; break; }
        const speed = Math.hypot(shot.vx, shot.vz) || 1;
        game.eachEnemyNear(shot.x, shot.z, shot.r, (enemy) => {
          if (shot.hits.has(enemy.id) || Math.abs(enemy.y - (shot.y - shot.r)) > 2) return;
          shot.hits.set(enemy.id, 1);
          game.damage(enemy, s.damage, panda, shot.vx / speed * s.knock, shot.vz / speed * s.knock, 6);
          if (shot.split) {
            shot.split = false;
            for (const turn of [-0.45, 0.45]) { const c = Math.cos(turn), n = Math.sin(turn); addShot(game, panda, shot.toy, 'bowl', shot.x, shot.y, shot.z, { vx: shot.vx * c - shot.vz * n, vz: shot.vx * n + shot.vz * c, r: shot.r * 0.8, life: shot.life - shot.t, hits: new Map(shot.hits), split: false }); }
          }
        });
        game.pushProps(shot.x, shot.z, shot.r, 2, 1);
        break;
      }
      case 'yoyo': {
        const speed = s.speed;
        if (shot.phase === 0) {
          shot.out += speed * dt;
          if (shot.out >= shot.reach) { shot.out = shot.reach; shot.phase = shot.evo ? 1 : 2; shot.spin = 1.6; shot.ax = panda.x + shot.dirX * shot.reach; shot.az = panda.z + shot.dirZ * shot.reach; }
          shot.x = panda.x + shot.dirX * shot.out; shot.z = panda.z + shot.dirZ * shot.out;
        } else if (shot.phase === 1) {
          // Evolved: hang at full stretch and spin.
          shot.x = shot.ax; shot.z = shot.az; shot.spin -= dt;
          if (shot.spin <= 0) shot.phase = 2;
        } else {
          const dx = panda.x - shot.x, dz = panda.z - shot.z, d = Math.hypot(dx, dz);
          if (d < speed * dt + 0.6) { shot.dead = true; break; }
          shot.x += dx / d * speed * 1.2 * dt; shot.z += dz / d * speed * 1.2 * dt;
        }
        shot.y = groundHeight(shot.x, shot.z) + 0.8;
        const radius = shot.phase === 1 ? 2.2 : shot.r + 0.25, again = shot.phase === 1 ? 0.2 : 0.35;
        game.eachEnemyNear(shot.x, shot.z, radius, (enemy, d) => {
          if ((shot.hits.get(enemy.id) ?? 0) > game.t) return;
          shot.hits.set(enemy.id, game.t + again);
          game.damage(enemy, s.damage * (shot.phase === 1 ? 0.6 : 1), panda, (enemy.x - shot.x) / (d || 1) * s.knock, (enemy.z - shot.z) / (d || 1) * s.knock, 2);
        });
        // The string between panda and yo-yo stings whatever it crosses.
        shot.stringT -= dt;
        if (shot.stringT <= 0) {
          shot.stringT = 0.3;
          const sx = shot.x - panda.x, sz = shot.z - panda.z, length = Math.hypot(sx, sz);
          for (let k = 1.2; k < length - 0.8; k += 1.3) game.eachEnemyNear(panda.x + sx / length * k, panda.z + sz / length * k, 0.3, (enemy) => { game.damage(enemy, s.extra, panda); });
        }
        break;
      }
      case 'rocket': {
        if (shot.phase === 0) {
          shot.x += shot.vx * dt; shot.z += shot.vz * dt; shot.y += 20 * dt;
          if (shot.t < 0.45) break;
          const target = game.densestPoint(panda.x, panda.z, s.range);
          shot.phase = 1; shot.t0 = shot.t; shot.sx = shot.x; shot.sy = shot.y; shot.sz = shot.z;
          shot.tx = target ? target.x + target.vx * 0.3 : shot.x + (random() - 0.5) * 8; shot.tz = target ? target.z + target.vz * 0.3 : shot.z + (random() - 0.5) * 8; shot.ty = groundHeight(shot.tx, shot.tz);
          break;
        }
        const k = Math.min(1, (shot.t - shot.t0) / s.duration), ease = k * k;
        shot.x = shot.sx + (shot.tx - shot.sx) * k; shot.z = shot.sz + (shot.tz - shot.sz) * k; shot.y = shot.sy + (shot.ty - shot.sy) * ease + Math.sin(k * Math.PI) * 2;
        if (k >= 1) { shot.dead = true; shot.y = shot.ty; explodeRocket(game, shot); }
        break;
      }
      case 'bubble': {
        if (shot.held.length === 0) {
          const target = game.nearestEnemy(shot.x, shot.z, 14);
          if (target && !target.boss) {
            const dx = target.x - shot.x, dz = target.z - shot.z, d = Math.hypot(dx, dz) || 1;
            shot.vx += (dx / d * s.speed - shot.vx) * Math.min(1, dt * 3); shot.vz += (dz / d * s.speed - shot.vz) * Math.min(1, dt * 3);
          }
          shot.x += shot.vx * dt; shot.z += shot.vz * dt; shot.y = groundHeight(shot.x, shot.z) + 0.9 + Math.sin(shot.t * 3) * 0.15;
          game.eachEnemyNear(shot.x, shot.z, shot.r * 0.7, (enemy) => {
            if (enemy.boss || enemy.trapped || enemy.air || shot.held.length >= s.pierce || enemy.r > shot.r * 1.6) return;
            enemy.trapped = shot; shot.held.push(enemy);
            if (shot.held.length === 1) { shot.life = shot.t + s.duration; shot.base = shot.y; game.emit('scoop', shot.x, shot.y, shot.z, {}); }
          });
        } else {
          // Carry the catch up and let it bob.
          shot.lift = Math.min(4.5, shot.lift + 5 * dt);
          shot.y = shot.base + shot.lift + Math.sin(shot.t * 3) * 0.15;
          shot.held.forEach((enemy, index) => { enemy.x = shot.x + (index ? Math.cos(index * 2.4) * 0.4 : 0); enemy.z = shot.z + (index ? Math.sin(index * 2.4) * 0.4 : 0); enemy.y = shot.y - enemy.r; enemy.vx = 0; enemy.vz = 0; enemy.vy = 0; });
        }
        if (shot.t >= shot.life) { shot.dead = true; popBubble(game, shot); }
        break;
      }
      case 'chomper': {
        const target = game.nearestEnemy(shot.x, shot.z, 20);
        shot.hop += dt * 3.2;
        if (target) {
          const dx = target.x - shot.x, dz = target.z - shot.z, d = Math.hypot(dx, dz) || 1, reach = shot.r + target.r + 0.3;
          if (d > reach) { shot.x += dx / d * s.speed * dt; shot.z += dz / d * s.speed * dt; shot.yaw = Math.atan2(dx, dz); }
          shot.bite -= dt;
          if (d <= reach + 0.2 && shot.bite <= 0) { shot.bite = 0.5; game.damage(target, s.damage, panda, dx / d * s.knock, dz / d * s.knock, 0); game.emit('bite', shot.x, shot.y + 0.4, shot.z, {}); }
        }
        shot.y = groundHeight(shot.x, shot.z) + Math.abs(Math.sin(shot.hop)) * 0.5;
        if (shot.t >= shot.life && shot.evo) { blast(game, panda, shot.x, shot.y, shot.z, 3, s.damage * 2, 6, 5); game.emit('boom', shot.x, shot.y + 0.3, shot.z, { radius: 3 }); }
        break;
      }
      case 'box': {
        if (shot.arm > 0) { shot.arm -= dt; break; }
        let sprung = false;
        game.eachEnemyNear(shot.x, shot.z, 1.3 * shot.width, (enemy) => { if (!enemy.air) sprung = true; });
        if (!sprung) break;
        const radius = 2.5 * shot.width;
        blast(game, panda, shot.x, shot.y, shot.z, radius, s.damage, s.knock, s.speed);
        game.emit('spring', shot.x, shot.y, shot.z, { radius });
        shot.uses--; shot.arm = 1.2;
        if (shot.uses <= 0) shot.dead = true;
        break;
      }
      case 'pellet': {
        shot.x += shot.vx * dt; shot.z += shot.vz * dt; shot.y = Math.max(shot.y, groundHeight(shot.x, shot.z) + 0.5);
        const speed = Math.hypot(shot.vx, shot.vz) || 1;
        game.eachEnemyNear(shot.x, shot.z, shot.r, (enemy) => {
          if (shot.dead || shot.hits.has(enemy.id) || Math.abs(enemy.y - shot.y) > 2.2 + enemy.r) return;
          shot.hits.add(enemy.id);
          game.damage(enemy, s.damage, panda, shot.vx / speed * s.knock, shot.vz / speed * s.knock, 0);
          if (--shot.pierce < 0) shot.dead = true;
        });
        break;
      }
      case 'top': {
        if (!shot.seek || shot.seek.dead || shot.seek.trapped) {
          // Pick any enemy in range, not just the nearest, so tops fan out.
          const near = nearestFew(game, shot.x, shot.z, 6, 12);
          shot.seek = near[(random() * near.length) | 0];
        }
        if (shot.seek) {
          const dx = shot.seek.x - shot.x, dz = shot.seek.z - shot.z, d = Math.hypot(dx, dz) || 1;
          shot.vx += (dx / d * s.speed - shot.vx) * Math.min(1, dt * 5); shot.vz += (dz / d * s.speed - shot.vz) * Math.min(1, dt * 5);
        }
        const nx = shot.x + shot.vx * dt, nz = shot.z + shot.vz * dt;
        if (isWater(nx, nz)) { shot.vx = -shot.vx; shot.vz = -shot.vz; shot.seek = undefined; } else { shot.x = nx; shot.z = nz; }
        shot.y = groundHeight(shot.x, shot.z);
        game.eachEnemyNear(shot.x, shot.z, shot.r, (enemy, d) => {
          if ((shot.hits.get(enemy.id) ?? 0) > game.t) return;
          shot.hits.set(enemy.id, game.t + 0.4);
          game.damage(enemy, s.damage, panda, (enemy.x - shot.x) / (d || 1) * s.knock, (enemy.z - shot.z) / (d || 1) * s.knock, 3);
          if (enemy === shot.seek) shot.seek = undefined;
        });
        if (shot.evo) {
          shot.pullT -= dt;
          if (shot.pullT <= 0) { shot.pullT = 0.15; game.eachEnemyNear(shot.x, shot.z, 4, (enemy, d) => { if (!enemy.boss && d > 0.8) { enemy.vx += (shot.x - enemy.x) / d * 2.2 / enemy.mass; enemy.vz += (shot.z - enemy.z) / d * 2.2 / enemy.mass; } }); }
        }
        break;
      }
      default: break;
    }
    if (shot.t >= shot.life) {
      if (shot.kind === 'bubble' && !shot.dead) popBubble(game, shot);
      shot.dead = true;
    }
  }
  let w = 0;
  for (let i = 0; i < shots.length; i++) if (!shots[i].dead) shots[w++] = shots[i];
  shots.length = w;
}
