import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const options = process.argv.slice(2);
if (options.length > 1 || options.some(option => option !== "--no-build")) throw new TypeError("Usage: node tools/verify.mjs [--no-build]");
// Keep source-boundary, type and behavior checks in one fail-fast sequence.
for (const script of [...(options.includes("--no-build") ? [] : ["build"]), "check-boundaries", "check-spine-content", "spritesheet-boundary", "sequence-playback-boundary", "browser-png-boundary", "bitmap-resource-slot-boundary", "bitmap-binding-ticket-boundary", "resource-scene-boundary", "atlas-frame/boundary", "atlas-import-boundary", "check-types", "browser-png-types", "test", "verify-spine-f2-source"]) {
  console.log(`VERIFY ${script}`);
  const result = spawnSync(process.execPath, [`tools/${script}.mjs`], { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("All prototype verification gates PASS.");
