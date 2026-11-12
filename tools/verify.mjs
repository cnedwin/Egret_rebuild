import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const options = process.argv.slice(2);
if (new Set(options).size !== options.length || options.some(option => option !== "--no-build" && option !== "--no-tests")) throw new TypeError("Usage: node tools/verify.mjs [--no-build] [--no-tests]");
// --no-tests is for a job whose test files run in declared parallel shards; it is never a complete verification.
const withoutTests = options.includes("--no-tests");
// Keep source-boundary, type and behavior checks in one fail-fast sequence.
for (const script of [...(options.includes("--no-build") ? [] : ["build"]), "check-boundaries", "check-spine-content", "spritesheet-boundary", "sequence-playback-boundary", "browser-png-boundary", "bitmap-resource-slot-boundary", "bitmap-binding-ticket-boundary", "resource-scene-boundary", "atlas-frame/boundary", "atlas-import-boundary", "check-types", "browser-png-types", ...(withoutTests ? [] : ["test"]), "verify-spine-f2-source"]) {
  console.log(`VERIFY ${script}`);
  const result = spawnSync(process.execPath, [`tools/${script}.mjs`], { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(withoutTests ? "Prototype verification gates PASS without the test files; every test shard must pass separately." : "All prototype verification gates PASS.");
