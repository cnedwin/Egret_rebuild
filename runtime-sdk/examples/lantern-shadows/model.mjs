// SPDX-License-Identifier: Apache-2.0
// Only the fixed game's playbill and HUD are represented here. Gameplay input
// still passes through the pointer ownership and edge detection in its input.mjs.
class GameElement {
  constructor(tag, attributes = {}, parent) {
    this.tag = tag;
    this.id = attributes.id ?? '';
    this.parent = parent;
    this.dataset = {};
    this.style = {};
    this.children = [];
    this.parts = [];
    this.hidden = 'hidden' in attributes;
    this.disabled = 'disabled' in attributes;
    this.attributes = new Map(Object.entries(attributes));
    this.events = new Map();
    const names = new Set((attributes.class ?? '').split(/\s+/).filter(Boolean));
    this.classList = {
      contains: (name) => names.has(name),
      add: (name) => names.add(name),
      remove: (name) => names.delete(name),
      toggle(name, force = !names.has(name)) {
        if (force) names.add(name);
        else names.delete(name);
        return force;
      },
      values: () => [...names]
    };
    for (const [name, value] of this.attributes) {
      if (name.startsWith('data-')) this.dataset[name.slice(5)] = value;
    }
  }
  get textContent() {
    return this.parts.map((item) => (typeof item === 'string' ? item : item.textContent)).join('');
  }
  set textContent(text) {
    this.children = [];
    this.parts = [String(text)];
  }
  set innerHTML(html) {
    this.html = String(html);
    this.textContent = this.html.replace(/<[^>]+>/g, ' ').trim();
  }
  get firstElementChild() {
    return this.children[0];
  }
  get childElementCount() {
    return this.children.length;
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
  removeAttribute(name) {
    this.attributes.delete(name);
    if (name.startsWith('data-')) delete this.dataset[name.slice(5)];
  }
  append(...children) {
    for (const child of children) {
      child.parent = this;
      this.children.push(child);
      this.parts.push(child);
    }
  }
  replaceChildren(...children) {
    this.children = [];
    this.parts = [];
    this.append(...children);
  }
  addEventListener(type, callback) {
    if (!this.events.has(type)) this.events.set(type, new Set());
    this.events.get(type).add(callback);
  }
  emit(type, fields = {}) {
    const e = { target: this, currentTarget: this, preventDefault() {}, ...fields };
    for (const callback of this.events.get(type) ?? []) callback(e);
  }
  click() {
    if (!this.disabled) this.emit('click', { detail: 0 });
  }
  focus() {}
  getBoundingClientRect() {
    return this.bounds;
  }
}
export function createLanternModel(layout, storage) {
  const nodes = new Map(),
    byId = new Map(),
    byAction = new Map();
  const window = new GameElement('window'),
    document = new GameElement('document');
  for (const [index, row] of layout.entries()) {
    const [tag, attributes, parent, text] = row;
    const owner = nodes.get(parent) ?? document;
    const element = new GameElement(tag, attributes, owner);
    if (text) element.textContent = text;
    nodes.set(index, element);
    owner.append(element);
    if (element.id) byId.set(element.id, element);
    if (element.dataset.hold) byAction.set(element.dataset.hold, element);
  }
  document.documentElement = new GameElement('html');
  document.getElementById = (id) => byId.get(id);
  document.createElement = (tag) => new GameElement(tag);
  document.querySelectorAll = (selector) => {
    if (selector === '[data-zh]') return [...nodes.values()].filter((node) => 'zh' in node.dataset);
    if (selector === '[data-hold]') return [...byAction.values()];
    throw new Error('Unexpected game selector ' + selector);
  };
  document.querySelector = (selector) =>
    [...nodes.values()].find((node) => node.classList.contains(selector.slice(1)));
  let observed;
  const captured = new Map();
  return {
    document,
    window,
    storage,
    node(id) {
      return byId.get(id);
    },
    observe(read) {
      observed = read;
    },
    onClick(id) {
      byId.get(id)?.click();
    },
    control(action, type, pointerId) {
      if (type === 'down') {
        if (!byAction.has(action) || captured.has(pointerId)) return;
        const node = byAction.get(action);
        captured.set(pointerId, node);
        node.emit('pointerdown', { pointerId, pointerType: 'touch', button: 0 });
      } else if (type === 'up' || type === 'cancel') {
        const node = captured.get(pointerId);
        if (!node) return;
        const kind = type === 'up' ? 'pointerup' : 'pointercancel',
          fields = { pointerId, pointerType: 'touch', button: 0 };
        node.emit(kind, fields);
        window.emit(kind, fields);
        captured.delete(pointerId);
      }
    },
    pause() {
      for (const id of [...captured.keys()]) this.control('', 'cancel', id);
      window.emit('blur');
    },
    route() {
      const game = observed?.();
      if (!game) return { playing: false };
      const { level, clones, ...act } = game.act;
      // The Tiled level is immutable and already included in the game. Clone
      // count is enough for input routing; never move the full level per frame.
      return {
        stage: game.stage,
        playing: game.playing,
        paused: !byId.get('paused').hidden,
        clones: clones.length,
        act
      };
    },
    snapshot() {
      const debug = observed?.(),
        act = debug?.act;
      const ids = [
        'curtain',
        'hud',
        'paused',
        'result',
        'rank',
        'clock',
        'soldiers',
        'boss',
        'boss-health',
        'combo-count',
        'notice',
        'result-title',
        'show-records',
        'replay',
        'tally'
      ];
      const snapshotNodes = {};
      for (const id of ids) {
        const item = byId.get(id);
        if (!item) continue;
        snapshotNodes[id] = {
          text: item.textContent,
          hidden: item.hidden,
          disabled: item.disabled,
          classes: item.classList.values(),
          style: { ...item.style }
        };
      }
      return {
        stage: debug?.stage,
        playing: debug?.playing ?? false,
        paused: byId.get('paused')?.hidden === false,
        phase: act?.state,
        result: act?.result ?? null,
        hero: act && { x: act.hero.x, y: act.hero.y, health: act.hero.health, facing: act.hero.facing },
        enemies: act?.foes.filter((foe) => !foe.gone && foe.health > 0).length,
        boss: act?.boss && {
          x: act.boss.x,
          y: act.boss.y,
          health: act.boss.health,
          phase: act.boss.phase,
          state: act.boss.state
        },
        rank: act?.result?.rank ?? null,
        stored: storage.getItem('lantern-shadows-records'),
        nodes: snapshotNodes
      };
    }
  };
}
