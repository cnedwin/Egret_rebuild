// SPDX-License-Identifier: Apache-2.0
import { installPlayerProject } from '@egret/android-player-project';
import { openLegacyAndroid } from '@egret/legacy/android';
import theme from './theme.json';

const images = ['north', 'south'].map((name, i) => ({ url: name + '.png', page: i + 1, width: 8, height: 8 }));
const resources = {
  configUrl: 'resource/routes.res.json', root: 'resource/',
  resources: [{ name: 'routes_json', type: 'json', url: 'routes.json' },
    ...images.map(image => ({ name: image.url.slice(0, -4) + '_png', type: 'image', url: image.url }))],
  groups: [{ name: 'routes', keys: ['routes_json', 'north_png', 'south_png'] }]
};
installPlayerProject({
  width: 320, height: 180, clearColor: 0x192334,
  async create(services) {
    const game = await openLegacyAndroid(services, {
      width: 320, height: 180, projectId: 'p_legacy_courier', scriptGroup: 'courier',
      entry: 'CourierMain', theme, resources, images,
      onError: error => services.state({ error: String(error) })
    });
    let last;
    return { ...game, update() {
      const value = globalThis.courierObservation;
      if (last !== value) { last = value; services.state(value); }
    }, closedSnapshot: () => services.raster.textPageUsage() };
  }
});
