// SPDX-License-Identifier: Apache-2.0
// The sample's own declarations cover only the APIs used by its original source.
declare namespace egret {
  class DisplayObjectContainer {
    numChildren: number;
    addChild<T>(child: T): T;
    addEventListener(kind: string, listener: () => void, receiver: object): void;
  }
  const Event: {ADDED_TO_STAGE: string};
  const TouchEvent: {TOUCH_TAP: string};
  const localStorage: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): boolean;
  };
}
declare namespace eui {
  class Component extends egret.DisplayObjectContainer {
    skinName: string;
    choose: egret.DisplayObjectContainer;
    heading: {text: string};
    marker: {source: string};
  }
}
declare namespace RES {
  function loadConfig(config: string, root: string): Promise<void>;
  function loadGroup(name: string): Promise<void>;
  function isGroupLoaded(name: string): boolean;
  function getRes(name: string): any;
}
declare var globalThis: {courierObservation: object};
