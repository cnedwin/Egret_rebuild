// SPDX-License-Identifier: Apache-2.0
import {createScene, PAGE} from '../scene/scene.mjs';
import {createPumpedHost} from '../scene/pumpedHost.mjs';
import {createCapturedProjectEncoder} from '../scene/project-frame.mjs';

// Send whole owned ArrayBuffers. JavaScriptCore owns the bytes until the host copies them.
export function createIosScene(bridge) {
  const host = createPumpedHost(() => bridge.now());
  const encoder = createCapturedProjectEncoder();
  let opening, scene, closing;
  let pages;

  async function start() {
    if (closing) throw new Error('iOS scene closed');
    opening ??= createScene(host).then(created => {
      scene = created;
      pages = new Map([[created.page, PAGE.id]]);
      return true;
    });
    return opening;
  }
  function publish() {
    if (!scene || closing) throw new Error('iOS scene unavailable');
    return bridge.upload(PAGE.id, PAGE.width, PAGE.height, scene.pageBytes().buffer);
  }
  return Object.freeze({
    start, publish, poll: host.poll,
    frame(index) {
      if (!scene || closing) throw new Error('iOS scene unavailable');
      return encoder.encode(scene.capture(index), index, pages).buffer;
    },
    close() {
      closing ??= (async () => {
        try {
          if (opening) await opening;
          return scene ? await scene.close() : {releases: 0};
        } finally {
          encoder.clear();
          pages?.clear();
          scene = undefined;
        }
      })();
      return closing;
    }
  });
}
