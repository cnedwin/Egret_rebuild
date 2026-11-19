// SPDX-License-Identifier: Apache-2.0
import { installPlayerProject } from '@egret/android-player-project';
import { createHerbarium } from './herbarium.mjs';

installPlayerProject({ width: 360, height: 640, clearColor: 0x132422, create: createHerbarium });
