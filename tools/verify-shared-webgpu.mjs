// SPDX-License-Identifier: Apache-2.0
// Finite opt-in native verifier; quality and performance have separate acceptance.
import { main } from './shared-rendering/collector.mjs';
await main(process.argv.slice(2));
