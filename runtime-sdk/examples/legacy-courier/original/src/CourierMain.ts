// SPDX-License-Identifier: Apache-2.0
interface CourierRoute {
  name: string;
  marker: string;
}

class CourierMain extends egret.DisplayObjectContainer {
  private routes: CourierRoute[];
  private selected = 0;
  private board: eui.Component;

  constructor() {
    super();
    this.addEventListener(egret.Event.ADDED_TO_STAGE, this.open, this);
  }

  private async open(): Promise<void> {
    await RES.loadConfig('resource/routes.res.json', 'resource/');
    await RES.loadGroup('routes');
    this.routes = RES.getRes('routes_json');
    this.selected = Number(egret.localStorage.getItem('route') || '0') === 1 ? 1 : 0;
    this.board = new eui.Component();
    this.board.skinName = 'CourierBoard';
    this.addChild(this.board);
    this.board.choose.addEventListener(egret.TouchEvent.TOUCH_TAP, this.choose, this);
    this.showRoute();
  }

  private choose(): void {
    this.selected = 1 - this.selected;
    egret.localStorage.setItem('route', String(this.selected));
    this.showRoute();
  }

  private showRoute(): void {
    const route = this.routes[this.selected];
    this.board.heading.text = route.name;
    this.board.marker.source = route.marker;
    globalThis.courierObservation = {
      selected: this.selected,
      heading: this.board.heading.text,
      markerWidth: RES.getRes(route.marker).textureWidth,
      saved: egret.localStorage.getItem('route'),
      routeLoaded: RES.isGroupLoaded('routes'),
      controls: this.board.numChildren
    };
  }
}
