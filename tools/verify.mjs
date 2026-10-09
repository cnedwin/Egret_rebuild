import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
for (const script of ["build", "check-boundaries", "check-types", "test"]) {
  console.log(`VERIFY ${script}`);
  const result = spawnSync(process.execPath, [`tools/${script}.mjs`], { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("All prototype verification gates PASS.");
