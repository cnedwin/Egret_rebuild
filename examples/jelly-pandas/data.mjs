// SPDX-License-Identifier: Apache-2.0
// Game content: panda skins, toys, charms, candy enemies, bosses and the
// pacing of a run. Plain data, shared by the simulation and the screen.

export const RUN = Object.freeze({
  bossTimes: [300, 600, 900],
  firstElite: 90, eliteEvery: 75,
  firstSurge: 150, surgeEvery: 150, surgeSeconds: 20,
  maxEnemies: 260,
  maxToyLevel: 8, maxCharmLevel: 5, toySlots: 6, charmSlots: 6,
});

/** Jelly pandas: `body` tints the jelly, `patch` the ears, eyes and limbs, `pattern` paints the belly, `start` is the first toy. */
export const SKINS = [
  { key: 'bamboo', start: 'bowler', en: 'Bamboo', zh: '青竹', body: 0x8fe6a0, patch: 0x1f6b3a, pattern: 'leaves', accent: 0xf4ffd0 },
  { key: 'peach', start: 'bubble', en: 'Peach', zh: '蜜桃', body: 0xffb3c7, patch: 0xc2356b, pattern: 'hearts', accent: 0xfff0f5 },
  { key: 'ocean', start: 'hose', en: 'Ocean', zh: '海盐', body: 0x8fd4ff, patch: 0x1d4fa8, pattern: 'waves', accent: 0xe8f8ff },
  { key: 'mango', start: 'lobber', en: 'Mango', zh: '芒果', body: 0xffd866, patch: 0xc76a12, pattern: 'spots', accent: 0xfff8d8 },
  { key: 'grape', start: 'yoyo', en: 'Grape', zh: '葡萄', body: 0xc9a2ff, patch: 0x5a2aa8, pattern: 'stars', accent: 0xf3e8ff },
  { key: 'classic', start: 'flail', en: 'Classic', zh: '经典', body: 0xf4f6fb, patch: 0x2a2d3a, pattern: 'stripes', accent: 0xffffff },
  { key: 'cherry', start: 'popper', en: 'Cherry', zh: '樱桃', body: 0xff8a8a, patch: 0x8f1024, pattern: 'checks', accent: 0xffe6e6 },
  { key: 'mint', start: 'ripple', en: 'Mint', zh: '薄荷', body: 0x9ff2e0, patch: 0x0f7a72, pattern: 'swirl', accent: 0xeafffb },
];

/**
 * Toys fire on their own. `base` holds the starting numbers; each entry of
 * `levels` adds to them for levels 2 to 8. `charm` names the charm that lets
 * a maxed toy evolve, and `evo` describes the evolved toy.
 */
