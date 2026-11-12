// SPDX-License-Identifier: Apache-2.0
import { copyFileSync } from 'node:fs';

// The standalone build carries the repository's exact first-party license.
copyFileSync(new URL('../../LICENSE', import.meta.url), new URL('../dist/LICENSE', import.meta.url));
