import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("public package headless example joins events, Scope, display tree and Engine shutdown", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const result = spawnSync(process.execPath, ["examples/headless.mjs"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.deepEqual(output, {
    defaultAllowed: false,
    trace: ["host.start", "capture", "button:headless", "bubble", "scope:closing", "lease.release", "host.stop", "host.close"],
    scopeState: "closed",
    panelDisposed: true,
    buttonDisposed: true,
    stageDisposed: true,
    pendingTimers: 0,
  });
});