export const TOYS = [
  { key: 'lobber', icon: '🍯', en: 'Jam Lobber', zh: '果酱投手', den: 'Tosses a blob of jam that bursts on landing and leaves a sticky, stinging patch.', dzh: '抛出一团果酱，落地炸开并留下一片又黏又辣的果酱。',
    base: { damage: 11, cooldown: 2.5, amount: 1, area: 1, duration: 3, extra: 5, range: 13 },
    levels: [{ damage: 4, extra: 1.5 }, { area: 0.2 }, { amount: 1 }, { duration: 1 }, { damage: 5, extra: 1.5, cooldown: -0.15 }, { amount: 1, area: 0.2 }, { damage: 6, cooldown: -0.2 }],
    charm: 'tea', evo: { en: 'Honey Flood', zh: '蜂蜜洪流', den: 'Puddles are huge, slow the horde and never stop burning.', dzh: '果酱滩变得巨大，减速糖果大军并持续灼烧。' } },
  { key: 'ripple', icon: '🌀', en: 'Belly Drum', zh: '肚皮鼓', den: 'Breathe in to tug enemies closer, then thump your tummy and send a shock ring through them.', dzh: '先吸气把敌人拽近，再拍响肚皮，让一圈震波穿过它们。',
    base: { damage: 11, cooldown: 3.4, area: 1, range: 6.5, knock: 8, speed: 20 },
    levels: [{ damage: 3 }, { area: 0.15 }, { cooldown: -0.35 }, { damage: 4, knock: 2.5 }, { area: 0.15 }, { cooldown: -0.35 }, { damage: 6, area: 0.2 }],
    charm: 'balloon', evo: { en: 'Tidal Tummy', zh: '潮汐肚皮', den: 'Two rings in a row, and the second throws enemies into the air.', dzh: '连续两道冲击环，第二道把敌人掀上天。' } },
  { key: 'flail', icon: '⛓️', en: 'Gumball Flail', zh: '口香糖流星锤', den: 'A gumball on a chain circles you and clobbers anything in its orbit.', dzh: '拴在链子上的口香糖球绕着你转圈，砸中轨道上的一切。',
    base: { damage: 13, amount: 1, range: 2.2, speed: 5, extra: 0.6, knock: 6 },
    levels: [{ damage: 3 }, { range: 0.4 }, { speed: 1 }, { amount: 1 }, { extra: 0.15 }, { damage: 4 }, { range: 0.4, speed: 1 }],
    charm: 'mochi', evo: { en: 'Wrecking Planet', zh: '毁灭行星', den: 'A giant ball that launches whatever it touches.', dzh: '巨型球体，碰到谁就把谁打飞。' } },
  { key: 'bowler', icon: '🎳', en: 'Bamboo Bowler', zh: '竹筒保龄', den: 'Sends a weighty ball rolling at the nearest candy; hills steer it and whatever is in the way gets run over.', dzh: '朝最近的糖果滚出一颗沉球，地形会带偏它，挡路的都会被碾过。',
    base: { damage: 20, cooldown: 3, amount: 1, speed: 18, duration: 4.2, extra: 1, knock: 8 },
    levels: [{ damage: 6 }, { amount: 1 }, { cooldown: -0.4 }, { extra: 0.18 }, { speed: 4 }, { amount: 1 }, { damage: 10 }],
    charm: 'shoes', evo: { en: 'Strike Storm', zh: '全中风暴', den: 'Balls split into three when they hit their first enemy.', dzh: '保龄球撞到第一个敌人时分裂成三颗。' } },
  { key: 'yoyo', icon: '🪀', en: 'Yo-yo', zh: '悠悠球', den: 'Whips out at a nearby enemy and reels back in; even the string stings.', dzh: '甩向附近的敌人再收回，连绳子都会抽人。',
    base: { damage: 10, cooldown: 1.7, amount: 1, range: 8.5, speed: 19, extra: 3, knock: 3 },
    levels: [{ amount: 1 }, { damage: 4 }, { range: 2 }, { cooldown: -0.25 }, { amount: 1 }, { damage: 6 }, { range: 2, extra: 5 }],
    charm: 'key', evo: { en: 'Walk the Dog', zh: '遛狗绝技', den: 'Yo-yos stop at full stretch and spin in place, shredding everything.', dzh: '悠悠球飞到尽头后原地高速旋转，绞碎周围一切。' } },
  { key: 'rocket', icon: '🚀', en: 'Soda Rockets', zh: '汽水火箭', den: 'Shaken bottles blast off, pick the busiest patch of candy and crash down on it.', dzh: '摇过的汽水瓶冲上天，挑糖果最多的地方砸下去。',
    base: { damage: 22, cooldown: 2.4, amount: 1, range: 22, knock: 7, area: 1, duration: 1 },
    levels: [{ amount: 1 }, { area: 0.2 }, { damage: 8 }, { amount: 1 }, { cooldown: -0.3 }, { damage: 10 }, { amount: 1 }],
    charm: 'pepper', evo: { en: 'Cola Barrage', zh: '可乐弹幕', den: 'Each blast scatters four fizzing bomblets.', dzh: '每次爆炸再散出四枚汽水小炸弹。' } },
  { key: 'bubble', icon: '🫧', en: 'Bubble Wand', zh: '泡泡棒', den: 'Drifting bubbles swallow enemies, carry them up and burst.', dzh: '飘动的泡泡吞下敌人，带上半空后破裂。',
    base: { damage: 10, cooldown: 2.6, amount: 2, area: 1, duration: 2.6, speed: 5, pierce: 1, extra: 4 },
    levels: [{ amount: 1 }, { damage: 4, extra: 2 }, { area: 0.2 }, { amount: 1 }, { duration: 1 }, { damage: 6, pierce: 1 }, { amount: 1 }],
    charm: 'hourglass', evo: { en: 'Bubble Bath', zh: '泡泡浴', den: 'Popping a bubble blows two more out of it.', dzh: '每个泡泡破裂时再吹出两个新泡泡。' } },
  { key: 'chomper', icon: '🦷', en: 'Wind-up Teeth', zh: '发条假牙', den: 'Little sets of teeth get wound up and go hopping off to nibble the horde.', dzh: '上好发条的小假牙蹦蹦跳跳地去啃糖果大军。',
    base: { damage: 9, cooldown: 5.2, amount: 2, duration: 6, speed: 6.5, extra: 6, knock: 2 },
    levels: [{ amount: 1 }, { damage: 4 }, { duration: 2 }, { amount: 1, extra: 2 }, { speed: 1.75 }, { damage: 6 }, { amount: 2, extra: 2 }],
    charm: 'clover', evo: { en: 'Shark Bite', zh: '鲨鱼之咬', den: 'Teeth are bigger and explode when they wind down.', dzh: '假牙变大，发条走完时爆炸。' } },
  { key: 'box', icon: '🎁', en: 'Jack-in-the-box', zh: '弹簧盒', den: 'Leaves gift boxes behind; step near one and the spring inside flings you skyward.', dzh: '在身后留下礼盒，敌人一靠近，里面的弹簧就把它弹上天。',
    base: { damage: 24, cooldown: 3.6, amount: 1, duration: 18, area: 1, extra: 0, knock: 6, speed: 14 },
    levels: [{ amount: 1 }, { damage: 8 }, { area: 0.2 }, { cooldown: -0.4 }, { amount: 1 }, { damage: 12 }, { extra: 1 }],
    charm: 'band', evo: { en: 'Surprise Party', zh: '惊喜派对', den: 'Boxes re-arm three times and spring twice as wide.', dzh: '弹簧盒可重复触发三次，范围翻倍。' } },
  { key: 'popper', icon: '🎉', en: 'Confetti Cannon', zh: '彩纸礼炮', den: 'Sprays a fan of confetti at the nearest candy.', dzh: '朝最近的糖果喷出一扇彩纸。',
    base: { damage: 8, cooldown: 1.2, amount: 6, pierce: 2, range: 6, knock: 5, extra: 26, speed: 25 },
    levels: [{ amount: 2 }, { damage: 3 }, { pierce: 1 }, { range: 1, extra: 4 }, { cooldown: -0.15 }, { damage: 4 }, { amount: 3 }],
    charm: 'magnet', evo: { en: 'Grand Finale', zh: '盛大终章', den: 'Fires in every direction at once.', dzh: '同时向四面八方开火。' } },
  { key: 'top', icon: '🌪️', en: 'Spinning Tops', zh: '陀螺', den: 'Launches tops that ricochet around the horde, hunting a new target after every hit.', dzh: '放出陀螺在敌群里弹来弹去，每撞一下就找下一个目标。',
    base: { damage: 8, cooldown: 3.4, amount: 1, duration: 5, speed: 9, extra: 0.65, knock: 5 },
    levels: [{ amount: 1 }, { damage: 3 }, { duration: 1.5 }, { amount: 1 }, { extra: 0.14 }, { damage: 4 }, { amount: 1 }],
    charm: 'glasses', evo: { en: 'Tornado Tops', zh: '龙卷陀螺', den: 'Tops pull nearby enemies into their spin.', dzh: '陀螺把附近的敌人吸进旋转范围。' } },
  { key: 'hose', icon: '💦', en: 'Jelly Hose', zh: '果冻水枪', den: 'Hoses down the closest group with jelly, pushing it away drop by drop.', dzh: '用果冻水柱冲刷最近的一群敌人，一滴一滴把它们顶回去。',
    base: { damage: 5, cooldown: 3.4, duration: 2.4, range: 11, knock: 2.4, amount: 1, pierce: 1, speed: 24 },
    levels: [{ damage: 2 }, { range: 2 }, { duration: 0.8 }, { damage: 2, knock: 0.8 }, { range: 2 }, { damage: 2 }, { amount: 1 }],
    charm: 'jelly', evo: { en: 'Fire Hydrant', zh: '消防栓', den: 'The stream never stops and pierces the whole crowd.', dzh: '水柱永不停歇，并贯穿整群敌人。' } },
];

