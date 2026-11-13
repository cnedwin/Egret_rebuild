import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { EVIDENCE_TOOLS } from "./lib/evidence-lane.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const options = process.argv.slice(2);
if (new Set(options).size !== options.length || options.some(option => option !== "--no-build" && option !== "--no-tests")) throw new TypeError("Usage: node tools/verify.mjs [--no-build] [--no-tests]");
// --no-tests is for a job whose test files run in declared parallel shards; it is never a complete verification.
const withoutTests = options.includes("--no-tests");
// Keep source-boundary, type and behavior checks in one fail-fast sequence. A check written against
// one exact set of product bytes is evidence, listed in tools/lib/evidence-lane.mjs; it never runs here.
const gates = [...(options.includes("--no-build") ? [] : ["build"]), "check-boundaries", "check-spine-content", "check-type-lanes", "check-types", ...(withoutTests ? [] : ["test"]), "verify-spine-f2-source"];
if (gates.some(script => EVIDENCE_TOOLS.includes(script))) throw new Error("An evidence tool cannot be a merge gate");
for (const script of gates) {
  console.log(`VERIFY ${script}`);
  const result = spawnSync(process.execPath, [`tools/${script}.mjs`], { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(withoutTests ? "Prototype verification gates PASS without the test files; every test shard must pass separately." : "All prototype verification gates PASS.");
