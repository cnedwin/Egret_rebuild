// SPDX-License-Identifier: Apache-2.0
// Explicit finite native lifetime verifier; sustained recovery and timing have separate evidence.
import { main } from './shared-rendering/gl-lifetime-collector.mjs';
await main(process.argv.slice(2));
