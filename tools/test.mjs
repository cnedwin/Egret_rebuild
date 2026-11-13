import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseShard, selectShard } from "./lib/test-shards.mjs";
import { EVIDENCE_TESTS } from "./lib/evidence-lane.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const options = process.argv.slice(2);
// --list prints the selected files and runs nothing.
const listOnly = options.includes("--list"), shards = options.filter(option => option !== "--list");
if (options.length - shards.length > 1 || shards.length > 1 || shards.some(option => !option.startsWith("--shard="))) throw new TypeError("Usage: node tools/test.mjs [--shard=<index>/<count>] [--list]");
// A test file bound to one exact set of product bytes is evidence: tools/evidence.mjs runs it and reports.
const files = readdirSync(new URL("../tests", import.meta.url)).filter((name) => name.endsWith(".test.mjs")).sort().map((name) => `tests/${name}`).filter((file) => !EVIDENCE_TESTS.includes(file));
// The optional SDK stays outside the four-core DAG but participates in normal delivery.
files.push(...readdirSync(new URL('../packages/spine/test',import.meta.url)).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>'packages/spine/test/'+name));
// Slowest files as measured on hosted Windows. They are dealt before the rest, one row per round,
// so each of four shards receives one file from every row.
const slow = [
  "tests/boundaries.test.mjs", "tests/project-boundaries.test.mjs", "tests/canvas-text-provider-boundaries.test.mjs", "tests/asset-group-boundaries.test.mjs",
  "tests/shared-retention-private.test.mjs", "tests/byte-reader-boundaries.test.mjs", "tests/text-field-boundaries.test.mjs", "tests/native-import-lexer.test.mjs",
  "tests/byte-writer-boundaries.test.mjs", "tests/tween-boundaries.test.mjs", "tests/shared-frame-upload-webgpu.test.mjs", "tests/project-restore.test.mjs",
  "tests/shared-frame-upload-webgl2.test.mjs", "tests/nine-slice-boundaries.test.mjs"
];
let selected = files;
if (shards.length === 1) {
  const { index, count } = parseShard(shards[0].slice("--shard=".length));
  selected = selectShard(files, index, count, slow);
  // One shard is never the suite: the caller must run every index of the same count.
  if (!listOnly) console.log(`Test shard ${index}/${count}: ${selected.length} of ${files.length} files; the complete suite is all ${count} shards.`);
  if (selected.length === 0) throw new Error("An empty shard cannot report a pass");
}
// Print in one write and end normally: an early exit can cut off output that a pipe has not taken yet.
if (listOnly) process.stdout.write(selected.map((file) => file + "\n").join(""));
else {
  const result = spawnSync(process.execPath, ["--test", ...selected], { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
