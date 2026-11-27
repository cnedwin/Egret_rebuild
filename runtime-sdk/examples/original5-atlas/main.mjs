// SPDX-License-Identifier: Apache-2.0
import {installOriginal5Project} from '@egret/android-original5';

installOriginal5Project({
  width: 192, height: 128, frameRate: 30,
  entryClass: 'AtlasStation',
  coreGroup: 'originalCore', moduleGroup: 'originalModules', gameGroup: 'originalGame',
  images: [{path: 'assets/station.png', width: 16, height: 8}],
  onReady({egret, root, services}) {
    const report = () => services.state({
      version: egret.Capabilities.engineVersion, native: egret.nativeRender,
      ready: root.ready, turns: root.turns, error: root.failure || '',
      ...(root.field ? {text: root.field.text, focus: root.focusCount, blur: root.blurCount} : {})
    });
    root.addEventListener('stationChanged', report, root);
    report();
  }
});
