import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
// Keep source-boundary, type and behavior checks in one fail-fast sequence.
for (const script of ["build", "check-boundaries", "spritesheet-boundary", "sequence-playback-boundary", "browser-png-boundary", "bitmap-resource-slot-boundary", "bitmap-binding-ticket-boundary", "resource-scene-boundary", "check-types", "browser-png-types", "test", "verify-spine-f2-source"]) {
  console.log(`VERIFY ${script}`);
  const result = spawnSync(process.execPath, [`tools/${script}.mjs`], { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("All prototype verification gates PASS.");