/** Charms are passive. `per` is the gain per level in the named stat. */
export const CHARMS = [
  { key: 'mochi', icon: '🍡', en: 'Mochi Heart', zh: '糯米团之心', stat: 'maxHp', per: 0.2, den: '+20% max health', dzh: '生命上限 +20%' },
  { key: 'tea', icon: '🍵', en: 'Bamboo Tea', zh: '竹叶茶', stat: 'regen', per: 0.6, den: '+0.6 health per second', dzh: '每秒回复 0.6 生命' },
  { key: 'pepper', icon: '🌶️', en: 'Chili Jam', zh: '辣椒酱', stat: 'might', per: 0.1, den: '+10% toy damage', dzh: '玩具伤害 +10%' },
  { key: 'key', icon: '🗝️', en: 'Clockwork Key', zh: '发条钥匙', stat: 'haste', per: 0.08, den: 'Toys fire 8% sooner', dzh: '玩具冷却缩短 8%' },
  { key: 'balloon', icon: '🎈', en: 'Balloon', zh: '气球', stat: 'area', per: 0.1, den: '+10% area', dzh: '作用范围 +10%' },
  { key: 'hourglass', icon: '⏳', en: 'Hourglass', zh: '沙漏', stat: 'duration', per: 0.12, den: 'Effects last 12% longer', dzh: '效果持续时间 +12%' },
  { key: 'shoes', icon: '👟', en: 'Spring Shoes', zh: '弹簧鞋', stat: 'speed', per: 0.08, den: '+8% move speed, higher jumps', dzh: '移动速度 +8%，跳得更高' },
  { key: 'magnet', icon: '🧲', en: 'Sprinkle Magnet', zh: '糖粒磁铁', stat: 'magnet', per: 0.3, den: '+30% pickup range', dzh: '拾取范围 +30%' },
  { key: 'glasses', icon: '👓', en: 'Smart Glasses', zh: '聪明眼镜', stat: 'growth', per: 0.1, den: '+10% experience', dzh: '经验获取 +10%' },
  { key: 'jelly', icon: '🍮', en: 'Thick Jelly', zh: '厚果冻', stat: 'armor', per: 0.08, den: '-8% damage taken, +20% body damage', dzh: '受到伤害 -8%，身体伤害 +20%' },
  { key: 'clover', icon: '🍀', en: 'Lucky Clover', zh: '幸运草', stat: 'luck', per: 0.07, den: '+7% chance to hit twice as hard', dzh: '+7% 几率造成双倍伤害' },
  { key: 'band', icon: '🪃', en: 'Bouncy Band', zh: '弹力带', stat: 'knock', per: 0.15, den: '+15% knock-back', dzh: '击退 +15%' },
];

