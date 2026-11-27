// SPDX-License-Identifier: Apache-2.0
import {createIosScene} from './scene.mjs';
import {openGame} from 'egret-ios:game';
const bridge = globalThis.EgretApple;
const scene = createIosScene(bridge,openGame);
globalThis.EgretIosScene = scene;
scene.start().then(({width,height}) => bridge.ready(width,height), error => bridge.fail(String(error)));
