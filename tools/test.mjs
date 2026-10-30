import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const files = readdirSync(new URL("../tests", import.meta.url)).filter((name) => name.endsWith(".test.mjs")).sort().map((name) => `tests/${name}`);
// The optional SDK stays outside the four-core DAG but participates in normal delivery.
files.push(...readdirSync(new URL('../packages/spine/test',import.meta.url)).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>'packages/spine/test/'+name));
const result = spawnSync(process.execPath, ["--test", ...files], { cwd: root, stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