/**
 * Candy enemies. `speed` in metres per second, `touch` is contact damage,
 * `mass` resists knock-back, `gem` is the experience dropped, `from` the
 * second of the run at which the kind starts to appear and `weight` its share.
 */
export const ENEMIES = [
  { key: 'gumdrop', en: 'Gumdrop', zh: '软糖', hp: 12, speed: 2.6, touch: 5, radius: 0.5, mass: 1, gem: 1, from: 0, weight: 10, color: 0xff6b8b },
  { key: 'bean', en: 'Jelly Bean', zh: '果冻豆', hp: 6, speed: 4.2, touch: 3, radius: 0.34, mass: 0.6, gem: 1, from: 40, weight: 7, color: 0x6fd36b },
  { key: 'corn', en: 'Candy Corn', zh: '玉米糖', hp: 20, speed: 2.2, touch: 9, radius: 0.5, mass: 1.2, gem: 2, from: 110, weight: 5, color: 0xffb02e, dash: true },
  { key: 'pop', en: 'Lollipop', zh: '棒棒糖', hp: 40, speed: 2.0, touch: 11, radius: 0.6, mass: 1.8, gem: 3, from: 200, weight: 4, color: 0xff5fd2 },
  { key: 'floss', en: 'Candy Floss', zh: '棉花糖云', hp: 28, speed: 2.4, touch: 7, radius: 0.7, mass: 0.5, gem: 2, from: 330, weight: 4, color: 0xffc8f0, split: true },
  { key: 'mint', en: 'Peppermint', zh: '薄荷糖', hp: 34, speed: 3.4, touch: 6, radius: 0.5, mass: 1, gem: 3, from: 450, weight: 4, color: 0xf2f2f2, bomb: true },
  { key: 'mallow', en: 'Marshmallow', zh: '棉花软糖', hp: 120, speed: 1.6, touch: 16, radius: 0.95, mass: 4, gem: 6, from: 560, weight: 2, color: 0xfff3e0 },
];

