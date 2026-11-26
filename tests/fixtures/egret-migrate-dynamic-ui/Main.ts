// SPDX-License-Identifier: Apache-2.0
// Original migration control. The browser driver selects rows with real pointer events.
class StockBadge extends eui.Group {}
class StockRow extends eui.ItemRenderer {
  constructor() { super(); this.skinName = "StockRowSkin"; }
}
class StockPanel extends eui.Component {
  model = { title: "Harbor" };
  items = new eui.ArrayCollection(["Rice", "Tea", "Paper", "Salt", "Ink", "Silk"].map(name => ({ name })));
  inventory!: eui.List;
  status!: eui.Label;
  badge!: StockBadge;
}
class Main extends eui.UILayer {
  protected createChildren(): void {
    super.createChildren();
    const theme = new eui.Theme("resource/default.thm.json", this.stage);
    theme.addEventListener(eui.UIEvent.COMPLETE, () => this.open(), this);
  }
  private open(): void {
    const menu = new StockPanel();
    menu.skinName = "StockPanelSkin";
    menu.currentState = "ready";
    this.addChild(menu);
    const picked: string[] = [];
    menu.inventory.addEventListener(eui.ItemTapEvent.ITEM_TAP, event => {
      picked.push(event.item.name);
    }, this);
    const original = menu.model;
    // This hook exposes observations and equivalent model actions to both browser versions.
    (globalThis as any).stockProbe = {
      snapshot: () => ({
        status: menu.status.text, state: menu.currentState, badgeVisible: !!menu.badge.parent,
        selected: menu.inventory.selectedItem?.name ?? null, picks: picked.slice(),
        count: menu.items.length, scroll: menu.inventory.scrollV,
        firstLabel: (menu.inventory.getElementAt(0) as any)?.titlePart?.text ?? null
      }),
      change: () => {
        menu.model = { title: "Gate" };
        original.title = "Stale";
        menu.currentState = "detail";
        menu.items.addItemAt({ name: "Pear" }, 0);
      },
      scroll: () => { menu.inventory.scrollV = 32; },
      reenter: () => {
        this.removeChild(menu);
        menu.model.title = "Tower";
        menu.items.removeItemAt(0);
        this.addChild(menu);
        menu.currentState = "ready";
      }
    };
  }
}
