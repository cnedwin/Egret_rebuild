// SPDX-License-Identifier: Apache-2.0
/** A completed or aborted selection must never capture the next deal on the same socket. */
export function bindTableChoices(socket, scene) {
  const choices = { privateWindow: undefined, globalWindow: undefined, page: 0 };
  const reset = () => {
    choices.privateWindow = choices.globalWindow = scene.globalCardSelectorWindow = undefined;
    choices.page = 0;
  };
  socket.on('game begin', reset);
  socket.on('game end', reset);
  return choices;
}

// The owner's Room, card packages and SelfPlayer retain authority over each offered action.
// This adapter presents their state on a compact table without importing the old effects renderer.
export function createTableView({
  egret,
  eui,
  Game,
  SceneLobby,
  SceneRoom,
  SceneGame,
  SelfGameArea,
  SkillButton,
  status,
  socket
}) {
  const sceneGame = new eui.Group();
  const seats = new Map();
  const table = new eui.Group();
  const controls = new Map();
  const pictures = [];
  const header = new eui.Label();
  const prompt = new eui.Label();
  let result = '',
    lastAction = '',
    gameNumber = 0,
    scheduled = false;
  const choices = bindTableChoices(socket, sceneGame);
  let disconnected = false;
  Object.assign(header, { x: 32, y: 30, width: 1065, height: 50, size: 28 });
  Object.assign(prompt, { x: 32, y: 175, width: 1050, height: 85, size: 23 });
  sceneGame.addChild(header);
  sceneGame.addChild(prompt);
  sceneGame.addChild(table);

  function queue() {
    if (!scheduled) {
      scheduled = true;
      // A Socket.IO packet can change several related fields before Room returns.
      queueMicrotask(() => {
        scheduled = false;
        render();
      });
    }
  }
  function button(parent, name, label, x, y, width, click) {
    let control = controls.get(name);
    if (!control) {
      control = new eui.Button();
      control.name = name;
      if (click)
        control.addEventListener(
          egret.TouchEvent.TOUCH_TAP,
          () => {
            control.activate?.();
            queue();
          },
          control
        );
      parent.addChild(control);
      controls.set(name, control);
    }
    if (control.label !== label) control.label = label;
    Object.assign(control, { x, y, width, height: 52, visible: true, activate: click });
    return control;
  }
  function equipSlot() {
    const node = new eui.Group();
    node.setCallback = function (actions) {
      this.callbacks = actions;
      this.canSelect = true;
    };
    return node;
  }
  function area(id) {
    if (seats.has(id)) return seats.get(id);
    const control = button(sceneGame, 'target-' + id, '', 32 + Math.max(id, 0) * 530, 95, 490);
    const entry = {
      componentToSelect: control,
      img_selected: {},
      img_dark: {},
      HPArea: {},
      equipUI: Array.from({ length: 4 }, equipSlot),
      cardCountLabel: { lb_cardCount: {} },
      addToJudgeZoneUI: queue,
      removeFromJudgeZoneUI: queue,
      refreshSkillButtons: queue,
      cancelSelectedSkill: queue
    };
    control.addEventListener(egret.TouchEvent.TOUCH_TAP, queue, control);
    seats.set(id, entry);
    return entry;
  }
  const gameArea = {
    handCardsCollection: new eui.ArrayCollection(),
    selectedCards: [],
    minSelectCount: 0,
    maxSelectCount: 0,
    list_handCards: { selectedItems: [] },
    get equipUI() {
      return area(Game.room.selfPlayer.seatID).equipUI;
    },
    refreshSelectedItem: queue
  };
  gameArea.list_handCards.dataProvider = gameArea.handCardsCollection;
  // Keep the original hand, target and skill selection rules, including equipment choices.
  for (const name of [
    'selectedCount',
    'selectedCardIDs',
    'selectCorrectly',
    'getEnabledCards',
    'onChangeHand',
    'onChangeEquip',
    'cancelSelectCards',
    'onChange',
    'cancelSelection',
    'refreshCardStatus',
    'refreshEquipCanSelect',
    'clearSelectedHandCards'
  ]) {
    Object.defineProperty(gameArea, name, Object.getOwnPropertyDescriptor(SelfGameArea.prototype, name));
  }
  for (const name of ['clearPlayerSelect', 'refreshPlayerSelect', 'filterSelect']) {
    Object.defineProperty(sceneGame, name, Object.getOwnPropertyDescriptor(SceneGame.prototype, name));
  }
  sceneGame.disposeZoneUI = [];
  sceneGame.refreshTip = queue;
  const UI = {
    get sceneLobby() {
      return SceneLobby.instance;
    },
    get sceneRoom() {
      return SceneRoom.instance;
    },
    sceneGame,
    generalArea: area,
    bigArea: area,
    self: {
      gameArea,
      get generalArea() {
        return area(Game.room.selfPlayer?.seatID ?? -1);
      },
      operationArea: { refreshButtonStatus: queue }
    },
    others: { gameArea: { initGeneralAreas: queue } }
  };

  function cardName(card) {
    return card?.class?.tipName || card?.class?.name || '暗牌';
  }
  class CardSelectorWindow {
    constructor({ title, cardCount, hand, equip, judge }) {
      this.title = title;
      this.needed = cardCount;
      this.cards = [...hand, ...equip, ...judge];
      this.judge = new Set(judge);
      this.picked = new Set();
    }
    show() {
      choices.privateWindow = this;
      choices.page = 0;
      queue();
    }
    select(index) {
      if (this.picked.has(index)) this.picked.delete(index);
      else this.picked.add(index);
      if (this.picked.size !== this.needed) return;
      const chosen = [...this.picked].map(i => this.cards[i]);
      socket.emit('select cards', {
        cardIDs: chosen.map(card => card.cardID),
        classNames: chosen.filter(card => card.virtual && this.judge.has(card)).map(card => card.class.name)
      });
      choices.privateWindow = undefined;
      Game.room.selfPlayer.endAsk();
    }
  }
  class GlobalCardSelectorWindow {
    constructor(title, cards) {
      this.title = title;
      this.cards = cards;
      this.used = new Set();
      this.canSelect = false;
    }
    show() {
      choices.globalWindow = sceneGame.globalCardSelectorWindow = this;
      choices.page = 0;
      queue();
    }
    dark(id) {
      this.used.add(id);
      queue();
    }
    exit() {
      choices.globalWindow = sceneGame.globalCardSelectorWindow = undefined;
      queue();
    }
    select(index) {
      const card = this.cards[index];
      if (!this.canSelect || this.used.has(card.cardID)) return;
      this.canSelect = false;
      socket.emit('select card', card.cardID);
      Game.room.selfPlayer.endAsk();
    }
  }

  const actions = {
    ok: '确定',
    cancel: '取消',
    over: '结束出牌',
    heart: '红桃',
    diamond: '方块',
    club: '梅花',
    spade: '黑桃'
  };
  function render() {
    if (!Game.room?.selfPlayer || !sceneGame.parent) return;
    if (disconnected) {
      sceneGame.touchChildren = false;
      prompt.text = '与房间服务器的连接已断开。请刷新并重新建房。';
      return;
    }
    const { selfPlayer, players, askingParam, round } = Game.room;
    header.text =
      '第 ' +
      gameNumber +
      ' 局 · ' +
      (result || (round.player ? round.player.name + '的回合' : '发牌')) +
      (lastAction ? '  |  ' + lastAction : '');
    for (const [id, seat] of seats) {
      const player = players[id];
      const control = seat.componentToSelect;
      control.visible = !!player;
      if (!player) continue;
      control.enabled = !result && !player.cannotSelect;
      control.label =
        (player === selfPlayer ? '自己 ' : '对方 ') +
        player.name +
        '  体力 ' +
        player.HP +
        '/' +
        player.maxHP +
        '  手牌 ' +
        player.hand.length +
        (player.selected ? '  ✓' : '');
    }
    const picker = choices.privateWindow || choices.globalWindow;
    prompt.text = (
      picker?.title ||
      (askingParam?.tip ? askingParam.tip() : '') ||
      (result ? '等待下一局' : '等待对方操作')
    ).replace(/<[^>]*>/g, '');
    const announcement = header.text + ' · ' + prompt.text;
    if (status.textContent !== announcement) status.textContent = announcement;
    for (const child of controls.values()) {
      if (child.parent === table) {
        child.visible = false;
        child.activate = undefined;
      }
    }
    for (const picture of pictures) picture.visible = false;
    if (result) return;
    const cards = picker ? picker.cards : selfPlayer.hand;
    const perPage = 10;
    const lastPage = Math.max(0, Math.ceil(cards.length / perPage) - 1);
    choices.page = Math.min(choices.page, lastPage);
    const enabled = askingParam && !picker ? gameArea.getEnabledCards() : [];
    cards.slice(choices.page * perPage, (choices.page + 1) * perPage).forEach((card, i) => {
      const index = i + choices.page * perPage;
      const selected = picker ? picker.picked?.has(index) : gameArea.selectedCards.includes(card);
      const control = button(
        table,
        'card-' + index,
        (selected ? '✓ ' : '') + cardName(card) + (card.number ? ' ' + card.number : ''),
        32 + (i % 5) * 211,
        295 + Math.floor(i / 5) * 62,
        193,
        () => {
          if (picker) {
            picker.select(index);
            return;
          }
          const item = gameArea.handCardsCollection.getItemAt(index);
          const list = gameArea.list_handCards;
          list.selectedItems = selected
            ? list.selectedItems.filter(value => value !== item)
            : [...list.selectedItems, item];
          gameArea.onChangeHand({ itemIndex: index });
        }
      );
      let picture = pictures[i];
      if (!picture) {
        picture = pictures[i] = new eui.Image();
        picture.touchEnabled = false;
        table.addChild(picture);
      }
      const source = 'Card_' + (card.class?.name || 'Back') + '_png';
      if (picture.source !== source) picture.source = source;
      Object.assign(picture, { x: control.x + 4, y: control.y + 3, width: 31, height: 45, visible: true });
      control.enabled = picker
        ? !picker.used || (picker.canSelect && !picker.used.has(card.cardID))
        : !!askingParam && (selected || enabled.includes(card));
    });
    if (lastPage > 0) {
      button(table, 'previous', '上页', 32, 422, 135, () => {
        choices.page--;
      }).enabled = choices.page > 0;
      button(table, 'next', '下页', 180, 422, 135, () => {
        choices.page++;
      }).enabled = choices.page < lastPage;
    }
    if (picker) return;
    let active = 0;
    for (const [key, label] of Object.entries(actions)) {
      const action = askingParam?.btnStatus?.[key];
      if (!action?.visible?.()) continue;
      button(table, 'action-' + key, label, 32 + active++ * 165, 508, 150, () => {
        if (action.onClick) action.onClick();
        else if (key === 'cancel') gameArea.cancelSelection();
      }).enabled = action.enabled?.() ?? true;
    }
    let skillIndex = 0;
    for (const skill of selfPlayer.skills.filter(skill => skill.tipName)) {
      const choice = { skill, selected: Game.room.askingSkillName === skill.name };
      button(table, 'skill-' + skill.name, skill.tipName, 32 + skillIndex++ * 124, 575, 116, () =>
        SkillButton.prototype.onClick.call(choice)
      ).enabled = !!askingParam && (skill.enabled(selfPlayer) || choice.selected);
    }
    for (const card of selfPlayer.equipZoneCards) {
      const slot = gameArea.equipUI[card.class.equipType];
      button(table, 'equip-' + card.cardID, cardName(card), 32 + skillIndex++ * 124, 575, 116, () => {
        slot.selected = !slot.selected;
        slot.callbacks?.[slot.selected ? 'selected' : 'unselected']?.();
      }).enabled = !!askingParam && !!slot.canSelect;
    }
  }

  function initialize() {
    Game.local = false;
    Game.initSocket = () => {
      Game.socket = socket;
    };
    Game.init();
    const room = Game.room;
    // Motion/effect methods affect presentation only. The original listener still updates zones and HP.
    room.moveCardEffect = queue;
    room.playEffect = (player, name) => {
      lastAction = player.name + ' · ' + name;
      queue();
    };
    room.showTargetLines = queue;
    room.playHurtEffect = player => {
      lastAction = player.name + '受伤';
      queue();
    };
    room.playLoseHPEffect = queue;
    room.playCardEffect = (player, name) => {
      lastAction = player.name + ' · ' + (Game.cardClasses[name]?.tipName || name);
      queue();
    };
    room.playSkillEffect = (player, name) => {
      lastAction = player.name + ' · ' + (Game.getSkill(name)?.tipName || name);
      queue();
    };
    socket.on('game begin', () => {
      gameNumber++;
      result = lastAction = '';
      queue();
    });
    socket.on('disconnect', () => {
      disconnected = true;
      queue();
    });
    socket.on('game end', winners => {
      result = '胜方 · ' + winners.map(id => room.players[id].name).join('、');
      queue();
    });
    for (const event of [
      'set seatID',
      'set general',
      'set HP',
      'set maxHP',
      'set alive',
      'move card',
      'set round',
      'set phase',
      'round begin',
      'get skill',
      'set identity',
      'set flag',
      'show global cards window',
      'set global cards window title',
      'ask select global card in window'
    ])
      socket.on(event, queue);
  }
  return { UI, initialize, CardSelectorWindow, GlobalCardSelectorWindow };
}