/** Bosses arrive at the times in RUN.bossTimes, in this order. */
export const BOSSES = [
  { key: 'pudding', en: 'Pudding Baron', zh: '布丁男爵', hp: 1500, speed: 2.4, touch: 18, radius: 2.4, mass: 30, color: 0xffc34d, attack: 'hop' },
  { key: 'donut', en: 'Donut Roller', zh: '甜甜圈碾压者', hp: 4000, speed: 3.0, touch: 24, radius: 2.6, mass: 40, color: 0xff8fb8, attack: 'charge' },
  { key: 'cake', en: 'Cake Emperor', zh: '蛋糕大帝', hp: 9000, speed: 2.0, touch: 30, radius: 3.2, mass: 60, color: 0xfff0dc, attack: 'volley' },
];

export const TOY_BY_KEY = Object.fromEntries(TOYS.map((toy, index) => [toy.key, index]));
export const CHARM_BY_KEY = Object.fromEntries(CHARMS.map((charm, index) => [charm.key, index]));

/** Experience needed to go from `level` to the next. */
export const experienceFor = (level) => Math.round(5 + level * 4 + Math.pow(level, 1.7) * 1.1);

/** Interface text in both languages. */
export const TEXT = {
  title: { en: 'JELLY PANDAS', zh: '果冻熊猫' },
  tagline: { en: 'Hold the toy island for fifteen minutes against the candy horde.', zh: '在玩具岛上抵挡糖果大军十五分钟。' },
  play: { en: 'Play', zh: '开始' },
  party: { en: 'Party', zh: '队伍' },
  solo: { en: 'Solo', zh: '单人' },
  friend: { en: 'friend', zh: '位伙伴' },
  friends: { en: 'friends', zh: '位伙伴' },
  pick: { en: 'Pick your panda', zh: '选择你的熊猫' },
  levelUp: { en: 'LEVEL UP!', zh: '升级！' },
  reroll: { en: 'Reroll (R)', zh: '重抽 (R)' },
  newToy: { en: 'New toy', zh: '新玩具' },
  newCharm: { en: 'New charm', zh: '新护符' },
  evolve: { en: 'EVOLVE', zh: '进化' },
  level: { en: 'Lv', zh: '等级' },
  paused: { en: 'Paused', zh: '已暂停' },
  resume: { en: 'Resume', zh: '继续' },
  restart: { en: 'Restart', zh: '重新开始' },
  quit: { en: 'Title', zh: '回到标题' },
  defeat: { en: 'The candy won', zh: '糖果赢了' },
  victory: { en: 'The island is safe!', zh: '玩具岛守住了！' },
  survived: { en: 'Survived', zh: '坚持时间' },
  kills: { en: 'Candy squashed', zh: '压扁的糖果' },
  again: { en: 'Play again', zh: '再来一次' },
  bossIncoming: { en: 'incoming!', zh: '来袭！' },
  surge: { en: 'CANDY SURGE!', zh: '糖果狂潮！' },
  elite: { en: 'A crowned candy appears', zh: '戴皇冠的糖果出现了' },
  down: { en: 'is down! Stand next to them', zh: '倒下了！站到身边救起' },
  revived: { en: 'is back up', zh: '重新站起来了' },
  heal: { en: 'Bamboo snack', zh: '竹笋点心' }, healDesc: { en: 'Restore 30% health', zh: '回复 30% 生命' },
  bonus: { en: 'Sprinkle shower', zh: '糖粒雨' }, bonusDesc: { en: 'A burst of experience', zh: '获得一批经验' },
  clickToPlay: { en: 'Click to capture the mouse', zh: '点击画面锁定鼠标' },
  controls: {
    en: 'WASD move · Mouse look · Space jump (hold: super jump) · Ctrl / Left click / Q slam in the air, belly-bump on the ground · Shift / Right click / E roll · 1-3 pick a card · R reroll · Esc menu',
    zh: 'WASD 移动 · 鼠标转视角 · 空格跳跃（长按蓄力大跳）· Ctrl / 左键 / Q 空中下砸、地面肚皮撞 · Shift / 右键 / E 翻滚 · 1-3 选卡 · R 重抽 · Esc 菜单',
  },
  chest: { en: 'Treasure! Free upgrade', zh: '宝箱！免费升级' },
  toyMax: { en: 'MAX', zh: '满级' },
};
