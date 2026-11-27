// SPDX-License-Identifier: Apache-2.0
import {createIosScene} from './scene.mjs';
const bridge = globalThis.EgretApple;
const scene = createIosScene(bridge);
globalThis.EgretIosScene = scene;
scene.start().then(bridge.ready, error => bridge.fail(String(error)));
