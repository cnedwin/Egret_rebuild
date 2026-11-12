import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseShard, selectShard } from "./lib/test-shards.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const options = process.argv.slice(2);
if (options.length > 1 || options.some(option => !option.startsWith("--shard="))) throw new TypeError("Usage: node tools/test.mjs [--shard=<index>/<count>]");
const files = readdirSync(new URL("../tests", import.meta.url)).filter((name) => name.endsWith(".test.mjs")).sort().map((name) => `tests/${name}`);
// The optional SDK stays outside the four-core DAG but participates in normal delivery.
files.push(...readdirSync(new URL('../packages/spine/test',import.meta.url)).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>'packages/spine/test/'+name));
// Slowest files as measured on hosted Windows. They are dealt before the rest, one row per round,
// so each of four shards receives one file from every row.
const slow = [
  "tests/boundaries.test.mjs", "tests/project-boundaries.test.mjs", "tests/atlas-import-boundary.test.mjs", "tests/spritesheet-boundaries.test.mjs",
  "tests/browser-png-boundaries.test.mjs", "tests/browser-png-boundaries-2.test.mjs", "tests/browser-png-boundaries-3.test.mjs", "tests/browser-png-boundaries-4.test.mjs",
  "tests/canvas-text-provider-boundaries.test.mjs", "tests/asset-group-boundaries.test.mjs", "tests/shared-retention-private.test.mjs", "tests/byte-reader-boundaries.test.mjs",
  "tests/text-field-boundaries.test.mjs", "tests/sequence-playback-boundaries.test.mjs", "tests/native-import-lexer.test.mjs", "tests/byte-writer-boundaries.test.mjs",
  "tests/b1-webgpu-verifier.test.mjs", "tests/tween-boundaries.test.mjs", "tests/shared-frame-upload-webgpu.test.mjs", "tests/bitmap-binding-ticket-boundaries.test.mjs",
  "tests/project-restore.test.mjs", "tests/shared-frame-upload-webgl2.test.mjs", "tests/webgpu-mesh-host.test.mjs", "tests/nine-slice-boundaries.test.mjs"
];
let selected = files;
if (options.length === 1) {
  const { index, count } = parseShard(options[0].slice("--shard=".length));
  selected = selectShard(files, index, count, slow);
  // One shard is never the suite: the caller must run every index of the same count.
  console.log(`Test shard ${index}/${count}: ${selected.length} of ${files.length} files; the complete suite is all ${count} shards.`);
  if (selected.length === 0) throw new Error("An empty shard cannot report a pass");
}
const result = spawnSync(process.execPath, ["--test", ...selected], { cwd: root, stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
