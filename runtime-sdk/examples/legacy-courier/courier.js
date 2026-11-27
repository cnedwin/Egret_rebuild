// SPDX-License-Identifier: Apache-2.0
// Self-authored ES2015 classic entry. It uses only the legacy game-facing namespaces.
class CourierMain extends egret.DisplayObjectContainer {
  constructor() {
    super();
    this.addEventListener(egret.Event.ADDED_TO_STAGE, this.open, this);
  }
  async open() {
    await RES.loadConfig('resource/routes.res.json', 'resource/');
    await RES.loadGroup('routes');
    this.routes = RES.getRes('routes_json');
    this.selected = Number(egret.localStorage.getItem('route') ?? '0') === 1 ? 1 : 0;
    this.board = new eui.Component();
    this.board.skinName = 'CourierBoard';
    this.addChild(this.board);
    this.board.choose.addEventListener(egret.TouchEvent.TOUCH_TAP, this.choose, this);
    this.showRoute();
  }
  choose() {
    this.selected = 1 - this.selected;
    egret.localStorage.setItem('route', String(this.selected));
    this.showRoute();
  }
  showRoute() {
    const route = this.routes[this.selected];
    this.board.heading.text = route.name;
    this.board.marker.source = route.marker;
    globalThis.courierObservation = {
      selected: this.selected, heading: this.board.heading.text,
      markerWidth: RES.getRes(route.marker).textureWidth, saved: egret.localStorage.getItem('route'),
      routeLoaded: RES.isGroupLoaded('routes'), controls: this.board.numChildren
    };
  }
}
globalThis.CourierMain = CourierMain;
