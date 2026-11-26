#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
import { runCli } from './cli.mjs';

runCli(process.argv.slice(2)).catch(error => {
  console.error(
    JSON.stringify({
      status: 'failed',
      diagnostic: { code: error.code ?? 'MIGRATE_FAILED', message: error.message, details: error.details }
    })
  );
  process.exitCode = 1;
});
