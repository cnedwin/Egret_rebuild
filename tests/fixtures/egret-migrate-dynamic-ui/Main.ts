// SPDX-License-Identifier: Apache-2.0
// Original migration control. The browser driver selects rows with real pointer events.
class StockBadge extends eui.Group {}
class StockRow extends eui.ItemRenderer {
  static created = 0;
  constructor() { super(); StockRow.created++; this.skinName = "StockRowSkin"; }
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
    let beforeRange = 0;
    // This hook exposes observations and equivalent model actions to both browser versions.
    (globalThis as any).stockProbe = {
      snapshot: () => ({
        status: menu.status.text, state: menu.currentState, badgeVisible: !!menu.badge.parent,
        selected: menu.inventory.selectedItem?.name ?? null, picks: picked.slice(),
        count: menu.items.length, scroll: menu.inventory.scrollV,
        firstLabel: (menu.inventory.getElementAt(0) as any)?.titlePart?.text ?? null
      }),
      openRange: () => {
        beforeRange = StockRow.created;
        menu.inventory.useVirtualLayout = true;
        menu.items = new eui.ArrayCollection(Array.from({ length: 1000 }, (_, i) => ({ name: "Lot " + i })));
        menu.inventory.scrollV = 0;
      },
      jumpTo: (index: number) => {
        const maxScroll = Math.max(0, menu.items.length * 32 - menu.inventory.height);
        menu.inventory.scrollV = Math.min(index * 32, maxScroll);
      },
      rangeState: (index: number) => {
        const list = menu.inventory;
        let center: number[] | null = null;
        let label: string | null = null;
        for (let i = 0; i < list.numChildren; i++) {
          const row = list.getChildAt(i) as any;
          if (row.visible && row.itemIndex === index && row.data === menu.items.getItemAt(index)) {
            const p = row.localToGlobal(24, 16);
            center = [p.x, p.y];
            label = row.titlePart?.text ?? null;
            break;
          }
        }
        return { center, label, selected: list.selectedIndex, created: StockRow.created - beforeRange,
          children: list.numChildren, length: menu.items.length, lastTap: picked[picked.length - 1] };
      },
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
