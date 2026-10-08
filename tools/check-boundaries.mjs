import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("..", import.meta.url));
const expected = {
  contracts: [],
  runtime: ["@egret/contracts"],
  engine: ["@egret/contracts", "@egret/runtime"],
};
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const file = path.join(dir, item.name);
    return item.isDirectory() ? files(file) : [file];
  });
}
let inspected = 0;
const forbidden = /\b(?:document|window|HTMLCanvasElement|GPUDevice|process|Buffer|require)\b|["']node:/;
for (const [name, allowed] of Object.entries(expected)) {
  const dir = path.join(root, "packages", name);
  const pkg = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"));
  const dependencies = Object.keys(pkg.dependencies ?? {}).sort();
  if (JSON.stringify(dependencies) !== JSON.stringify(allowed)) throw new Error(`${name}: dependency DAG mismatch`);
  if (!pkg.private || pkg.version !== "0.0.0" || pkg.type !== "module") throw new Error(`${name}: private prototype metadata mismatch`);
  for (const dependency of dependencies) {
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", `await import(${JSON.stringify(dependency)});`], { cwd: dir, encoding: "utf8" });
    if (result.status !== 0) throw new Error(`${name}: ESM dependency resolution failed: ${result.stderr}`);
  }
  for (const file of [...files(path.join(dir, "src")), ...files(path.join(dir, "dist"))]) {
    if (!file.endsWith(".ts") && !file.endsWith(".js")) continue;
    const raw = readFileSync(file, "utf8");
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    if (forbidden.test(code)) throw new Error(`${path.relative(root, file)}: host ambient dependency`);
    for (const match of code.matchAll(/(?:from\s*|import\s*\(|import\s*)["']([^"']+)["']/g)) {
      const imported = match[1];
      if (!imported) continue;
      if (imported.startsWith(".")) {
        if (!path.resolve(path.dirname(file), imported).startsWith(`${dir}${path.sep}`)) throw new Error(`${file}: crosses package by relative path`);
      } else if (!allowed.includes(imported)) throw new Error(`${file}: unapproved/deep package import ${imported}`);
    }
    inspected++;
  }
  const tsconfig = JSON.parse(readFileSync(path.join(dir, "tsconfig.json"), "utf8"));
  if (tsconfig.extends !== "../../tsconfig.base.json") throw new Error(`${name}: shared strict baseline missing`);
  const references = (tsconfig.references ?? []).map((entry) => entry.path).sort();
  const expectedReferences = allowed.map((dependency) => `../${dependency.slice("@egret/".length)}`).sort();
  if (JSON.stringify(references) !== JSON.stringify(expectedReferences)) throw new Error(`${name}: project references mismatch`);
}
const facade = await import("@egret/engine");
for (const internal of ["createScope", "createStage", "constructEngine", "createAssetManager", "createAssetLease", "revokeAssetLease", "assertAssetRef", "assertAssetType", "reportDiagnostic", "bind", "engineOf", "ownerOf"]) {
  if (internal in facade) throw new Error(`Internal lifecycle port leaked: ${internal}`);
}
console.log(`Boundary check PASS: three private workspace packages, actual exports resolution, ${inspected} source/build/declaration files, core without DOM/Node globals.`);
