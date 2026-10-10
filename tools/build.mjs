import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const compiler = path.join(root, "node_modules/typescript/bin/tsc");
const generated = spawnSync(process.execPath, ["tools/generate-project-format.mjs", "--check"], { cwd: root, stdio: "inherit" });
if (generated.error) throw generated.error;
if (generated.status !== 0) process.exit(generated.status ?? 1);
const result = spawnSync(process.execPath, [compiler, "--build", "--force", "tsconfig.json"], { cwd: root, stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
