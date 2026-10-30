import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("..", import.meta.url));
const expected = {
  contracts: [],
  runtime: ["@egret/contracts"],
  engine: ["@egret/contracts", "@egret/runtime"],
  project: ["@egret/contracts"],
};
// External root imports are audited separately from the internal workspace DAG/references.
const external = { engine: { 'robust-predicates': '3.0.3' }, project: { 'jsonc-parser': '3.3.1' } };
const projectValues = ['DEFAULT_PROJECT_LIMITS', 'createProjectStore', 'openProjectHistory', 'parseProjectSnapshot', 'parseProjectTransaction', 'serializeProjectSnapshot'];
const projectTypes = ['ProjectId', 'EntityId', 'FileId', 'TransactionId', 'ProjectRevision', 'Sha256', 'JsonValue', 'JsonObject', 'ProjectVersionPins', 'ProjectReference', 'ProjectEntity', 'ProjectFileRole', 'ProjectFile', 'ProjectSnapshot', 'ProjectTransactionSource', 'ProjectTransactionScope', 'ProjectOperation', 'ProjectEditTransaction', 'ProjectRestoreTransaction', 'ProjectTransaction', 'ProjectHistory', 'ProjectDiff', 'ProjectDiagnosticCode', 'ProjectDiagnostic', 'ProjectValueResult', 'ProjectTransactionReceipt', 'ProjectCommitResult', 'ProjectLimits', 'ProjectStore'];
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const file = path.join(dir, item.name);
    return item.isDirectory() ? files(file) : [file];
  });
}
// M15: exact named metadata port and one private browser bridge. No deep-path wildcard.
const m15DeepClauses = {
  // M2.1: bounded content assembly and public, explicit browser composition only.
  "packages/engine/src/contentLoader.ts": [{operation:'import',kind:'value',members:['isAdmittedResourceManifest'],target:'@egret/contracts/resources'},{operation:'import',kind:'type',members:['AdmittedResourceManifest','ResourceManifestEntry'],target:'@egret/contracts/resources'}],
  "packages/engine/dist/contentLoader.js": [{operation:'import',kind:'value',members:['isAdmittedResourceManifest'],target:'@egret/contracts/resources'}],
  "packages/engine/dist/contentLoader.d.ts": [{operation:'import',kind:'type',members:['AdmittedResourceManifest'],target:'@egret/contracts/resources'}],
  "packages/engine/src/internal/contentFactoryState.ts": [{operation:'import',kind:'type',members:['AdmittedResourceManifest'],target:'@egret/contracts/resources'}],
  "packages/engine/dist/internal/contentFactoryState.d.ts": [{operation:'import',kind:'type',members:['AdmittedResourceManifest'],target:'@egret/contracts/resources'}],
  "packages/engine/web/resources.ts": [{operation:'import',kind:'type',members:['Engine'],target:'@egret/engine'},{operation:'import',kind:'value',members:['createContentLoader'],target:'@egret/engine/resources'},{operation:'import',kind:'type',members:['ContentGroup','ContentLoader','ManifestGroupOptions'],target:'@egret/engine/resources'},{operation:'import',kind:'type',members:['AdmittedResourceManifest'],target:'@egret/contracts/resources'}],
  "packages/engine/dist/web/resources.js": [{operation:'import',kind:'value',members:['createContentLoader'],target:'@egret/engine/resources'}],
  "packages/engine/dist/web/resources.d.ts": [{operation:'import',kind:'type',members:['Engine'],target:'@egret/engine'},{operation:'import',kind:'type',members:['ContentLoader'],target:'@egret/engine/resources'},{operation:'import',kind:'type',members:['AdmittedResourceManifest'],target:'@egret/contracts/resources'}],
  // M3.2: ordinary UI content keeps exact numeric runtime imports.
  "packages/engine/src/ui/leafContent.ts": [{operation:'import',kind:'value',members:['captureUiLayout'],target:'@egret/runtime/ui'},{operation:'import',kind:'type',members:['UiLayoutNode','UiLayoutTree','UiMeasurement'],target:'@egret/runtime/ui'}],
  "packages/engine/dist/ui/leafContent.js": [{operation:'import',kind:'value',members:['captureUiLayout'],target:'@egret/runtime/ui'}],
  "packages/engine/dist/ui/leafContent.d.ts": [{operation:'import',kind:'type',members:['UiLayoutNode','UiLayoutTree'],target:'@egret/runtime/ui'}],
  // M3.1: exact optional UI value and erased assembly clauses only.
  "packages/engine/src/internal/uiFactoryState.ts": [{"operation":"import","kind":"type","members":["createUiDisplayOperations","UiDisplayOperations"],"target":"@egret/runtime/ui"}],
  "packages/engine/dist/internal/uiFactoryState.d.ts": [{"operation":"import","kind":"type","members":["createUiDisplayOperations","UiDisplayOperations"],"target":"@egret/runtime/ui"}],
  "packages/engine/src/ui/types.ts": [{"operation":"import","kind":"type","members":["UiLayoutNode","UiDirtyKind","UiLayoutBox"],"target":"@egret/runtime/ui"}],
  "packages/engine/dist/ui/types.d.ts": [{"operation":"import","kind":"type","members":["UiLayoutNode","UiDirtyKind","UiLayoutBox"],"target":"@egret/runtime/ui"}],
  "packages/engine/src/ui/uiRoot.ts": [{"operation":"import","kind":"value","members":["captureUiLayout","planUiLayout","UiHeightIndex","createUiDisplayOperations"],"target":"@egret/runtime/ui"},{"operation":"import","kind":"type","members":["UiLayoutTree","UiLayoutNode","UiLayoutPlan","UiLayoutBox","UiDisplayUpdate"],"target":"@egret/runtime/ui"}],
  "packages/engine/dist/ui/uiRoot.js": [{"operation":"import","kind":"value","members":["captureUiLayout","planUiLayout","UiHeightIndex","createUiDisplayOperations"],"target":"@egret/runtime/ui"}],
  // M2.1: exact optional content adapter clauses; no general deep-import allowance.
  "packages/project/src/resources/content.ts": [{"operation":"import","kind":"type","members":["AdmittedResourceManifest","ResourceBuildPlanDescription","ResourceBuildSourceEntry","ResourceManifestResult"],"target":"@egret/contracts/resources"},{"operation":"import","kind":"value","members":["buildResourceManifest","evaluateResourceBuildKeys","validateResourceBuildPlanDescription"],"target":"@egret/contracts/resources"}],
  "packages/project/dist/resources/content.js": [{"operation":"import","kind":"value","members":["buildResourceManifest","evaluateResourceBuildKeys","validateResourceBuildPlanDescription"],"target":"@egret/contracts/resources"}],
  "packages/project/dist/resources/content.d.ts": [{"operation":"import","kind":"type","members":["AdmittedResourceManifest","ResourceBuildPlanDescription"],"target":"@egret/contracts/resources"}],
  "packages/engine/dist/Engine.d.ts": [
    {
      "operation": "import",
      "kind": "type",
      "members": [
        "AdmittedResourceManifest"
      ],
      "target": "@egret/contracts/resources"
    }
  ],
  "packages/engine/dist/manifestAssetGroup.js": [{"operation":"import","kind":"value","members":["isAdmittedResourceManifest"],"target":"@egret/contracts/resources"}],
  "packages/engine/dist/manifestResourceState.d.ts": [{"operation":"import","kind":"type","members":["AdmittedResourceManifest","ResourceManifestEntry"],"target":"@egret/contracts/resources"}],
  "packages/engine/dist/manifestResourceState.js": [{"operation":"import","kind":"value","members":["isAdmittedResourceManifest"],"target":"@egret/contracts/resources"}],
  "packages/engine/dist/web/ManifestByteSource.d.ts": [{"operation":"import","kind":"type","members":["AdmittedResourceManifest","ResourceManifestEntry"],"target":"@egret/contracts/resources"},{"operation":"import","kind":"type","members":["ManifestBinding"],"target":"#egret-manifest-resources"}],
  "packages/engine/dist/web/ManifestByteSource.js": [{"operation":"import","kind":"value","members":["isAdmittedResourceManifest"],"target":"@egret/contracts/resources"},{"operation":"import","kind":"value","members":["requireManifestBinding","requireManifestAssetRef"],"target":"#egret-manifest-resources"}],
  "packages/engine/src/Engine.ts": [
    {
      "operation": "import",
      "kind": "type",
      "members": [
        "AdmittedResourceManifest"
      ],
      "target": "@egret/contracts/resources"
    }
  ],
  "packages/engine/src/manifestAssetGroup.ts": [{"operation":"import","kind":"value","members":["isAdmittedResourceManifest"],"target":"@egret/contracts/resources"},{"operation":"import","kind":"type","members":["AdmittedResourceManifest","ResourceManifestEntry"],"target":"@egret/contracts/resources"}],
  "packages/engine/src/manifestResourceState.ts": [{"operation":"import","kind":"value","members":["isAdmittedResourceManifest"],"target":"@egret/contracts/resources"},{"operation":"import","kind":"type","members":["AdmittedResourceManifest","ResourceManifestEntry"],"target":"@egret/contracts/resources"}],
  "packages/engine/web/ManifestByteSource.ts": [{"operation":"import","kind":"value","members":["isAdmittedResourceManifest"],"target":"@egret/contracts/resources"},{"operation":"import","kind":"type","members":["AdmittedResourceManifest","ResourceManifestEntry"],"target":"@egret/contracts/resources"},{"operation":"import","kind":"value","members":["requireManifestBinding","requireManifestAssetRef"],"target":"#egret-manifest-resources"},{"operation":"import","kind":"type","members":["ManifestBinding"],"target":"#egret-manifest-resources"}],
  "packages/project/dist/resources/index.d.ts": [{"operation":"export","kind":"type","members":["ResourceBuildPlanDescription"],"target":"@egret/contracts/resources"},{"operation":"export","kind":"type","members":["ResourceBuildDescription","ResourceBuildEntry","ResourceManifestEntry","AdmittedResourceManifest"],"target":"@egret/contracts/resources"}],
  "packages/project/dist/resources/manifest.d.ts": [{"operation":"import","kind":"type","members":["AdmittedResourceManifest","ResourceBuildDescription"],"target":"@egret/contracts/resources"}],
  "packages/project/dist/resources/manifest.js": [{"operation":"import","kind":"value","members":["admitResourceManifest","serializeResourceManifest as encodeManifest","validateResourceBuildDescription"],"target":"@egret/contracts/resources"}],
  "packages/project/src/resources/index.ts": [{"operation":"export","kind":"type","members":["ResourceBuildPlanDescription"],"target":"@egret/contracts/resources"},{"operation":"export","kind":"type","members":["ResourceBuildDescription","ResourceBuildEntry","ResourceManifestEntry","AdmittedResourceManifest"],"target":"@egret/contracts/resources"}],
  "packages/project/src/resources/manifest.ts": [{"operation":"import","kind":"type","members":["AdmittedResourceManifest","ResourceBuildDescription","ResourceBuildEntry","ResourceManifestResult"],"target":"@egret/contracts/resources"},{"operation":"import","kind":"value","members":["admitResourceManifest","serializeResourceManifest as encodeManifest","validateResourceBuildDescription"],"target":"@egret/contracts/resources"}],
};
const m15ClauseKey = row => JSON.stringify([row.operation,row.kind,row.target,[...row.members].sort()]);
// M3.2: exact optional protocol clauses; no same-package value/deep-import wildcard.
const m32ParagraphDeepClauses = {
  "packages/engine/web/canvasKitParagraphGeometry.ts": [
    {
      "operation": "import",
      "kind": "type",
      "members": [
        "ParagraphMetrics",
        "ParagraphRequest",
        "ParagraphTextCluster",
        "ParagraphTextGeometryData",
        "ParagraphTextLine"
      ],
      "target": "@egret/engine/paragraph"
    }
  ],
  "packages/engine/dist/web/canvasKitParagraphGeometry.d.ts": [
    {
      "operation": "import",
      "kind": "type",
      "members": [
        "ParagraphMetrics",
        "ParagraphRequest",
        "ParagraphTextGeometryData"
      ],
      "target": "@egret/engine/paragraph"
    }
  ],
  "packages/engine/src/paragraph.ts": [
    {
      "operation": "import",
      "kind": "type",
      "members": [
        "Paragraph",
        "ParagraphCache"
      ],
      "target": "@egret/runtime/paragraph"
    },
    {
      "operation": "export",
      "kind": "value",
      "members": [
        "createParagraphCache"
      ],
      "target": "@egret/runtime/paragraph"
    }
  ],
  "packages/engine/dist/paragraph.d.ts": [
    {
      "operation": "import",
      "kind": "type",
      "members": [
        "Paragraph",
        "ParagraphCache"
      ],
      "target": "@egret/runtime/paragraph"
    },
    {
      "operation": "export",
      "kind": "value",
      "members": [
        "createParagraphCache"
      ],
      "target": "@egret/runtime/paragraph"
    }
  ],
  "packages/engine/dist/paragraph.js": [
    {
      "operation": "export",
      "kind": "value",
      "members": [
        "createParagraphCache"
      ],
      "target": "@egret/runtime/paragraph"
    }
  ],
  "packages/engine/web/CanvasKitParagraphProvider.ts": [
    {
      "operation": "import",
      "kind": "type",
      "members": [
        "ParagraphProvider",
        "ParagraphRaster",
        "ParagraphRequest"
      ],
      "target": "@egret/engine/paragraph"
    }
  ],
  "packages/engine/dist/web/CanvasKitParagraphProvider.d.ts": [
    {
      "operation": "import",
      "kind": "type",
      "members": [
        "ParagraphProvider"
      ],
      "target": "@egret/engine/paragraph"
    }
  ]
};
let inspected = 0;
const forbidden = /\b(?:document|window|HTMLCanvasElement|GPUDevice|process|Buffer|require)\b|["']node:/;
for (const [name, allowed] of Object.entries(expected)) {
  const dir = path.join(root, "packages", name);
  const pkg = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"));
  const dependencies = Object.keys(pkg.dependencies ?? {}).sort();
  const registryImports = { '#egret-textured-frame-state': { types: './dist/internal/texturedFrameState.d.ts', import: './dist/internal/texturedFrameState.js' }, '#egret-mouse-input': {types:'./dist/mouseInput.d.ts',import:'./dist/mouseInput.js'}, '#egret-manifest-resources': {types:'./dist/manifestResourceState.d.ts',import:'./dist/manifestResourceState.js'}, '#egret-pointer-input': {types:'./dist/pointerInput.d.ts',import:'./dist/pointerInput.js'}, '#egret-keyboard-input': {types:'./dist/keyboardInput.d.ts',import:'./dist/keyboardInput.js'} };
  if (name === 'engine') {
    if (JSON.stringify(pkg.imports) !== JSON.stringify(registryImports)) throw new Error('engine: private textured registry mapping mismatch');
  } else if (pkg.imports !== undefined) throw new Error(`${name}: unexpected private import mapping`);
  const externalAllowed = Object.hasOwn(external, name) ? external[name] : {};
  const internalDependencies = dependencies.filter(dependency => !Object.hasOwn(externalAllowed, dependency));
  if (JSON.stringify(internalDependencies) !== JSON.stringify(allowed)) throw new Error(`${name}: dependency DAG mismatch`);
  for (const [dependency, version] of Object.entries(externalAllowed)) if (pkg.dependencies[dependency] !== version) throw new Error(`${name}: external exact pin mismatch`);
  if (!pkg.private || pkg.version !== "0.0.0" || pkg.type !== "module") throw new Error(`${name}: private prototype metadata mismatch`);
  if (name === 'contracts' && JSON.stringify(pkg.exports) !== JSON.stringify({'.':{types:'./dist/index.d.ts',import:'./dist/index.js'},'./resources':{types:'./dist/resources/index.d.ts',import:'./dist/resources/index.js'}})) throw new Error('M15: contracts exact export mapping mismatch');
  if (name === 'project' && JSON.stringify(pkg.exports) !== JSON.stringify({'.': {types:'./dist/index.d.ts', import:'./dist/index.js'},'./spine':{types:'./dist/spine/index.d.ts',import:'./dist/spine/index.js'},'./atlas':{types:'./dist/atlas/index.d.ts',import:'./dist/atlas/index.js'},'./resources':{types:'./dist/resources/index.d.ts',import:'./dist/resources/index.js'}})) throw new Error('project: root export mapping mismatch');
  if (name === 'runtime' || name === 'engine') {
    const textExports = name === 'runtime' ? {
      '.': {types:'./dist/index.d.ts',import:'./dist/index.js'},
      './text': {types:'./dist/text/index.d.ts',import:'./dist/text/index.js'},
      './paragraph': {types:'./dist/paragraph/index.d.ts',import:'./dist/paragraph/index.js'},
      './input': {types:'./dist/input/index.d.ts',import:'./dist/input/index.js'},
      './ui': {types:'./dist/ui/index.d.ts',import:'./dist/ui/index.js'},
    } : {
      '.': {types:'./dist/index.d.ts',import:'./dist/index.js'},
      './webgpu': {types:'./dist/web/webgpu.d.ts',import:'./dist/web/webgpu.js'},
      './webgl2': {types:'./dist/web/webgl2.d.ts',import:'./dist/web/webgl2.js'},
      './webgl2/scene3d': {types:'./dist/web/webgl2Scene3d.d.ts',import:'./dist/web/webgl2Scene3d.js'},
      './web': {types:'./dist/web/index.d.ts',import:'./dist/web/index.js'},
      './text': {types:'./dist/text.d.ts',import:'./dist/text.js'},
      './paragraph': {types:'./dist/paragraph.d.ts',import:'./dist/paragraph.js'},
      './web/paragraph': {types:'./dist/web/paragraph.d.ts',import:'./dist/web/paragraph.js'},
      './layout': {types:'./dist/layout.d.ts',import:'./dist/layout.js'},
      './animation': {types:'./dist/animation/index.d.ts',import:'./dist/animation/index.js'},
      './web/text': {types:'./dist/web/text.d.ts',import:'./dist/web/text.js'},
      './web/input': {types:'./dist/web/input.d.ts',import:'./dist/web/input.js'},
      './input': {types:'./dist/input.d.ts',import:'./dist/input.js'},
      './ui': {types:'./dist/ui/index.d.ts',import:'./dist/ui/index.js'},
      './web/pointer': {types:'./dist/web/pointer.d.ts',import:'./dist/web/pointer.js'},
      './web/keyboard': {types:'./dist/web/keyboard.d.ts',import:'./dist/web/keyboard.js'},
      './web/image': {types:'./dist/web/image.d.ts',import:'./dist/web/image.js'},
      './resources': {types:'./dist/resources.d.ts',import:'./dist/resources.js'},
      './web/resources': {types:'./dist/web/resources.d.ts',import:'./dist/web/resources.js'},
      // S3D1_MAP_BEGIN
      './scene3d': {types:'./dist/rendering/scene3d.d.ts',import:'./dist/rendering/scene3d.js'},
      './webgpu/scene3d': {types:'./dist/web/scene3d.d.ts',import:'./dist/web/scene3d.js'},
      // S3D1_MAP_END
    };
    if (JSON.stringify(Object.keys(pkg.exports ?? {}).sort()) !== JSON.stringify(Object.keys(textExports).sort())
        || Object.entries(textExports).some(([entry, mapping]) => JSON.stringify(pkg.exports[entry]) !== JSON.stringify(mapping)))
      throw new Error(`${name}: text explicit export mapping mismatch`);
  }
  for (const dependency of dependencies) {
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", `await import(${JSON.stringify(dependency)});`], { cwd: dir, encoding: "utf8" });
    if (result.status !== 0) throw new Error(`${name}: ESM dependency resolution failed: ${result.stderr}`);
  }
  for (const file of [...files(path.join(dir, "src")), ...files(path.join(dir, "dist")), ...(name === 'engine' ? [...files(path.join(dir, 'web')), ...files(path.join(dir, 'rendering'))] : [])]) {
    if (!file.endsWith(".ts") && !file.endsWith(".js")) continue;
    const raw = readFileSync(file, "utf8");
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    const web = name === 'engine' && (file.startsWith(path.join(dir, 'web') + path.sep) || file.startsWith(path.join(dir, 'dist', 'web') + path.sep));
    const rendering = name === 'engine' && (file.startsWith(path.join(dir, 'rendering') + path.sep) || file.startsWith(path.join(dir, 'dist', 'rendering') + path.sep));
    const projectFoundation = name === 'project' && ['json-foundation.ts', 'json-foundation.js', 'json-foundation.d.ts'].includes(path.basename(file));
    // Raw triple-slash references are compiler dependencies, even though ordinary
    // comments are removed below. Project declarations must stay DOM/Node-free.
    if (name === 'project' && (/\b(?:HTMLElement|HTMLCanvasElement|Document|Window|Navigator|NodeJS|GPUDevice)\b/.test(code) || /\/\/\/\s*<reference\s+(?:lib\s*=\s*["']dom(?:\.iterable)?["']|types\s*=\s*["']node["'])/i.test(raw))) throw new Error(`${path.relative(root, file)}: host ambient dependency`);
    // WebGL resource kinds use the quoted spelling Buffer; it is not the Node
    // global. Only these ten literals in five named files have this exception.
    const glKindLiterals = name === 'engine' ? {
      'web/webgl2Native.ts': 2, 'dist/web/webgl2Native.js': 1, 'dist/web/webgl2Native.d.ts': 1,
      'web/WebGL2Host.ts': 3, 'dist/web/WebGL2Host.js': 3,
    }[path.relative(dir,file).split(path.sep).join('/')] : undefined;
    let ambientCode = code;
    if (glKindLiterals !== undefined) {
      if ((code.match(/(['"])Buffer\1/g) ?? []).length !== glKindLiterals) throw new Error('M14: exact native Buffer kind literal count mismatch: '+path.relative(root,file));
      ambientCode = code.replace(/(['"])Buffer\1/g, '""');
    }
    if ((web ? /\b(?:process|Buffer|require)\b|["']node:/ : forbidden).test(ambientCode)) throw new Error(path.relative(root,file)+': host ambient dependency');
    // Consume complete ordinary quoted strings before recognizing import clauses.
    // This bounded lexical scan retains the existing import policies and reasons.
    for (const match of code.matchAll(/"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"|'(?:\\(?:\r\n|[\s\S])|[^'\\\r\n])*'|\b(?:from\s*|import\s*\(\s*|import\s*)["']([^"']+)["']/g)) {
      const imported = match[1];
      if (!imported) continue;
      if (imported.startsWith(".")) {
        if (!path.resolve(path.dirname(file), imported).startsWith(`${dir}${path.sep}`)) throw new Error(`${file}: crosses package by relative path`);
        if (name === 'engine') {
          const target=path.relative(dir,path.resolve(path.dirname(file),imported)).split(path.sep).join('/');
          const relative=path.relative(dir,file).split(path.sep).join('/');
          const providerTarget=['web/CanvasTextRasterProvider.js','dist/web/CanvasTextRasterProvider.js'].includes(target);
          const providerBarrel=['web/text.ts','dist/web/text.js','dist/web/text.d.ts'].includes(relative);
          if ((providerTarget && !providerBarrel) || ['web/text.js','dist/web/text.js'].includes(target)) throw new Error(`${file}: Canvas text opt-in module imported outside its barrel`);
          const paragraphProviderTarget=['web/CanvasKitParagraphProvider.js','dist/web/CanvasKitParagraphProvider.js'].includes(target);
          if (paragraphProviderTarget && !['web/paragraph.ts','dist/web/paragraph.js','dist/web/paragraph.d.ts'].includes(relative)) throw new Error(`${file}: paragraph provider imported outside its optional barrel`);
        }
      } else if (['@egret/contracts/resources','#egret-manifest-resources','@egret/runtime/ui','@egret/engine/resources','@egret/engine'].includes(imported)) {
        const relative=path.relative(root,file).split(path.sep).join('/');
        const clause=code.slice(0,match.index).match(/\b(import|export)(\s+type)?\s*\{([^{}]+)\}\s*$/);
        const row=clause && {operation:clause[1],kind:clause[2]?'type':'value',members:clause[3].split(',').map(member=>member.trim().replace(/\s+/g,' ')).filter(Boolean),target:imported};
        if (!row || !(m15DeepClauses[relative]??[]).some(expected=>m15ClauseKey(expected)===m15ClauseKey(row)))
          throw new Error('M15: unapproved named resource dependency: '+relative+'/'+imported);
      } else if (imported === '@egret/runtime/input') {
        const relative=path.relative(dir,file).split(path.sep).join('/');
        if(name!=='engine'||!['src/pointerInput.ts','src/pointerInputTypes.ts','dist/pointerInput.js','dist/pointerInput.d.ts','dist/pointerInputTypes.d.ts'].includes(relative))
          throw new Error('M3: pointer runtime import outside the named core modules: '+relative);
      } else if (imported === '#egret-keyboard-input') {
        const relative=path.relative(dir,file).split(path.sep).join('/');
        if(name!=='engine'||!['web/keyboard.ts','web/BrowserKeyboardInput.ts','dist/web/keyboard.js','dist/web/keyboard.d.ts','dist/web/BrowserKeyboardInput.js','dist/web/BrowserKeyboardInput.d.ts'].includes(relative))
          throw new Error('M3.3: keyboard assembly import outside the named browser modules: '+relative);
      } else if (imported === '#egret-pointer-input') {
        const relative=path.relative(dir,file).split(path.sep).join('/');
        if(name!=='engine'||!['web/pointer.ts','web/BrowserPointerInput.ts','dist/web/pointer.js','dist/web/pointer.d.ts','dist/web/BrowserPointerInput.js','dist/web/BrowserPointerInput.d.ts'].includes(relative))
          throw new Error('M3: pointer assembly import outside the named browser modules: '+relative);
      } else if (imported === '#egret-mouse-input') {
        const relative=path.relative(dir,file).split(path.sep).join('/');
        if(name!=='engine'||!['web/input.ts','web/MouseInput.ts','dist/web/input.js','dist/web/input.d.ts','dist/web/MouseInput.js','dist/web/MouseInput.d.ts'].includes(relative))
          throw new Error('MI1: private mouse input alias imported outside exact browser ports: '+relative);
      } else if (imported === '#egret-textured-frame-state') {
        // Only these three first-party adapters may share the Engine-owned registry.
        const relative = path.relative(dir, file).split(path.sep).join('/');
        if (name !== 'engine' || !['web/CanvasHost.ts', 'web/WebGPUHost.ts', 'web/WebGL2Host.ts', 'dist/web/CanvasHost.js', 'dist/web/WebGPUHost.js', 'dist/web/WebGL2Host.js'].includes(relative)) throw new Error(`${file}: private textured registry import outside approved adapters`);
      } else if (imported === '@egret/runtime/paragraph' || imported === '@egret/engine/paragraph') {
        const relative=path.relative(root,file).split(path.sep).join('/');
        const clause=code.slice(0,match.index).match(/\b(import|export)(\s+type)?\s*\{([^{}]+)\}\s*$/);
        const row=clause && {operation:clause[1],kind:clause[2]?'type':'value',members:clause[3].split(',').map(member=>member.trim().replace(/\s+/g,' ')).filter(Boolean),target:imported};
        const retainedTypeForward=imported==='@egret/runtime/paragraph'
          && ['packages/engine/src/paragraph.ts','packages/engine/dist/paragraph.d.ts'].includes(relative)
          && /\bexport\s+type\s*\*\s*$/.test(code.slice(0,match.index));
        if (!retainedTypeForward && (!row || !(m32ParagraphDeepClauses[relative]??[]).some(expected=>m15ClauseKey(expected)===m15ClauseKey(row))))
          throw new Error('M3.2: unapproved paragraph protocol dependency: '+relative+'/'+imported);
      } else if (imported === '@egret/runtime/text') {
        const relative = path.relative(dir, file).split(path.sep).join('/');
        if (name !== 'engine' || !['src/text.ts', 'dist/text.js', 'dist/text.d.ts'].includes(relative)) throw new Error(`${file}: unapproved/deep package import ${imported}`);
      } else if (imported === '@egret/engine/text') {
        const relative = path.relative(dir, file).split(path.sep).join('/');
        // The public provider protocol is one exact erased dependency, not a
        // same-package value-import exception or permission for other adapters.
        const clause = code.slice(0, match.index).match(/\bimport\s+type\s*\{([^{}]+)\}\s*$/);
        const types = ['TextLineMetricsInput','TextMeasureContext','TextRasterContext','TextRasterPlan','TextRasterProvider','TextRasterRequest'];
        const names = clause?.[1].split(',').map(value=>value.trim()).filter(Boolean);
        if (name !== 'engine' || !['web/CanvasTextRasterProvider.ts','dist/web/CanvasTextRasterProvider.d.ts'].includes(relative)
            || !names?.length || names.some(value=>!types.includes(value)) || new Set(names).size!==names.length)
          throw new Error(`${file}: unapproved/deep package import ${imported}`);
      } else if (!allowed.includes(imported) && !((rendering || projectFoundation) && Object.hasOwn(external, name) && Object.hasOwn(externalAllowed, imported))) throw new Error(`${file}: unapproved/deep package import ${imported}`);
    }
    inspected++;
  }
  const tsconfig = JSON.parse(readFileSync(path.join(dir, "tsconfig.json"), "utf8"));
  if (tsconfig.extends !== "../../tsconfig.base.json") throw new Error(`${name}: shared strict baseline missing`);
  const references = (tsconfig.references ?? []).map((entry) => entry.path).sort();
  const expectedReferences = allowed.map((dependency) => `../${dependency.slice("@egret/".length)}`).sort();
  if (JSON.stringify(references) !== JSON.stringify(expectedReferences)) throw new Error(`${name}: project references mismatch`);
  if (name === 'project' && JSON.stringify(tsconfig.compilerOptions) !== JSON.stringify({rootDir:'src',outDir:'dist'})) throw new Error('project: strict compilation boundary mismatch');
  if (name === 'engine') {
    const webConfig = JSON.parse(readFileSync(path.join(dir, 'tsconfig.web.json'), 'utf8'));
    if (webConfig.extends !== '../../tsconfig.base.json' || webConfig.compilerOptions.rootDir !== 'web' || webConfig.compilerOptions.outDir !== 'dist/web' || JSON.stringify(webConfig.compilerOptions.lib) !== JSON.stringify(['ES2022', 'DOM']) || JSON.stringify(webConfig.include) !== JSON.stringify(['web/**/*.ts'])) throw new Error('engine: approved web compilation boundary mismatch');
    const webReferences = webConfig.references.map(entry => entry.path).sort();
    if (JSON.stringify(webReferences) !== JSON.stringify([...expectedReferences, './tsconfig.rendering.json', './tsconfig.json'].sort())) throw new Error('engine: web dependency references mismatch');
    const renderingConfig = JSON.parse(readFileSync(path.join(dir, 'tsconfig.rendering.json'), 'utf8'));
    const renderingOptions = { composite: true, types: [], lib: ['ES2022'], rootDir: 'rendering', outDir: 'dist/rendering', tsBuildInfoFile: 'tsconfig.rendering.tsbuildinfo' };
    if (renderingConfig.extends !== '../../tsconfig.base.json' || JSON.stringify(renderingConfig.compilerOptions) !== JSON.stringify(renderingOptions) || JSON.stringify(renderingConfig.include) !== JSON.stringify(['rendering/**/*.ts']) || JSON.stringify(renderingConfig.references) !== JSON.stringify([{path:'../contracts'}])) throw new Error('engine: DOM-free rendering compilation boundary mismatch');
    for (const file of files(path.join(dir, 'src'))) {
      if (/['"][^'"]*(?:\/(?:web|rendering)\/|\/(?:web|rendering)['"])/.test(readFileSync(file, 'utf8'))) throw new Error('engine: root imports adapter/preparation subtree');
    }
  }
}
const projectFacade = await import('@egret/project');
if (JSON.stringify(Object.keys(projectFacade)) !== JSON.stringify(projectValues)) throw new Error('project: runtime export surface mismatch');
const projectDeclaration = readFileSync(path.join(root, 'packages/project/dist/index.d.ts'), 'utf8').replace(/\/\/[^\n]*/g, '');
const typeExports = [...projectDeclaration.matchAll(/export type\s*\{([^}]+)\}\s*from\s*["'][^"']+["'];?/g)].flatMap(match => match[1].split(',').map(name => name.trim())).sort();
const valueExports = [...projectDeclaration.matchAll(/export\s*\{([^}]+)\}\s*from\s*["'][^"']+["'];?/g)].flatMap(match => match[1].split(',').map(name => name.trim())).sort();
const declarationRemainder = projectDeclaration.replace(/export(?: type)?\s*\{[^}]+\}\s*from\s*["'][^"']+["'];?/g, '').trim();
if (JSON.stringify(typeExports) !== JSON.stringify([...projectTypes].sort()) || JSON.stringify(valueExports) !== JSON.stringify(projectValues) || declarationRemainder) throw new Error('project: type-only export surface mismatch');
// SP1_A_BOUNDARY_BEGIN
// Optional planning is separate from the retained root and renderer/runtime DAG.
const spinePlanValues=["SPINE_IMPORT_LIMITS","createSpineImportPlan"];
const spinePlanTypes=["SpineImportInput","SpineTextSource","SpinePageBinding","SpineProvenance","SpineImportPlan","SpineImportResult","SpineImportDiagnostic","SpineImportDiagnosticCode","SpineSourceSpan","SpinePagePlan","SpineRegionPlan"];
const spinePlanFacade=await import('@egret/project/spine');
if(JSON.stringify(Object.keys(spinePlanFacade))!==JSON.stringify(spinePlanValues))throw new Error('SP1-A: exact optional runtime exports mismatch');
for(const relative of ['src/spine/index.ts','dist/spine/index.d.ts','dist/spine/index.js']){
  const raw=readFileSync(path.join(root,'packages/project',relative),'utf8');
  const code=raw.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  const declarations=[...code.matchAll(/export(\s+type)?\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]\s*;?/g)];
  const actualValues=declarations.filter(m=>!m[1]).flatMap(m=>m[2].split(',').map(n=>n.trim())).sort();
  const actualTypes=declarations.filter(m=>m[1]).flatMap(m=>m[2].split(',').map(n=>n.trim())).sort();
  const remainder=code.replace(/export(?:\s+type)?\s*\{[^}]+\}\s*from\s*['"][^'"]+['"]\s*;?/g,'').trim();
  if(JSON.stringify(actualValues)!==JSON.stringify(spinePlanValues)||JSON.stringify(actualTypes)!==JSON.stringify(relative.endsWith('.js')?[]:[...spinePlanTypes].sort())||remainder
    ||declarations.some(m=>m[3]!== (m[1]?'./types.js':'./preflight.js')))
    throw new Error('SP1-A: exact optional declaration forwarding mismatch: '+relative);
}
if(Object.keys(await import(new URL('../packages/project/dist/spine/types.js',import.meta.url))).length)throw new Error('SP1-A: types module emitted runtime values');
for(const file of [...files(path.join(root,'packages/project/src')),...files(path.join(root,'packages/project/dist'))]){
  if(!/\.(?:ts|js)$/.test(file))continue;
  const relative=path.relative(path.join(root,'packages/project'),file).split(path.sep).join('/');
  const code=readFileSync(file,'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  if(!/^(?:src|dist)\/spine\//.test(relative)&&/['"][^'"]*(?:^|\/)spine\/[^'"]*['"]/.test(code))throw new Error('SP1-A: optional subtree imported outside its entry: '+relative);
  if(/^(?:src|dist)\/spine\//.test(relative)&&/\b(?:fetch|XMLHttpRequest|WebSocket|setTimeout|setInterval|setImmediate|queueMicrotask|requestAnimationFrame|TextEncoder|ImageBitmap)\b/.test(code))throw new Error('SP1-A: optional planning entry requests a host: '+relative);
}
// SP1_A_BOUNDARY_END
const facade = await import("@egret/engine");
const webFacade = await import('@egret/engine/web');
const gpuFacade = await import('@egret/engine/webgpu');
const contractsFacade = await import(new URL('../packages/contracts/dist/index.js', import.meta.url));
const runtimeFacade = await import(new URL('../packages/runtime/dist/index.js', import.meta.url));
// Mesh is one runtime singleton. Its slot module and authority stay private on
// every entry, including type-only declarations and aliased module re-exports.
const meshPrivate = ['MeshCaptureState', 'hasMeshState', 'readMeshState', 'writeMeshState'];
const m15ResourceEntries = [
  ['contracts/resources',await import('@egret/contracts/resources'),'packages/contracts/dist/resources/index'],
  ['project/resources',await import('@egret/project/resources'),'packages/project/dist/resources/index'],
  ['engine/resources',await import('@egret/engine/resources'),'packages/engine/dist/resources'],
  ['engine/web/resources',await import('@egret/engine/web/resources'),'packages/engine/dist/web/resources'],
];
const meshEntries = [
  ...m15ResourceEntries,
  ['contracts', contractsFacade, 'packages/contracts/dist/index'],
  ['root', facade, 'packages/engine/dist/index'],
  ['web', webFacade, 'packages/engine/dist/web/index'],
  ['webgpu', gpuFacade, 'packages/engine/dist/web/webgpu'],
  ['runtime', runtimeFacade, 'packages/runtime/dist/index'],
];
for (const [entry, values, emittedEntry] of meshEntries) {
  const declaration = readFileSync(path.join(root, emittedEntry + '.d.ts'), 'utf8');
  const emitted = readFileSync(path.join(root, emittedEntry + '.js'), 'utf8');
  for (const name of meshPrivate) if (name in values || new RegExp(`\\b${name}\\b`).test(declaration + '\n' + emitted)) throw new Error(`${entry}: private Mesh authority leaked: ${name}`);
  if (/\bmeshDisplayState\b/.test(declaration + '\n' + emitted)) throw new Error(`${entry}: private Mesh state module leaked`);
}
if (typeof runtimeFacade.Mesh2D !== 'function') throw new Error('runtime: public Mesh2D singleton missing');
if (typeof facade.Mesh2D !== 'function') throw new Error('root: public Mesh2D singleton missing');
if (facade.Mesh2D !== runtimeFacade.Mesh2D) throw new Error('root: Mesh2D runtime identity mismatch');
for (const [entry, values] of [['contracts', contractsFacade], ['web', webFacade], ['webgpu', gpuFacade]]) if ('Mesh2D' in values) throw new Error(`${entry}: public Mesh2D value belongs only to runtime/root`);
for (const [entry, declarationPath, target] of [
  ['root', 'packages/engine/dist/index.d.ts', '@egret/runtime'],
  ['runtime', 'packages/runtime/dist/index.d.ts', './Mesh2D.js'],
]) {
  const declaration = readFileSync(path.join(root, declarationPath), 'utf8');
  const exports = [...declaration.matchAll(/export(\s+type)?\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];?/g)].flatMap(match => match[2].split(',').filter(name => name.trim() === 'Mesh2D').map(() => ({typeOnly:!!match[1], target:match[3]})));
  if (exports.length !== 1 || exports[0].typeOnly || exports[0].target !== target) throw new Error(`${entry}: exact Mesh2D value declaration re-export mismatch`);
}
// NLB1 forwards one canonical value and one erased options type on its owners.
if (typeof runtimeFacade.NineSliceBitmap !== 'function' || facade.NineSliceBitmap !== runtimeFacade.NineSliceBitmap) throw new Error('NLB1: root/runtime singleton identity mismatch');
for (const [entry, values, prefix, target] of [
  ['root', facade, 'packages/engine', '@egret/runtime'],
  ['runtime', runtimeFacade, 'packages/runtime', './NineSliceBitmap.js'],
]) {
  if ('NineSliceBitmapOptions' in values) throw new Error(entry + ': NLB1 options must be erased');
  for (const relative of [prefix + '/src/index.ts', prefix + '/dist/index.d.ts', prefix + '/dist/index.js']) {
    const code = readFileSync(path.join(root, relative), 'utf8');
    const ports = [...code.matchAll(/export(\s+type)?\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];?/g)]
      .flatMap(match => match[2].split(',').map(member => ({ member: member.trim(), typeOnly: !!match[1], target: match[3] })));
    for (const [name, typeOnly] of [['NineSliceBitmap', false], ['NineSliceBitmapOptions', true]]) {
      const named = ports.filter(port => new RegExp('\\b' + name + '\\b').test(port.member));
      const expected = typeOnly && relative.endsWith('.js') ? 0 : 1;
      if (named.length !== expected || named.some(port => port.member !== name || port.typeOnly !== typeOnly || port.target !== target)) throw new Error(relative + ': NLB1 canonical barrel forwarding mismatch: ' + name);
    }
  }
}
// Other existing public routes keep their current surface and no panel authority.
for (const [entry, values, emittedEntry] of [
  ...m15ResourceEntries,
  ['contracts', contractsFacade, 'packages/contracts/dist/index'],
  ['web', webFacade, 'packages/engine/dist/web/index'],
  ['webgpu', gpuFacade, 'packages/engine/dist/web/webgpu'],
  ['project', projectFacade, 'packages/project/dist/index'],
  ['project/spine', spinePlanFacade, 'packages/project/dist/spine/index'],
  ['runtime/text', await import('@egret/runtime/text'), 'packages/runtime/dist/text/index'],
  ['engine/text', await import('@egret/engine/text'), 'packages/engine/dist/text'],
  ['web/text', await import('@egret/engine/web/text'), 'packages/engine/dist/web/text'],
  ['web/input', await import('@egret/engine/web/input'), 'packages/engine/dist/web/input'],
  ['web/image', await import('@egret/engine/web/image'), 'packages/engine/dist/web/image'],
  ['scene3d', await import('@egret/engine/scene3d'), 'packages/engine/dist/rendering/scene3d'],
  ['webgpu/scene3d', await import('@egret/engine/webgpu/scene3d'), 'packages/engine/dist/web/scene3d'],
]) {
  const code = readFileSync(path.join(root, emittedEntry + '.d.ts'), 'utf8') + '\n' + readFileSync(path.join(root, emittedEntry + '.js'), 'utf8');
  if (Object.values(values).includes(runtimeFacade.NineSliceBitmap) || /\b(?:NineSliceBitmap|NineSliceBitmapOptions)\b/.test(code)) throw new Error(entry + ': NLB1 panel surface belongs only to runtime/root');
}
const nineSliceBitmapDeclaration = readFileSync(path.join(root, 'packages/runtime/dist/NineSliceBitmap.d.ts'), 'utf8');
const nineSliceBitmapDeclaredNames = [...nineSliceBitmapDeclaration.matchAll(/\bexport\s+(?:declare\s+)?(?:type|interface|function|const|class|enum)\s+(\w+)/g)].map(match => match[1]).sort();
if (JSON.stringify(nineSliceBitmapDeclaredNames) !== JSON.stringify(['NineSliceBitmap', 'NineSliceBitmapOptions'])) throw new Error('runtime: NLB1 exact leaf declaration surface mismatch');
// The content slot may publish only this exact private visual revision edge.
// Resource/display classes remain type-only; other imports keep their refusal.
const meshRevisionImport = 'import { recordVisualChange, VISUAL_CONTENT, VISUAL_BINDING } from "./displayVisualState.js";';
const meshSourceRaw = readFileSync(path.join(root, 'packages/runtime/src/meshDisplayState.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const meshEmittedRaw = readFileSync(path.join(root, 'packages/runtime/dist/meshDisplayState.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const revisionSourceCount = meshSourceRaw.split(meshRevisionImport).length - 1;
const revisionEmittedCount = meshEmittedRaw.split(meshRevisionImport).length - 1;
if (revisionSourceCount > 1 || revisionSourceCount !== revisionEmittedCount) throw new Error('runtime: Mesh revision import must match source and emission exactly once');
const meshStateSource = meshSourceRaw.replace(meshRevisionImport, '');
for (const match of meshStateSource.matchAll(/\bimport\b/g)) if (!/^import\s+type\b/.test(meshStateSource.slice(match.index))) throw new Error('runtime: Mesh state source imports must be type-only');
const meshStateEmitted = meshEmittedRaw.replace(meshRevisionImport, '');
if (/\bimport\b|\bexport\s*(?:\*|\{[^}]*\})\s*from\s*["']/.test(meshStateEmitted)) throw new Error('runtime: Mesh state emitted value import/backedge');
const meshStateDeclaration = readFileSync(path.join(root, 'packages/runtime/dist/meshDisplayState.d.ts'), 'utf8');
const meshStateNames = [...meshStateDeclaration.matchAll(/\bexport\s+(?:declare\s+)?(?:type|interface|function|const|class|enum)\s+(\w+)/g)].map(match => match[1]).sort();
if (JSON.stringify(meshStateNames) !== JSON.stringify([...meshPrivate].sort())) throw new Error('runtime: Mesh state private declaration surface mismatch');
// Task 5 entry controls; Mesh guards above retain their existing reasons.
const texturedPrivate = ['registerSharedFrame', 'readOwnedSharedFrame', 'sharedRenderFrame2DBrand', 'registerTexturedFrame', 'readOwnedTexturedFrame', 'texturedRenderFrame2DBrand', 'createTexturedRenderFrame2D', 'CapturedEngineFramePorts', 'startEngine', 'TexturedCaptureBudget', 'admitTree', 'referencedTuples', 'flattenClips', 'readMeshCaptureImage', 'observeRejectedRenderResult'];
const texturedPrivateModules = ['texturedFrameState', 'texturedFrameBudget', 'meshCaptureSnapshot'];
const texturedWorkspaceNames = ['collectTexturedFrameContent', 'CapturedTexturedContent2D', 'collectSharedFrameContent', 'CapturedSharedContent2D'];
for (const [entry, values, emittedEntry] of meshEntries) {
  const declaration = readFileSync(path.join(root, emittedEntry + '.d.ts'), 'utf8');
  const emitted = readFileSync(path.join(root, emittedEntry + '.js'), 'utf8');
  for (const name of texturedPrivate) if (name in values || new RegExp(`\\b${name}\\b`).test(declaration + '\n' + emitted)) throw new Error(`${entry}: private textured-frame authority leaked: ${name}`);
  for (const name of texturedPrivateModules) if (new RegExp(`\\b${name}\\b`).test(declaration + '\n' + emitted)) throw new Error(`${entry}: private textured-frame module leaked: ${name}`);
  if (entry !== 'runtime') for (const name of texturedWorkspaceNames) if (name in values || new RegExp(`\\b${name}\\b`).test(declaration + '\n' + emitted)) throw new Error(`${entry}: textured-frame workspace port leaked: ${name}`);
}
const texturedRegistryEmitted = readFileSync(path.join(root, 'packages/engine/dist/internal/texturedFrameState.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
if (/\bimport\b|\bexport\s*(?:\*|\{[^}]*\})\s*from\s*["']/.test(texturedRegistryEmitted)) throw new Error('engine: completed-frame registry emitted import/backedge');

// New typed GPU host ports stay on their explicit entry; private implementation
// names and module paths cannot be hidden by a public alias or type-only export.
const privateTexturedGPU = [
  'TexturedPreparationLimits2D', 'TexturedPreparationSnapshot2D', 'TexturedPreparationBudget2D',
  'MeshPoint2D', 'MeshClipPolicy2D', 'createMeshClipPolicy2D', 'MeshStageCounters2D',
  'PreparedMesh2D', 'attachTexturedMeshAttributes2D', 'prepareTexturedMesh2D',
  'PackedTexturedMesh2D', 'TexturedMeshPackingAllocationError', 'packTexturedMesh2D',
  'AdmittedTexturedCommand2D', 'TexturedFrameAdmission2D', 'PreparedTexturedDraw2D', 'prepareTexturedDraws2D',
  'TexturedFrameAdmissionOptions2D', 'TexturedFrameAdmissionError2D', 'admitTexturedFrame2D',
  'noteOwnedPreparationFailure', 'runOwnedPreparationScope',
  'TexturedSubmissionStorageOptions2D', 'TexturedSubmissionHardware2D', 'TexturedSubmissionOwnerSnapshot2D',
  'TexturedSubmissionRequest2D', 'TexturedDrawStorage2D', 'TexturedSubmissionStorage2D',
  'PackedTexturedDraw2D', 'TexturedPayloadOperations2D', 'TexturedSubmissionAdmissionError2D',
  'isTexturedSubmissionAdmissionError2D', 'planTexturedSubmissionStorage2D', 'FIRST_PARTY_OPERATIONS',
  'TexturedSubmissionPlan2D', 'prepareTexturedSubmission2D',
  'PackedTexturedPayload2D', 'packTexturedDrawPayloads2D', 'materializeTexturedSubmission2D',
  'createWebGPUBufferPool', 'SubmissionBufferRole', 'SubmissionBufferRequest', 'BufferHandle',
  'SubmissionBufferLease', 'BufferReusePlan', 'BufferReturnPlan', 'WebGPUBufferPool',
  'createWebGPUBindingCache', 'DrawBindingKey', 'DrawBindingCandidate', 'WebGPUBindingCache',
  'planTexturedImageProjections', 'createWebGPUTexturedPipeline', 'createWebGPUTexturedMeshPipeline', 'encodeWebGPUTexturedMesh',
  'TEXTURED_MODE', 'TEXTURED_OWNERS', 'TEXTURED_OPTIONS', 'TEXTURED_FUNCTIONS', 'TEXTURED_LIMITS',
  'SharedSubmissionPlan2D', 'TexturedConfiguration', 'TexturedWebGPUConfiguration', 'admitTexturedWebGPUOptions',
  'createTexturedWebGPUHostInternal',
  'TEXTURED_SCENE_MODE','TexturedB1WebGPUHost','createTexturedB1WebGPUHostInternal','createTexturedB1WebGPUHost',
  'renderSceneTexturedOwnedFrame','packTexturedSubmission2D','TexturedSceneReservation2D',
];
const privateTexturedGPUModules = [
  'texturedPreparationBudget2D', 'prepareTexturedMesh2D', 'packTexturedMesh2D',
  'prepareTexturedDraws2D', 'admitTexturedFrame2D', 'ownedPreparationFailure2D',
  'prepareTexturedSubmission2D', 'texturedWebGPUOptions', 'webgpuTexturedPass', 'webgpuTexturedMeshPass',
  'webgpuBufferPool', 'webgpuBindingCache',
];
const publicTexturedGPUTypes = ['TexturedWebGPUHost', 'TexturedWebGPUHostOptions', 'TexturedWebGPUHostStatus'];
const sharedGPUTypes = ['SharedWebGPUHost','SharedWebGPUHostOptions','SharedWebGPUHostStatus','SharedWebGPUReadback'];
const completeGPUValues = ['createSharedWebGPUHost','createTexturedWebGPUHost','createWebGPUHost'];
for (const [entry, values, emittedEntry] of meshEntries) {
  const declaration = readFileSync(path.join(root, emittedEntry + '.d.ts'), 'utf8');
  const emitted = readFileSync(path.join(root, emittedEntry + '.js'), 'utf8');
  const text = declaration + '\n' + emitted;
  for (const name of privateTexturedGPU) if (name in values || new RegExp('\\b'+name+'\\b').test(text)) throw new Error(entry+': private textured GPU port leaked: '+name);
  for (const name of privateTexturedGPUModules) if (new RegExp('\\b'+name+'\\b').test(text)) throw new Error(entry+': private textured GPU module leaked: '+name);
  if (entry !== 'webgpu') for (const name of publicTexturedGPUTypes) if (name in values || new RegExp('\\b'+name+'\\b').test(text)) throw new Error(entry+': GPU-only textured host type leaked: '+name);
}
if (JSON.stringify(Object.keys(gpuFacade)) !== JSON.stringify(completeGPUValues)) throw new Error('webgpu facade leaks private helpers');
const gpuExport = JSON.parse(readFileSync(path.join(root, 'packages/engine/package.json'), 'utf8')).exports['./webgpu'];
if (JSON.stringify(gpuExport) !== JSON.stringify({types:'./dist/web/webgpu.d.ts',import:'./dist/web/webgpu.js'})) throw new Error('webgpu export mapping mismatch');
if (completeGPUValues.some(name => name in facade || name in webFacade)) throw new Error('GPU factory leaks root/Canvas boundary');
if (JSON.stringify(Object.keys(webFacade)) !== JSON.stringify(['createCanvasHost'])) throw new Error('web facade leaks internal ports');
if ('createCanvasHost' in facade) throw new Error('root facade leaks Canvas entry');
const imageValues = ['IMAGE_LIMITS_2D', 'copyImageData2DPixels', 'createImageData2D', 'isImageData2D'];
const geometryValues = ['createTexturedGeometry2D', 'isTexturedGeometry2D'];
const geometryTypes = ['TexturedFloatArray2D', 'TexturedIndexArray2D', 'TexturedGeometry2DInput', 'TexturedGeometry2D'];
const contractValues = [...imageValues, ...geometryValues, 'TEXTURED_FRAME_PROFILE_2D'].sort();
const sharedContractValues = ['createSharedMaterial2D','createSharedGeometry2D','isSharedMaterial2D','isSharedGeometry2D','SHARED_FRAME_PROFILE_2D'];
const completeContractValues = [...contractValues,...sharedContractValues].sort();
if (JSON.stringify(Object.keys(contractsFacade)) !== JSON.stringify(completeContractValues)) throw new Error('contracts: executable image/geometry export surface mismatch');
for (const name of imageValues) if (facade[name] !== contractsFacade[name]) throw new Error(`engine: image contract identity mismatch: ${name}`);
for (const name of geometryValues) if (typeof contractsFacade[name] !== 'function' || facade[name] !== contractsFacade[name]) throw new Error(`engine: geometry contract identity mismatch: ${name}`);
// Literal equality checks the protocol value; owned-frame singleton evidence
// requires actual Engine captures and first-party host refusal in later stages.
if (contractsFacade.TEXTURED_FRAME_PROFILE_2D !== 'egret.textured-frame2d/1' || facade.TEXTURED_FRAME_PROFILE_2D !== contractsFacade.TEXTURED_FRAME_PROFILE_2D) throw new Error('engine: textured profile literal mismatch');
// Exact accepted Mesh root plus the opt-in factory and shared literal.
const texturedRootValues = ['Engine', 'createEngine', 'createEngineForProfile', 'CancellationController', 'EgretError', 'Event', 'createEventType', 'EventDispatcher', 'DisplayObject', 'DisplayObjectContainer', 'Scope', 'Stage', 'AssetManager', 'AssetLease', 'createAssetType', 'createAssetRef', 'Sprite', 'Graphics', ...imageValues, ...geometryValues, 'TEXTURED_FRAME_PROFILE_2D', 'Texture', 'createTexture', 'isTexture', 'Bitmap', 'Mesh2D', 'NineSliceBitmap', 'createSequenceClip', 'SequencePlayer', 'ByteReader', 'BYTE_READER_LIMITS', 'ByteWriter', 'BYTE_WRITER_LIMITS', 'createNineSliceGeometry2D','createSpriteSheet'].sort();
const completeRootValues = [...texturedRootValues,'createSharedMaterial2D','createSharedGeometry2D','SHARED_FRAME_PROFILE_2D','createTextureView'].sort();
if (typeof facade.createEngineForProfile !== 'function' || JSON.stringify(Object.keys(facade)) !== JSON.stringify(completeRootValues)) throw new Error('root: executable textured-frame export surface mismatch');
const texturedTypes = ['TexturedFrameProfile2D', 'TexturedMeshCommand2D', 'TexturedRenderCommand2D', 'TexturedRenderFrame2D', 'TexturedRenderHostAdapter'];
for (const [entry, values, declarationPath] of [['contracts', contractsFacade, 'packages/contracts/dist/index.d.ts'], ['root', facade, 'packages/engine/dist/index.d.ts']]) {
  const declaration = readFileSync(path.join(root, declarationPath), 'utf8');
  const names = [...declaration.matchAll(/export type\s*\{([^}]+)\}\s*from\s*["'][^"']+["'];?/g)].flatMap(match => match[1].split(',').map(name => name.trim()));
  for (const name of texturedTypes) if (name in values || names.filter(value => value === name).length !== 1) throw new Error(`${entry}: textured-frame type-only export mismatch: ${name}`);
}
const texturedModuleDeclaration = readFileSync(path.join(root, 'packages/contracts/dist/TexturedRenderFrame2D.d.ts'), 'utf8');
const texturedModuleNames = [...texturedModuleDeclaration.matchAll(/\bexport\s+(?:declare\s+)?(?:type|interface|function|const|class|enum)\s+(\w+)/g)].map(match => match[1]).sort();
if (JSON.stringify(texturedModuleNames) !== JSON.stringify(['TEXTURED_FRAME_PROFILE_2D', ...texturedTypes].sort())) throw new Error('contracts: textured-frame declaration surface mismatch');
const texturedRuntimeDeclaration = readFileSync(path.join(root, 'packages/runtime/dist/index.d.ts'), 'utf8');
const texturedRuntimePorts = [...texturedRuntimeDeclaration.matchAll(/export(\s+type)?\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];?/g)].flatMap(match => match[2].split(',').map(name => ({name:name.trim(),typeOnly:!!match[1],target:match[3]})));
for (const [name, typeOnly] of [['collectTexturedFrameContent', false], ['CapturedTexturedContent2D', true]]) {
  const ports = texturedRuntimePorts.filter(port => port.name === name);
  if (ports.length !== 1 || ports[0].typeOnly !== typeOnly || ports[0].target !== './texturedFrameCapture.js' || (typeOnly ? name in runtimeFacade : typeof runtimeFacade[name] !== 'function')) throw new Error(`runtime: low-level textured capture port mismatch: ${name}`);
}

for (const [entry, values, declarationPath] of [
  ['contracts', contractsFacade, 'packages/contracts/dist/index.d.ts'],
  ['root', facade, 'packages/engine/dist/index.d.ts'],
]) {
  const declaration = readFileSync(path.join(root, declarationPath), 'utf8');
  const types = [...declaration.matchAll(/export type\s*\{([^}]+)\}\s*from\s*["'][^"']+["'];?/g)].flatMap(match => match[1].split(',').map(name => name.trim()));
  for (const name of geometryTypes) if (name in values || types.filter(type => type === name).length !== 1) throw new Error(`${entry}: geometry type-only export mismatch: ${name}`);
}
// The owned value module exposes precisely the six specified names. Its private
// identity symbol/registry and capacity policy are not public declarations.
const geometryDeclaration = readFileSync(path.join(root, 'packages/contracts/dist/TexturedGeometry2D.d.ts'), 'utf8');
const geometryDeclaredNames = [...geometryDeclaration.matchAll(/\bexport\s+(?:declare\s+)?(?:type|interface|function|const|class|enum)\s+(\w+)/g)].map(match => match[1]).sort();
if (JSON.stringify(geometryDeclaredNames) !== JSON.stringify([...geometryTypes, ...geometryValues].sort())) throw new Error('contracts: geometry declaration surface mismatch');
// Private rectangle and future mixed/image preparation ports remain unavailable
// on every public entry, in runtime values and emitted declaration exports.
const privateRendering = ['RectangleFrame2D', 'copyFrame2D', 'copyCanvasFrame', 'prepareRectangles2D', 'FrameCopyOptions', 'RectanglePreparationOptions', 'PreparedRectangles2D', 'FrameCopyError', 'FrameInputReadError', 'GeometryPreparationError', 'copyMixedFrame2D', 'imageFrameBudget', 'prepareImages2D', 'packImageVertices2D', 'CapturedContent2D', 'collectFrameContent', 'Matrix4', 'Vector4', 'Math3DErrorCode', 'Math3DError', 'createMatrix4', 'createVector4', 'multiplyMatrix4', 'transformHomogeneous4', 'DepthRange3D', 'DepthDirection3D', 'DepthConvention3D', 'Projection3D', 'createPerspectiveProjection3D', 'createOrthographicProjection3D', 'MeshGeometry3D', 'MeshGeometry3DErrorCode', 'MeshGeometry3DError', 'MeshGeometry3DErrorOrigin', 'createMeshGeometry3D', 'isMeshGeometry3D', 'getMeshGeometry3DErrorOrigin', 'PackedMeshGeometry3D', 'MeshPacking3DErrorCode', 'MeshPacking3DErrorOrigin', 'MeshPacking3DError', 'packMeshGeometry3D', 'getMeshPacking3DErrorOrigin', 'SceneProjectionInput3D', 'SceneDrawInput3D', 'SceneInput3D', 'SceneDraw3D', 'SceneFrame3D', 'createSceneFrame3D', 'isSceneFrame3D', 'Scene3DErrorOrigin', 'Scene3DErrorCode', 'Scene3DError', 'getScene3DErrorOrigin', 'B1SceneStatus', 'B1WebGPUHost', 'createB1WebGPUHost', 'createB1WebGPUHostInternal', 'B1BuiltinProtocol', 'getBuiltinB1Protocol', 'isBuiltinB1Protocol', 'createWebGPUMeshPipeline', 'encodeWebGPUMesh'];
const privateCapture = ['isStageRoot', 'CaptureImageBudget', 'BitmapCaptureState', 'bitmapCaptureState', 'readBitmapImage', 'TextureSnapshot2D', 'readTextureSnapshot', 'isAssetLease', 'readAssetLeaseValue'];
const privateCoordinates = ['composeDisplayTransform', 'queryDisplayPoint', 'invertCoordinatePoint', 'decodeFiniteDyadic', 'sumDyadicProducts', 'roundDyadicRatio', 'Dyadic'];
const privateBounds = ['queryDisplayBounds', 'hasBitmapState', 'readBitmapState', 'writeBitmapState', 'childCountOf', 'childAtOf'];
for (const [entry, values] of [['contracts', contractsFacade], ['root', facade], ['web', webFacade], ['webgpu', gpuFacade]]) {
  const declarationPath = entry === 'contracts' ? 'packages/contracts/dist/index.d.ts' : entry === 'root' ? 'packages/engine/dist/index.d.ts' : `packages/engine/dist/web/${entry === 'web' ? 'index' : 'webgpu'}.d.ts`;
  const declaration = readFileSync(path.join(root, declarationPath), 'utf8');
  for (const name of [...privateRendering, ...privateCapture, ...privateCoordinates, ...privateBounds]) if (name in values || new RegExp(`\\b${name}\\b`).test(declaration)) throw new Error(`${entry}: private rendering port leaked: ${name}`);
}
const runtimeDeclaration = readFileSync(path.join(root, 'packages/runtime/dist/index.d.ts'), 'utf8');
if (typeof runtimeFacade.collectFrameContent !== 'function' || !/export type\s*\{\s*CapturedContent2D\s*\}/.test(runtimeDeclaration)) throw new Error('runtime: low-level capture port missing');
for (const name of [...privateCapture, ...privateCoordinates, ...privateBounds]) if (name in runtimeFacade || new RegExp(`\\b${name}\\b`).test(runtimeDeclaration)) throw new Error(`runtime: private authority leaked: ${name}`);
for (const internal of ["collectFrameCommands", "createScope", "createStage", "constructEngine", "createAssetManager", "createAssetLease", "revokeAssetLease", "assertAssetRef", "assertAssetType", "reportDiagnostic", "bind", "engineOf", "ownerOf"]) {
  if (internal in facade) throw new Error(`Internal lifecycle port leaked: ${internal}`);
}
// Keep retained private-port reasons above this exact type-only facade check.
const m15SessionTypes = ['SharedDeviceSessionState','SharedDeviceSessionStatus','SharedHostResourceStatus'];
const m15UploadTypes = ['SharedFrameUploadOptions','SharedFrameUploadReady','SharedFrameSubmission','SharedFrameUpload'];
const m15SharedHostTypes = [...m15SessionTypes,...m15UploadTypes];
const m15SharedHostTypeClauses = "export type { SharedDeviceSessionState, SharedDeviceSessionStatus, SharedHostResourceStatus } from './sharedDeviceSession.js'; export type { SharedFrameUploadOptions, SharedFrameUploadReady, SharedFrameSubmission, SharedFrameUpload } from './sharedFrameUpload.js';";
const expectedGPUTypeNames = [
  'WebGPUHost', 'WebGPUHostState', 'WebGPUHostErrorCode', 'WebGPUHostFailure',
  'WebGPUHostDiagnostic', 'WebGPUHostOptions', 'WebGPUReadback', 'WebGPUHostStatus',
  ...publicTexturedGPUTypes, ...sharedGPUTypes, ...m15SharedHostTypes,
].sort();
const gpuDeclaration = readFileSync(path.join(root, 'packages/engine/dist/web/webgpu.d.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const actualGPUTypeNames = [...gpuDeclaration.matchAll(/export type\s*\{([^}]+)\}\s*from\s*["'][^"']+["'];?/g)].flatMap(match => match[1].split(',').map(name => name.trim())).sort();
const actualGPUValueNames = [...gpuDeclaration.matchAll(/export\s*\{([^}]+)\}\s*from\s*["'][^"']+["'];?/g)].flatMap(match => match[1].split(',').map(name => name.trim())).sort();
const gpuDeclarationRemainder = gpuDeclaration.replace(/export(?: type)?\s*\{[^}]+\}\s*from\s*["'][^"']+["'];?/g, '').trim();
if (JSON.stringify(actualGPUTypeNames) !== JSON.stringify(expectedGPUTypeNames) || JSON.stringify(actualGPUValueNames) !== JSON.stringify(completeGPUValues) || gpuDeclarationRemainder) throw new Error('webgpu: exact type-only host export surface mismatch');


// M1.3 has one explicit shared profile; the retained checks above are unchanged.
// No contract guard, captured-frame authority or GPU helper is a root SDK port.
const sharedContractTypeModules = {
  SharedMaterial2D:['SharedMaterialInput2D','SharedMaterial2D'],
  SharedGeometry2D:['SharedFloatArray2D','SharedIndexArray2D','SharedGeometryInput2D','SharedGeometry2D'],
  TextureViewRegion2D:['TextureViewRegionInput2D','TextureViewRegion2D'],
  SharedRenderFrame2D:['SharedFrameProfile2D','SharedOutputAlpha2D','SharedFrameOptions2D','SharedPage2D','SharedRegion2D','SharedDrawState2D','SharedRectangleCommand2D','SharedImageCommand2D','SharedMeshCommand2D','SharedBarrierCommand2D','SharedRenderCommand2D','SharedRenderFrame2D','SharedRenderHostAdapter'],
};
function sharedForward(text,name,typeOnly,target,file) {
  const rows=[...text.matchAll(/export(\s+type)?\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];?/g)]
    .flatMap(match=>match[2].split(',').map(member=>({member:member.trim(),typeOnly:!!match[1],target:match[3]})))
    .filter(row=>new RegExp('\\b'+name+'\\b').test(row.member));
  if(rows.length!==1||rows[0].member!==name||rows[0].typeOnly!==typeOnly||rows[0].target!==target)
    throw new Error('M13: canonical shared forwarding mismatch: '+file+'/'+name);
}
for(const [leaf,names]of Object.entries(sharedContractTypeModules)) {
  const declared=readFileSync(path.join(root,'packages/contracts/dist/'+leaf+'.d.ts'),'utf8');
  const values=leaf==='SharedMaterial2D'?['createSharedMaterial2D','isSharedMaterial2D']:leaf==='SharedGeometry2D'?['createSharedGeometry2D','isSharedGeometry2D']:leaf==='SharedRenderFrame2D'?['SHARED_FRAME_PROFILE_2D']:[];
  // A local alias is an export even without a new declaration. Only TypeScript's
  // empty module marker is permitted alongside the enumerated declarations.
  const exportText = declared.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  if (/\bexport\s+(?:type\s+)?\*/.test(exportText)
      || [...exportText.matchAll(/\bexport\s+(type\s+)?\{([^}]*)\}([^;\n]*)/g)].some(match => match[1] || match[2].trim() || match[3].trim()))
    throw new Error('M13: exact shared contract leaf mismatch: '+leaf);
  const exported=[...declared.matchAll(/\bexport\s+(?:declare\s+)?(?:type|interface|function|const|class|enum)\s+(\w+)/g)].map(match=>match[1]).sort();
  if(JSON.stringify(exported)!==JSON.stringify([...names,...values].sort()))throw new Error('M13: exact shared contract leaf mismatch: '+leaf);
  for(const [owner,target]of [['contracts','./'+leaf+'.js'],['engine','@egret/contracts']])for(const relative of ['src/index.ts','dist/index.d.ts']) {
    const file='packages/'+owner+'/'+relative,text=readFileSync(path.join(root,file),'utf8');
    for(const name of names)sharedForward(text,name,true,target,file);
    for(const name of values.filter(name=>owner==='contracts'||!name.startsWith('isShared')))sharedForward(text,name,false,target,file);
  }
}
for(const name of ['createSharedMaterial2D','createSharedGeometry2D'])if(typeof contractsFacade[name]!=='function'||facade[name]!==contractsFacade[name])throw new Error('M13: shared contract factory identity mismatch: '+name);
if(contractsFacade.SHARED_FRAME_PROFILE_2D!=='egret.shared-frame2d/1'||facade.SHARED_FRAME_PROFILE_2D!==contractsFacade.SHARED_FRAME_PROFILE_2D)throw new Error('M13: shared profile literal mismatch');
for(const name of ['isSharedMaterial2D','isSharedGeometry2D']) {
  if(typeof contractsFacade[name]!=='function')throw new Error('M13: contracts shared brand guard missing: '+name);
  for(const [entry,values,stem]of meshEntries.filter(row=>row[0]!=='contracts')) {
    const text=readFileSync(path.join(root,stem+'.d.ts'),'utf8')+'\n'+readFileSync(path.join(root,stem+'.js'),'utf8');
    if(name in values||new RegExp('\\b'+name+'\\b').test(text))throw new Error('M13: shared brand guard leaked outside contracts: '+entry);
  }
}
if(typeof runtimeFacade.createTextureView!=='function'||facade.createTextureView!==runtimeFacade.createTextureView)throw new Error('M13: TextureView factory identity mismatch');
for(const [owner,target]of [['runtime','./Texture.js'],['engine','@egret/runtime']])for(const relative of ['src/index.ts','dist/index.d.ts','dist/index.js']) {
  const file='packages/'+owner+'/'+relative;sharedForward(readFileSync(path.join(root,file),'utf8'),'createTextureView',false,target,file);
}
for(const relative of ['src/index.ts','dist/index.d.ts','dist/index.js']) {
  const file='packages/runtime/'+relative,text=readFileSync(path.join(root,file),'utf8');
  sharedForward(text,'collectSharedFrameContent',false,'./sharedFrameCapture.js',file);
  if(!relative.endsWith('.js'))sharedForward(text,'CapturedSharedContent2D',true,'./sharedFrameCapture.js',file);
}
const sharedMeshDeclaration=readFileSync(path.join(root,'packages/runtime/dist/Mesh2D.d.ts'),'utf8').replace(/\s+/g,'');
for(const exact of ['exportdeclareclassMesh2D<GextendsTexturedGeometry2D|SharedGeometry2D=TexturedGeometry2D>extendsDisplayObject{','constructor(textureLease:AssetLease<Texture>,geometry:G);','getgeometry():G|undefined;','setContent(textureLease:AssetLease<Texture>,geometry:G):void;'])
  if(sharedMeshDeclaration.split(exact).length!==2)throw new Error('M13: Mesh2D canonical generic contract mismatch');
for(const [entry,values,stem]of meshEntries.filter(row=>row[0]!=='webgpu')) {
  const text=readFileSync(path.join(root,stem+'.d.ts'),'utf8')+'\n'+readFileSync(path.join(root,stem+'.js'),'utf8');
  for(const name of sharedGPUTypes)if(name in values||new RegExp('\\b'+name+'\\b').test(text))throw new Error('M13: shared GPU type leaked outside optional entry: '+entry);
}
for(const relative of ['web/webgpu.ts','dist/web/webgpu.d.ts','dist/web/webgpu.js']) {
  const file='packages/engine/'+relative,text=readFileSync(path.join(root,file),'utf8');
  sharedForward(text,'createSharedWebGPUHost',false,'./WebGPUHost.js',file);
  if(!relative.endsWith('.js'))for(const name of sharedGPUTypes)sharedForward(text,name,true,'./WebGPUHost.js',file);
}
const privateSharedGPU = ["SharedStorageLimits2D","SharedStorageFees2D","SharedReadbackLayout2D","SharedStoragePlan2D","planSharedStorageFees2D","withSharedReadbackLayout2D","createRetentionLedger","RetentionRequestBase","KeyedRetentionRequest","LedgerHandle","LedgerLease","LedgerPlan","LedgerReturnPlan","RetentionLedgerStatus","RetentionSettlement","RetentionLedger","MeshPacking3DError","MeshPacking3DErrorCode","MeshPacking3DErrorOrigin","PackedMeshGeometry3D","PackedSharedDraw2D","PackedSharedEntry2D","PreparedSharedBarrier2D","PreparedSharedBatchPlan2D","PreparedSharedDraw2D","PreparedSharedEntry2D","PreparedSharedFrame2D","RetentionBufferRequest","RetentionHandle","RetentionLease","RetentionPlan","RetentionRequest","RetentionReturnPlan","RetentionTargetRequest","SHARED_BLENDS","SharedB1BuiltinProtocol","SharedDrawCommand2D","SharedOwnerSnapshot2D","SharedPoint2D","SharedPreparationError","SharedPreparationOptions2D","SharedSceneStorage2D","SharedStorageError2D","SharedSubmissionStorage2D","SharedWebGPUConfiguration","WebGPURetentionPool","admitSharedWebGPUOptions","checkSharedCapacity2D","copySharedPagePixels","createSharedResolvePipeline","createSharedWebGPUMeshPipeline","createSharedWebGPUPipeline","createWebGPURetentionPool","decodeSharedSRGB","encodeSharedSRGB","encodeSharedWebGPUMesh","getBuiltinSharedB1Protocol","getSharedMeshPacking3DErrorOrigin","isBuiltinSharedB1Protocol","materializeSharedPages2D","packSharedDraws2D","packSharedMeshGeometry3D","packSharedSubmission2D","planSharedSubmission2D","prepareSharedBatches2D","prepareSharedDraws2D","qualifySharedUV","sharedFailure"];
const privateSharedModules = ["sharedSubmissionStorage2D","sharedRetentionLedger","packSharedDraws2D","packSharedMeshGeometry3D","prepareSharedDraws2D","prepareSharedSubmission2D","preparedSharedBatches2D","sharedB1","sharedColor2D","sharedWebGPUOptions","webgpuRetentionPool","webgpuSharedMeshPass","webgpuSharedPass","webgpuSharedResolvePass"];
for(const [entry,values,stem]of meshEntries) {
  const text=readFileSync(path.join(root,stem+'.d.ts'),'utf8')+'\n'+readFileSync(path.join(root,stem+'.js'),'utf8');
  for(const name of [...privateSharedGPU,...privateSharedModules])if(name in values||new RegExp('\\b'+name+'\\b').test(text))throw new Error('M13: private shared helper leaked: '+entry+'/'+name);
}
// M13_SHARED_SURFACE_END

// T1 adds one exact explicit DOM-free entry. Every retained rule above remains.
const textPublicTypes = [
  'TextRasterRequestInput','TextSourceLine','TextRasterRequest','TextBounds2D','TextLineMetricsInput',
  'TextPlanInput','TextLineMetrics','TextRasterPlacement','TextRasterMetrics','TextRasterPlan','TextRasterLimits',
  'TextMeasureContext','TextRasterContext','TextRasterProvider','TextRasterCacheOptions','TextRasterAcquireOptions',
  'PreparedTextRaster','TextRasterCacheStatus','TextRasterCache',
];
const textPrivate = [
  'registerAssetManagerOwner','requireAssetManagerOwner','beginTextCacheCreation','commitTextCacheLifetime',
  'markAssetManagerOwnerClosed','closeOwnedTextCache','observeAssetLeaseRetirement',
  'TextValueInvocation','TextValueFailureCode','TextValueFailure','TextRasterRequestSnapshot','TextRasterRequestSummary',
  'createTextValueInvocation','closeTextValueInvocation','createTextValueFailure','takeTextValueFailure',
  'snapshotTextRasterRequest','summarizeTextRasterRequest','createOwnedTextRasterRequest',
  'isOwnedTextRasterRequest','requireOwnedTextRasterRequest','matchesTextRasterRequestSummary',
  'TextRasterPlanIssuer','createTextRasterPlanIssuer','closeTextRasterPlanIssuer','readIssuedTextRasterPlan','requireIssuedTextRasterPlan',
  'TextBudgetLimits','TextBudgetCounters','TextBudgetDelta','TextBudgetFailure','TextBudget','TEXT_BUDGET_DEFAULTS','TEXT_BUDGET_MINIMA',
  'requestBrand','planBrand','cacheBrand',
  'registerTextFieldEngine','requireTextFieldEngine','TextFieldEnginePort',
  'createTextFieldLeaf','TextFieldLeaf','TextFieldCachePort','createTextFieldRequestInput',
  'TextFieldCommittedDisplay','TextFieldDisplayState','hasTextFieldState','readTextFieldState','writeTextFieldState','assertTextFieldScope',
];
const runtimeText = await import('@egret/runtime/text');
const engineText = await import('@egret/engine/text');
const canvasText = await import('@egret/engine/web/text');
const textEntries = [...meshEntries,
  ['runtime/text',runtimeText,'packages/runtime/dist/text/index'],
  ['engine/text',engineText,'packages/engine/dist/text'],
  ['engine/web/text',canvasText,'packages/engine/dist/web/text'],
];
// Engine-owned clock extends only the root type surface. Preserve every retained
// reason above; admission and owner helpers remain same-package private details.
const clockPublicTypes = ['GameClockOptions','GameClockState','GameClockTick','GameClockHandler','GameClock','GameClockSubscription'];
const clockPrivate = ['admitGameClockOptions','createGameClockOwner','AdmittedGameClockOptions','GameClockContext','GameClockOwner','clockBrand','subscriptionBrand','createGameClock'];
for (const [entry, values, emittedEntry] of [...textEntries, ['project',projectFacade,'packages/project/dist/index']]) {
  const declaration = readFileSync(path.join(root,emittedEntry+'.d.ts'),'utf8');
  const emitted = readFileSync(path.join(root,emittedEntry+'.js'),'utf8');
  const source = declaration+'\n'+emitted;
  for (const name of clockPrivate) if (name in values || new RegExp('\\b'+name+'\\b').test(source)) throw new Error(`${entry}: private clock authority leaked: ${name}`);
  if (/["'][^"']*(?:^|\/)gameClock(?:\.js|["'])/.test(source)) throw new Error(`${entry}: private clock module leaked`);
  if (entry !== 'root') {
    for (const name of clockPublicTypes) if (name in values || new RegExp('\\b'+name+'\\b').test(source)) throw new Error(`${entry}: Engine-only clock type leaked: ${name}`);
    if (/["'][^"']*(?:^|\/)gameClockTypes(?:\.js|["'])/.test(source)) throw new Error(`${entry}: Engine-only clock types module leaked`);
  } else {
    const clockPorts = [...declaration.matchAll(/export(\s+type)?\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];?/g)].filter(match => match[3] === './gameClockTypes.js');
    if (clockPorts.length !== 1 || !clockPorts[0][1] || JSON.stringify(clockPorts[0][2].split(',').map(name=>name.trim()).sort()) !== JSON.stringify([...clockPublicTypes].sort()) || clockPublicTypes.some(name=>name in values)) throw new Error('root: exact clock type-only export surface mismatch');
  }
}
for (const [entry,values,emittedEntry] of textEntries) {
  const declaration=readFileSync(path.join(root,emittedEntry+'.d.ts'),'utf8');
  const emitted=readFileSync(path.join(root,emittedEntry+'.js'),'utf8');
  const source=declaration+'\n'+emitted;
  for (const name of textPrivate) if (name in values || new RegExp('\\b'+name+'\\b').test(source)) throw new Error(`${entry}: private text authority leaked: ${name}`);
  if (/["'][^"']*(?:assetManagerOwnerState|\/(?:request|plan|budget)\.js)["']/.test(source)) throw new Error(`${entry}: private text module leaked`);
  if (/["'][^"']*(?:textFieldFactoryState|textDisplayState|\/text\/TextField)\.js["']/.test(source)) throw new Error(`${entry}: private text module leaked`);
  if (entry !== 'engine/text') {
    for (const name of ['createTextField','TextField','TextFieldStatus']) if (name in values || new RegExp('\\b'+name+'\\b').test(source)) throw new Error(`${entry}: explicit-only TextField port leaked: ${name}`);
    if (/["'][^"']*\/textField\.js["']/.test(source)) throw new Error(`${entry}: explicit-only TextField module leaked`);
  }
  if (Object.hasOwn(values,'textFieldBrand') || /\bexport\s+(?:declare\s+)?(?:const|let|var|class|function)\s+textFieldBrand\b/.test(declaration) || /\btextFieldBrand\b/.test(emitted)) throw new Error(`${entry}: private TextField brand value leaked`);
  if (!entry.endsWith('/text')) {
    for (const name of ['createTextRasterCache',...textPublicTypes]) if (name in values || new RegExp('\\b'+name+'\\b').test(source)) throw new Error(`${entry}: explicit-only text port leaked: ${name}`);
    if (/["'][^"']*(?:\/text(?:\/|\.js|["']))/.test(source)) throw new Error(`${entry}: explicit-only text module leaked`);
  }
}
const expectedRuntimeValues=['CancellationController','EgretError','Scope','createScope','Event','createEventType',
  'EventDispatcher','DisplayObject','DisplayObjectContainer','Stage','createStage','createDisplayInputOperations','reportDiagnostic','AssetManager',
  'createAssetManager','AssetLease','createAssetType','createAssetRef','Sprite','Graphics','collectFrameCommands',
  'collectFrameContent','collectTexturedFrameContent','Texture','createTexture','isTexture','Bitmap','Mesh2D','NineSliceBitmap','createSequenceClip','SequencePlayer','ByteReader','BYTE_READER_LIMITS','ByteWriter','BYTE_WRITER_LIMITS','createNineSliceGeometry2D','createSpriteSheet'].sort();
const completeRuntimeValues = [...expectedRuntimeValues,'createTextureView','collectSharedFrameContent'].sort();
if (JSON.stringify(Object.keys(runtimeFacade)) !== JSON.stringify(completeRuntimeValues)) throw new Error('runtime: unchanged default-root export surface mismatch');
for (const [entry,values,emittedEntry,valueTarget,typeTarget] of [
  ['runtime/text',runtimeText,'packages/runtime/dist/text/index','./TextRasterCache.js','./types.js'],
  ['engine/text',engineText,'packages/engine/dist/text','@egret/runtime/text','@egret/runtime/text'],
]) {
  const expectedValues=entry==='engine/text'?['createTextField','createTextRasterCache']:['createTextRasterCache'];
  if (JSON.stringify(Object.keys(values)) !== JSON.stringify(expectedValues) || expectedValues.some(name=>typeof values[name]!=='function')) throw new Error(`${entry}: exact text runtime surface mismatch`);
  const declaration=readFileSync(path.join(root,emittedEntry+'.d.ts'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  const valuesDeclared=[...declaration.matchAll(/export\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];?/g)];
  const typeStars=[...declaration.matchAll(/export\s+type\s*\*\s*from\s*["']([^"']+)["'];?/g)];
  let remainder=declaration.replace(/export\s*\{[^}]+\}\s*from\s*["'][^"']+["'];?/g,'').replace(/export\s+type\s*\*\s*from\s*["'][^"']+["'];?/g,'');
  const cachePorts=valuesDeclared.filter(match=>match[1].trim()==='createTextRasterCache'&&match[2]===valueTarget);
  if(entry==='engine/text') {
    const fieldPorts=valuesDeclared.filter(match=>match[1].trim()==='createTextField'&&match[2]==='./textField.js');
    const interfaces=[...remainder.matchAll(/export\s+interface\s+(\w+)(?:\s+extends\s+DisplayObject)?\s*\{[^{}]*\}/g)];
    if(fieldPorts.length!==1||JSON.stringify(interfaces.map(match=>match[1]).sort())!==JSON.stringify(['TextField','TextFieldStatus']))throw new Error(`${entry}: exact TextField type-only surface mismatch`);
    remainder=remainder.replace(/export\s+interface\s+(?:TextField|TextFieldStatus)(?:\s+extends\s+DisplayObject)?\s*\{[^{}]*\}/g,'')
      .replace(/import\s+type\s*\{\s*DisplayObject\s*\}\s*from\s*["']@egret\/runtime["'];?/g,'')
      .replace(/import\s+type\s*\{\s*TextRasterMetrics\s*,\s*TextRasterRequestInput\s*\}\s*from\s*["']@egret\/runtime\/text["'];?/g,'')
      .replace(/declare\s+const\s+textFieldBrand\s*:\s*unique\s+symbol\s*;/g,'')
      .replace(/^[ \t]*export[ \t]*\{[ \t]*\}[ \t]*;[ \t]*\r?$/gm,'');
  }
  if (valuesDeclared.length!==expectedValues.length || cachePorts.length!==1 || typeStars.length!==1 || typeStars[0][1]!==typeTarget || remainder.trim()) throw new Error(`${entry}: exact text declaration surface mismatch`);
}
if (runtimeText.createTextRasterCache !== engineText.createTextRasterCache) throw new Error('engine/text: runtime factory identity mismatch');
const textTypesModule=await import(new URL('../packages/runtime/dist/text/types.js',import.meta.url));
if (Object.keys(textTypesModule).length!==0) throw new Error('runtime/text: canonical types emitted runtime values');
const textTypesDeclaration=readFileSync(path.join(root,'packages/runtime/dist/text/types.d.ts'),'utf8');
const textDeclaredNames=[...textTypesDeclaration.matchAll(/\bexport\s+(?:declare\s+)?(?:type|interface|function|const|class|enum)\s+(\w+)/g)].map(match=>match[1]).sort();
if (JSON.stringify(textDeclaredNames)!==JSON.stringify([...textPublicTypes].sort())) throw new Error('runtime/text: canonical public type inventory mismatch');
// Triple-slash ambient references are dependencies even when normal comments
// are removed by the retained source scan. The new text subtree is DOM-free.
for (const file of [...files(path.join(root,'packages/runtime/src/text')), ...files(path.join(root,'packages/runtime/dist/text')),
  path.join(root,'packages/engine/src/text.ts'),path.join(root,'packages/engine/dist/text.js'),path.join(root,'packages/engine/dist/text.d.ts')]) {
  if (!file.endsWith('.ts') && !file.endsWith('.js')) continue;
  const raw=readFileSync(file,'utf8');
  if (/\/\/\/\s*<reference\s+(?:lib\s*=\s*["']dom(?:\.iterable)?["']|types\s*=\s*["']node["'])/i.test(raw)) throw new Error(`${path.relative(root,file)}: host ambient dependency`);
}

const clockTypesModule = await import(new URL('../packages/engine/dist/gameClockTypes.js',import.meta.url));
if (Object.keys(clockTypesModule).length !== 0) throw new Error('engine: clock types emitted runtime values');
const clockTypesDeclaration = readFileSync(path.join(root,'packages/engine/dist/gameClockTypes.d.ts'),'utf8');
const clockDeclaredNames = [...clockTypesDeclaration.matchAll(/\bexport\s+(?:declare\s+)?(?:type|interface|function|const|class|enum)\s+(\w+)/g)].map(match=>match[1]).sort();
if (JSON.stringify(clockDeclaredNames) !== JSON.stringify([...clockPublicTypes].sort())) throw new Error('engine: canonical clock type inventory mismatch');
// Existing host timeout code remains outside this exact two-module clock scan.
for (const file of ['packages/engine/src/gameClock.ts','packages/engine/src/gameClockTypes.ts','packages/engine/dist/gameClock.js','packages/engine/dist/gameClockTypes.js','packages/engine/dist/gameClock.d.ts','packages/engine/dist/gameClockTypes.d.ts']) {
  const raw = readFileSync(path.join(root,file),'utf8');
  const code = raw.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  if (/\b(?:Date|performance|requestAnimationFrame|cancelAnimationFrame|setInterval|clearInterval|setTimeout|clearTimeout)\b/.test(code)) throw new Error(`${file}: clock automatic timing dependency`);
  if (/\/\/\/\s*<reference\s+(?:lib\s*=\s*["']dom(?:\.iterable)?["']|types\s*=\s*["']node["'])/i.test(raw)) throw new Error(`${file}: host ambient dependency`);
}

// Scope-owned scalar Tween extends only Engine's root type surface/method.
// These names follow the adopted plan; they are not public owner ports.
const tweenPublicTypes = ['Tween','TweenState','TweenOptions','TweenEasing'];
const tweenPrivate = ['createTweenOwner','TweenContext','TweenOwner','tweenBrand','createTween'];
for(const [entry,values,emittedEntry] of [...textEntries,['project',projectFacade,'packages/project/dist/index']]) {
  const declaration=readFileSync(path.join(root,emittedEntry+'.d.ts'),'utf8');
  const emitted=readFileSync(path.join(root,emittedEntry+'.js'),'utf8');
  const source=declaration+'\n'+emitted;
  for(const name of tweenPrivate)if(name in values || new RegExp('\\b'+name+'\\b').test(source))throw new Error(`${entry}: private Tween authority leaked: ${name}`);
  if(/["'][^"']*(?:^|\/)tween(?:\.js|["'])/.test(source))throw new Error(`${entry}: private Tween module leaked`);
  if(entry!=='root') {
    for(const name of tweenPublicTypes)if(name in values || new RegExp('\\b'+name+'\\b').test(source))throw new Error(`${entry}: Engine-only Tween type leaked: ${name}`);
    if(/["'][^"']*(?:^|\/)tweenTypes(?:\.js|["'])/.test(source))throw new Error(`${entry}: Engine-only Tween types module leaked`);
  } else {
    const ports=[...declaration.matchAll(/export(\s+type)?\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];?/g)].filter(match=>match[3]==='./tweenTypes.js');
    const references=[...declaration.matchAll(/["']\.\/tweenTypes\.js["']/g)];
    if(ports.length!==1 || !ports[0][1] || references.length!==1 || /["']\.\/tweenTypes\.js["']/.test(emitted) || JSON.stringify(ports[0][2].split(',').map(name=>name.trim()).sort())!==JSON.stringify([...tweenPublicTypes].sort()) || tweenPublicTypes.some(name=>name in values))throw new Error('root: exact Tween type-only export surface mismatch');
  }
}
const tweenTypesModule=await import(new URL('../packages/engine/dist/tweenTypes.js',import.meta.url));
if(Object.keys(tweenTypesModule).length!==0)throw new Error('engine: Tween types emitted runtime values');
const tweenTypesDeclaration=readFileSync(path.join(root,'packages/engine/dist/tweenTypes.d.ts'),'utf8');
const tweenDeclaredNames=[...tweenTypesDeclaration.matchAll(/\bexport\s+(?:declare\s+)?(?:type|interface|function|const|class|enum)\s+(\w+)/g)].map(match=>match[1]).sort();
// The four canonical declarations are the complete export surface, including
// erased local aliases/reexports that declaration-name scanning alone misses.
const tweenTypesCode=tweenTypesDeclaration.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
// Only standalone empty compiler module markers with a semicolon add no named export.
const tweenExportCount=(tweenTypesCode.replace(/^[ \t]*export[ \t]*\{[ \t]*\}[ \t]*;[ \t]*\r?$/gm,'').match(/\bexport\b/g)??[]).length;
if(JSON.stringify(tweenDeclaredNames)!==JSON.stringify([...tweenPublicTypes].sort()) || tweenExportCount!==tweenPublicTypes.length)throw new Error('engine: canonical Tween type inventory mismatch');
// Only the exact two Tween modules are scanned; existing host deadlines keep
// their lifecycle scope and every prior source scanner/reason remains intact.
for(const file of ['packages/engine/src/tween.ts','packages/engine/src/tweenTypes.ts','packages/engine/dist/tween.js','packages/engine/dist/tweenTypes.js','packages/engine/dist/tween.d.ts','packages/engine/dist/tweenTypes.d.ts']) {
  const raw=readFileSync(path.join(root,file),'utf8');
  const code=raw.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  if(/\b(?:Date|performance|requestAnimationFrame|cancelAnimationFrame|setInterval|clearInterval|setTimeout|clearTimeout)\b/.test(code))throw new Error(`${file}: Tween automatic timing dependency`);
  if(/\/\/\/\s*<reference\s+(?:lib\s*=\s*["']dom(?:\.iterable)?["']|types\s*=\s*["']node["'])/i.test(raw))throw new Error(`${file}: host ambient dependency`);
}

// BR1 extends only the two retained exact value inventories above. These new
// checks follow every old refusal, without adding an import/subpath exception.
const byteReaderValues = ['BYTE_READER_LIMITS', 'ByteReader'];
const byteReaderNames = [...byteReaderValues, 'ByteOrder'];
const byteReaderStrip = raw => raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const byteReaderModuleReference = /["'][^"']*(?:^|\/)ByteReader\.js["']/;
const byteReaderRuntimeWildcard = /export\s+(?:type\s+)?\*(?:\s+as\s+\w+)?\s*from\s*["']@egret\/runtime["']/;
// These public barrels admit named runtime dependencies, never a root-runtime
// namespace import or import-type query. The observed genuine baseline has
// neither form. Reject the form itself, without resolving local names/escapes.
// This bounded ordinary-barrel scan is not a general TypeScript parser.
const byteReaderRuntimeModuleAccess = raw => {
  const tokens = [...raw.matchAll(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"|'(?:\\(?:\r\n|[\s\S])|[^'\\\r\n])*'|`(?:\\[\s\S]|[^`\\$]|\$(?!\{))*`|[$_\p{ID_Start}][$\u200c\u200d\p{ID_Continue}]*|[^\s]/gu)]
    .map(match => match[0]).filter(text => !text.startsWith('/*') && !text.startsWith('//'));
  const target = token => typeof token === 'string' && /^(["'])@egret\/runtime\1$/.test(token);
  for (let index = 0; index < tokens.length; index++) {
    if (tokens[index] !== 'import') continue;
    // typeof import(...) exposes value shapes even with no BR1 name in the
    // declaration; the same fixed policy also rejects qualified import types.
    if (tokens[index + 1] === '(' && target(tokens[index + 2])) return true;
    let from = index + 1;
    for (; from < tokens.length; from++) {
      if (tokens[from] === ';' || (from > index + 1 && ['import', 'export'].includes(tokens[from]))) break;
      if (tokens[from] === 'from' && /^["']/.test(tokens[from + 1] ?? '')) break;
    }
    if (tokens[from] === 'from' && target(tokens[from + 1]) && tokens.slice(index + 1, from).includes('*')) return true;
  }
  return false;
};
for (const [entry, values, emittedEntry] of [...textEntries, ['project', projectFacade, 'packages/project/dist/index']]) {
  const rawDeclaration = readFileSync(path.join(root, emittedEntry + '.d.ts'), 'utf8');
  const declaration = byteReaderStrip(rawDeclaration);
  const emitted = byteReaderStrip(readFileSync(path.join(root, emittedEntry + '.js'), 'utf8'));
  if (entry !== 'root' && entry !== 'runtime') {
    for (const name of byteReaderNames) if (name in values || new RegExp('\\b' + name + '\\b').test(declaration + '\n' + emitted)) throw new Error(`${entry}: root/runtime-only ByteReader port leaked: ${name}`);
    if (byteReaderModuleReference.test(declaration + '\n' + emitted) || byteReaderRuntimeWildcard.test(declaration + '\n' + emitted)
        || byteReaderRuntimeModuleAccess(rawDeclaration)) throw new Error(`${entry}: root/runtime-only ByteReader module leaked`);
    continue;
  }
  if ('ByteOrder' in values || /\bByteOrder\b/.test(emitted)) throw new Error(`${entry}: ByteOrder must be erased`);
  if (typeof values.ByteReader !== 'function' || typeof values.BYTE_READER_LIMITS !== 'object' || values.BYTE_READER_LIMITS === null) throw new Error(`${entry}: ByteReader value surface missing`);
  const target = entry === 'root' ? '@egret/runtime' : './ByteReader.js';
  const ports = [...declaration.matchAll(/export(\s+type)?\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];?/g)].filter(match =>
    byteReaderNames.some(name => new RegExp('\\b' + name + '\\b').test(match[2])) || /(?:^|\/)ByteReader\.js$/.test(match[3]));
  const valuesDeclared = ports.filter(match => !match[1]);
  const typesDeclared = ports.filter(match => !!match[1]);
  const remainder = ports.reduce((text, match) => text.replace(match[0], ''), declaration);
  // Named clauses are exact: aliases, inline type modifiers, duplicate clauses
  // and runtime-wide type namespaces cannot silently enlarge this small API.
  if (ports.length !== 2 || valuesDeclared.length !== 1 || typesDeclared.length !== 1
      || ports.some(match => match[3] !== target)
      || JSON.stringify(valuesDeclared[0][2].split(',').map(name => name.trim()).sort()) !== JSON.stringify(byteReaderValues)
      || typesDeclared[0][2].trim() !== 'ByteOrder'
      || byteReaderNames.some(name => new RegExp('\\b' + name + '\\b').test(remainder))
      || byteReaderModuleReference.test(remainder) || byteReaderRuntimeWildcard.test(remainder)
      || byteReaderRuntimeModuleAccess(rawDeclaration)) throw new Error(`${entry}: exact ByteReader declaration re-export mismatch`);
}
const byteReaderModule = await import(new URL('../packages/runtime/dist/ByteReader.js', import.meta.url));
if (JSON.stringify(Object.keys(byteReaderModule)) !== JSON.stringify(byteReaderValues)) throw new Error('runtime: canonical ByteReader runtime export surface mismatch');
for (const name of byteReaderValues) {
  if (runtimeFacade[name] !== byteReaderModule[name]) throw new Error(`runtime: ByteReader module identity mismatch: ${name}`);
  if (facade[name] !== runtimeFacade[name]) throw new Error(`root: ByteReader runtime identity mismatch: ${name}`);
}
const byteReaderDeclaration = byteReaderStrip(readFileSync(path.join(root, 'packages/runtime/dist/ByteReader.d.ts'), 'utf8'));
const byteReaderDeclaredNames = [...byteReaderDeclaration.matchAll(/\bexport\s+(?:declare\s+)?(?:type|interface|function|const|class|enum)\s+(\w+)/g)].map(match => match[1]).sort();
const byteReaderExportCount = (byteReaderDeclaration.replace(/^[ \t]*export[ \t]*\{[ \t]*\}[ \t]*;[ \t]*\r?$/gm, '').match(/\bexport\b/g) ?? []).length;
if (JSON.stringify(byteReaderDeclaredNames) !== JSON.stringify([...byteReaderNames].sort()) || byteReaderExportCount !== 3) throw new Error('runtime: canonical ByteReader declaration export surface mismatch');
// Triple-slash references remain dependencies even though the retained generic
// scan removes ordinary comments. This exact utility stays DOM/Node-free.
for (const file of ['packages/runtime/src/ByteReader.ts', 'packages/runtime/dist/ByteReader.js', 'packages/runtime/dist/ByteReader.d.ts']) {
  const raw = readFileSync(path.join(root, file), 'utf8'), code = byteReaderStrip(raw);
  if (forbidden.test(code) || /\b(?:HTMLElement|Document|Window|Navigator|NodeJS)\b/.test(code)
      || /\/\/\/\s*<reference\s+(?:lib\s*=\s*["']dom(?:\.iterable)?["']|types\s*=\s*["']node["'])/i.test(raw)) throw new Error(`${file}: host ambient dependency`);
}

// WC1 adds one explicit value and no named type surface. Keep old entry guards
// and their refusal precedence; this leaf is never a default or Canvas-host port.
if (JSON.stringify(Object.keys(canvasText))!==JSON.stringify(['createCanvasTextRasterProvider'])
    || typeof canvasText.createCanvasTextRasterProvider!=='function') throw new Error('web/text: exact Canvas text runtime surface mismatch');
const canvasTextStrip=raw=>raw.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'').trim();
const canvasTextDeclaration=canvasTextStrip(readFileSync(path.join(root,'packages/engine/dist/web/text.d.ts'),'utf8'));
if (!/^export\s*\{\s*createCanvasTextRasterProvider\s*\}\s*from\s*['"]\.\/CanvasTextRasterProvider\.js['"];?$/.test(canvasTextDeclaration)) throw new Error('web/text: exact Canvas text declaration surface mismatch');
const canvasProviderDeclaration=canvasTextStrip(readFileSync(path.join(root,'packages/engine/dist/web/CanvasTextRasterProvider.d.ts'),'utf8'));
if (!/^import\s+type\s*\{\s*TextRasterProvider\s*\}\s*from\s*['"]@egret\/engine\/text['"];\s*export\s+declare\s+function\s+createCanvasTextRasterProvider\s*\(\s*\)\s*:\s*TextRasterProvider\s*;$/.test(canvasProviderDeclaration)) throw new Error('web/text: exact Canvas text factory declaration mismatch');
for(const [entry,values,emittedEntry] of [...textEntries,['project',projectFacade,'packages/project/dist/index']]) {
  if(entry==='engine/web/text')continue;
  const code=readFileSync(path.join(root,emittedEntry+'.d.ts'),'utf8')+'\n'+readFileSync(path.join(root,emittedEntry+'.js'),'utf8');
  if('createCanvasTextRasterProvider' in values || /\b(?:createCanvasTextRasterProvider|CanvasTextRasterProvider)\b/.test(code)
      || /['"][^'"]*\/web\/text\.js['"]/.test(code)) throw new Error(`${entry}: explicit-only Canvas text port leaked`);
}
// Source, runtime emission and declarations share the exact opt-in boundary.
for(const suffix of ['web/CanvasTextRasterProvider.ts','web/text.ts','dist/web/CanvasTextRasterProvider.js','dist/web/text.js','dist/web/CanvasTextRasterProvider.d.ts','dist/web/text.d.ts']) {
  const file='packages/engine/'+suffix,code=canvasTextStrip(readFileSync(path.join(root,file),'utf8'));
  if(/\b(?:FontFace|OffscreenCanvas|fetch|setTimeout|clearTimeout|setInterval|clearInterval|requestAnimationFrame|cancelAnimationFrame)\b|\.fonts\s*\.\s*(?:load|ready|add|delete|clear)\b|\baddEventListener\b/.test(code)) throw new Error(`${file}: Canvas text hidden work or font ownership`);
  if(/['"][^'"]*(?:runtime\/text|\/text\/(?:TextRasterCache|request|plan|budget|types)|\.\.\/text|textField)\.js['"]/.test(code)) throw new Error(`${file}: Canvas text private/value text dependency`);
}
// Import itself is inert in the ordinary Node checker; only the explicit factory
// reports environment unavailability. This is not native Canvas verification.
let canvasTextUnavailable;
try { canvasText.createCanvasTextRasterProvider(); } catch(error) { canvasTextUnavailable=error; }
if(canvasTextUnavailable?.code!=='WEB_TEXT_UNAVAILABLE')throw new Error('web/text: nonbrowser factory must be unavailable');

// HT1 adds only an erased options port and members on existing display classes.
// The retained value inventories and every older refusal above stay unchanged.
const hitTestStrip = raw => raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').trim();
const hitTestPrivateNames = ['DisplayHitState', 'registerDisplayHitNode', 'registerDisplayHitContainer',
  'readDisplayHitState', 'readDisplayTouchChildren', 'writeDisplayTouchEnabled', 'writeDisplayTouchChildren', 'writeDisplayHitArea', 'queryDisplayHit'];
for (const [entry, values, emittedEntry] of [...textEntries, ['project', projectFacade, 'packages/project/dist/index']]) {
  const declaration = hitTestStrip(readFileSync(path.join(root, emittedEntry + '.d.ts'), 'utf8'));
  const emitted = hitTestStrip(readFileSync(path.join(root, emittedEntry + '.js'), 'utf8'));
  let remainder = declaration;
  if (entry === 'root' || entry === 'runtime') {
    const target = entry === 'root' ? '@egret/runtime' : './displayHitTest.js';
    const clauses = [...declaration.matchAll(/export(?:\s+type)?\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g)]
      .filter(match => /\bHitTestOptions\b/.test(match[1]) || /\bdisplayHitTest\b/.test(match[2]));
    if (clauses.length !== 1 || !/^export\s+type\s*\{\s*HitTestOptions\s*\}\s*from\s*['"][^'"]+['"];?$/.test(clauses[0][0])
        || clauses[0][2] !== target || 'HitTestOptions' in values || /\bHitTestOptions\b/.test(emitted)) {
      throw new Error(`${entry}: exact hit-test type-only facade mismatch`);
    }
    remainder = declaration.replace(clauses[0][0], '');
    if (/\bHitTestOptions\b/.test(remainder)) throw new Error(`${entry}: duplicate hit-test options declaration`);
  } else if ('HitTestOptions' in values || /\bHitTestOptions\b/.test(declaration + '\n' + emitted)) {
    throw new Error(`${entry}: root/runtime-only hit-test options leaked`);
  }
  for (const name of hitTestPrivateNames) if (name in values || new RegExp('\\b' + name + '\\b').test(remainder + '\n' + emitted)) {
    throw new Error(`${entry}: private hit-test authority leaked: ${name}`);
  }
  if (/\b(?:displayHitState|displayHitTest)\b/.test(remainder + '\n' + emitted)) throw new Error(`${entry}: private hit-test module leaked`);
}
const hitTestOptionsDeclaration = hitTestStrip(readFileSync(path.join(root, 'packages/runtime/dist/displayHitTest.d.ts'), 'utf8'));
const hitTestOptionBodies = [...hitTestOptionsDeclaration.matchAll(/export\s+interface\s+HitTestOptions\s*\{([^}]*)\}/g)];
if (hitTestOptionBodies.length !== 1 || !/^\s*readonly\s+maxNodes\?\s*:\s*number\s*;\s*$/.test(hitTestOptionBodies[0][1])) {
  throw new Error('runtime: exact hit-test options shape mismatch');
}
const hitTestClassMembers = [
  ['DisplayObject', 'touchEnabled', 'get touchEnabled(): boolean;', 'set touchEnabled(value: boolean);'],
  ['DisplayObject', 'hitArea', 'get hitArea(): Rectangle2D | undefined;', 'set hitArea(value: Rectangle2D | undefined);'],
  ['DisplayObjectContainer', 'touchChildren', 'get touchChildren(): boolean;', 'set touchChildren(value: boolean);'],
];
for (const name of ['DisplayObject', 'DisplayObjectContainer', 'Stage']) if (facade[name] !== runtimeFacade[name]) {
  throw new Error(`root: hit-test class identity mismatch: ${name}`);
}
const hitTestDeclarationText = name => hitTestStrip(readFileSync(path.join(root, 'packages/runtime/dist/' + name + '.d.ts'), 'utf8')).replace(/\s+/g, ' ');
for (const [name, member, getter, setter] of hitTestClassMembers) {
  const declaration = hitTestDeclarationText(name);
  if (!declaration.includes(getter) || !declaration.includes(setter)
      || [...declaration.matchAll(new RegExp('\\b(?:get|set)\\s+' + member + '\\s*\\(', 'g'))].length !== 2) throw new Error(`runtime: hit-test ${name}.${member} declaration mismatch`);
  for (const [entry, values] of [['runtime', runtimeFacade], ['root', facade]]) {
    const descriptor = Object.getOwnPropertyDescriptor(values[name].prototype, member);
    if (!descriptor || typeof descriptor.get !== 'function' || typeof descriptor.set !== 'function'
        || descriptor.enumerable !== false || descriptor.configurable !== true) throw new Error(`${entry}: hit-test ${name}.${member} accessor mismatch`);
  }
}
const hitTestStageSignature = 'hitTest(globalX: number, globalY: number, options?: HitTestOptions): DisplayObject | undefined;';
if (!hitTestDeclarationText('Stage').includes(hitTestStageSignature)
    || [...hitTestDeclarationText('Stage').matchAll(/\bhitTest\s*\(/g)].length !== 1
    || /\bhitTest\s*\(|\btouchChildren\b/.test(hitTestDeclarationText('DisplayObject'))
    || /\bhitTest\s*\(/.test(hitTestDeclarationText('DisplayObjectContainer'))) throw new Error('runtime: Stage.hitTest declaration mismatch');
for (const [entry, values] of [['runtime', runtimeFacade], ['root', facade]]) {
  const descriptor = Object.getOwnPropertyDescriptor(values.Stage.prototype, 'hitTest');
  if (!descriptor || typeof descriptor.value !== 'function' || descriptor.enumerable !== false || descriptor.configurable !== true
      || Object.hasOwn(values.DisplayObject.prototype, 'hitTest') || Object.hasOwn(values.DisplayObjectContainer.prototype, 'hitTest')) {
    throw new Error(`${entry}: Stage-only hit-test method mismatch`);
  }
}
for (const name of ['displayHitState', 'displayHitTest']) for (const [directory, suffix] of [['src', '.ts'], ['dist', '.js'], ['dist', '.d.ts']]) {
  const file = `packages/runtime/${directory}/${name}${suffix}`, raw = readFileSync(path.join(root, file), 'utf8'), code = hitTestStrip(raw);
  if (forbidden.test(code) || /\b(?:HTMLElement|Document|Window|Navigator|NodeJS)\b/.test(code)
      || /\/\/\/\s*<reference\s+(?:lib\s*=\s*['"]dom(?:\.iterable)?['"]|types\s*=\s*['"]node['"])/i.test(raw)) throw new Error(`${file}: hit-test host ambient dependency`);
  const runtimeImports = directory === 'src' ? code.replace(/\bimport\s+type\s*\{[^}]+\}\s*from\s*['"][^'"]+['"];?/g, '') : code;
  if (suffix !== '.d.ts' && /\bimport\b[^;]*['"]\.\/(?:DisplayObject|DisplayObjectContainer|Stage)\.js['"]/.test(runtimeImports)) {
    throw new Error(`${file}: hit-test display class value backedge`);
  }
}

// RG1_BOUNDARY_BEGIN
// Scope-owned resource groups add three erased Engine types and one instance
// method. The runtime port below is exact assembly typing, not owner authority.
// Every retained policy runs before this finite successor, with no exemption.
const assetGroupStrip = raw => raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').trim();
const assetGroupPublicTypes = ['AssetGroup', 'AssetGroupState', 'AssetGroupOptions'];
const assetGroupPrivateNames = ['createAssetGroup', 'createAssetGroupOwner', 'AssetGroupOwner', 'AssetGroupContext', 'assetGroupBrand', 'registerAssetGroupOperations', 'requireAssetManagerOwner', 'registerAssetManagerOwner'];
const assetGroupSourceEntries = {
  contracts: 'packages/contracts/src/index.ts', root: 'packages/engine/src/index.ts',
  runtime: 'packages/runtime/src/index.ts', web: 'packages/engine/web/index.ts',
  webgpu: 'packages/engine/web/webgpu.ts', 'runtime/text': 'packages/runtime/src/text/index.ts',
  'engine/text': 'packages/engine/src/text.ts', 'engine/web/text': 'packages/engine/web/text.ts',
  project: 'packages/project/src/index.ts',
  'contracts/resources': 'packages/contracts/src/resources/index.ts',
  'project/resources': 'packages/project/src/resources/index.ts',
  'engine/resources': 'packages/engine/src/resources.ts',
  'engine/web/resources': 'packages/engine/web/resources.ts',
};
for (const [entry, values, emittedEntry] of [...textEntries, ['project', projectFacade, 'packages/project/dist/index']]) {
  const declaration = assetGroupStrip(readFileSync(path.join(root, emittedEntry + '.d.ts'), 'utf8'));
  const emitted = assetGroupStrip(readFileSync(path.join(root, emittedEntry + '.js'), 'utf8'));
  const original = assetGroupStrip(readFileSync(path.join(root, assetGroupSourceEntries[entry]), 'utf8'));
  for (const [label, text] of [[entry, declaration], [entry + ' source', original]]) {
    let remainder = text;
    if (entry === 'root') {
      const ports = [...text.matchAll(/export(?:\s+type)?\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g)]
        .filter(match => match[2] === './assetGroupTypes.js' || /\b(?:AssetGroup|AssetGroupState|AssetGroupOptions)\b/.test(match[1]));
      const references = [...text.matchAll(/['"]\.\/assetGroupTypes\.js['"]/g)];
      if (ports.length !== 1 || !/^export\s+type\s*\{[^}]+\}\s*from\s*['"]\.\/assetGroupTypes\.js['"];?$/.test(ports[0][0])
          || references.length !== 1 || JSON.stringify(ports[0][1].split(',').map(name => name.trim()).sort()) !== JSON.stringify([...assetGroupPublicTypes].sort())
          || assetGroupPublicTypes.some(name => name in values)) throw new Error(`${label}: exact AssetGroup type-only export surface mismatch`);
      remainder = text.replace(ports[0][0], '');
      if (/\b(?:AssetGroup|AssetGroupState|AssetGroupOptions)\b/.test(remainder)) throw new Error(`${label}: exact AssetGroup type-only export surface mismatch`);
    } else {
      for (const name of assetGroupPublicTypes) if (name in values || new RegExp('\\b' + name + '\\b').test(text)) throw new Error(`${label}: Engine-only AssetGroup type leaked: ${name}`);
      if (/\bassetGroupTypes\b/.test(text)) throw new Error(`${label}: Engine-only AssetGroup types module leaked`);
    }
    if (entry === 'runtime') {
      const ports = [...text.matchAll(/export(?:\s+type)?\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g)]
        .filter(match => match[2] === './assetManagerOwnerState.js' || /\bAssetGroupOperations\b/.test(match[1]));
      if (ports.length !== 1 || !/^export\s+type\s*\{\s*AssetGroupOperations\s*\}\s*from\s*['"]\.\/assetManagerOwnerState\.js['"];?$/.test(ports[0][0])
          || [...text.matchAll(/['"]\.\/assetManagerOwnerState\.js['"]/g)].length !== 1 || 'AssetGroupOperations' in values)
        throw new Error(`${label}: exact AssetGroupOperations type-only assembly mismatch`);
      remainder = remainder.replace(ports[0][0], '');
      if (/\b(?:AssetGroupOperations|assetManagerOwnerState)\b/.test(remainder)) throw new Error(`${label}: exact AssetGroupOperations type-only assembly mismatch`);
    } else if ('AssetGroupOperations' in values || /\bAssetGroupOperations\b/.test(text)) {
      throw new Error(`${label}: runtime-only AssetGroup assembly type leaked`);
    }
    for (const name of assetGroupPrivateNames) if (name in values || new RegExp('\\b' + name + '\\b').test(remainder)) throw new Error(`${label}: private AssetGroup authority leaked: ${name}`);
    if (/['"][^'"]*(?:^|\/)assetGroup(?:\.js|['"])/.test(remainder)) throw new Error(`${label}: private AssetGroup module leaked`);
  }
  for (const name of [...assetGroupPublicTypes, 'AssetGroupOperations', ...assetGroupPrivateNames])
    if (name in values || new RegExp('\\b' + name + '\\b').test(emitted)) throw new Error(`${entry}: AssetGroup erased or private value leaked: ${name}`);
  if (/\b(?:assetGroupTypes|assetGroup|assetManagerOwnerState)\b/.test(emitted)) throw new Error(`${entry}: private AssetGroup module leaked`);
}
const assetGroupTypesModule = await import(new URL('../packages/engine/dist/assetGroupTypes.js', import.meta.url));
if (Object.keys(assetGroupTypesModule).length !== 0) throw new Error('engine: AssetGroup types emitted runtime values');
// RG1_ERASURE_BEGIN
// An empty namespace does not prove local allocations were erased. The exact
// declaration-only module may retain only its empty compiler module marker.
const assetGroupTypesEmitted = assetGroupStrip(readFileSync(path.join(root, 'packages/engine/dist/assetGroupTypes.js'), 'utf8'));
if (!/^export\s*\{\s*\}\s*;$/.test(assetGroupTypesEmitted)) throw new Error('engine: AssetGroup types emitted non-erased module code');
// RG1_ERASURE_END
for (const [label, file] of [['engine source', 'packages/engine/src/assetGroupTypes.ts'], ['engine', 'packages/engine/dist/assetGroupTypes.d.ts']]) {
  const code = assetGroupStrip(readFileSync(path.join(root, file), 'utf8'));
  const names = [...code.matchAll(/\bexport\s+(?:declare\s+)?(?:type|interface|function|const|class|enum)\s+(\w+)/g)].map(match => match[1]).sort();
  const exportCount = (code.replace(/^[ \t]*export[ \t]*\{[ \t]*\}[ \t]*;[ \t]*\r?$/gm, '').match(/\bexport\b/g) ?? []).length;
  if (JSON.stringify(names) !== JSON.stringify([...assetGroupPublicTypes].sort()) || exportCount !== 3)
    throw new Error(`${label}: canonical AssetGroup type inventory mismatch`);
  const states = [...code.matchAll(/export\s+type\s+AssetGroupState\s*=\s*([^;]+);/g)];
  const options = [...code.matchAll(/export\s+interface\s+AssetGroupOptions\s*\{([^}]*)\}/g)];
  const groups = [...code.matchAll(/export\s+interface\s+AssetGroup\s*<\s*T\s*>\s*\{([^}]*)\}/g)];
  const compact = value => value.replace(/\s+/g, '');
  if ([...code.matchAll(/\bdeclare\s+const\s+assetGroupBrand\s*:\s*unique\s+symbol\s*;/g)].length !== 1
      || /\bexport\s+(?:declare\s+)?const\s+assetGroupBrand\b/.test(code)
      || states.length !== 1 || compact(states[0][1]) !== "'pending'|'ready'|'failed'|'disposed'"
      || options.length !== 1 || compact(options[0][1]) !== 'readonlyconcurrency?:number;'
      || groups.length !== 1 || compact(groups[0][1]) !== 'readonly[assetGroupBrand]:true;readonlystate:AssetGroupState;readonlyready:Promise<readonlyAssetLease<T>[]>;dispose():void;')
    throw new Error(`${label}: canonical AssetGroup contract mismatch`);
}
const assetGroupMethod = 'createAssetGroup<T>(scope: Scope, refs: readonly AssetRef<T>[], options?: AssetGroupOptions): AssetGroup<T>';
for (const [label, file, ending] of [['engine source', 'packages/engine/src/Engine.ts', ' {'], ['engine', 'packages/engine/dist/Engine.d.ts', ';']]) {
  const code = assetGroupStrip(readFileSync(path.join(root, file), 'utf8')).replace(/\s+/g, ' ');
  if (!code.includes(assetGroupMethod + ending) || [...code.matchAll(/\bcreateAssetGroup\s*(?:<[^>]*>)?\s*\(/g)].length !== 1)
    throw new Error(`${label}: exact createAssetGroup signature mismatch`);
}
const assetGroupMethodDescriptor = Object.getOwnPropertyDescriptor(facade.Engine.prototype, 'createAssetGroup');
if (!assetGroupMethodDescriptor || typeof assetGroupMethodDescriptor.value !== 'function'
    || assetGroupMethodDescriptor.enumerable !== false || assetGroupMethodDescriptor.configurable !== true
    || Object.hasOwn(facade.Engine, 'createAssetGroup')) throw new Error('engine: createAssetGroup instance method mismatch');
// Optional context assembly keeps ordinary runtime construction valid. Pin the
// four captured operations, not a public factory or runtime ownership lookup.
for (const [label, directory, suffix] of [['runtime source', 'src', '.ts'], ['runtime', 'dist', '.d.ts']]) {
  const operations = assetGroupStrip(readFileSync(path.join(root, `packages/runtime/${directory}/assetManagerOwnerState${suffix}`), 'utf8'));
  const ports = [...operations.matchAll(/export\s+interface\s+AssetGroupOperations\s*\{([^}]*)\}/g)];
  const expectedBody = 'readonlyadmitGroupRefs:(refs:readonlyunknown[])=>void;readonlyacquire:<T>(ref:AssetRef<T>,options?:AssetAcquireOptions)=>Promise<AssetLease<T>>;readonlyclaimGroupLease:(lease:unknown,group:object)=>void;readonlyreleaseGroupLease:(lease:unknown)=>void;';
  if (ports.length !== 1 || ports[0][1].replace(/\s+/g, '') !== expectedBody) throw new Error(`${label}: AssetGroupOperations assembly contract mismatch`);
  const context = assetGroupStrip(readFileSync(path.join(root, `packages/runtime/${directory}/ownership${suffix}`), 'utf8'));
  if ([...context.matchAll(/readonly\s+registerAssetGroupOperations\?\s*:\s*\(operations\s*:\s*AssetGroupOperations\)\s*=>\s*void\s*;/g)].length !== 1
      || [...context.matchAll(/\bregisterAssetGroupOperations\b/g)].length !== 1) throw new Error(`${label}: optional AssetGroupOperations context assembly mismatch`);
}
// Only new group modules gain this no-automatic-timing check. Retained Engine
// shutdown deadlines and all earlier source-scanner exceptions remain intact.
for (const name of ['assetGroup', 'assetGroupTypes']) for (const [directory, suffix] of [['src', '.ts'], ['dist', '.js'], ['dist', '.d.ts']]) {
  const file = `packages/engine/${directory}/${name}${suffix}`;
  const raw = readFileSync(path.join(root, file), 'utf8'), code = assetGroupStrip(raw);
  if (/\b(?:Date|performance|requestAnimationFrame|cancelAnimationFrame|setInterval|clearInterval|setTimeout|clearTimeout)\b/.test(code)) throw new Error(`${file}: AssetGroup automatic timing dependency`);
  if (forbidden.test(code) || /\b(?:HTMLElement|Document|Window|Navigator|NodeJS|GPUDevice)\b/.test(code)
      || /\/\/\/\s*<reference\s+(?:lib\s*=\s*['"]dom(?:\.iterable)?['"]|types\s*=\s*['"]node['"])/i.test(raw)) throw new Error(`${file}: host ambient dependency`);
}
// RG1_BOUNDARY_END
// S3D1_BOUNDARY_BEGIN
// Separate explicit entries do not exempt any earlier private authority guard.
const sceneCPUValues = ['createMatrix4','multiplyMatrix4','Math3DError','createMeshGeometry3D','isMeshGeometry3D','MeshGeometry3DError','getMeshGeometry3DErrorOrigin','createSceneFrame3D','isSceneFrame3D','Scene3DError','getScene3DErrorOrigin'];
const sceneCPUTypes = ['Matrix4','Math3DErrorCode','MeshGeometry3DInput','MeshGeometry3D','MeshGeometry3DErrorCode','MeshGeometry3DErrorOrigin','SceneProjectionInput3D','SceneDrawInput3D','SceneInput3D','SceneDraw3D','SceneFrame3D','Scene3DErrorCode','Scene3DErrorOrigin'];
const sceneLegacyWebTypes = ['SceneWebGPUHostOptions','SceneWebGPUHostStatus','SceneWebGPUHost'];
const sceneWebValues = ['createSceneWebGPUHost','createTexturedSceneWebGPUHost','createSharedSceneWebGPUHost'];
const sceneWebTypes = [...sceneLegacyWebTypes,'TexturedSceneWebGPUHost','TexturedWebGPUHostOptions','SharedSceneWebGPUHost','SharedSceneWebGPUHostOptions',...m15SharedHostTypes];
const sceneRead = file => assetGroupStrip(readFileSync(path.join(root,file),'utf8'));
const sceneEqual = (a,b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
function sceneExports(code, label) {
  const value = [], type = [];
  if (/\bexport\s*(?:type\s*)?\*/.test(code) || /\bexport\s+default\b/.test(code)) throw new Error(label + ': exact type-only export surface mismatch');
  for (const match of code.matchAll(/\bexport(\s+type)?\s*\{([^}]+)\}(?:\s*from\s*['"]([^'"]+)['"])?\s*;?/g)) {
    for (const name of match[2].split(',').map(name=>name.trim()).filter(Boolean)) {
      if (!/^\w+$/.test(name)) throw new Error(label + ': exact type-only export surface mismatch');
      (match[1] ? type : value).push(name);
    }
  }
  for (const match of code.matchAll(/\bexport\s+(?:declare\s+)?(type|interface|function|const|class|enum)\s+(\w+)/g))
    (['type','interface'].includes(match[1]) ? type : value).push(match[2]);
  return {value,type};
}
function sceneSurface(code, label, expectedValues, expectedTypes) {
  const names=sceneExports(code,label);
  if (!sceneEqual(names.value,expectedValues)) throw new Error(label + ': exact runtime export surface mismatch');
  if (!sceneEqual(names.type,expectedTypes)) throw new Error(label + ': exact type-only export surface mismatch');
}
function sceneClauses(code, label, allowed) {
  // Direct quoted static clauses only. A computed/dynamic edge has no permission
  // on either facade, even when it would resolve into the same private subtree.
  if (/\bimport\s*\(/.test(code)) throw new Error('S3D1: scene entry imported outside approved closure: '+label);
  for (const match of code.matchAll(/\b(import|export)(\s+type)?\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]\s*;?/g)) {
    const kind=match[2]?'type':'value',rule=allowed[match[4]]?.[kind];
    const names=match[3].split(',').map(name=>name.trim().split(/\s+as\s+/)[0]).filter(Boolean);
    if (!rule || names.some(name=>!rule.includes(name)) || new Set(names).size!==names.length)
      throw new Error('S3D1: scene entry imported outside approved closure: '+label);
  }
  const stripped=code.replace(/\b(?:import|export)(?:\s+type)?\s*\{[^}]+\}\s*from\s*['"][^'"]+['"]\s*;?/g,'');
  if (/\bimport\b|\bfrom\s*['"]/.test(stripped)) throw new Error('S3D1: scene entry imported outside approved closure: '+label);
}
function sceneForward(code, name, target, parameter, label) {
  const imports=[...code.matchAll(/\bimport\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]\s*;?/g)]
    .filter(match=>match[2]===target).flatMap(match=>match[1].split(',').map(value=>value.trim().split(/\s+as\s+/)));
  const forwardName=name==='createSceneWebGPUHost'?'createB1WebGPUHost':name==='createTexturedSceneWebGPUHost'?'createTexturedB1WebGPUHost':name;
  const importsForFactory=imports.filter(parts=>parts[0]===forwardName);
  if (importsForFactory.length!==1) throw new Error(label+': exact direct factory forwarding mismatch');
  const local=importsForFactory[0][1]??importsForFactory[0][0];
  // Operand pairs retain exact order; the existing single-input check stays intact.
  const parameters=Array.isArray(parameter)?parameter:[parameter];
  const parameterList=Array.isArray(parameter)
    ? parameter.map(value=>value+'(?:\\s*:[^,)]+)?').join('\\s*,\\s*')
    : parameter+'(?:\\s*:[^)]*)?';
  const functions=[...code.matchAll(new RegExp('export\\s+function\\s+'+name+'\\s*\\(\\s*'+parameterList+'\\s*\\)(?:\\s*:[^{]+)?\\s*\\{([^}]*)\\}','g'))];
  if (functions.length!==1 || functions[0][1].replace(/\s+/g,'')!=='return'+local+'('+parameters.join(',')+');')
    throw new Error(label+': exact direct factory forwarding mismatch');
}
function sceneOnlyProgram(code,kind,factories,localTypes,label) {
  let rest=code.replace(/\b(?:import|export)(?:\s+type)?\s*\{[^}]+\}\s*from\s*['"][^'"]+['"]\s*;?/g,'');
  for(const [name,signature,body]of localTypes) {
    const match=rest.match(new RegExp('export\\s+(?:declare\\s+)?'+signature+'\\s*'+name+'\\b[^\\{;]*(?:\\{([^}]*)\\}|=([^;]+);)'));
    if(!match || (match[1]??match[2]).replace(/\s+/g,'')!==body)throw new Error(label+': canonical authoring/Host type mismatch: '+name);
    rest=rest.replace(match[0],'');
  }
  for(const [name,inputType,outputType,parameter]of factories) {
    // Source/declaration operand types and emitted arity remain exact at this port.
    const parameterList=Array.isArray(parameter)?parameter.join('\\s*,\\s*'):parameter;
    const typedParameterList=Array.isArray(parameter)
      ? parameter.map((value,index)=>value+'\\s*:\\s*'+inputType[index]).join('\\s*,\\s*')
      : parameter+'\\s*:\\s*'+inputType;
    const expression=kind==='emitted'
      ? 'export\\s+function\\s+'+name+'\\s*\\(\\s*'+parameterList+'\\s*\\)\\s*\\{[^}]*\\}'
      : kind==='declaration'
      ? 'export\\s+declare\\s+function\\s+'+name+'\\s*\\(\\s*'+typedParameterList+'\\s*\\)\\s*:\\s*'+outputType+'\\s*;'
      : 'export\\s+function\\s+'+name+'\\s*\\(\\s*'+typedParameterList+'\\s*\\)\\s*:\\s*'+outputType+'\\s*\\{[^}]*\\}';
    const match=rest.match(new RegExp(expression));if(!match)throw new Error(label+': exact direct factory signature mismatch: '+name);
    rest=rest.replace(match[0],'');
  }
  if(rest.trim())throw new Error('S3D1: facade contains non-forwarding module code: '+label);
}
function sceneCanonicalTypeReexports(code,label) {
  const targets={Matrix4:'./matrix4.js',Math3DErrorCode:'./matrix4.js',MeshGeometry3D:'./meshGeometry3D.js',MeshGeometry3DErrorCode:'./meshGeometry3D.js',MeshGeometry3DErrorOrigin:'./meshGeometry3D.js'};
  for(const name of ['SceneProjectionInput3D','SceneDrawInput3D','SceneInput3D','SceneDraw3D','SceneFrame3D','Scene3DErrorCode','Scene3DErrorOrigin'])targets[name]='./sceneFrame3D.js';
  const exports=[...code.matchAll(/\bexport\s+type\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]\s*;?/g)]
    .flatMap(match=>match[1].split(',').map(name=>({name:name.trim(),target:match[2]})).filter(item=>item.name));
  for(const [name,target]of Object.entries(targets)) {
    const found=exports.filter(item=>item.name===name);
    if(found.length!==1 || found[0].target!==target)throw new Error(label+': exact canonical type re-export mismatch: '+name);
  }
}
function sceneWebCanonicalTypes(code,label) {
  const exported=[...code.matchAll(/\bexport\s+type\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]\s*;?/g)]
    .flatMap(match=>match[1].split(',').map(name=>({name:name.trim(),target:match[2]})).filter(item=>item.name));
  const options=exported.filter(item=>item.name==='TexturedWebGPUHostOptions');
  if(options.length!==1 || options[0].target!=='./webgpu.js')throw new Error(label+': exact canonical type re-export mismatch: TexturedWebGPUHostOptions');
  const required={
    '@egret/contracts':['RenderFrame2D','TexturedRenderFrame2D'],
    '../rendering/scene3d.js':['SceneFrame3D'],
    './webgpu.js':['WebGPUHost','WebGPUHostOptions','WebGPUHostStatus','TexturedWebGPUHost','TexturedWebGPUHostOptions'],
  };
  const imported=[...code.matchAll(/\bimport\s+type\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]\s*;?/g)]
    .flatMap(match=>match[1].split(',').map(name=>({name:name.trim(),target:match[2]})).filter(item=>item.name));
  for(const [target,names]of Object.entries(required))for(const name of names){
    const found=imported.filter(item=>item.name===name);
    if(found.length!==1 || found[0].target!==target)throw new Error(label+': exact public consumer type import mismatch: '+name);
  }
  const inheritance=[...code.matchAll(/\bexport\s+(?:declare\s+)?interface\s+TexturedSceneWebGPUHost\b([^\{]*)\{/g)];
  if(inheritance.length!==1 || inheritance[0][1].replace(/\s+/g,'')!=='extendsTexturedWebGPUHost,SceneWebGPUHost')
    throw new Error(label+': canonical authoring/Host type mismatch: TexturedSceneWebGPUHost');
}
const sceneCPU=await import('@egret/engine/scene3d');
const sceneWeb=await import('@egret/engine/webgpu/scene3d');
if (!sceneEqual(Object.keys(sceneCPU),sceneCPUValues)) throw new Error('scene3d: exact runtime export surface mismatch');
if (!sceneEqual(Object.keys(sceneWeb),sceneWebValues)) throw new Error('webgpu/scene3d: exact runtime export surface mismatch');
const sceneCPURules={
  './matrix4.js':{value:['createMatrix4','multiplyMatrix4','Math3DError'],type:['Matrix4','Math3DErrorCode']},
  './meshGeometry3D.js':{value:['createMeshGeometry3D','isMeshGeometry3D','MeshGeometry3DError','getMeshGeometry3DErrorOrigin'],type:['MeshGeometry3D','MeshGeometry3DErrorCode','MeshGeometry3DErrorOrigin']},
  './sceneFrame3D.js':{value:['createSceneFrame3D','isSceneFrame3D','Scene3DError','getScene3DErrorOrigin'],type:['SceneProjectionInput3D','SceneDrawInput3D','SceneInput3D','SceneDraw3D','SceneFrame3D','Scene3DErrorCode','Scene3DErrorOrigin']},
};
const sceneWebTypeRules={
  './sharedDeviceSession.js':{type:m15SessionTypes},
  './sharedFrameUpload.js':{type:m15UploadTypes},
  '@egret/contracts':{type:['RenderFrame2D','TexturedRenderFrame2D']},
  '../rendering/scene3d.js':{type:['SceneFrame3D']},
  './webgpu.js':{type:['WebGPUHost','WebGPUHostOptions','WebGPUHostStatus','TexturedWebGPUHost','TexturedWebGPUHostOptions']},
};
for (const [label,file,kind] of [['scene3d source','packages/engine/rendering/scene3d.ts','source'],['scene3d','packages/engine/dist/rendering/scene3d.d.ts','declaration'],['scene3d emitted','packages/engine/dist/rendering/scene3d.js','emitted']]) {
  const code=sceneRead(file);
  sceneSurface(code,label,sceneCPUValues,kind==='emitted'?[]:sceneCPUTypes);
  sceneClauses(code,label,sceneCPURules);
  if (kind!=='declaration') {
    sceneForward(code,'createMatrix4','./matrix4.js','input',label);
    sceneForward(code,'multiplyMatrix4','./matrix4.js',['left','right'],label);
    sceneForward(code,'createMeshGeometry3D','./meshGeometry3D.js','input',label);
    sceneForward(code,'createSceneFrame3D','./sceneFrame3D.js','input',label);
  }
  if(kind!=='emitted')sceneCanonicalTypeReexports(code,label);
  sceneOnlyProgram(code,kind,[['createMatrix4','readonly\\s+number\\[\\]','Matrix4','input'],['multiplyMatrix4',['Matrix4','Matrix4'],'Matrix4',['left','right']],['createMeshGeometry3D','MeshGeometry3DInput','MeshGeometry3D','input'],['createSceneFrame3D','SceneInput3D','SceneFrame3D','input']],kind==='emitted'?[]:[['MeshGeometry3DInput','interface','readonlypositions:readonlynumber[];readonlycolors:readonlynumber[];readonlyindices:readonlynumber[];']],label);
  if (kind==='emitted' && sceneCPUTypes.some(name=>new RegExp('\\b'+name+'\\b').test(code))) throw new Error('scene3d: type-only runtime erasure mismatch');
}
for (const [label,file,kind] of [['webgpu/scene3d source','packages/engine/web/scene3d.ts','source'],['webgpu/scene3d','packages/engine/dist/web/scene3d.d.ts','declaration'],['webgpu/scene3d emitted','packages/engine/dist/web/scene3d.js','emitted']]) {
  const code=sceneRead(file);
  sharedForward(code,'createSharedSceneWebGPUHost',false,'./sharedB1.js',file);
  if(kind!=='emitted')for(const name of ['SharedSceneWebGPUHost','SharedSceneWebGPUHostOptions'])sharedForward(code,name,true,'./WebGPUHost.js',file);
  const privateDeclarationCode=code.replace(/export\s+type\s*\{\s*SharedSceneWebGPUHost\s*,\s*SharedSceneWebGPUHostOptions\s*\}\s*from\s*['"]\.\/WebGPUHost\.js['"]\s*;?/g,'');
  if (kind==='declaration' && /\b(?:B1BuiltinProtocol|createB1WebGPUHostInternal|B1WebGPUHost|B1SceneStatus|TEXTURED_SCENE_MODE|TexturedB1WebGPUHost|createTexturedB1WebGPUHostInternal|createTexturedB1WebGPUHost|renderSceneTexturedOwnedFrame|packTexturedSubmission2D)\b|['"](?:\.\/b1|\.\/WebGPUHost|\.\.\/rendering\/sceneFrame3D)\.js['"]/.test(privateDeclarationCode))
    throw new Error('webgpu/scene3d: private declaration dependency leaked');
  sceneSurface(code,label,sceneWebValues,kind==='emitted'?[]:sceneWebTypes);
  sceneClauses(code,label,{...sceneWebTypeRules,'./sharedB1.js':{value:['createSharedSceneWebGPUHost']},'./WebGPUHost.js':{type:['SharedSceneWebGPUHost','SharedSceneWebGPUHostOptions']},...(kind==='declaration'?{}:{'./b1.js':{value:['createB1WebGPUHost','createTexturedB1WebGPUHost']}})});
  if (kind!=='declaration') {
    sceneForward(code,'createSceneWebGPUHost','./b1.js','options',label);
    sceneForward(code,'createTexturedSceneWebGPUHost','./b1.js','options',label);
  }
  if(kind!=='emitted')sceneWebCanonicalTypes(code,label);
  sceneOnlyProgram(code,kind,[['createSceneWebGPUHost','SceneWebGPUHostOptions','SceneWebGPUHost','options'],['createTexturedSceneWebGPUHost','TexturedWebGPUHostOptions','TexturedSceneWebGPUHost','options']],kind==='emitted'?[]:[
    ['SceneWebGPUHostOptions','type','WebGPUHostOptions'],
    ['SceneWebGPUHostStatus','interface','readonlyhost:WebGPUHostStatus;readonlypendingSceneBytes:number;readonlypendingUniformBytes:number;readonlypendingDepthBytes:number;'],
    ['SceneWebGPUHost','interface','renderSceneFrame(scene:SceneFrame3D,overlay:RenderFrame2D):undefined;getSceneStatus():SceneWebGPUHostStatus;'],
    ['TexturedSceneWebGPUHost','interface','renderSceneTexturedFrame(scene:SceneFrame3D,overlay:TexturedRenderFrame2D):undefined;'],
  ],label);
  if (kind==='emitted' && [...sceneWebTypes,'SceneFrame3D','RenderFrame2D','TexturedRenderFrame2D','WebGPUHostOptions','WebGPUHostStatus','TexturedWebGPUHost'].some(name=>new RegExp('\\b'+name+'\\b').test(code)))
    throw new Error('webgpu/scene3d: type-only runtime erasure mismatch');
}
// Original module values, including origin registration and identity predicates,
// cannot be replaced by a facade-local class/function with a matching shape.
for (const [target,names] of [['matrix4',['Math3DError']],['meshGeometry3D',['isMeshGeometry3D','MeshGeometry3DError','getMeshGeometry3DErrorOrigin']],['sceneFrame3D',['isSceneFrame3D','Scene3DError','getScene3DErrorOrigin']]]) {
  const original=await import(new URL('../packages/engine/dist/rendering/'+target+'.js',import.meta.url));
  for (const name of names) if (sceneCPU[name]!==original[name]) throw new Error('scene3d: original module identity mismatch: '+name);
}
const sceneNewNames=['createMatrix4','multiplyMatrix4','Math3DError','Math3DErrorCode','MeshGeometry3DInput',...sceneWebValues,...sceneLegacyWebTypes,'TexturedSceneWebGPUHost','SharedSceneWebGPUHost','SharedSceneWebGPUHostOptions'];
for (const [entry,values,emittedEntry] of [...textEntries,['project',projectFacade,'packages/project/dist/index']]) {
  const text=[sceneRead(assetGroupSourceEntries[entry]),sceneRead(emittedEntry+'.js'),sceneRead(emittedEntry+'.d.ts')].join('\n');
  for (const name of sceneNewNames) if (name in values || new RegExp('\\b'+name+'\\b').test(text)) throw new Error(entry+': explicit-only scene name leaked: '+name);
}
// The explicit facade alone forwards through this private b1 value. Its public
// declarations still cannot name it; source/import shape is checked above.
const sceneForbiddenNames=[...privateSharedGPU,...meshPrivate,...texturedPrivate,...privateTexturedGPU.filter(name=>name!=='createTexturedB1WebGPUHost'),...privateCapture,...privateCoordinates,...privateBounds,...assetGroupPublicTypes,'AssetGroupOperations',...assetGroupPrivateNames,'packMeshGeometry3D','PackedMeshGeometry3D','MeshPacking3DError','getMeshPacking3DErrorOrigin','B1BuiltinProtocol','getBuiltinB1Protocol','isBuiltinB1Protocol','createB1WebGPUHostInternal'];
for (const [label,values,stem] of [['scene3d',sceneCPU,'packages/engine/dist/rendering/scene3d'],['webgpu/scene3d',sceneWeb,'packages/engine/dist/web/scene3d']]) {
  const text=sceneRead(stem+'.d.ts')+'\n'+sceneRead(stem+'.js');
  for (const name of sceneForbiddenNames) if (name in values || new RegExp('\\b'+name+'\\b').test(text)) throw new Error(label+': retained private authority leaked: '+name);
}
for (const file of [...files(path.join(root,'packages/engine/src')),...files(path.join(root,'packages/engine/rendering')),...files(path.join(root,'packages/engine/web')),...files(path.join(root,'packages/engine/dist'))]) {
  if (!/\.(?:js|ts)$/.test(file)) continue;
  const relative=path.relative(path.join(root,'packages/engine'),file).split(path.sep).join('/'),code=sceneRead(path.relative(root,file));
  for (const match of code.matchAll(/\b(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)) {
    if (!match[1].startsWith('.')) continue;
    const target=path.relative(path.join(root,'packages/engine'),path.resolve(path.dirname(file),match[1])).split(path.sep).join('/');
    if (!['rendering/scene3d.js','dist/rendering/scene3d.js','web/scene3d.js','dist/web/scene3d.js'].includes(target)) continue;
    const typeHost=['web/scene3d.ts','dist/web/scene3d.d.ts'].includes(relative) && ['rendering/scene3d.js','dist/rendering/scene3d.js'].includes(target);
    const before=code.slice(0,match.index);
    if (!typeHost || !/\bimport\s+type\s*\{\s*SceneFrame3D\s*\}\s*$/.test(before)) throw new Error('S3D1: scene entry imported outside approved closure: '+relative);
  }
}
// M14_WEBGL2_BOUNDARY_BEGIN
// Two explicit facades share the original CPU preparation and authority. These
// finite additions leave all retained WebGPU closure/capture policies intact.
const glValues = ['createSharedWebGL2Host'];
const glTypes = ['SharedWebGL2HostOptions','SharedWebGL2Host','SharedWebGL2HostStatus','SharedWebGL2Readback','WebGL2HostState','WebGL2HostErrorCode','WebGL2HostFailure','WebGL2HostDiagnostic','WebGL2HostStatus'];
const glSceneValues = ['createSharedSceneWebGL2Host'];
const glSceneTypes = ['SharedSceneWebGL2Host','SharedSceneWebGL2HostOptions'];
const glFacade = await import('@egret/engine/webgl2');
const glSceneFacade = await import('@egret/engine/webgl2/scene3d');
const glHostModule = await import(new URL('../packages/engine/dist/web/WebGL2Host.js',import.meta.url));
if (!sceneEqual(Object.keys(glFacade),glValues) || !sceneEqual(Object.keys(glSceneFacade),glSceneValues)
    || glFacade.createSharedWebGL2Host !== glHostModule.createSharedWebGL2Host
    || glSceneFacade.createSharedSceneWebGL2Host !== glHostModule.createSharedSceneWebGL2HostInternal)
  throw new Error('M14: exact WebGL2 runtime facade mismatch');
const glFacadeRules = [
  ['webgl2', "export { createSharedWebGL2Host } from './WebGL2Host.js';", "export type { SharedWebGL2HostOptions } from './sharedWebGL2Options.js'; export type { SharedWebGL2Host, SharedWebGL2HostStatus, SharedWebGL2Readback, WebGL2HostState, WebGL2HostErrorCode, WebGL2HostFailure, WebGL2HostDiagnostic, WebGL2HostStatus } from './webgl2Types.js';"],
  ['webgl2Scene3d', "export { createSharedSceneWebGL2HostInternal as createSharedSceneWebGL2Host } from './WebGL2Host.js';", "export type { SharedSceneWebGL2Host } from './webgl2Types.js'; export type { SharedSceneWebGL2HostOptions } from './sharedWebGL2Options.js';"],
];
for (const [stem,valueClause,typeClauses] of glFacadeRules) {
  for (const [directory,suffix] of [['web','.ts'],['dist/web','.js'],['dist/web','.d.ts']]) {
    const file='packages/engine/'+directory+'/'+stem+suffix;
    const expected=(valueClause+(suffix==='.js'?'':typeClauses+m15SharedHostTypeClauses)).replace(/\s+/g,'');
    if (sceneRead(file).replace(/\s+/g,'')!==expected) throw new Error('M14: exact WebGL2 forwarding/type erasure mismatch: '+file);
  }
}
const glModuleNames = ['webgl2','webgl2Scene3d','WebGL2Host','webgl2Types','webgl2Native','sharedWebGL2Options','sharedWebGL2Arena','sharedWebGL2Shaders','sharedWebGL2Scene'];
const glPrivateNames = ['createSharedSceneWebGL2HostInternal','SharedGLHost','GLNativeKind','GLNativeOwner','GLNativeSession','glFailure','isGLFailure',
  'SharedWebGL2Configuration','admitSharedWebGL2Options','SharedWebGL2ArenaStrides','SharedWebGL2ArenaPlan','SharedWebGL2ArenaOwner','qualifySharedWebGL2Alignment','planSharedWebGL2Arenas','checkSharedWebGL2ArenaCapacity',
  'sharedWebGL2VertexSource','sharedWebGL2FragmentSource','sharedWebGL2ResolveVertexSource','sharedWebGL2ResolveFragmentSource','sharedWebGL2BlendFactors',
  'SharedGLScenePreparationReason','SharedGLScenePreparationError','SharedGLSceneAdmission','SharedGLSceneDraw','PreparedSharedGLScene','admitSharedGLScene','prepareSharedGLScene','SHARED_GL_SCENE_LAYOUT','SHARED_GL_SCENE_VERTEX','SHARED_GL_SCENE_FRAGMENT'];
const glOtherEntryFiles = [
  ...Object.entries(assetGroupSourceEntries).map(([name,source])=>[name,source]),
  ['engine/layout','packages/engine/src/layout.ts'],['engine/web/input','packages/engine/web/input.ts'],['engine/web/image','packages/engine/web/image.ts'],
  ['engine/scene3d','packages/engine/rendering/scene3d.ts'],['engine/webgpu/scene3d','packages/engine/web/scene3d.ts'],
  ['project/spine','packages/project/src/spine/index.ts'],['project/atlas','packages/project/src/atlas/index.ts'],
];
for (const [entry,source] of glOtherEntryFiles) {
  const emitted=source.replace('/src/','/dist/').replace('/web/','/dist/web/').replace('/rendering/','/dist/rendering/').replace(/\.ts$/,'');
  const text=[sceneRead(source),sceneRead(emitted+'.js'),sceneRead(emitted+'.d.ts')].join('\n');
  for (const name of [...glValues,...glTypes,...glSceneValues,...glSceneTypes,...glPrivateNames,...glModuleNames])
    if (new RegExp('\\b'+name+'\\b').test(text)) throw new Error('M14: explicit-only WebGL2 name leaked: '+entry+'/'+name);
}
for (const [entry,values,stem] of [['webgl2',glFacade,'packages/engine/dist/web/webgl2'],['webgl2/scene3d',glSceneFacade,'packages/engine/dist/web/webgl2Scene3d']]) {
  const text=sceneRead(stem+'.d.ts')+'\n'+sceneRead(stem+'.js');
  for (const name of [...sceneForbiddenNames,...privateSharedModules])
    if (name in values || new RegExp('\\b'+name+'\\b').test(text)) throw new Error('M14: retained private authority leaked: '+entry+'/'+name);
}
// Literal lists are reviewed policy, not a graph learned from product files.
// Keep duplicate clauses: source type edges and runtime edges have separate counts.
const glEdges = (statics,dynamics=[]) => [...statics.map(target=>['static',target]),...dynamics.map(target=>['dynamic',target])]
  .sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
const m14WebGL2LiteralClosure = {
  'packages/engine/web/webgl2.ts': glEdges(['./WebGL2Host.js','./sharedWebGL2Options.js','./webgl2Types.js']),
  'packages/engine/dist/web/webgl2.js': glEdges(['./WebGL2Host.js']),
  'packages/engine/dist/web/webgl2.d.ts': glEdges(['./WebGL2Host.js','./sharedWebGL2Options.js','./webgl2Types.js']),
  'packages/engine/web/webgl2Scene3d.ts': glEdges(['./WebGL2Host.js','./webgl2Types.js','./sharedWebGL2Options.js']),
  'packages/engine/dist/web/webgl2Scene3d.js': glEdges(['./WebGL2Host.js']),
  'packages/engine/dist/web/webgl2Scene3d.d.ts': glEdges(['./WebGL2Host.js','./webgl2Types.js','./sharedWebGL2Options.js']),
  'packages/engine/web/WebGL2Host.ts': glEdges([
    '@egret/contracts','@egret/contracts','#egret-textured-frame-state','./sharedWebGL2Options.js','./sharedWebGL2Options.js','./webgl2Types.js','../rendering/sceneFrame3D.js','./sharedWebGL2Scene.js','./webgl2Types.js',
    '../rendering/prepareSharedDraws2D.js','../rendering/prepareRectangles2D.js','../rendering/packSharedDraws2D.js','../rendering/preparedBatches2D.js','../rendering/preparedSharedBatches2D.js','../rendering/preparedSharedBatches2D.js','../rendering/sharedColor2D.js','../rendering/ownedPreparationFailure2D.js',
    './sharedSubmissionStorage2D.js','./sharedSubmissionStorage2D.js','./sharedWebGL2Arena.js','./sharedWebGL2Arena.js','./sharedRetentionLedger.js','./sharedRetentionLedger.js','./webgl2Native.js','./webgl2Native.js','./sharedWebGL2Shaders.js',
  ],['./sharedWebGL2Scene.js','./sharedWebGL2Scene.js']),
  'packages/engine/dist/web/WebGL2Host.js': glEdges([
    '@egret/contracts','#egret-textured-frame-state','./sharedWebGL2Options.js','../rendering/prepareSharedDraws2D.js','../rendering/prepareRectangles2D.js','../rendering/packSharedDraws2D.js','../rendering/preparedBatches2D.js','../rendering/preparedSharedBatches2D.js','../rendering/sharedColor2D.js','../rendering/ownedPreparationFailure2D.js',
    './sharedSubmissionStorage2D.js','./sharedWebGL2Arena.js','./sharedRetentionLedger.js','./webgl2Native.js','./sharedWebGL2Shaders.js',
  ],['./sharedWebGL2Scene.js']),
  'packages/engine/dist/web/WebGL2Host.d.ts': glEdges(['./sharedWebGL2Options.js','./webgl2Types.js','./webgl2Types.js']),
  'packages/engine/web/webgl2Types.ts': glEdges(['@egret/contracts','../rendering/sceneFrame3D.js']),
  'packages/engine/dist/web/webgl2Types.js': glEdges([]),
  'packages/engine/dist/web/webgl2Types.d.ts': glEdges(['@egret/contracts','../rendering/sceneFrame3D.js']),
  'packages/engine/web/webgl2Native.ts': glEdges(['@egret/runtime','./webgl2Types.js']),
  'packages/engine/dist/web/webgl2Native.js': glEdges(['@egret/runtime']),
  'packages/engine/dist/web/webgl2Native.d.ts': glEdges(['@egret/runtime','./webgl2Types.js']),
  'packages/engine/web/sharedWebGL2Options.ts': glEdges(['../rendering/prepareSharedDraws2D.js','./sharedSubmissionStorage2D.js','./webgl2Types.js']),
  'packages/engine/dist/web/sharedWebGL2Options.js': glEdges([]),
  'packages/engine/dist/web/sharedWebGL2Options.d.ts': glEdges(['../rendering/prepareSharedDraws2D.js','./sharedSubmissionStorage2D.js','./webgl2Types.js']),
  'packages/engine/web/sharedWebGL2Arena.ts': glEdges(['../rendering/packSharedDraws2D.js','../rendering/ownedPreparationFailure2D.js','./sharedSubmissionStorage2D.js']),
  'packages/engine/dist/web/sharedWebGL2Arena.js': glEdges(['../rendering/ownedPreparationFailure2D.js','./sharedSubmissionStorage2D.js']),
  'packages/engine/dist/web/sharedWebGL2Arena.d.ts': glEdges(['../rendering/packSharedDraws2D.js']),
  'packages/engine/web/sharedWebGL2Shaders.ts': glEdges(['@egret/contracts']),
  'packages/engine/dist/web/sharedWebGL2Shaders.js': glEdges([]),
  'packages/engine/dist/web/sharedWebGL2Shaders.d.ts': glEdges(['@egret/contracts']),
  'packages/engine/web/sharedWebGL2Scene.ts': glEdges(['../rendering/sceneFrame3D.js','../rendering/sceneFrame3D.js','../rendering/packSharedMeshGeometry3D.js','../rendering/packSharedMeshGeometry3D.js','../rendering/ownedPreparationFailure2D.js']),
  'packages/engine/dist/web/sharedWebGL2Scene.js': glEdges(['../rendering/sceneFrame3D.js','../rendering/packSharedMeshGeometry3D.js','../rendering/ownedPreparationFailure2D.js']),
  'packages/engine/dist/web/sharedWebGL2Scene.d.ts': glEdges(['../rendering/sceneFrame3D.js','../rendering/sceneFrame3D.js','../rendering/packSharedMeshGeometry3D.js']),
};
const glTargets = new Set(glModuleNames.flatMap(name=>['web/'+name+'.js','dist/web/'+name+'.js']));
for (const directory of ['src','rendering','web','dist']) for (const file of files(path.join(root,'packages/engine',directory))) {
  if (!/\.(?:ts|js)$/.test(file)) continue;
  const relative=path.relative(root,file).split(path.sep).join('/'),code=sceneRead(relative);
  for (const [,imported] of sceneGraphEdges(code)) {
    if (!imported.startsWith('.')) continue;
    const target=path.relative(path.join(root,'packages/engine'),path.resolve(path.dirname(file),imported)).split(path.sep).join('/');
    if (glTargets.has(target) && !Object.hasOwn(m14WebGL2LiteralClosure,relative))
      throw new Error('M14: WebGL2 module imported outside exact optional closure: '+relative);
  }
}
// One erased typeof import plus one guarded runtime import in source; only the
// guarded runtime import remains after emission. No caller-provided scene plugin.
for (const file of ['packages/engine/web/WebGL2Host.ts','packages/engine/dist/web/WebGL2Host.js']) {
  const compact=sceneRead(file).replace(/\s+/g,'');
  const guarded="if(this.sceneMode){this.sceneFunctions=awaitimport('./sharedWebGL2Scene.js');this.generationGate(token);}";
  if (compact.split(guarded).length!==2) throw new Error('M14: scene module must remain in the fixed private mode guard: '+file);
}
const glNativeMethods = [
  'getContextAttributes','getError','isContextLost','getParameter','getShaderPrecisionFormat',
  'getFramebufferAttachmentParameter','checkFramebufferStatus','bindFramebuffer','bindBuffer',
  'bufferData','bufferSubData','getBufferSubData','readPixels','shaderSource','attachShader',
  'getShaderParameter','getProgramParameter','getShaderInfoLog','getProgramInfoLog',
  'getUniformBlockIndex','getActiveUniformBlockParameter','getUniformIndices','getActiveUniforms',
  'getUniformLocation','useProgram','clientWaitSync','activeTexture','bindTexture','bindRenderbuffer',
  'bindVertexArray','bindSampler','bindBufferRange','enable','disable','colorMask','depthMask','depthFunc',
  'clearDepth','clearColor','clear','viewport','scissor','depthRange','blendEquationSeparate','blendFuncSeparate',
  'pixelStorei','texParameteri','texStorage2D','texSubImage2D','renderbufferStorage','framebufferTexture2D',
  'framebufferRenderbuffer','drawBuffers','readBuffer','compileShader','linkProgram','detachShader',
  'uniformBlockBinding','uniform1i','uniform1f','uniform2f','enableVertexAttribArray',
  'disableVertexAttribArray','vertexAttribPointer','vertexAttribDivisor','drawArrays','drawElements','flush',
];
const glNativeKinds = ['Buffer','Texture','Renderbuffer','Framebuffer','Shader','Program','VertexArray','Sync'];
for (const file of ['packages/engine/web/webgl2Native.ts','packages/engine/dist/web/webgl2Native.js']) {
  const code=sceneRead(file),typed=file.endsWith('.ts');
  for (const [name,expected] of [['METHODS',glNativeMethods],['KINDS',glNativeKinds]]) {
    const rows=[...code.matchAll(new RegExp('\\bconst\\s+'+name+'(?:\\s*:\\s*readonly\\s+GLNativeKind\\[\\])?\\s*=\\s*\\[([^\\]]*)\\](?:\\s+as\\s+const)?\\s*;','g'))];
    const literal=rows[0]?.[1],actual=literal===undefined?[]:[...literal.matchAll(/'([^']+)'/g)].map(match=>match[1]);
    if (rows.length!==1 || literal.replace(/'[^']*'|\s|,/g,'') || JSON.stringify(actual)!==JSON.stringify(expected)
        || (code.match(new RegExp('\\b'+name+'\\b','g'))??[]).length!==2)
      throw new Error('M14: finite native method/kind list mismatch: '+file+'/'+name);
  }
  // The existing post-call gate follows one fixed scalar observation of the
  // original texSubImage2D return. No new native lookup or invocation is allowed.
  const pageWriteObservation = "if(name==='texSubImage2D'&&this.diagnostics){const state=this.diagnostics,bytes="+
    (typed?"(args[4] as number)*(args[5] as number)*4;":"args[4]*args[5]*4;")+
    "if(state.totals.pageWriteCalls===Number.MAX_SAFE_INTEGER||bytes>Number.MAX_SAFE_INTEGER-state.totals.pageWriteBytes)state.saturated=true;"+
    "state.totals.pageWriteCalls=Math.min(Number.MAX_SAFE_INTEGER,state.totals.pageWriteCalls+1);"+
    "state.totals.pageWriteBytes=Math.min(Number.MAX_SAFE_INTEGER,state.totals.pageWriteBytes+bytes);}";
  const capture = "for(const name of [...METHODS,...KINDS.flatMap(kind=>[kind==='Sync'?'fenceSync':'create'+kind,'delete'+kind])]){"+
    (typed?"const candidate=(context as unknown as Record<string,unknown>)[name];":"const candidate=context[name];")+
    "gate();if(typeof candidate!=='function')throw new TypeError(name);"+
    (typed?"const call=candidate.bind(context) as (...args:unknown[])=>unknown;":"const call=candidate.bind(context);")+
    "this.calls.set(name,call);Object.defineProperty(captured,name,{value:"+
    (typed?"(...args:unknown[]):unknown=>":"(...args)=>")+
    "{gate();const value=call(...args);"+pageWriteObservation+"gate();return value;}});}";
  if (code.replace(/\s+/g,'').split(capture.replace(/\s+/g,'')).length!==2
      || /\bReflect\b|\bObject\s*\.\s*(?:keys|values|entries|getOwnPropertyNames|getOwnPropertyDescriptors|getPrototypeOf)\s*\(|\bfor\s*\([^)]*\bin\b|\b(?:eval|Function)\s*\(/.test(code))
    throw new Error('M14: finite native capture block mismatch: '+file);
}
// M14_WEBGL2_BOUNDARY_END


const sceneLiteralClosure = {
  "packages/engine/rendering/sceneFrame3D.ts": [
    [
      "static",
      "./matrix4.js"
    ],
    [
      "static",
      "./matrix4.js"
    ],
    [
      "static",
      "./meshGeometry3D.js"
    ],
    [
      "static",
      "./meshGeometry3D.js"
    ],
    [
      "static",
      "./projection3D.js"
    ]
  ],
  "packages/engine/rendering/meshGeometry3D.ts": [],
  "packages/engine/web/b1.ts": [
    [
      "static",
      "../rendering/packMeshGeometry3D.js"
    ],
    [
      "static",
      "../rendering/sceneFrame3D.js"
    ],
    [
      "static",
      "../rendering/sceneFrame3D.js"
    ],
    [
      "static",
      "./WebGPUHost.js"
    ],
    [
      "static",
      "./WebGPUHost.js"
    ],
    [
      "static",
      "./webgpuMeshPass.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/rendering/matrix4.ts": [],
  "packages/engine/rendering/projection3D.ts": [
    [
      "static",
      "./matrix4.js"
    ],
    [
      "static",
      "./matrix4.js"
    ]
  ],
  "packages/engine/rendering/packMeshGeometry3D.ts": [
    [
      "static",
      "./meshGeometry3D.js"
    ]
  ],
  "packages/engine/web/WebGPUHost.ts": [
    [
      "dynamic",
      "./b1.js"
    ],
    [
      "static",
      "../rendering/admitTexturedFrame2D.js"
    ],
    [
      "static",
      "../rendering/copyFrame2D.js"
    ],
    [
      "static",
      "../rendering/copyMixedFrame2D.js"
    ],
    [
      "static",
      "../rendering/ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "../rendering/packImageVertices2D.js"
    ],
    [
      "static",
      "../rendering/packTexturedMesh2D.js"
    ],
    [
      "static",
      "../rendering/preparedBatches2D.js"
    ],
    [
      "static",
      "../rendering/preparedBatches2D.js"
    ],
    [
      "static",
      "../rendering/preparedFrameCache2D.js"
    ],
    [
      "static",
      "../rendering/prepareMixedDraws2D.js"
    ],
    [
      "static",
      "../rendering/prepareRectangles2D.js"
    ],
    [
      "static",
      "../rendering/prepareTexturedDraws2D.js"
    ],
    [
      "static",
      "../rendering/texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "./b1.js"
    ],
    [
      "static",
      "./imageProjections2D.js"
    ],
    [
      "static",
      "./imageProjections2D.js"
    ],
    [
      "static",
      "./imageProjections2D.js"
    ],
    [
      "static",
      "./prepareTexturedSubmission2D.js"
    ],
    [
      "static",
      "./prepareTexturedSubmission2D.js"
    ],
    [
      "static",
      "./texturedWebGPUOptions.js"
    ],
    [
      "static",
      "./texturedWebGPUOptions.js"
    ],
    [
      "static",
      "./texturedWebGPUOptions.js"
    ],
    [
      "static",
      "./webgpuBindingCache.js"
    ],
    [
      "static",
      "./webgpuBindingCache.js"
    ],
    [
      "static",
      "./webgpuBufferPool.js"
    ],
    [
      "static",
      "./webgpuBufferPool.js"
    ],
    [
      "static",
      "./webgpuImagePass.js"
    ],
    [
      "static",
      "./webgpuLifetime.js"
    ],
    [
      "static",
      "./webgpuLifetime.js"
    ],
    [
      "static",
      "./webgpuPass.js"
    ],
    [
      "static",
      "./webgpuTexturedPass.js"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/runtime"
    ],
    [
      "static",
      "#egret-textured-frame-state"
    ]
  ],
  "packages/engine/web/webgpuMeshPass.ts": [],
  "packages/engine/rendering/admitTexturedFrame2D.ts": [
    [
      "static",
      "./ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "./prepareTexturedDraws2D.js"
    ],
    [
      "static",
      "./texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/rendering/copyFrame2D.ts": [
    [
      "static",
      "./RectangleFrame2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/rendering/copyMixedFrame2D.ts": [
    [
      "static",
      "./copyFrame2D.js"
    ],
    [
      "static",
      "./copyFrame2D.js"
    ],
    [
      "static",
      "./imageFrameBudget.js"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/rendering/ownedPreparationFailure2D.ts": [],
  "packages/engine/rendering/packImageVertices2D.ts": [
    [
      "static",
      "./ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "./packedOrientation.js"
    ],
    [
      "static",
      "./packedPosition2D.js"
    ],
    [
      "static",
      "./preparedFrameCache2D.js"
    ],
    [
      "static",
      "./preparedFrameCache2D.js"
    ],
    [
      "static",
      "./prepareImages2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ]
  ],
  "packages/engine/rendering/packTexturedMesh2D.ts": [
    [
      "static",
      "./ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "./packedOrientation.js"
    ],
    [
      "static",
      "./packedPosition2D.js"
    ],
    [
      "static",
      "./preparedFrameCache2D.js"
    ],
    [
      "static",
      "./preparedFrameCache2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "./prepareTexturedMesh2D.js"
    ],
    [
      "static",
      "./texturedPreparationBudget2D.js"
    ]
  ],
  "packages/engine/rendering/prepareMixedDraws2D.ts": [
    [
      "static",
      "./preparedFrameCache2D.js"
    ],
    [
      "static",
      "./prepareImages2D.js"
    ],
    [
      "static",
      "./prepareImages2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/rendering/prepareRectangles2D.ts": [
    [
      "static",
      "./ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "./preparedFrameCache2D.js"
    ],
    [
      "static",
      "./preparedFrameCache2D.js"
    ],
    [
      "static",
      "./RectangleFrame2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "robust-predicates"
    ]
  ],
  "packages/engine/rendering/prepareTexturedDraws2D.ts": [
    [
      "static",
      "./preparedFrameCache2D.js"
    ],
    [
      "static",
      "./prepareImages2D.js"
    ],
    [
      "static",
      "./prepareImages2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "./prepareTexturedMesh2D.js"
    ],
    [
      "static",
      "./prepareTexturedMesh2D.js"
    ],
    [
      "static",
      "./texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/rendering/texturedPreparationBudget2D.ts": [
    [
      "static",
      "./ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "./preparedFrameCache2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ]
  ],
  "packages/engine/web/imageProjections2D.ts": [
    [
      "static",
      "../rendering/ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/web/prepareTexturedSubmission2D.ts": [
    [
      "static",
      "../rendering/ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "../rendering/packImageVertices2D.js"
    ],
    [
      "static",
      "../rendering/packImageVertices2D.js"
    ],
    [
      "static",
      "../rendering/packTexturedMesh2D.js"
    ],
    [
      "static",
      "../rendering/packTexturedMesh2D.js"
    ],
    [
      "static",
      "../rendering/preparedBatches2D.js"
    ],
    [
      "static",
      "../rendering/prepareTexturedDraws2D.js"
    ],
    [
      "static",
      "../rendering/texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "./imageProjections2D.js"
    ],
    [
      "static",
      "./imageProjections2D.js"
    ],
    [
      "static",
      "./webgpuPass.js"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/web/texturedWebGPUOptions.ts": [
    [
      "static",
      "./WebGPUHost.js"
    ]
  ],
  "packages/engine/web/webgpuImagePass.ts": [],
  "packages/engine/web/webgpuLifetime.ts": [],
  "packages/engine/web/webgpuPass.ts": [
    [
      "static",
      "../rendering/ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "../rendering/packedOrientation.js"
    ],
    [
      "static",
      "../rendering/packedPosition2D.js"
    ],
    [
      "static",
      "../rendering/preparedFrameCache2D.js"
    ],
    [
      "static",
      "../rendering/preparedFrameCache2D.js"
    ],
    [
      "static",
      "../rendering/prepareRectangles2D.js"
    ]
  ],
  "packages/engine/web/webgpuTexturedPass.ts": [],
  "packages/engine/rendering/RectangleFrame2D.ts": [
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/rendering/imageFrameBudget.ts": [
    [
      "static",
      "./copyFrame2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/rendering/packedOrientation.ts": [
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "robust-predicates"
    ]
  ],
  "packages/engine/rendering/packedPosition2D.ts": [
    [
      "static",
      "./prepareRectangles2D.js"
    ]
  ],
  "packages/engine/rendering/prepareImages2D.ts": [
    [
      "static",
      "./ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "./preparedFrameCache2D.js"
    ],
    [
      "static",
      "./preparedFrameCache2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/rendering/prepareTexturedMesh2D.ts": [
    [
      "static",
      "./ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "./preparedFrameCache2D.js"
    ],
    [
      "static",
      "./preparedFrameCache2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "./texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "./texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "./texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/sceneFrame3D.js": [
    [
      "static",
      "./matrix4.js"
    ],
    [
      "static",
      "./meshGeometry3D.js"
    ],
    [
      "static",
      "./projection3D.js"
    ]
  ],
  "packages/engine/dist/rendering/sceneFrame3D.d.ts": [
    [
      "static",
      "./matrix4.js"
    ],
    [
      "static",
      "./meshGeometry3D.js"
    ]
  ],
  "packages/engine/dist/rendering/meshGeometry3D.js": [],
  "packages/engine/dist/rendering/meshGeometry3D.d.ts": [],
  "packages/engine/dist/web/b1.js": [
    [
      "static",
      "../rendering/packMeshGeometry3D.js"
    ],
    [
      "static",
      "../rendering/sceneFrame3D.js"
    ],
    [
      "static",
      "./WebGPUHost.js"
    ],
    [
      "static",
      "./webgpuMeshPass.js"
    ]
  ],
  "packages/engine/dist/web/b1.d.ts": [
    [
      "static",
      "../rendering/packMeshGeometry3D.js"
    ],
    [
      "static",
      "../rendering/sceneFrame3D.js"
    ],
    [
      "static",
      "../rendering/sceneFrame3D.js"
    ],
    [
      "static",
      "./WebGPUHost.js"
    ],
    [
      "static",
      "./webgpuMeshPass.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/matrix4.js": [],
  "packages/engine/dist/rendering/matrix4.d.ts": [],
  "packages/engine/dist/rendering/projection3D.js": [
    [
      "static",
      "./matrix4.js"
    ]
  ],
  "packages/engine/dist/rendering/projection3D.d.ts": [
    [
      "static",
      "./matrix4.js"
    ]
  ],
  "packages/engine/dist/rendering/packMeshGeometry3D.js": [
    [
      "static",
      "./meshGeometry3D.js"
    ]
  ],
  "packages/engine/dist/rendering/packMeshGeometry3D.d.ts": [
    [
      "static",
      "./meshGeometry3D.js"
    ]
  ],
  "packages/engine/dist/web/WebGPUHost.js": [
    [
      "dynamic",
      "./b1.js"
    ],
    [
      "static",
      "../rendering/admitTexturedFrame2D.js"
    ],
    [
      "static",
      "../rendering/copyFrame2D.js"
    ],
    [
      "static",
      "../rendering/copyMixedFrame2D.js"
    ],
    [
      "static",
      "../rendering/ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "../rendering/packImageVertices2D.js"
    ],
    [
      "static",
      "../rendering/packTexturedMesh2D.js"
    ],
    [
      "static",
      "../rendering/preparedBatches2D.js"
    ],
    [
      "static",
      "../rendering/preparedFrameCache2D.js"
    ],
    [
      "static",
      "../rendering/prepareMixedDraws2D.js"
    ],
    [
      "static",
      "../rendering/prepareRectangles2D.js"
    ],
    [
      "static",
      "../rendering/prepareTexturedDraws2D.js"
    ],
    [
      "static",
      "../rendering/texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "./imageProjections2D.js"
    ],
    [
      "static",
      "./imageProjections2D.js"
    ],
    [
      "static",
      "./prepareTexturedSubmission2D.js"
    ],
    [
      "static",
      "./texturedWebGPUOptions.js"
    ],
    [
      "static",
      "./webgpuBindingCache.js"
    ],
    [
      "static",
      "./webgpuBufferPool.js"
    ],
    [
      "static",
      "./webgpuImagePass.js"
    ],
    [
      "static",
      "./webgpuLifetime.js"
    ],
    [
      "static",
      "./webgpuPass.js"
    ],
    [
      "static",
      "./webgpuTexturedPass.js"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/runtime"
    ],
    [
      "static",
      "#egret-textured-frame-state"
    ]
  ],
  "packages/engine/dist/web/WebGPUHost.d.ts": [
    [
      "static",
      "./b1.js"
    ],
    [
      "static",
      "./texturedWebGPUOptions.js"
    ],
    [
      "static",
      "./texturedWebGPUOptions.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/web/webgpuMeshPass.js": [],
  "packages/engine/dist/web/webgpuMeshPass.d.ts": [],
  "packages/engine/dist/rendering/admitTexturedFrame2D.js": [
    [
      "static",
      "./ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/admitTexturedFrame2D.d.ts": [
    [
      "static",
      "./prepareTexturedDraws2D.js"
    ],
    [
      "static",
      "./texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/copyFrame2D.js": [],
  "packages/engine/dist/rendering/copyFrame2D.d.ts": [
    [
      "static",
      "./RectangleFrame2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/copyMixedFrame2D.js": [
    [
      "static",
      "./copyFrame2D.js"
    ],
    [
      "static",
      "./imageFrameBudget.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/copyMixedFrame2D.d.ts": [
    [
      "static",
      "./copyFrame2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/ownedPreparationFailure2D.js": [],
  "packages/engine/dist/rendering/ownedPreparationFailure2D.d.ts": [],
  "packages/engine/dist/rendering/packImageVertices2D.js": [
    [
      "static",
      "./ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "./packedOrientation.js"
    ],
    [
      "static",
      "./packedPosition2D.js"
    ],
    [
      "static",
      "./preparedFrameCache2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ]
  ],
  "packages/engine/dist/rendering/packImageVertices2D.d.ts": [
    [
      "static",
      "./preparedFrameCache2D.js"
    ],
    [
      "static",
      "./prepareImages2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ]
  ],
  "packages/engine/dist/rendering/packTexturedMesh2D.js": [
    [
      "static",
      "./ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "./packedOrientation.js"
    ],
    [
      "static",
      "./packedPosition2D.js"
    ],
    [
      "static",
      "./preparedFrameCache2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ]
  ],
  "packages/engine/dist/rendering/packTexturedMesh2D.d.ts": [
    [
      "static",
      "./preparedFrameCache2D.js"
    ],
    [
      "static",
      "./prepareTexturedMesh2D.js"
    ],
    [
      "static",
      "./texturedPreparationBudget2D.js"
    ]
  ],
  "packages/engine/dist/rendering/prepareMixedDraws2D.js": [
    [
      "static",
      "./prepareImages2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ]
  ],
  "packages/engine/dist/rendering/prepareMixedDraws2D.d.ts": [
    [
      "static",
      "./preparedFrameCache2D.js"
    ],
    [
      "static",
      "./prepareImages2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/prepareRectangles2D.js": [
    [
      "static",
      "./ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "./preparedFrameCache2D.js"
    ],
    [
      "static",
      "robust-predicates"
    ]
  ],
  "packages/engine/dist/rendering/prepareRectangles2D.d.ts": [
    [
      "static",
      "./preparedFrameCache2D.js"
    ],
    [
      "static",
      "./RectangleFrame2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/prepareTexturedDraws2D.js": [
    [
      "static",
      "./prepareImages2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "./prepareTexturedMesh2D.js"
    ]
  ],
  "packages/engine/dist/rendering/prepareTexturedDraws2D.d.ts": [
    [
      "static",
      "./preparedFrameCache2D.js"
    ],
    [
      "static",
      "./prepareImages2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "./prepareTexturedMesh2D.js"
    ],
    [
      "static",
      "./texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/texturedPreparationBudget2D.js": [
    [
      "static",
      "./ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ]
  ],
  "packages/engine/dist/rendering/texturedPreparationBudget2D.d.ts": [
    [
      "static",
      "./preparedFrameCache2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ]
  ],
  "packages/engine/dist/web/imageProjections2D.js": [
    [
      "static",
      "../rendering/ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/web/imageProjections2D.d.ts": [
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/web/prepareTexturedSubmission2D.js": [
    [
      "static",
      "../rendering/ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "../rendering/packImageVertices2D.js"
    ],
    [
      "static",
      "../rendering/packTexturedMesh2D.js"
    ],
    [
      "static",
      "./imageProjections2D.js"
    ],
    [
      "static",
      "./webgpuPass.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/web/prepareTexturedSubmission2D.d.ts": [
    [
      "static",
      "../rendering/packImageVertices2D.js"
    ],
    [
      "static",
      "../rendering/packTexturedMesh2D.js"
    ],
    [
      "static",
      "../rendering/preparedBatches2D.js"
    ],
    [
      "static",
      "../rendering/prepareTexturedDraws2D.js"
    ],
    [
      "static",
      "../rendering/texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "./imageProjections2D.js"
    ],
    [
      "static",
      "./webgpuPass.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/web/texturedWebGPUOptions.js": [],
  "packages/engine/dist/web/texturedWebGPUOptions.d.ts": [
    [
      "static",
      "./WebGPUHost.js"
    ]
  ],
  "packages/engine/dist/web/webgpuImagePass.js": [],
  "packages/engine/dist/web/webgpuImagePass.d.ts": [],
  "packages/engine/dist/web/webgpuLifetime.js": [],
  "packages/engine/dist/web/webgpuLifetime.d.ts": [],
  "packages/engine/dist/web/webgpuPass.js": [
    [
      "static",
      "../rendering/ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "../rendering/packedOrientation.js"
    ],
    [
      "static",
      "../rendering/packedPosition2D.js"
    ],
    [
      "static",
      "../rendering/preparedFrameCache2D.js"
    ]
  ],
  "packages/engine/dist/web/webgpuPass.d.ts": [
    [
      "static",
      "../rendering/preparedFrameCache2D.js"
    ],
    [
      "static",
      "../rendering/prepareRectangles2D.js"
    ]
  ],
  "packages/engine/dist/web/webgpuTexturedPass.js": [],
  "packages/engine/dist/web/webgpuTexturedPass.d.ts": [],
  "packages/engine/dist/rendering/RectangleFrame2D.js": [],
  "packages/engine/dist/rendering/RectangleFrame2D.d.ts": [
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/imageFrameBudget.js": [
    [
      "static",
      "./copyFrame2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/imageFrameBudget.d.ts": [
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/packedOrientation.js": [
    [
      "static",
      "robust-predicates"
    ]
  ],
  "packages/engine/dist/rendering/packedOrientation.d.ts": [
    [
      "static",
      "./prepareRectangles2D.js"
    ]
  ],
  "packages/engine/dist/rendering/packedPosition2D.js": [],
  "packages/engine/dist/rendering/packedPosition2D.d.ts": [
    [
      "static",
      "./prepareRectangles2D.js"
    ]
  ],
  "packages/engine/dist/rendering/prepareImages2D.js": [
    [
      "static",
      "./ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "./preparedFrameCache2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ]
  ],
  "packages/engine/dist/rendering/prepareImages2D.d.ts": [
    [
      "static",
      "./preparedFrameCache2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/prepareTexturedMesh2D.js": [
    [
      "static",
      "./ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "./preparedFrameCache2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "./texturedPreparationBudget2D.js"
    ]
  ],
  "packages/engine/dist/rendering/prepareTexturedMesh2D.d.ts": [
    [
      "static",
      "./preparedFrameCache2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "./texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "./texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/web/webgpuBufferPool.ts": [
    [
      "static",
      "./webgpuLifetime.js"
    ]
  ],
  "packages/engine/dist/web/webgpuBufferPool.js": [],
  "packages/engine/dist/web/webgpuBufferPool.d.ts": [
    [
      "static",
      "./webgpuLifetime.js"
    ]
  ],
  "packages/engine/web/webgpuBindingCache.ts": [
    [
      "static",
      "./webgpuBufferPool.js"
    ]
  ],
  "packages/engine/dist/web/webgpuBindingCache.js": [],
  "packages/engine/dist/web/webgpuBindingCache.d.ts": [
    [
      "static",
      "./webgpuBufferPool.js"
    ]
  ],
  "packages/engine/rendering/preparedBatches2D.ts": [
    [
      "static",
      "./packImageVertices2D.js"
    ],
    [
      "static",
      "./packTexturedMesh2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/preparedBatches2D.js": [],
  "packages/engine/dist/rendering/preparedBatches2D.d.ts": [
    [
      "static",
      "./packImageVertices2D.js"
    ],
    [
      "static",
      "./packTexturedMesh2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/rendering/preparedFrameCache2D.ts": [
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/preparedFrameCache2D.js": [],
  "packages/engine/dist/rendering/preparedFrameCache2D.d.ts": [
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ]
};

// M1.3 replaces only these exact edge rows; the complete historical table remains above.
const m13SharedRenderingLiteralClosure = {
  "packages/contracts/dist/SharedGeometry2D.d.ts": [],
  "packages/contracts/dist/SharedGeometry2D.js": [],
  "packages/contracts/dist/SharedMaterial2D.d.ts": [],
  "packages/contracts/dist/SharedMaterial2D.js": [],
  "packages/contracts/dist/SharedRenderFrame2D.d.ts": [
    [
      "static",
      "./HostAdapter.js"
    ],
    [
      "static",
      "./ImageData2D.js"
    ],
    [
      "static",
      "./RenderFrame2D.js"
    ],
    [
      "static",
      "./SharedGeometry2D.js"
    ],
    [
      "static",
      "./SharedMaterial2D.js"
    ],
    [
      "static",
      "./TexturedGeometry2D.js"
    ],
    [
      "static",
      "./TextureViewRegion2D.js"
    ]
  ],
  "packages/contracts/dist/SharedRenderFrame2D.js": [],
  "packages/contracts/dist/TextureViewRegion2D.d.ts": [
    [
      "static",
      "./ImageData2D.js"
    ]
  ],
  "packages/contracts/dist/TextureViewRegion2D.js": [],
  "packages/contracts/src/SharedGeometry2D.ts": [],
  "packages/contracts/src/SharedMaterial2D.ts": [],
  "packages/contracts/src/SharedRenderFrame2D.ts": [
    [
      "static",
      "./HostAdapter.js"
    ],
    [
      "static",
      "./ImageData2D.js"
    ],
    [
      "static",
      "./RenderFrame2D.js"
    ],
    [
      "static",
      "./SharedGeometry2D.js"
    ],
    [
      "static",
      "./SharedMaterial2D.js"
    ],
    [
      "static",
      "./TexturedGeometry2D.js"
    ],
    [
      "static",
      "./TextureViewRegion2D.js"
    ]
  ],
  "packages/contracts/src/TextureViewRegion2D.ts": [
    [
      "static",
      "./ImageData2D.js"
    ]
  ],
  "packages/engine/dist/rendering/packSharedDraws2D.d.ts": [
    [
      "static",
      "./prepareSharedDraws2D.js"
    ]
  ],
  "packages/engine/dist/rendering/packSharedDraws2D.js": [
    [
      "static",
      "./packedOrientation.js"
    ],
    [
      "static",
      "./prepareSharedDraws2D.js"
    ]
  ],
  "packages/engine/dist/rendering/packSharedMeshGeometry3D.d.ts": [
    [
      "static",
      "./meshGeometry3D.js"
    ]
  ],
  "packages/engine/dist/rendering/packSharedMeshGeometry3D.js": [
    [
      "static",
      "./meshGeometry3D.js"
    ],
    [
      "static",
      "./sharedColor2D.js"
    ]
  ],
  "packages/engine/dist/rendering/prepareSharedDraws2D.d.ts": [
    [
      "static",
      "./texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "./texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/prepareSharedDraws2D.js": [
    [
      "static",
      "./ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "./sharedColor2D.js"
    ],
    [
      "static",
      "./texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/preparedSharedBatches2D.d.ts": [
    [
      "static",
      "./packSharedDraws2D.js"
    ],
    [
      "static",
      "./preparedBatches2D.js"
    ]
  ],
  "packages/engine/dist/rendering/preparedSharedBatches2D.js": [],
  "packages/engine/dist/rendering/sharedColor2D.d.ts": [
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/rendering/sharedColor2D.js": [
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/web/WebGPUHost.d.ts": [
    [
      "static",
      "./b1.js"
    ],
    [
      "static",
      "./sharedWebGPUOptions.js"
    ],
    [
      "static",
      "./sharedWebGPUOptions.js"
    ],
    [
      "static",
      "./texturedWebGPUOptions.js"
    ],
    [
      "static",
      "./texturedWebGPUOptions.js"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/web/WebGPUHost.js": [
    [
      "dynamic",
      "./b1.js"
    ],
    [
      "dynamic",
      "./sharedB1.js"
    ],
    [
      "static",
      "../rendering/admitTexturedFrame2D.js"
    ],
    [
      "static",
      "../rendering/copyFrame2D.js"
    ],
    [
      "static",
      "../rendering/copyMixedFrame2D.js"
    ],
    [
      "static",
      "../rendering/ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "../rendering/packImageVertices2D.js"
    ],
    [
      "static",
      "../rendering/packTexturedMesh2D.js"
    ],
    [
      "static",
      "../rendering/preparedBatches2D.js"
    ],
    [
      "static",
      "../rendering/preparedFrameCache2D.js"
    ],
    [
      "static",
      "../rendering/preparedSharedBatches2D.js"
    ],
    [
      "static",
      "../rendering/prepareMixedDraws2D.js"
    ],
    [
      "static",
      "../rendering/prepareRectangles2D.js"
    ],
    [
      "static",
      "../rendering/prepareSharedDraws2D.js"
    ],
    [
      "static",
      "../rendering/prepareTexturedDraws2D.js"
    ],
    [
      "static",
      "../rendering/sharedColor2D.js"
    ],
    [
      "static",
      "../rendering/texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "./imageProjections2D.js"
    ],
    [
      "static",
      "./imageProjections2D.js"
    ],
    [
      "static",
      "./prepareSharedSubmission2D.js"
    ],
    [
      "static",
      "./prepareTexturedSubmission2D.js"
    ],
    [
      "static",
      "./sharedWebGPUOptions.js"
    ],
    [
      "static",
      "./texturedWebGPUOptions.js"
    ],
    [
      "static",
      "./webgpuBindingCache.js"
    ],
    [
      "static",
      "./webgpuImagePass.js"
    ],
    [
      "static",
      "./webgpuLifetime.js"
    ],
    [
      "static",
      "./webgpuPass.js"
    ],
    [
      "static",
      "./webgpuRetentionPool.js"
    ],
    [
      "static",
      "./webgpuSharedPass.js"
    ],
    [
      "static",
      "./webgpuSharedResolvePass.js"
    ],
    [
      "static",
      "./webgpuTexturedPass.js"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/runtime"
    ],
    [
      "static",
      "#egret-textured-frame-state"
    ]
  ],
  "packages/engine/dist/web/prepareSharedSubmission2D.d.ts": [
    [
      "static",
      "../rendering/packSharedDraws2D.js"
    ],
    [
      "static",
      "../rendering/prepareSharedDraws2D.js"
    ],
    [
      "static",
      "./sharedSubmissionStorage2D.js"
    ],
    [
      "static",
      "./sharedSubmissionStorage2D.js"
    ],
    [
      "static",
      "./sharedSubmissionStorage2D.js"
    ],
    [
      "static",
      "./sharedWebGPUOptions.js"
    ]
  ],
  "packages/engine/dist/web/prepareSharedSubmission2D.js": [
    [
      "static",
      "../rendering/ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "../rendering/packSharedDraws2D.js"
    ],
    [
      "static",
      "./sharedSubmissionStorage2D.js"
    ],
    [
      "static",
      "./sharedSubmissionStorage2D.js"
    ]
  ],
  "packages/engine/dist/web/sharedB1.d.ts": [
    [
      "static",
      "../rendering/packSharedMeshGeometry3D.js"
    ],
    [
      "static",
      "../rendering/sceneFrame3D.js"
    ],
    [
      "static",
      "./WebGPUHost.js"
    ],
    [
      "static",
      "./webgpuSharedMeshPass.js"
    ]
  ],
  "packages/engine/dist/web/sharedB1.js": [
    [
      "static",
      "../rendering/packSharedMeshGeometry3D.js"
    ],
    [
      "static",
      "../rendering/sceneFrame3D.js"
    ],
    [
      "static",
      "./WebGPUHost.js"
    ],
    [
      "static",
      "./webgpuSharedMeshPass.js"
    ]
  ],
  "packages/engine/dist/web/sharedWebGPUOptions.d.ts": [
    [
      "static",
      "./texturedWebGPUOptions.js"
    ],
    [
      "static",
      "./WebGPUHost.js"
    ]
  ],
  "packages/engine/dist/web/sharedWebGPUOptions.js": [],
  "packages/engine/dist/web/webgpuBufferPool.d.ts": [
    [
      "static",
      "./webgpuLifetime.js"
    ],
    [
      "static",
      "./webgpuRetentionPool.js"
    ]
  ],
  "packages/engine/dist/web/webgpuBufferPool.js": [
    [
      "static",
      "./webgpuRetentionPool.js"
    ]
  ],
  "packages/engine/dist/web/webgpuRetentionPool.d.ts": [
    [
      "static",
      "./webgpuLifetime.js"
    ]
  ],
  "packages/engine/dist/web/webgpuRetentionPool.js": [["static", "./sharedRetentionLedger.js"]],
  "packages/engine/web/sharedSubmissionStorage2D.ts": [
    [
      "static",
      "../rendering/ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "../rendering/prepareSharedDraws2D.js"
    ],
    [
      "static",
      "../rendering/sharedColor2D.js"
    ],
    [
      "static",
      "./imageProjections2D.js"
    ]
  ],
  "packages/engine/dist/web/sharedSubmissionStorage2D.js": [
    [
      "static",
      "../rendering/ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "../rendering/sharedColor2D.js"
    ]
  ],
  "packages/engine/dist/web/sharedSubmissionStorage2D.d.ts": [
    [
      "static",
      "../rendering/prepareSharedDraws2D.js"
    ],
    [
      "static",
      "./imageProjections2D.js"
    ]
  ],
  "packages/engine/web/sharedRetentionLedger.ts": [],
  "packages/engine/dist/web/sharedRetentionLedger.js": [],
  "packages/engine/dist/web/sharedRetentionLedger.d.ts": [],
  "packages/engine/dist/web/webgpuSharedMeshPass.d.ts": [],
  "packages/engine/dist/web/webgpuSharedMeshPass.js": [],
  "packages/engine/dist/web/webgpuSharedPass.d.ts": [
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/dist/web/webgpuSharedPass.js": [],
  "packages/engine/dist/web/webgpuSharedResolvePass.d.ts": [],
  "packages/engine/dist/web/webgpuSharedResolvePass.js": [],
  "packages/engine/rendering/packSharedDraws2D.ts": [
    [
      "static",
      "./packedOrientation.js"
    ],
    [
      "static",
      "./prepareSharedDraws2D.js"
    ],
    [
      "static",
      "./prepareSharedDraws2D.js"
    ]
  ],
  "packages/engine/rendering/packSharedMeshGeometry3D.ts": [
    [
      "static",
      "./meshGeometry3D.js"
    ],
    [
      "static",
      "./sharedColor2D.js"
    ]
  ],
  "packages/engine/rendering/prepareSharedDraws2D.ts": [
    [
      "static",
      "./ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "./prepareRectangles2D.js"
    ],
    [
      "static",
      "./sharedColor2D.js"
    ],
    [
      "static",
      "./texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "./texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/rendering/preparedSharedBatches2D.ts": [
    [
      "static",
      "./packSharedDraws2D.js"
    ],
    [
      "static",
      "./preparedBatches2D.js"
    ]
  ],
  "packages/engine/rendering/sharedColor2D.ts": [
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/web/WebGPUHost.ts": [
    [
      "dynamic",
      "./b1.js"
    ],
    [
      "dynamic",
      "./b1.js"
    ],
    [
      "dynamic",
      "./b1.js"
    ],
    [
      "dynamic",
      "./sharedB1.js"
    ],
    [
      "dynamic",
      "./sharedB1.js"
    ],
    [
      "dynamic",
      "./sharedB1.js"
    ],
    [
      "static",
      "../rendering/admitTexturedFrame2D.js"
    ],
    [
      "static",
      "../rendering/copyFrame2D.js"
    ],
    [
      "static",
      "../rendering/copyMixedFrame2D.js"
    ],
    [
      "static",
      "../rendering/ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "../rendering/packImageVertices2D.js"
    ],
    [
      "static",
      "../rendering/packSharedDraws2D.js"
    ],
    [
      "static",
      "../rendering/packTexturedMesh2D.js"
    ],
    [
      "static",
      "../rendering/preparedBatches2D.js"
    ],
    [
      "static",
      "../rendering/preparedBatches2D.js"
    ],
    [
      "static",
      "../rendering/preparedFrameCache2D.js"
    ],
    [
      "static",
      "../rendering/preparedSharedBatches2D.js"
    ],
    [
      "static",
      "../rendering/preparedSharedBatches2D.js"
    ],
    [
      "static",
      "../rendering/prepareMixedDraws2D.js"
    ],
    [
      "static",
      "../rendering/prepareRectangles2D.js"
    ],
    [
      "static",
      "../rendering/prepareSharedDraws2D.js"
    ],
    [
      "static",
      "../rendering/prepareTexturedDraws2D.js"
    ],
    [
      "static",
      "../rendering/sharedColor2D.js"
    ],
    [
      "static",
      "../rendering/texturedPreparationBudget2D.js"
    ],
    [
      "static",
      "./b1.js"
    ],
    [
      "static",
      "./imageProjections2D.js"
    ],
    [
      "static",
      "./imageProjections2D.js"
    ],
    [
      "static",
      "./imageProjections2D.js"
    ],
    [
      "static",
      "./prepareSharedSubmission2D.js"
    ],
    [
      "static",
      "./prepareSharedSubmission2D.js"
    ],
    [
      "static",
      "./prepareTexturedSubmission2D.js"
    ],
    [
      "static",
      "./prepareTexturedSubmission2D.js"
    ],
    [
      "static",
      "./sharedWebGPUOptions.js"
    ],
    [
      "static",
      "./sharedWebGPUOptions.js"
    ],
    [
      "static",
      "./sharedWebGPUOptions.js"
    ],
    [
      "static",
      "./texturedWebGPUOptions.js"
    ],
    [
      "static",
      "./texturedWebGPUOptions.js"
    ],
    [
      "static",
      "./texturedWebGPUOptions.js"
    ],
    [
      "static",
      "./webgpuBindingCache.js"
    ],
    [
      "static",
      "./webgpuBindingCache.js"
    ],
    [
      "static",
      "./webgpuBufferPool.js"
    ],
    [
      "static",
      "./webgpuImagePass.js"
    ],
    [
      "static",
      "./webgpuLifetime.js"
    ],
    [
      "static",
      "./webgpuLifetime.js"
    ],
    [
      "static",
      "./webgpuPass.js"
    ],
    [
      "static",
      "./webgpuRetentionPool.js"
    ],
    [
      "static",
      "./webgpuRetentionPool.js"
    ],
    [
      "static",
      "./webgpuSharedPass.js"
    ],
    [
      "static",
      "./webgpuSharedResolvePass.js"
    ],
    [
      "static",
      "./webgpuTexturedPass.js"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/runtime"
    ],
    [
      "static",
      "#egret-textured-frame-state"
    ]
  ],
  "packages/engine/web/prepareSharedSubmission2D.ts": [
    [
      "static",
      "../rendering/ownedPreparationFailure2D.js"
    ],
    [
      "static",
      "../rendering/packSharedDraws2D.js"
    ],
    [
      "static",
      "../rendering/prepareSharedDraws2D.js"
    ],
    [
      "static",
      "./imageProjections2D.js"
    ],
    [
      "static",
      "./sharedSubmissionStorage2D.js"
    ],
    [
      "static",
      "./sharedSubmissionStorage2D.js"
    ],
    [
      "static",
      "./sharedSubmissionStorage2D.js"
    ],
    [
      "static",
      "./sharedSubmissionStorage2D.js"
    ],
    [
      "static",
      "./sharedWebGPUOptions.js"
    ]
  ],
  "packages/engine/web/sharedB1.ts": [
    [
      "static",
      "../rendering/packSharedMeshGeometry3D.js"
    ],
    [
      "static",
      "../rendering/sceneFrame3D.js"
    ],
    [
      "static",
      "./WebGPUHost.js"
    ],
    [
      "static",
      "./WebGPUHost.js"
    ],
    [
      "static",
      "./webgpuSharedMeshPass.js"
    ]
  ],
  "packages/engine/web/sharedWebGPUOptions.ts": [
    [
      "static",
      "./texturedWebGPUOptions.js"
    ],
    [
      "static",
      "./WebGPUHost.js"
    ]
  ],
  "packages/engine/web/webgpuBufferPool.ts": [
    [
      "static",
      "./webgpuLifetime.js"
    ],
    [
      "static",
      "./webgpuRetentionPool.js"
    ],
    [
      "static",
      "./webgpuRetentionPool.js"
    ]
  ],
  "packages/engine/web/webgpuRetentionPool.ts": [
    ["static", "./sharedRetentionLedger.js"],
    ["static", "./webgpuLifetime.js"]
  ],
  "packages/engine/web/webgpuSharedMeshPass.ts": [],
  "packages/engine/web/webgpuSharedPass.ts": [
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/web/webgpuSharedResolvePass.ts": [],
  "packages/runtime/dist/sharedFrameCapture.d.ts": [
    [
      "static",
      "./Stage.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/runtime/dist/sharedFrameCapture.js": [
    [
      "static",
      "./Bitmap.js"
    ],
    [
      "static",
      "./displayTransform.js"
    ],
    [
      "static",
      "./displayTreeState.js"
    ],
    [
      "static",
      "./displayVisualState.js"
    ],
    [
      "static",
      "./EgretError.js"
    ],
    [
      "static",
      "./meshCaptureSnapshot.js"
    ],
    [
      "static",
      "./meshDisplayState.js"
    ],
    [
      "static",
      "./ownership.js"
    ],
    [
      "static",
      "./textDisplayState.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/runtime/src/sharedFrameCapture.ts": [
    [
      "static",
      "./Bitmap.js"
    ],
    [
      "static",
      "./bitmapDisplayState.js"
    ],
    [
      "static",
      "./DisplayObject.js"
    ],
    [
      "static",
      "./DisplayObjectContainer.js"
    ],
    [
      "static",
      "./displayTransform.js"
    ],
    [
      "static",
      "./displayTreeState.js"
    ],
    [
      "static",
      "./displayVisualState.js"
    ],
    [
      "static",
      "./displayVisualState.js"
    ],
    [
      "static",
      "./EgretError.js"
    ],
    [
      "static",
      "./meshCaptureSnapshot.js"
    ],
    [
      "static",
      "./meshDisplayState.js"
    ],
    [
      "static",
      "./meshDisplayState.js"
    ],
    [
      "static",
      "./ownership.js"
    ],
    [
      "static",
      "./ownership.js"
    ],
    [
      "static",
      "./Stage.js"
    ],
    [
      "static",
      "./textDisplayState.js"
    ],
    [
      "static",
      "./textDisplayState.js"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ]
};

// M15 semantic successor: named source/emission/declaration import multisets only.
// Historical S3D1/M13/M14 tables above remain byte-identical; no raw whole-graph pin is renewed.
const m15ResourceRecoveryLiteralClosure = {
  "packages/engine/src/contentTypes.ts": [["static","./manifestResourceTypes.js"],["static","@egret/runtime"]],
  "packages/engine/dist/contentTypes.js": [],
  "packages/engine/dist/contentTypes.d.ts": [["static","./manifestResourceTypes.js"],["static","@egret/runtime"]],
  "packages/engine/src/contentAtlasPages.ts": [["static","./contentArtifacts.js"],["static","@egret/runtime"]],
  "packages/engine/dist/contentAtlasPages.js": [["static","./contentArtifacts.js"]],
  "packages/engine/dist/contentAtlasPages.d.ts": [["static","@egret/runtime"]],
  "packages/engine/src/contentArtifacts.ts": [["static","@egret/runtime"],["static","@egret/runtime"]],
  "packages/engine/dist/contentArtifacts.js": [["static","@egret/runtime"]],
  "packages/engine/dist/contentArtifacts.d.ts": [["static","@egret/runtime"],["static","@egret/runtime"]],
  "packages/engine/src/contentLoader.ts": [["static","./contentArtifacts.js"],["static","./contentArtifacts.js"],["static","./contentAtlasPages.js"],["static","./contentTypes.js"],["static","./Engine.js"],["static","./internal/contentFactoryState.js"],["static","./manifestResourceState.js"],["static","./manifestResourceTypes.js"],["static","@egret/contracts/resources"],["static","@egret/contracts/resources"],["static","@egret/runtime"],["static","@egret/runtime"]],
  "packages/engine/dist/contentLoader.js": [["static","./contentArtifacts.js"],["static","./contentAtlasPages.js"],["static","./internal/contentFactoryState.js"],["static","./manifestResourceState.js"],["static","@egret/contracts/resources"],["static","@egret/runtime"]],
  "packages/engine/dist/contentLoader.d.ts": [["static","./contentTypes.js"],["static","./Engine.js"],["static","@egret/contracts/resources"]],
  "packages/engine/src/internal/contentFactoryState.ts": [["static","../manifestResourceTypes.js"],["static","@egret/contracts/resources"],["static","@egret/runtime"],["static","@egret/runtime"]],
  "packages/engine/dist/internal/contentFactoryState.js": [["static","@egret/runtime"]],
  "packages/engine/dist/internal/contentFactoryState.d.ts": [["static","../manifestResourceTypes.js"],["static","@egret/contracts/resources"],["static","@egret/runtime"]],
  "packages/contracts/src/ResourceManifest.ts": [["static","./ProjectFormat.generated.js"]],
  "packages/contracts/dist/ResourceManifest.js": [],
  "packages/contracts/dist/ResourceManifest.d.ts": [["static","./ProjectFormat.generated.js"]],
  "packages/contracts/src/resources/index.ts": [["static","../ResourceManifest.js"],["static","./manifestAdmission.js"]],
  "packages/contracts/dist/resources/index.js": [["static","./manifestAdmission.js"]],
  "packages/contracts/dist/resources/index.d.ts": [["static","../ResourceManifest.js"],["static","./manifestAdmission.js"]],
  "packages/contracts/src/resources/manifestAdmission.ts": [["static","../ProjectFormat.generated.js"],["static","../ResourceManifest.js"],["static","./sha256.js"]],
  "packages/contracts/dist/resources/manifestAdmission.js": [["static","./sha256.js"]],
  "packages/contracts/dist/resources/manifestAdmission.d.ts": [["static","../ResourceManifest.js"]],
  "packages/contracts/src/resources/sha256.ts": [],
  "packages/contracts/dist/resources/sha256.js": [],
  "packages/contracts/dist/resources/sha256.d.ts": [],
  "packages/project/src/resources/index.ts": [["static","./content.js"],["static","./content.js"],["static","./manifest.js"],["static","@egret/contracts/resources"],["static","@egret/contracts/resources"]],
  "packages/project/dist/resources/index.js": [["static","./content.js"],["static","./manifest.js"]],
  "packages/project/dist/resources/index.d.ts": [["static","./content.js"],["static","./content.js"],["static","./manifest.js"],["static","@egret/contracts/resources"],["static","@egret/contracts/resources"]],
  "packages/project/src/resources/content.ts": [["static","../api.js"],["static","../diagnostics.js"],["static","../limits.js"],["static","../live-input.js"],["static","../paths.js"],["static","../public.js"],["static","@egret/contracts"],["static","@egret/contracts/resources"],["static","@egret/contracts/resources"]],
  "packages/project/dist/resources/content.js": [["static","../api.js"],["static","../diagnostics.js"],["static","../limits.js"],["static","../live-input.js"],["static","../paths.js"],["static","@egret/contracts/resources"]],
  "packages/project/dist/resources/content.d.ts": [["static","../public.js"],["static","@egret/contracts"],["static","@egret/contracts/resources"]],
  "packages/project/src/resources/manifest.ts": [["static","../api.js"],["static","../diagnostics.js"],["static","../limits.js"],["static","../public.js"],["static","../text-input.js"],["static","@egret/contracts"],["static","@egret/contracts/resources"],["static","@egret/contracts/resources"]],
  "packages/project/dist/resources/manifest.js": [["static","../api.js"],["static","../diagnostics.js"],["static","../limits.js"],["static","../text-input.js"],["static","@egret/contracts/resources"]],
  "packages/project/dist/resources/manifest.d.ts": [["static","../public.js"],["static","@egret/contracts"],["static","@egret/contracts/resources"]],
  "packages/engine/src/resources.ts": [["static","./contentLoader.js"],["static","./contentTypes.js"],["static","./manifestResourceState.js"],["static","./manifestResourceTypes.js"]],
  "packages/engine/dist/resources.js": [["static","./contentLoader.js"],["static","./manifestResourceState.js"]],
  "packages/engine/dist/resources.d.ts": [["static","./contentLoader.js"],["static","./contentTypes.js"],["static","./manifestResourceState.js"],["static","./manifestResourceTypes.js"]],
  "packages/engine/src/manifestResourceTypes.ts": [["static","@egret/runtime"]],
  "packages/engine/dist/manifestResourceTypes.js": [],
  "packages/engine/dist/manifestResourceTypes.d.ts": [["static","@egret/runtime"]],
  "packages/engine/src/manifestResourceState.ts": [["static","./manifestResourceTypes.js"],["static","./manifestResourceTypes.js"],["static","@egret/contracts/resources"],["static","@egret/contracts/resources"],["static","@egret/runtime"],["static","@egret/runtime"]],
  "packages/engine/dist/manifestResourceState.js": [["static","@egret/contracts/resources"],["static","@egret/runtime"]],
  "packages/engine/dist/manifestResourceState.d.ts": [["static","./manifestResourceTypes.js"],["static","./manifestResourceTypes.js"],["static","@egret/contracts/resources"],["static","@egret/runtime"]],
  "packages/engine/src/manifestAssetGroup.ts": [["static","./assetGroup.js"],["static","./manifestResourceState.js"],["static","./manifestResourceState.js"],["static","./manifestResourceTypes.js"],["static","@egret/contracts/resources"],["static","@egret/contracts/resources"],["static","@egret/runtime"],["static","@egret/runtime"]],
  "packages/engine/dist/manifestAssetGroup.js": [["static","./manifestResourceState.js"],["static","@egret/contracts/resources"],["static","@egret/runtime"]],
  "packages/engine/dist/manifestAssetGroup.d.ts": [["static","./assetGroup.js"],["static","./manifestResourceTypes.js"],["static","@egret/runtime"]],
  "packages/engine/src/Engine.ts": [["static","./assetGroup.js"],["static","./assetGroup.js"],["static","./assetGroupTypes.js"],["static","./bitmapBindingTicket.js"],["static","./bitmapBindingTicket.js"],["static","./bitmapResourceSlot.js"],["static","./bitmapResourceSlot.js"],["static","./closeHost.js"],["static","./gameClock.js"],["static","./gameClock.js"],["static","./gameClockTypes.js"],["static","./internal/textFieldFactoryState.js"],["static","./internal/texturedFrameState.js"],["static","./manifestAssetGroup.js"],["static","./manifestAssetGroup.js"],["static","./manifestResourceTypes.js"],["static","./mouseInput.js"],["static","./mouseInput.js"],["static","./sequencePlayback.js"],["static","./sequencePlayback.js"],["static","./sequencePlaybackTypes.js"],["static","./tween.js"],["static","./tween.js"],["static","./tweenTypes.js"],["static","@egret/contracts"],["static","@egret/contracts"],["static","@egret/contracts"],["static","@egret/contracts/resources"],["static","@egret/runtime"],["static","@egret/runtime"],["static","@egret/runtime"],["static","@egret/runtime"],["static","@egret/runtime"]],
  "packages/engine/dist/Engine.js": [["static","./assetGroup.js"],["static","./bitmapBindingTicket.js"],["static","./bitmapResourceSlot.js"],["static","./closeHost.js"],["static","./gameClock.js"],["static","./internal/textFieldFactoryState.js"],["static","./internal/texturedFrameState.js"],["static","./manifestAssetGroup.js"],["static","./mouseInput.js"],["static","./sequencePlayback.js"],["static","./tween.js"],["static","@egret/contracts"],["static","@egret/runtime"],["static","@egret/runtime"]],
  "packages/engine/dist/Engine.d.ts": [["static","./assetGroupTypes.js"],["static","./bitmapBindingTicket.js"],["static","./bitmapResourceSlot.js"],["static","./gameClock.js"],["static","./gameClockTypes.js"],["static","./manifestResourceTypes.js"],["static","./sequencePlaybackTypes.js"],["static","./tweenTypes.js"],["static","@egret/contracts"],["static","@egret/contracts"],["static","@egret/contracts/resources"],["static","@egret/runtime"],["static","@egret/runtime"]],
  "packages/engine/src/bitmapBindingTicket.ts": [["static","@egret/runtime"],["static","@egret/runtime"]],
  "packages/engine/dist/bitmapBindingTicket.js": [["static","@egret/runtime"]],
  "packages/engine/dist/bitmapBindingTicket.d.ts": [["static","@egret/runtime"],["static","@egret/runtime"]],
  "packages/engine/web/resources.ts": [["static","./BrowserTextureProvider.js"],["static","./BrowserTextureProvider.js"],["static","./BrowserTextureProvider.js"],["static","./BrowserTextureProvider.js"],["static","./ManifestByteSource.js"],["static","./ManifestByteSource.js"],["static","./ManifestByteSource.js"],["static","./ManifestByteSource.js"],["static","./ManifestByteSource.js"],["static","./ManifestByteSource.js"],["static","@egret/contracts/resources"],["static","@egret/engine"],["static","@egret/engine/resources"],["static","@egret/engine/resources"],["static","@egret/runtime"],["static","@egret/runtime"]],
  "packages/engine/dist/web/resources.js": [["static","./BrowserTextureProvider.js"],["static","./ManifestByteSource.js"],["static","./ManifestByteSource.js"],["static","./ManifestByteSource.js"],["static","@egret/engine/resources"],["static","@egret/runtime"]],
  "packages/engine/dist/web/resources.d.ts": [["static","./BrowserTextureProvider.js"],["static","./BrowserTextureProvider.js"],["static","./BrowserTextureProvider.js"],["static","./ManifestByteSource.js"],["static","./ManifestByteSource.js"],["static","./ManifestByteSource.js"],["static","./ManifestByteSource.js"],["static","@egret/contracts/resources"],["static","@egret/engine"],["static","@egret/engine/resources"]],
  "packages/engine/web/ManifestByteSource.ts": [["static","@egret/contracts"],["static","@egret/contracts/resources"],["static","@egret/contracts/resources"],["static","@egret/runtime"],["static","@egret/runtime"],["static","#egret-manifest-resources"],["static","#egret-manifest-resources"]],
  "packages/engine/dist/web/ManifestByteSource.js": [["static","@egret/contracts/resources"],["static","@egret/runtime"],["static","#egret-manifest-resources"]],
  "packages/engine/dist/web/ManifestByteSource.d.ts": [["static","@egret/contracts"],["static","@egret/contracts/resources"],["static","@egret/runtime"],["static","@egret/runtime"],["static","#egret-manifest-resources"]],
  "packages/engine/web/BrowserTextureProvider.ts": [["static","./ManifestByteSource.js"],["static","@egret/contracts"],["static","@egret/contracts"],["static","@egret/runtime"],["static","@egret/runtime"]],
  "packages/engine/dist/web/BrowserTextureProvider.js": [["static","@egret/contracts"],["static","@egret/runtime"]],
  "packages/engine/dist/web/BrowserTextureProvider.d.ts": [["static","./ManifestByteSource.js"],["static","@egret/runtime"],["static","@egret/runtime"]],
  "packages/engine/web/sharedDeviceSession.ts": [],
  "packages/engine/dist/web/sharedDeviceSession.js": [],
  "packages/engine/dist/web/sharedDeviceSession.d.ts": [],
  "packages/engine/web/sharedFrameUpload.ts": [["static","@egret/contracts"]],
  "packages/engine/dist/web/sharedFrameUpload.js": [],
  "packages/engine/dist/web/sharedFrameUpload.d.ts": [["static","@egret/contracts"]],
  "packages/engine/web/WebGPUHost.ts": [["dynamic","./b1.js"],["dynamic","./b1.js"],["dynamic","./b1.js"],["dynamic","./sharedB1.js"],["dynamic","./sharedB1.js"],["dynamic","./sharedB1.js"],["static","../rendering/admitTexturedFrame2D.js"],["static","../rendering/copyFrame2D.js"],["static","../rendering/copyMixedFrame2D.js"],["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packImageVertices2D.js"],["static","../rendering/packSharedDraws2D.js"],["static","../rendering/packTexturedMesh2D.js"],["static","../rendering/preparedBatches2D.js"],["static","../rendering/preparedBatches2D.js"],["static","../rendering/preparedFrameCache2D.js"],["static","../rendering/preparedSharedBatches2D.js"],["static","../rendering/preparedSharedBatches2D.js"],["static","../rendering/prepareMixedDraws2D.js"],["static","../rendering/prepareRectangles2D.js"],["static","../rendering/prepareSharedDraws2D.js"],["static","../rendering/prepareTexturedDraws2D.js"],["static","../rendering/sharedColor2D.js"],["static","../rendering/sharedColor2D.js"],["static","../rendering/texturedPreparationBudget2D.js"],["static","./b1.js"],["static","./imageProjections2D.js"],["static","./imageProjections2D.js"],["static","./imageProjections2D.js"],["static","./prepareSharedSubmission2D.js"],["static","./prepareSharedSubmission2D.js"],["static","./prepareTexturedSubmission2D.js"],["static","./prepareTexturedSubmission2D.js"],["static","./sharedDeviceSession.js"],["static","./sharedFrameUpload.js"],["static","./sharedRetentionLedger.js"],["static","./sharedWebGPUOptions.js"],["static","./sharedWebGPUOptions.js"],["static","./sharedWebGPUOptions.js"],["static","./texturedWebGPUOptions.js"],["static","./texturedWebGPUOptions.js"],["static","./texturedWebGPUOptions.js"],["static","./webgpuBindingCache.js"],["static","./webgpuBindingCache.js"],["static","./webgpuBufferPool.js"],["static","./webgpuImagePass.js"],["static","./webgpuLifetime.js"],["static","./webgpuLifetime.js"],["static","./webgpuPass.js"],["static","./webgpuRetentionPool.js"],["static","./webgpuRetentionPool.js"],["static","./webgpuSharedPass.js"],["static","./webgpuSharedResolvePass.js"],["static","./webgpuTexturedPass.js"],["static","@egret/contracts"],["static","@egret/contracts"],["static","@egret/contracts"],["static","@egret/contracts"],["static","@egret/contracts"],["static","@egret/runtime"],["static","#egret-textured-frame-state"]],
  "packages/engine/dist/web/WebGPUHost.js": [["dynamic","./b1.js"],["dynamic","./sharedB1.js"],["static","../rendering/admitTexturedFrame2D.js"],["static","../rendering/copyFrame2D.js"],["static","../rendering/copyMixedFrame2D.js"],["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packImageVertices2D.js"],["static","../rendering/packTexturedMesh2D.js"],["static","../rendering/preparedBatches2D.js"],["static","../rendering/preparedFrameCache2D.js"],["static","../rendering/preparedSharedBatches2D.js"],["static","../rendering/prepareMixedDraws2D.js"],["static","../rendering/prepareRectangles2D.js"],["static","../rendering/prepareSharedDraws2D.js"],["static","../rendering/prepareTexturedDraws2D.js"],["static","../rendering/sharedColor2D.js"],["static","../rendering/texturedPreparationBudget2D.js"],["static","./imageProjections2D.js"],["static","./imageProjections2D.js"],["static","./prepareSharedSubmission2D.js"],["static","./prepareTexturedSubmission2D.js"],["static","./sharedWebGPUOptions.js"],["static","./texturedWebGPUOptions.js"],["static","./webgpuBindingCache.js"],["static","./webgpuImagePass.js"],["static","./webgpuLifetime.js"],["static","./webgpuPass.js"],["static","./webgpuRetentionPool.js"],["static","./webgpuSharedPass.js"],["static","./webgpuSharedResolvePass.js"],["static","./webgpuTexturedPass.js"],["static","@egret/contracts"],["static","@egret/contracts"],["static","@egret/runtime"],["static","#egret-textured-frame-state"]],
  "packages/engine/dist/web/WebGPUHost.d.ts": [["static","./b1.js"],["static","./sharedDeviceSession.js"],["static","./sharedFrameUpload.js"],["static","./sharedWebGPUOptions.js"],["static","./sharedWebGPUOptions.js"],["static","./texturedWebGPUOptions.js"],["static","./texturedWebGPUOptions.js"],["static","@egret/contracts"],["static","@egret/contracts"]],
  "packages/engine/web/webgpu.ts": [["static","./sharedDeviceSession.js"],["static","./sharedFrameUpload.js"],["static","./WebGPUHost.js"],["static","./WebGPUHost.js"],["static","./WebGPUHost.js"],["static","./WebGPUHost.js"],["static","./WebGPUHost.js"]],
  "packages/engine/dist/web/webgpu.js": [["static","./WebGPUHost.js"],["static","./WebGPUHost.js"]],
  "packages/engine/dist/web/webgpu.d.ts": [["static","./sharedDeviceSession.js"],["static","./sharedFrameUpload.js"],["static","./WebGPUHost.js"],["static","./WebGPUHost.js"],["static","./WebGPUHost.js"],["static","./WebGPUHost.js"],["static","./WebGPUHost.js"]],
  "packages/engine/web/scene3d.ts": [["static","../rendering/scene3d.js"],["static","./b1.js"],["static","./sharedB1.js"],["static","./sharedDeviceSession.js"],["static","./sharedFrameUpload.js"],["static","./webgpu.js"],["static","./webgpu.js"],["static","./WebGPUHost.js"],["static","@egret/contracts"]],
  "packages/engine/dist/web/scene3d.js": [["static","./b1.js"],["static","./sharedB1.js"]],
  "packages/engine/dist/web/scene3d.d.ts": [["static","../rendering/scene3d.js"],["static","./sharedB1.js"],["static","./sharedDeviceSession.js"],["static","./sharedFrameUpload.js"],["static","./webgpu.js"],["static","./webgpu.js"],["static","./WebGPUHost.js"],["static","@egret/contracts"]],
  "packages/engine/web/sharedWebGPUOptions.ts": [["static","./texturedWebGPUOptions.js"],["static","./WebGPUHost.js"]],
  "packages/engine/dist/web/sharedWebGPUOptions.js": [],
  "packages/engine/dist/web/sharedWebGPUOptions.d.ts": [["static","./texturedWebGPUOptions.js"],["static","./WebGPUHost.js"]],
  "packages/engine/web/webgpuLifetime.ts": [],
  "packages/engine/dist/web/webgpuLifetime.js": [],
  "packages/engine/dist/web/webgpuLifetime.d.ts": [],
  "packages/engine/web/webgpuRetentionPool.ts": [["static","./sharedRetentionLedger.js"],["static","./sharedRetentionLedger.js"],["static","./webgpuLifetime.js"]],
  "packages/engine/dist/web/webgpuRetentionPool.js": [["static","./sharedRetentionLedger.js"]],
  "packages/engine/dist/web/webgpuRetentionPool.d.ts": [["static","./sharedRetentionLedger.js"],["static","./webgpuLifetime.js"]],
  "packages/engine/web/WebGL2Host.ts": [["dynamic","./sharedWebGL2Scene.js"],["dynamic","./sharedWebGL2Scene.js"],["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packSharedDraws2D.js"],["static","../rendering/preparedBatches2D.js"],["static","../rendering/preparedSharedBatches2D.js"],["static","../rendering/preparedSharedBatches2D.js"],["static","../rendering/prepareRectangles2D.js"],["static","../rendering/prepareSharedDraws2D.js"],["static","../rendering/sceneFrame3D.js"],["static","../rendering/sharedColor2D.js"],["static","../rendering/sharedColor2D.js"],["static","./sharedDeviceSession.js"],["static","./sharedFrameUpload.js"],["static","./sharedRetentionLedger.js"],["static","./sharedRetentionLedger.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedWebGL2Arena.js"],["static","./sharedWebGL2Arena.js"],["static","./sharedWebGL2Options.js"],["static","./sharedWebGL2Options.js"],["static","./sharedWebGL2Scene.js"],["static","./sharedWebGL2Shaders.js"],["static","./webgl2Native.js"],["static","./webgl2Native.js"],["static","./webgl2Types.js"],["static","./webgl2Types.js"],["static","@egret/contracts"],["static","@egret/contracts"],["static","#egret-textured-frame-state"]],
  "packages/engine/dist/web/WebGL2Host.js": [["dynamic","./sharedWebGL2Scene.js"],["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packSharedDraws2D.js"],["static","../rendering/preparedBatches2D.js"],["static","../rendering/preparedSharedBatches2D.js"],["static","../rendering/prepareRectangles2D.js"],["static","../rendering/prepareSharedDraws2D.js"],["static","../rendering/sharedColor2D.js"],["static","./sharedRetentionLedger.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedWebGL2Arena.js"],["static","./sharedWebGL2Options.js"],["static","./sharedWebGL2Shaders.js"],["static","./webgl2Native.js"],["static","@egret/contracts"],["static","#egret-textured-frame-state"]],
  "packages/engine/dist/web/WebGL2Host.d.ts": [["static","./sharedWebGL2Options.js"],["static","./webgl2Types.js"],["static","./webgl2Types.js"]],
  "packages/engine/web/webgl2Types.ts": [["static","../rendering/sceneFrame3D.js"],["static","./sharedDeviceSession.js"],["static","./sharedFrameUpload.js"],["static","@egret/contracts"]],
  "packages/engine/dist/web/webgl2Types.js": [],
  "packages/engine/dist/web/webgl2Types.d.ts": [["static","../rendering/sceneFrame3D.js"],["static","./sharedDeviceSession.js"],["static","./sharedFrameUpload.js"],["static","@egret/contracts"]],
  "packages/engine/web/webgl2.ts": [["static","./sharedDeviceSession.js"],["static","./sharedFrameUpload.js"],["static","./sharedWebGL2Options.js"],["static","./WebGL2Host.js"],["static","./webgl2Types.js"]],
  "packages/engine/dist/web/webgl2.js": [["static","./WebGL2Host.js"]],
  "packages/engine/dist/web/webgl2.d.ts": [["static","./sharedDeviceSession.js"],["static","./sharedFrameUpload.js"],["static","./sharedWebGL2Options.js"],["static","./WebGL2Host.js"],["static","./webgl2Types.js"]],
  "packages/engine/web/webgl2Scene3d.ts": [["static","./sharedDeviceSession.js"],["static","./sharedFrameUpload.js"],["static","./sharedWebGL2Options.js"],["static","./WebGL2Host.js"],["static","./webgl2Types.js"]],
  "packages/engine/dist/web/webgl2Scene3d.js": [["static","./WebGL2Host.js"]],
  "packages/engine/dist/web/webgl2Scene3d.d.ts": [["static","./sharedDeviceSession.js"],["static","./sharedFrameUpload.js"],["static","./sharedWebGL2Options.js"],["static","./WebGL2Host.js"],["static","./webgl2Types.js"]],
  "packages/runtime/src/Bitmap.ts": [["static","./AssetLease.js"],["static","./AssetLease.js"],["static","./atlasFrameLayout.js"],["static","./bitmapDisplayState.js"],["static","./bitmapDisplayState.js"],["static","./bitmapDisplayState.js"],["static","./DisplayObject.js"],["static","./displayTreeState.js"],["static","./EgretError.js"],["static","./ownership.js"],["static","./ownership.js"],["static","./sequenceClip.js"],["static","./sharedFrameCapture.js"],["static","./sharedFrameCapture.js"],["static","./Stage.js"],["static","./Texture.js"],["static","./Texture.js"],["static","@egret/contracts"]],
  "packages/runtime/dist/Bitmap.js": [["static","./AssetLease.js"],["static","./AssetLease.js"],["static","./atlasFrameLayout.js"],["static","./bitmapDisplayState.js"],["static","./DisplayObject.js"],["static","./displayTreeState.js"],["static","./EgretError.js"],["static","./ownership.js"],["static","./sharedFrameCapture.js"],["static","./Texture.js"]],
  "packages/runtime/dist/Bitmap.d.ts": [["static","./AssetLease.js"],["static","./bitmapDisplayState.js"],["static","./bitmapDisplayState.js"],["static","./DisplayObject.js"],["static","./sequenceClip.js"],["static","./Texture.js"],["static","@egret/contracts"]],
  "packages/runtime/src/sharedFrameCapture.ts": [["static","./Bitmap.js"],["static","./bitmapDisplayState.js"],["static","./DisplayObject.js"],["static","./DisplayObjectContainer.js"],["static","./displayTransform.js"],["static","./displayTreeState.js"],["static","./displayVisualState.js"],["static","./displayVisualState.js"],["static","./EgretError.js"],["static","./meshCaptureSnapshot.js"],["static","./meshDisplayState.js"],["static","./meshDisplayState.js"],["static","./ownership.js"],["static","./ownership.js"],["static","./Stage.js"],["static","./textDisplayState.js"],["static","./textDisplayState.js"],["static","@egret/contracts"],["static","@egret/contracts"]],
  "packages/runtime/dist/sharedFrameCapture.js": [["static","./Bitmap.js"],["static","./displayTransform.js"],["static","./displayTreeState.js"],["static","./displayVisualState.js"],["static","./EgretError.js"],["static","./meshCaptureSnapshot.js"],["static","./meshDisplayState.js"],["static","./ownership.js"],["static","./textDisplayState.js"],["static","@egret/contracts"]],
  "packages/runtime/dist/sharedFrameCapture.d.ts": [["static","./bitmapDisplayState.js"],["static","./Stage.js"],["static","@egret/contracts"]],
  "packages/runtime/src/bitmapDisplayState.ts": [["static","./AssetLease.js"],["static","./atlasFrameLayout.js"],["static","./DisplayObject.js"],["static","./displayVisualState.js"],["static","./Texture.js"],["static","@egret/contracts"]],
  "packages/runtime/dist/bitmapDisplayState.js": [["static","./displayVisualState.js"]],
  "packages/runtime/dist/bitmapDisplayState.d.ts": [["static","./AssetLease.js"],["static","./atlasFrameLayout.js"],["static","./DisplayObject.js"],["static","./Texture.js"],["static","@egret/contracts"]],
  "packages/runtime/src/ownership.ts": [["static","./AssetLease.js"],["static","./assetManagerOwnerState.js"],["static","./Bitmap.js"],["static","./DisplayObject.js"],["static","./DisplayObjectContainer.js"],["static","./displayTreeState.js"],["static","./displayTreeState.js"],["static","./displayVisualState.js"],["static","./EgretError.js"],["static","./Scope.js"],["static","./sharedFrameCapture.js"],["static","./Stage.js"],["static","./Texture.js"],["static","@egret/contracts"]],
  "packages/runtime/dist/ownership.js": [["static","./displayTreeState.js"],["static","./displayVisualState.js"],["static","./EgretError.js"]],
  "packages/runtime/dist/ownership.d.ts": [["static","./AssetLease.js"],["static","./assetManagerOwnerState.js"],["static","./Bitmap.js"],["static","./DisplayObject.js"],["static","./DisplayObjectContainer.js"],["static","./displayTreeState.js"],["static","./Scope.js"],["static","./sharedFrameCapture.js"],["static","./Stage.js"],["static","./Texture.js"],["static","@egret/contracts"]],
  // Diagnostics: exact existing owner and erased CPU-observation edges.
  "packages/engine/web/webgl2Native.ts": [["static","./sharedRetentionLedger.js"],["static","./webgl2Types.js"],["static","@egret/runtime"]],
  "packages/engine/dist/web/webgl2Native.js": [["static","@egret/runtime"]],
  "packages/engine/dist/web/webgl2Native.d.ts": [["static","./sharedRetentionLedger.js"],["static","./webgl2Types.js"],["static","@egret/runtime"]],
  "packages/engine/web/sharedRetentionLedger.ts": [],
  "packages/engine/dist/web/sharedRetentionLedger.js": [],
  "packages/engine/dist/web/sharedRetentionLedger.d.ts": [],
  "packages/engine/rendering/sharedColor2D.ts": [["static","@egret/contracts"],["static","@egret/contracts"]],
  "packages/engine/dist/rendering/sharedColor2D.js": [["static","@egret/contracts"]],
  "packages/engine/dist/rendering/sharedColor2D.d.ts": [["static","@egret/contracts"]],
  "packages/engine/web/sharedSubmissionStorage2D.ts": [["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/prepareSharedDraws2D.js"],["static","../rendering/sharedColor2D.js"],["static","../rendering/sharedColor2D.js"],["static","./imageProjections2D.js"]],
  "packages/engine/dist/web/sharedSubmissionStorage2D.js": [["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/sharedColor2D.js"]],
  "packages/engine/dist/web/sharedSubmissionStorage2D.d.ts": [["static","../rendering/prepareSharedDraws2D.js"],["static","../rendering/sharedColor2D.js"],["static","./imageProjections2D.js"]],
  "packages/engine/web/prepareSharedSubmission2D.ts": [["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packSharedDraws2D.js"],["static","../rendering/prepareSharedDraws2D.js"],["static","../rendering/sharedColor2D.js"],["static","./imageProjections2D.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedWebGPUOptions.js"]],
  "packages/engine/dist/web/prepareSharedSubmission2D.js": [["static","../rendering/ownedPreparationFailure2D.js"],["static","../rendering/packSharedDraws2D.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedSubmissionStorage2D.js"]],
  "packages/engine/dist/web/prepareSharedSubmission2D.d.ts": [["static","../rendering/packSharedDraws2D.js"],["static","../rendering/prepareSharedDraws2D.js"],["static","../rendering/sharedColor2D.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedSubmissionStorage2D.js"],["static","./sharedWebGPUOptions.js"]],
};

// M1.2 keeps the four retained tables above unchanged. The existing stock-ledger
// check makes this one previously erased dependency a runtime static edge.
const m12IncrementalRenderingLiteralClosure = {
  "packages/engine/dist/rendering/prepareTexturedDraws2D.js": [["static","./prepareImages2D.js"],["static","./prepareRectangles2D.js"],["static","./prepareTexturedMesh2D.js"],["static","./texturedPreparationBudget2D.js"]],
};

// M3.1 finite named source/emission/declaration successor; retained tables stay intact.
const m31UiLiteralClosure = {
  "packages/engine/src/Engine.ts": [["static","./assetGroup.js"],["static","./assetGroup.js"],["static","./assetGroupTypes.js"],["static","./bitmapBindingTicket.js"],["static","./bitmapBindingTicket.js"],["static","./bitmapResourceSlot.js"],["static","./bitmapResourceSlot.js"],["static","./closeHost.js"],["static","./gameClock.js"],["static","./gameClock.js"],["static","./gameClockTypes.js"],["static","./internal/textFieldFactoryState.js"],["static","./internal/texturedFrameState.js"],["static","./internal/uiFactoryState.js"],["static","./internal/uiFactoryState.js"],["static","./manifestAssetGroup.js"],["static","./manifestAssetGroup.js"],["static","./manifestResourceTypes.js"],["static","./mouseInput.js"],["static","./mouseInput.js"],["static","./sequencePlayback.js"],["static","./sequencePlayback.js"],["static","./sequencePlaybackTypes.js"],["static","./tween.js"],["static","./tween.js"],["static","./tweenTypes.js"],["static","@egret/contracts"],["static","@egret/contracts"],["static","@egret/contracts"],["static","@egret/contracts/resources"],["static","@egret/runtime"],["static","@egret/runtime"],["static","@egret/runtime"],["static","@egret/runtime"],["static","@egret/runtime"]],
  "packages/engine/dist/Engine.js": [["static","./assetGroup.js"],["static","./bitmapBindingTicket.js"],["static","./bitmapResourceSlot.js"],["static","./closeHost.js"],["static","./gameClock.js"],["static","./internal/textFieldFactoryState.js"],["static","./internal/texturedFrameState.js"],["static","./internal/uiFactoryState.js"],["static","./manifestAssetGroup.js"],["static","./mouseInput.js"],["static","./sequencePlayback.js"],["static","./tween.js"],["static","@egret/contracts"],["static","@egret/runtime"],["static","@egret/runtime"]],
  "packages/engine/dist/Engine.d.ts": [["static","./assetGroupTypes.js"],["static","./bitmapBindingTicket.js"],["static","./bitmapResourceSlot.js"],["static","./gameClock.js"],["static","./gameClockTypes.js"],["static","./manifestResourceTypes.js"],["static","./sequencePlaybackTypes.js"],["static","./tweenTypes.js"],["static","@egret/contracts"],["static","@egret/contracts"],["static","@egret/contracts/resources"],["static","@egret/runtime"],["static","@egret/runtime"]],
  "packages/runtime/src/DisplayObject.ts": [["static","./displayBounds.js"],["static","./displayBounds.js"],["static","./displayCoordinates.js"],["static","./displayCoordinates.js"],["static","./displayHitState.js"],["static","./DisplayObjectContainer.js"],["static","./displayTreeState.js"],["static","./displayVisualState.js"],["static","./EgretError.js"],["static","./EventDispatcher.js"],["static","./ownership.js"],["static","./ui/managedState.js"],["static","@egret/contracts"],["static","@egret/contracts"]],
  "packages/runtime/dist/DisplayObject.js": [["static","./displayBounds.js"],["static","./displayCoordinates.js"],["static","./displayHitState.js"],["static","./displayTreeState.js"],["static","./displayVisualState.js"],["static","./EgretError.js"],["static","./EventDispatcher.js"],["static","./ownership.js"],["static","./ui/managedState.js"],["static","@egret/contracts"]],
  "packages/runtime/dist/DisplayObject.d.ts": [["static","./displayBounds.js"],["static","./displayCoordinates.js"],["static","./DisplayObjectContainer.js"],["static","./EventDispatcher.js"],["static","./ownership.js"],["static","@egret/contracts"]],
  "packages/runtime/src/DisplayObjectContainer.ts": [["static","./displayHitState.js"],["static","./DisplayObject.js"],["static","./displayTreeState.js"],["static","./EgretError.js"],["static","./ownership.js"],["static","./ui/managedState.js"]],
  "packages/runtime/dist/DisplayObjectContainer.js": [["static","./displayHitState.js"],["static","./DisplayObject.js"],["static","./displayTreeState.js"],["static","./EgretError.js"],["static","./ownership.js"],["static","./ui/managedState.js"]],
  "packages/runtime/dist/DisplayObjectContainer.d.ts": [["static","./DisplayObject.js"],["static","./ownership.js"]],
  "packages/runtime/src/Scope.ts": [["static","./CancellationController.js"],["static","./EgretError.js"],["static","./ownership.js"],["static","./ownership.js"],["static","./ui/managedState.js"],["static","@egret/contracts"]],
  "packages/runtime/dist/Scope.js": [["static","./CancellationController.js"],["static","./EgretError.js"],["static","./ownership.js"],["static","./ui/managedState.js"]],
  "packages/runtime/dist/Scope.d.ts": [["static","./ownership.js"],["static","@egret/contracts"]],
  "packages/runtime/src/displayHitState.ts": [["static","./DisplayObject.js"],["static","./displayTreeState.js"],["static","./displayVisualState.js"],["static","./EgretError.js"],["static","./ownership.js"],["static","./ui/managedState.js"],["static","@egret/contracts"]],
  "packages/runtime/dist/displayHitState.js": [["static","./displayTreeState.js"],["static","./displayVisualState.js"],["static","./EgretError.js"],["static","./ownership.js"],["static","./ui/managedState.js"]],
  "packages/runtime/dist/displayHitState.d.ts": [["static","./DisplayObject.js"],["static","@egret/contracts"]],
  "packages/runtime/src/displayTreeState.ts": [["static","./DisplayObject.js"],["static","./DisplayObjectContainer.js"],["static","./displayVisualState.js"],["static","./EgretError.js"],["static","./frameCaptureCache.js"],["static","./Stage.js"]],
  "packages/runtime/dist/displayTreeState.js": [["static","./displayVisualState.js"],["static","./EgretError.js"],["static","./frameCaptureCache.js"]],
  "packages/runtime/dist/displayTreeState.d.ts": [["static","./DisplayObject.js"],["static","./DisplayObjectContainer.js"],["static","./Stage.js"]],
  "packages/runtime/src/displayVisualState.ts": [["static","./DisplayObject.js"],["static","./displayTreeState.js"],["static","./EgretError.js"],["static","./frameCaptureCache.js"],["static","./ownership.js"],["static","./ui/managedState.js"],["static","@egret/contracts"]],
  "packages/runtime/dist/displayVisualState.js": [["static","./displayTreeState.js"],["static","./EgretError.js"],["static","./frameCaptureCache.js"],["static","./ownership.js"],["static","./ui/managedState.js"]],
  "packages/runtime/dist/displayVisualState.d.ts": [["static","./DisplayObject.js"],["static","@egret/contracts"]],
  "packages/engine/src/pointerInput.ts": [["static","./internal/mouseInputFactoryState.js"],["static","./internal/uiFactoryState.js"],["static","./mouseInput.js"],["static","./pointerInputTypes.js"],["static","./pointerInputTypes.js"],["static","@egret/contracts"],["static","@egret/runtime"],["static","@egret/runtime/input"],["static","@egret/runtime/input"]],
  "packages/engine/dist/pointerInput.js": [["static","./internal/mouseInputFactoryState.js"],["static","./internal/uiFactoryState.js"],["static","@egret/runtime"],["static","@egret/runtime/input"]],
  "packages/engine/dist/pointerInput.d.ts": [["static","./pointerInputTypes.js"],["static","./pointerInputTypes.js"]],
  "packages/engine/src/internal/uiFactoryState.ts": [["static","../pointerInputTypes.js"],["static","@egret/contracts"],["static","@egret/runtime"],["static","@egret/runtime"],["static","@egret/runtime/ui"]],
  "packages/engine/dist/internal/uiFactoryState.js": [["static","@egret/runtime"]],
  "packages/engine/dist/internal/uiFactoryState.d.ts": [["static","../pointerInputTypes.js"],["static","@egret/contracts"],["static","@egret/runtime"],["static","@egret/runtime"],["static","@egret/runtime/ui"]],
  "packages/runtime/src/ui/index.ts": [["static","./displayCommit.js"],["static","./displayCommit.js"],["static","./heightIndex.js"],["static","./layout.js"],["static","./types.js"]],
  "packages/runtime/dist/ui/index.js": [["static","./displayCommit.js"],["static","./heightIndex.js"],["static","./layout.js"]],
  "packages/runtime/dist/ui/index.d.ts": [["static","./displayCommit.js"],["static","./displayCommit.js"],["static","./heightIndex.js"],["static","./layout.js"],["static","./types.js"]],
  "packages/runtime/src/ui/managedState.ts": [["static","../DisplayObject.js"],["static","../displayTreeState.js"],["static","../EgretError.js"]],
  "packages/runtime/dist/ui/managedState.js": [["static","../displayTreeState.js"],["static","../EgretError.js"]],
  "packages/runtime/dist/ui/managedState.d.ts": [["static","../DisplayObject.js"]],
  "packages/runtime/src/ui/displayCommit.ts": [["static","../displayHitState.js"],["static","../DisplayObject.js"],["static","../DisplayObjectContainer.js"],["static","../displayTreeState.js"],["static","../displayTreeState.js"],["static","../displayVisualState.js"],["static","../EgretError.js"],["static","../ownership.js"],["static","../Scope.js"],["static","../Stage.js"],["static","./managedState.js"],["static","@egret/contracts"]],
  "packages/runtime/dist/ui/displayCommit.js": [["static","../displayHitState.js"],["static","../DisplayObjectContainer.js"],["static","../displayTreeState.js"],["static","../displayVisualState.js"],["static","../EgretError.js"],["static","../ownership.js"],["static","../Scope.js"],["static","./managedState.js"]],
  "packages/runtime/dist/ui/displayCommit.d.ts": [["static","../DisplayObject.js"],["static","../DisplayObjectContainer.js"],["static","../Scope.js"],["static","../Stage.js"],["static","@egret/contracts"]],
  "packages/runtime/src/ui/layout.ts": [["static","../EgretError.js"],["static","./types.js"]],
  "packages/runtime/dist/ui/layout.js": [["static","../EgretError.js"]],
  "packages/runtime/dist/ui/layout.d.ts": [["static","./types.js"]],
  "packages/runtime/src/ui/heightIndex.ts": [["static","../EgretError.js"],["static","./types.js"]],
  "packages/runtime/dist/ui/heightIndex.js": [["static","../EgretError.js"]],
  "packages/runtime/dist/ui/heightIndex.d.ts": [["static","./types.js"]],
  "packages/runtime/src/ui/types.ts": [],
  "packages/runtime/dist/ui/types.js": [],
  "packages/runtime/dist/ui/types.d.ts": [],
  "packages/engine/src/ui/index.ts": [["static","./types.js"],["static","./uiRoot.js"]],
  "packages/engine/dist/ui/index.js": [["static","./uiRoot.js"]],
  "packages/engine/dist/ui/index.d.ts": [["static","./types.js"],["static","./uiRoot.js"]],
  "packages/engine/src/ui/types.ts": [["static","../Engine.js"],["static","../pointerInputTypes.js"],["static","@egret/contracts"],["static","@egret/runtime"],["static","@egret/runtime/ui"]],
  "packages/engine/dist/ui/types.js": [],
  "packages/engine/dist/ui/types.d.ts": [["static","../Engine.js"],["static","../pointerInputTypes.js"],["static","@egret/contracts"],["static","@egret/runtime"],["static","@egret/runtime/ui"]],
  "packages/engine/src/ui/uiRoot.ts": [["static","../internal/uiFactoryState.js"],["static","../pointerInputTypes.js"],["static","./types.js"],["static","./virtualList.js"],["static","./virtualList.js"],["static","@egret/runtime"],["static","@egret/runtime"],["static","@egret/runtime/ui"],["static","@egret/runtime/ui"]],
  "packages/engine/dist/ui/uiRoot.js": [["static","../internal/uiFactoryState.js"],["static","./virtualList.js"],["static","@egret/runtime"],["static","@egret/runtime/ui"]],
  "packages/engine/dist/ui/uiRoot.d.ts": [["static","./types.js"]],
  "packages/engine/src/ui/virtualList.ts": [["static","./types.js"],["static","@egret/runtime"]],
  "packages/engine/dist/ui/virtualList.js": [["static","@egret/runtime"]],
  "packages/engine/dist/ui/virtualList.d.ts": [["static","./types.js"]],
};

// Exact reviewed sequence edges override only their current cooperating owners.
const m22SequenceLiteralClosure = {
  "packages/engine/src/Engine.ts": [
    [
      "static",
      "./assetGroup.js"
    ],
    [
      "static",
      "./assetGroup.js"
    ],
    [
      "static",
      "./assetGroupTypes.js"
    ],
    [
      "static",
      "./bitmapBindingTicket.js"
    ],
    [
      "static",
      "./bitmapBindingTicket.js"
    ],
    [
      "static",
      "./bitmapResourceSlot.js"
    ],
    [
      "static",
      "./bitmapResourceSlot.js"
    ],
    [
      "static",
      "./closeHost.js"
    ],
    [
      "static",
      "./gameClock.js"
    ],
    [
      "static",
      "./gameClock.js"
    ],
    [
      "static",
      "./gameClockTypes.js"
    ],
    [
      "static",
      "./internal/contentFactoryState.js"
    ],
    [
      "static",
      "./internal/sequenceControllerFactoryState.js"
    ],
    [
      "static",
      "./internal/sequenceControllerFactoryState.js"
    ],
    [
      "static",
      "./internal/textFieldFactoryState.js"
    ],
    [
      "static",
      "./internal/texturedFrameState.js"
    ],
    [
      "static",
      "./internal/uiFactoryState.js"
    ],
    [
      "static",
      "./internal/uiFactoryState.js"
    ],
    [
      "static",
      "./manifestAssetGroup.js"
    ],
    [
      "static",
      "./manifestAssetGroup.js"
    ],
    [
      "static",
      "./manifestResourceTypes.js"
    ],
    [
      "static",
      "./mouseInput.js"
    ],
    [
      "static",
      "./mouseInput.js"
    ],
    [
      "static",
      "./sequencePlayback.js"
    ],
    [
      "static",
      "./sequencePlayback.js"
    ],
    [
      "static",
      "./sequencePlaybackTypes.js"
    ],
    [
      "static",
      "./sequenceTargetClaims.js"
    ],
    [
      "static",
      "./tween.js"
    ],
    [
      "static",
      "./tween.js"
    ],
    [
      "static",
      "./tweenTypes.js"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/contracts/resources"
    ],
    [
      "static",
      "@egret/runtime"
    ],
    [
      "static",
      "@egret/runtime"
    ],
    [
      "static",
      "@egret/runtime"
    ],
    [
      "static",
      "@egret/runtime"
    ],
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/Engine.js": [
    [
      "static",
      "./assetGroup.js"
    ],
    [
      "static",
      "./bitmapBindingTicket.js"
    ],
    [
      "static",
      "./bitmapResourceSlot.js"
    ],
    [
      "static",
      "./closeHost.js"
    ],
    [
      "static",
      "./gameClock.js"
    ],
    [
      "static",
      "./internal/contentFactoryState.js"
    ],
    [
      "static",
      "./internal/sequenceControllerFactoryState.js"
    ],
    [
      "static",
      "./internal/textFieldFactoryState.js"
    ],
    [
      "static",
      "./internal/texturedFrameState.js"
    ],
    [
      "static",
      "./internal/uiFactoryState.js"
    ],
    [
      "static",
      "./manifestAssetGroup.js"
    ],
    [
      "static",
      "./mouseInput.js"
    ],
    [
      "static",
      "./sequencePlayback.js"
    ],
    [
      "static",
      "./sequenceTargetClaims.js"
    ],
    [
      "static",
      "./tween.js"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/runtime"
    ],
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/Engine.d.ts": [
    [
      "static",
      "./assetGroupTypes.js"
    ],
    [
      "static",
      "./bitmapBindingTicket.js"
    ],
    [
      "static",
      "./bitmapResourceSlot.js"
    ],
    [
      "static",
      "./gameClock.js"
    ],
    [
      "static",
      "./gameClockTypes.js"
    ],
    [
      "static",
      "./manifestResourceTypes.js"
    ],
    [
      "static",
      "./sequencePlaybackTypes.js"
    ],
    [
      "static",
      "./tweenTypes.js"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/contracts/resources"
    ],
    [
      "static",
      "@egret/runtime"
    ],
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/src/sequencePlayback.ts": [
    [
      "static",
      "./gameClockTypes.js"
    ],
    [
      "static",
      "./sequencePlaybackTypes.js"
    ],
    [
      "static",
      "./sequenceTargetClaims.js"
    ],
    [
      "static",
      "@egret/runtime"
    ],
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/sequencePlayback.js": [
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/sequencePlayback.d.ts": [
    [
      "static",
      "./gameClockTypes.js"
    ],
    [
      "static",
      "./sequencePlaybackTypes.js"
    ],
    [
      "static",
      "./sequenceTargetClaims.js"
    ],
    [
      "static",
      "@egret/runtime"
    ],
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/src/sequenceTargetClaims.ts": [
    [
      "static",
      "@egret/runtime"
    ],
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/sequenceTargetClaims.js": [
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/sequenceTargetClaims.d.ts": [
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/src/internal/sequenceControllerFactoryState.ts": [
    [
      "static",
      "../gameClockTypes.js"
    ],
    [
      "static",
      "../sequenceTargetClaims.js"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/internal/sequenceControllerFactoryState.js": [
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/internal/sequenceControllerFactoryState.d.ts": [
    [
      "static",
      "../gameClockTypes.js"
    ],
    [
      "static",
      "../sequenceTargetClaims.js"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/src/animation/index.ts": [
    [
      "static",
      "./sequenceController.js"
    ],
    [
      "static",
      "./types.js"
    ]
  ],
  "packages/engine/dist/animation/index.js": [
    [
      "static",
      "./sequenceController.js"
    ]
  ],
  "packages/engine/dist/animation/index.d.ts": [
    [
      "static",
      "./sequenceController.js"
    ],
    [
      "static",
      "./types.js"
    ]
  ],
  "packages/engine/src/animation/sequenceController.ts": [
    [
      "static",
      "../Engine.js"
    ],
    [
      "static",
      "../gameClockTypes.js"
    ],
    [
      "static",
      "../internal/sequenceControllerFactoryState.js"
    ],
    [
      "static",
      "../internal/sequenceControllerFactoryState.js"
    ],
    [
      "static",
      "./sequenceCoordinator.js"
    ],
    [
      "static",
      "./sequenceCoordinator.js"
    ],
    [
      "static",
      "./sequenceInput.js"
    ],
    [
      "static",
      "./sequenceInput.js"
    ],
    [
      "static",
      "./sequenceMath.js"
    ],
    [
      "static",
      "./sequenceMath.js"
    ],
    [
      "static",
      "./types.js"
    ],
    [
      "static",
      "@egret/runtime"
    ],
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/animation/sequenceController.js": [
    [
      "static",
      "../internal/sequenceControllerFactoryState.js"
    ],
    [
      "static",
      "./sequenceCoordinator.js"
    ],
    [
      "static",
      "./sequenceInput.js"
    ],
    [
      "static",
      "./sequenceMath.js"
    ],
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/animation/sequenceController.d.ts": [
    [
      "static",
      "../Engine.js"
    ],
    [
      "static",
      "./types.js"
    ],
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/src/animation/sequenceCoordinator.ts": [
    [
      "static",
      "../gameClockTypes.js"
    ],
    [
      "static",
      "../internal/sequenceControllerFactoryState.js"
    ],
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/animation/sequenceCoordinator.js": [
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/animation/sequenceCoordinator.d.ts": [
    [
      "static",
      "../gameClockTypes.js"
    ],
    [
      "static",
      "../internal/sequenceControllerFactoryState.js"
    ]
  ],
  "packages/engine/src/animation/sequenceInput.ts": [
    [
      "static",
      "./sequenceMath.js"
    ],
    [
      "static",
      "./types.js"
    ],
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/animation/sequenceInput.js": [
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/animation/sequenceInput.d.ts": [
    [
      "static",
      "./sequenceMath.js"
    ],
    [
      "static",
      "./types.js"
    ]
  ],
  "packages/engine/src/animation/sequenceMath.ts": [
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/animation/sequenceMath.js": [
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/animation/sequenceMath.d.ts": [],
  "packages/engine/src/animation/types.ts": [
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/animation/types.js": [],
  "packages/engine/dist/animation/types.d.ts": [
    [
      "static",
      "@egret/runtime"
    ]
  ]
};

// M3.2: reviewed optional paragraph/UI owners; predecessor maps remain unchanged.
const m32ParagraphLiteralClosure = {
  "packages/engine/dist/paragraph.d.ts": [
    [
      "static",
      "./Engine.js"
    ],
    [
      "static",
      "@egret/runtime"
    ],
    [
      "static",
      "@egret/runtime/paragraph"
    ],
    [
      "static",
      "@egret/runtime/paragraph"
    ],
    [
      "static",
      "@egret/runtime/paragraph"
    ]
  ],
  "packages/engine/dist/paragraph.js": [
    [
      "static",
      "./internal/textFieldFactoryState.js"
    ],
    [
      "static",
      "@egret/runtime/paragraph"
    ]
  ],
  "packages/engine/dist/ui/leafContent.d.ts": [
    [
      "static",
      "./types.js"
    ],
    [
      "static",
      "@egret/runtime/ui"
    ]
  ],
  "packages/engine/dist/ui/leafContent.js": [
    [
      "static",
      "@egret/runtime"
    ],
    [
      "static",
      "@egret/runtime/ui"
    ]
  ],
  "packages/engine/dist/ui/uiRoot.d.ts": [
    [
      "static",
      "./types.js"
    ]
  ],
  "packages/engine/dist/ui/uiRoot.js": [
    [
      "static",
      "../internal/uiFactoryState.js"
    ],
    [
      "static",
      "./leafContent.js"
    ],
    [
      "static",
      "./virtualList.js"
    ],
    [
      "static",
      "@egret/runtime"
    ],
    [
      "static",
      "@egret/runtime/ui"
    ]
  ],
  "packages/engine/dist/web/CanvasKitParagraphProvider.d.ts": [
    [
      "static",
      "./canvasKitParagraphGeometry.js"
    ],
    [
      "static",
      "@egret/engine/paragraph"
    ]
  ],
  "packages/engine/dist/web/CanvasKitParagraphProvider.js": [
    [
      "static",
      "./canvasKitParagraphGeometry.js"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/web/paragraph.d.ts": [
    [
      "static",
      "./CanvasKitParagraphProvider.js"
    ],
    [
      "static",
      "./CanvasKitParagraphProvider.js"
    ]
  ],
  "packages/engine/dist/web/paragraph.js": [
    [
      "static",
      "./CanvasKitParagraphProvider.js"
    ]
  ],
  "packages/engine/src/paragraph.ts": [
    [
      "static",
      "./Engine.js"
    ],
    [
      "static",
      "./internal/textFieldFactoryState.js"
    ],
    [
      "static",
      "@egret/runtime"
    ],
    [
      "static",
      "@egret/runtime/paragraph"
    ],
    [
      "static",
      "@egret/runtime/paragraph"
    ],
    [
      "static",
      "@egret/runtime/paragraph"
    ]
  ],
  "packages/engine/src/ui/leafContent.ts": [
    [
      "static",
      "./types.js"
    ],
    [
      "static",
      "@egret/runtime"
    ],
    [
      "static",
      "@egret/runtime/ui"
    ],
    [
      "static",
      "@egret/runtime/ui"
    ]
  ],
  "packages/engine/src/ui/uiRoot.ts": [
    [
      "static",
      "../internal/uiFactoryState.js"
    ],
    [
      "static",
      "../pointerInputTypes.js"
    ],
    [
      "static",
      "./leafContent.js"
    ],
    [
      "static",
      "./leafContent.js"
    ],
    [
      "static",
      "./types.js"
    ],
    [
      "static",
      "./virtualList.js"
    ],
    [
      "static",
      "./virtualList.js"
    ],
    [
      "static",
      "@egret/runtime"
    ],
    [
      "static",
      "@egret/runtime"
    ],
    [
      "static",
      "@egret/runtime/ui"
    ],
    [
      "static",
      "@egret/runtime/ui"
    ]
  ],
  "packages/engine/web/CanvasKitParagraphProvider.ts": [
    [
      "static",
      "./canvasKitParagraphGeometry.js"
    ],
    [
      "static",
      "./canvasKitParagraphGeometry.js"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/engine/paragraph"
    ],
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/web/paragraph.ts": [
    [
      "static",
      "./CanvasKitParagraphProvider.js"
    ],
    [
      "static",
      "./CanvasKitParagraphProvider.js"
    ]
  ],
  "packages/runtime/dist/paragraph/Paragraph.d.ts": [
    [
      "static",
      "../DisplayObjectContainer.js"
    ],
    [
      "static",
      "../ownership.js"
    ],
    [
      "static",
      "../Scope.js"
    ],
    [
      "static",
      "./types.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/runtime/dist/paragraph/Paragraph.js": [
    [
      "static",
      "../Bitmap.js"
    ],
    [
      "static",
      "../CancellationController.js"
    ],
    [
      "static",
      "../DisplayObjectContainer.js"
    ],
    [
      "static",
      "../displayTreeState.js"
    ],
    [
      "static",
      "../EgretError.js"
    ],
    [
      "static",
      "../ownership.js"
    ],
    [
      "static",
      "../Scope.js"
    ],
    [
      "static",
      "../textDisplayState.js"
    ],
    [
      "static",
      "../ui/managedState.js"
    ],
    [
      "static",
      "./request.js"
    ]
  ],
  "packages/runtime/dist/paragraph/ParagraphCache.d.ts": [
    [
      "static",
      "../AssetManager.js"
    ],
    [
      "static",
      "./types.js"
    ]
  ],
  "packages/runtime/dist/paragraph/ParagraphCache.js": [
    [
      "static",
      "../AssetLease.js"
    ],
    [
      "static",
      "../assetManagerOwnerState.js"
    ],
    [
      "static",
      "../AssetRef.js"
    ],
    [
      "static",
      "../EgretError.js"
    ],
    [
      "static",
      "../ownership.js"
    ],
    [
      "static",
      "../Texture.js"
    ],
    [
      "static",
      "./geometry.js"
    ],
    [
      "static",
      "./Paragraph.js"
    ],
    [
      "static",
      "./request.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/runtime/dist/paragraph/index.d.ts": [
    [
      "static",
      "./ParagraphCache.js"
    ],
    [
      "static",
      "./types.js"
    ]
  ],
  "packages/runtime/dist/paragraph/index.js": [
    [
      "static",
      "./ParagraphCache.js"
    ]
  ],
  "packages/runtime/dist/paragraph/request.d.ts": [
    [
      "static",
      "./types.js"
    ]
  ],
  "packages/runtime/dist/paragraph/request.js": [
    [
      "static",
      "../EgretError.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/runtime/dist/paragraph/types.d.ts": [
    [
      "static",
      "../AssetLease.js"
    ],
    [
      "static",
      "../DisplayObjectContainer.js"
    ],
    [
      "static",
      "../Texture.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/runtime/dist/paragraph/types.js": [],
  "packages/runtime/src/paragraph/Paragraph.ts": [
    [
      "static",
      "../Bitmap.js"
    ],
    [
      "static",
      "../CancellationController.js"
    ],
    [
      "static",
      "../DisplayObjectContainer.js"
    ],
    [
      "static",
      "../displayTreeState.js"
    ],
    [
      "static",
      "../EgretError.js"
    ],
    [
      "static",
      "../ownership.js"
    ],
    [
      "static",
      "../ownership.js"
    ],
    [
      "static",
      "../Scope.js"
    ],
    [
      "static",
      "../textDisplayState.js"
    ],
    [
      "static",
      "../ui/managedState.js"
    ],
    [
      "static",
      "./request.js"
    ],
    [
      "static",
      "./types.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/runtime/src/paragraph/ParagraphCache.ts": [
    [
      "static",
      "../AssetLease.js"
    ],
    [
      "static",
      "../AssetLease.js"
    ],
    [
      "static",
      "../AssetManager.js"
    ],
    [
      "static",
      "../assetManagerOwnerState.js"
    ],
    [
      "static",
      "../AssetRef.js"
    ],
    [
      "static",
      "../AssetRef.js"
    ],
    [
      "static",
      "../EgretError.js"
    ],
    [
      "static",
      "../ownership.js"
    ],
    [
      "static",
      "../Texture.js"
    ],
    [
      "static",
      "../Texture.js"
    ],
    [
      "static",
      "./geometry.js"
    ],
    [
      "static",
      "./Paragraph.js"
    ],
    [
      "static",
      "./request.js"
    ],
    [
      "static",
      "./types.js"
    ],
    [
      "static",
      "@egret/contracts"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/runtime/src/paragraph/index.ts": [
    [
      "static",
      "./ParagraphCache.js"
    ],
    [
      "static",
      "./types.js"
    ]
  ],
  "packages/runtime/src/paragraph/request.ts": [
    [
      "static",
      "../EgretError.js"
    ],
    [
      "static",
      "./types.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/runtime/src/paragraph/types.ts": [
    [
      "static",
      "../AssetLease.js"
    ],
    [
      "static",
      "../DisplayObjectContainer.js"
    ],
    [
      "static",
      "../Texture.js"
    ],
    [
      "static",
      "@egret/contracts"
    ]
  ],
  "packages/engine/web/canvasKitParagraphGeometry.ts": [
    [
      "static",
      "@egret/engine/paragraph"
    ],
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/web/canvasKitParagraphGeometry.js": [
    [
      "static",
      "@egret/runtime"
    ]
  ],
  "packages/engine/dist/web/canvasKitParagraphGeometry.d.ts": [
    [
      "static",
      "@egret/engine/paragraph"
    ]
  ],
  "packages/runtime/src/paragraph/geometry.ts": [
    [
      "static",
      "../EgretError.js"
    ],
    [
      "static",
      "./types.js"
    ]
  ],
  "packages/runtime/dist/paragraph/geometry.js": [
    [
      "static",
      "../EgretError.js"
    ]
  ],
  "packages/runtime/dist/paragraph/geometry.d.ts": [
    [
      "static",
      "./types.js"
    ]
  ]
};

function sceneGraphEdges(code) {
  return [...code.matchAll(/\b(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)]
    .map(match=>[/^import\s*\(/.test(match[0])?'dynamic':'static',match[1]])
    .sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
for (const [file,edges] of Object.entries({...sceneLiteralClosure,...m13SharedRenderingLiteralClosure,...m14WebGL2LiteralClosure,...m15ResourceRecoveryLiteralClosure,...m12IncrementalRenderingLiteralClosure,...m31UiLiteralClosure,...m22SequenceLiteralClosure,...m32ParagraphLiteralClosure})) {
  const code=sceneRead(file);
  if (JSON.stringify(sceneGraphEdges(code))!==JSON.stringify(edges)) throw new Error('S3D1: scene entry imported outside approved closure: '+file);
  // Non-literal dynamic imports cannot hide an additional dependency edge.
  if ((code.match(/\bimport\s*\(/g)??[]).length!==edges.filter(edge=>edge[0]==='dynamic').length) throw new Error('S3D1: scene entry imported outside approved closure: '+file);
}

// S3D1_BOUNDARY_END

// MI1_BOUNDARY_BEGIN
// This finite opt-in policy adds no wildcard package/private-import permission.
const mousePublicTypes=['MouseInputOptions','MouseInput','MouseInputState','MouseInputEvents','MouseInputPayload','MouseInputCancelReason'];
const buttonPublicTypes=['BitmapButton','BitmapButtonOptions','BitmapButtonState'];
const inputPublicValues=['createBitmapButton','createMouseInput'];
const buttonPrivateNames=['BitmapButtonAssociation','BitmapButtonInputPort','assertBitmapButtonScopeOrigin','registerMouseInputScope','registerMouseInputInstance','requireBitmapButtonInput','bitmapButtonOperations'];
const mousePrivateNames=['createMouseInputOwner','createMouseInputWithNative','MouseInputOwner','MouseInputAssembly','MouseInputEnginePort','MouseInputNativeFactory','MouseInputNativePorts','MouseInputNativePair','MouseInputNativeKind','MouseInputNativeListener','MouseInputPoint','registerMouseInputEngine','requireMouseInputEngine','markMouseInputEngineStarted'];
const mouseRead=file=>assetGroupStrip(readFileSync(path.join(root,file),'utf8'));
const mouseSame=(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
function mouseExports(code,label) {
  if(/\bexport\s*(?:type\s*)?\*|\bexport\s+default\b/.test(code))throw new Error('MI1: exact optional export surface mismatch: '+label);
  const values=[],types=[];
  for(const match of code.matchAll(/\bexport(\s+type)?\s*\{([^}]+)\}(?:\s*from\s*['"]([^'"]+)['"])?\s*;?/g))
    for(const name of match[2].split(',').map(value=>value.trim()).filter(Boolean)){if(!/^\w+$/.test(name))throw new Error('MI1: exact optional export surface mismatch: '+label);(match[1]?types:values).push(name);}
  for(const match of code.matchAll(/\bexport\s+(?:declare\s+)?(type|interface|function|const|class|enum)\s+(\w+)/g))(['type','interface'].includes(match[1])?types:values).push(match[2]);
  return {values,types};
}
function mouseEdges(code,label) {
  if(/\bimport\s*\(/.test(code))throw new Error('MI1: exact input module import closure mismatch: '+label);
  const clauses=[...code.matchAll(/\b(import|export)(\s+type)?\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]\s*;?/g)];
  const rest=code.replace(/\b(?:import|export)(?:\s+type)?\s*\{[^}]+\}\s*from\s*['"][^'"]+['"]\s*;?/g,'');
  if(/\bimport\b|\bfrom\s*['"]/.test(rest))throw new Error('MI1: exact input module import closure mismatch: '+label);
  return clauses.map(match=>({kind:match[2]?'type':'value',target:match[4],names:match[3].split(',').map(value=>value.trim().split(/\s+as\s+/)[0]).filter(Boolean)}));
}
const mouseFacade=await import('@egret/engine/web/input');
if(!mouseSame(Object.keys(mouseFacade),inputPublicValues)||inputPublicValues.some(name=>typeof mouseFacade[name]!=='function'))throw new Error('MI1: exact optional runtime export surface mismatch');
for(const [file,hasTypes]of [['packages/engine/web/input.ts',true],['packages/engine/dist/web/input.js',false],['packages/engine/dist/web/input.d.ts',true]]) {
  const code=mouseRead(file),surface=mouseExports(code,file);
  if(!mouseSame(surface.values,inputPublicValues)||!mouseSame(surface.types,hasTypes?[...mousePublicTypes,...buttonPublicTypes]:[]))throw new Error('MI1: exact optional export surface mismatch: '+file);
  const clauses=mouseEdges(code,file);
  const expectedClauses=[
    {kind:'value',target:'./MouseInput.js',names:['createMouseInput']},
    ...(hasTypes?[{kind:'type',target:'#egret-mouse-input',names:mousePublicTypes}]:[]),
    {kind:'value',target:'#egret-mouse-input',names:['createBitmapButton']},
    ...(hasTypes?[{kind:'type',target:'#egret-mouse-input',names:buttonPublicTypes}]:[]),
  ];
  if(clauses.length!==expectedClauses.length||expectedClauses.some(expected=>clauses.filter(clause=>clause.kind===expected.kind&&clause.target===expected.target&&mouseSame(clause.names,expected.names)).length!==1))
    throw new Error('MI1: exact optional forwarding mismatch: '+file);
  if(code.replace(/\bexport(?:\s+type)?\s*\{[^}]+\}\s*from\s*['"][^'"]+['"]\s*;?/g,'').trim())throw new Error('MI1: input barrel performs module work: '+file);
}
const mouseEntryFiles=[['root',facade,'packages/engine/dist/index'],['web',webFacade,'packages/engine/dist/web/index'],['webgpu',gpuFacade,'packages/engine/dist/web/webgpu'],['runtime',runtimeFacade,'packages/runtime/dist/index'],['text',engineText,'packages/engine/dist/text']];
for(const [label,values,entry]of mouseEntryFiles) {
  const declared=mouseRead(entry+'.d.ts');
  const prohibited=[...mousePublicTypes,...buttonPublicTypes,...inputPublicValues,...mousePrivateNames,...buttonPrivateNames,...(label==='runtime'?[]:['createDisplayInputOperations','DisplayInputOperations'])];
  for(const name of prohibited)if(name in values||new RegExp('\\b'+name+'\\b').test(declared))throw new Error('MI1: input leaks outside optional entry: '+label+'/'+name);
  if(/(?:mouseInput|MouseInput|bitmapButton|BitmapButton|web\/input|#egret-mouse-input)/.test(declared))throw new Error('MI1: private input declaration edge leaks outside optional entry: '+label);
}
for(const file of ['packages/engine/src/mouseInputTypes.ts','packages/engine/dist/mouseInputTypes.d.ts']) {
  const surface=mouseExports(mouseRead(file),file);if(surface.values.length||!mouseSame(surface.types,mousePublicTypes))throw new Error('MI1: canonical six erased input types mismatch: '+file);
}
for(const file of ['packages/engine/src/bitmapButtonTypes.ts','packages/engine/dist/bitmapButtonTypes.d.ts']) {
  const surface=mouseExports(mouseRead(file),file);
  if(surface.values.length||!mouseSame(surface.types,buttonPublicTypes))throw new Error('BITMAP_BUTTON: canonical three erased types mismatch: '+file);
}
if(Object.keys(await import(new URL('../packages/engine/dist/bitmapButtonTypes.js',import.meta.url))).length)throw new Error('BITMAP_BUTTON: types emitted runtime values');
if(Object.keys(await import(new URL('../packages/engine/dist/mouseInputTypes.js',import.meta.url))).length)throw new Error('MI1: input types emitted runtime values');
for(const file of ['packages/engine/src/bitmapButton.ts','packages/engine/src/bitmapButtonTypes.ts','packages/engine/dist/bitmapButton.js','packages/engine/dist/bitmapButtonTypes.js','packages/engine/src/mouseInput.ts','packages/engine/src/mouseInputTypes.ts','packages/engine/src/internal/mouseInputFactoryState.ts','packages/engine/dist/mouseInput.js','packages/engine/dist/mouseInputTypes.js','packages/engine/dist/internal/mouseInputFactoryState.js','packages/runtime/src/displayInputOperations.ts','packages/runtime/dist/displayInputOperations.js']) {
  const raw=readFileSync(path.join(root,file),'utf8'),code=mouseRead(file);
  if(/\b(?:document|window|HTMLCanvasElement|HTMLElement|Document|Window|PointerEvent|MouseEvent|EventTarget|CSSStyleDeclaration|DOMRect|GPUDevice|NodeJS|process|Buffer|require)\b|['"]node:/.test(code)
    ||/\/\/\/\s*<reference\s+(?:lib\s*=\s*['"]dom(?:\.iterable)?['"]|types\s*=\s*['"]node['"])/i.test(raw))throw new Error('MI1: input core host ambient dependency: '+file);
  if(/\b(?:requestAnimationFrame|cancelAnimationFrame|setInterval|clearInterval|setTimeout|clearTimeout|performance|Date)\b/.test(code))throw new Error('MI1: input automatic timing dependency: '+file);
}
const mouseBrowserRules={
  '@egret/runtime':{value:['EgretError']},
  '#egret-mouse-input':{value:['createMouseInputWithNative'],type:['MouseInput','MouseInputOptions','MouseInputNativeFactory','MouseInputNativeKind','MouseInputNativeListener','MouseInputNativePair','MouseInputPoint']},
};
for(const file of ['packages/engine/web/MouseInput.ts','packages/engine/dist/web/MouseInput.js','packages/engine/dist/web/MouseInput.d.ts']) {
  for(const clause of mouseEdges(mouseRead(file),file)){const allowed=mouseBrowserRules[clause.target]?.[clause.kind];if(!allowed||clause.names.some(name=>!allowed.includes(name))||new Set(clause.names).size!==clause.names.length)throw new Error('MI1: exact input module import closure mismatch: '+file);}
  if(/\.\.[/]src[/]|\b(?:preventDefault|stopPropagation|setPointerCapture|releasePointerCapture|requestAnimationFrame|setTimeout)\s*\(/.test(mouseRead(file)))throw new Error('MI1: browser input forbidden native behavior: '+file);
}
const mouseEngine=mouseRead('packages/engine/src/Engine.ts'),mouseStart=mouseRead('packages/engine/src/startEngine.ts'),mouseOwner=mouseRead('packages/engine/src/mouseInput.ts');
if(!/createDisplayInputOperations\(stage\)/.test(mouseEngine)||!/createMouseInputOwner\(this,/.test(mouseEngine)||!/\.registerScope\(scope\)/.test(mouseEngine))throw new Error('MI1: genuine Engine display/scope assembly guard missing');
const closing=mouseEngine.indexOf('this.#currentState = "closing"'),inputGate=mouseEngine.indexOf('this.#mouseInputOwner.close()',closing),owners=mouseEngine.indexOf('this.#assetGroupOwner.close()',closing);
if(closing<0||inputGate<closing||owners<inputGate)throw new Error('MI1: early Engine input gate order mismatch');
if(!/await\s+host\.start\?\.\(\)\s*;\s*markMouseInputEngineStarted\(engine\)\s*;\s*return\s+engine/.test(mouseStart)
  ||!/if\s*\(!started\)\s*throw\s+new\s+EgretError\(['"]MOUSE_INPUT_INVALID['"]\)/.test(mouseOwner))throw new Error('MI1: successful startup readiness guard missing');
const ownerAssembly=mouseOwner.indexOf('export function createMouseInputOwner('),signalCapture=mouseOwner.indexOf('new CancellationController().signal');
if(ownerAssembly<0||signalCapture<ownerAssembly||!/const originalSignals = new WeakMap/.test(mouseOwner))throw new Error('MI1: Signal intrinsic capture must occur per Engine assembly');
for(const file of ['packages/runtime/src/displayInputOperations.ts','packages/runtime/dist/displayInputOperations.js']) {
  const code=mouseRead(file);
  if(!/queryDisplayHit\(stage,\s*x,\s*y,\s*\{\s*maxNodes\s*\}\)/.test(code)||!/dispatchDisplayInputEvent\(target,\s*event,/.test(code)
    ||/\.hitTest\s*\(|\.dispatchEvent\s*\(|\.eventParent\s*\(|\.assertUsable\s*\(|\.parent\b|\.candidates\b/.test(code))throw new Error('MI1: captured display port must reuse private HT1 and typed route');
}
// Exact new target ownership; unrelated files never acquire input authority by
// importing a dormant value, an erased type, or a dynamic relative edge.
const mouseApprovedTargets={
  'src/mouseInput.js':['src/Engine.ts','src/internal/mouseInputFactoryState.ts','src/bitmapButton.ts','src/pointerInput.ts','src/keyboardInput.ts'],
  'dist/mouseInput.js':['dist/Engine.js','dist/Engine.d.ts','dist/internal/mouseInputFactoryState.js','dist/internal/mouseInputFactoryState.d.ts','dist/bitmapButton.js','dist/bitmapButton.d.ts'],
  'src/mouseInputTypes.js':['src/mouseInput.ts','src/bitmapButton.ts','src/bitmapButtonTypes.ts','src/internal/mouseInputFactoryState.ts'],
  'dist/mouseInputTypes.js':['dist/mouseInput.js','dist/mouseInput.d.ts','dist/bitmapButton.js','dist/bitmapButton.d.ts','dist/bitmapButtonTypes.d.ts','dist/internal/mouseInputFactoryState.d.ts'],
  'src/bitmapButton.js':['src/mouseInput.ts'],
  'dist/bitmapButton.js':['dist/mouseInput.js','dist/mouseInput.d.ts'],
  'src/bitmapButtonTypes.js':['src/mouseInput.ts','src/bitmapButton.ts'],
  'dist/bitmapButtonTypes.js':['dist/mouseInput.d.ts','dist/bitmapButton.d.ts'],
  'src/internal/mouseInputFactoryState.js':['src/mouseInput.ts','src/startEngine.ts','src/bitmapButton.ts','src/pointerInput.ts','src/keyboardInput.ts'],
  'dist/internal/mouseInputFactoryState.js':['dist/mouseInput.js','dist/mouseInput.d.ts','dist/startEngine.js','dist/bitmapButton.js','dist/pointerInput.js','dist/keyboardInput.js'],
};
for(const file of [...files(path.join(root,'packages/engine/src')),...files(path.join(root,'packages/engine/web')),...files(path.join(root,'packages/engine/dist'))]) {
  if(!/\.(?:ts|js)$/.test(file))continue;const relative=path.relative(path.join(root,'packages/engine'),file).split(path.sep).join('/'),code=assetGroupStrip(readFileSync(file,'utf8'));
  for(const match of code.matchAll(/\b(?:from\s*|import\s*\(\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
    const target=path.relative(path.join(root,'packages/engine'),path.resolve(path.dirname(file),match[1])).split(path.sep).join('/');
    if(Object.hasOwn(mouseApprovedTargets,target)&&!mouseApprovedTargets[target].includes(relative))throw new Error('MI1: private input target imported outside named paths: '+relative);
  }
}
// MI1_BOUNDARY_END
// BW1_BOUNDARY_BEGIN
// BW1 runs after all retained policies. The original BR1 clauses and refusal
// precedence stay intact; only the two root value inventories grow above.
const byteWriterValues = ['BYTE_WRITER_LIMITS', 'ByteWriter'];
const byteWriterModuleReference = /["'][^"']*(?:^|\/)ByteWriter\.js["']/;
// Import optional namespaces here so this BW leak check is independent of the
// deliberately removed S3D1 block in the retained predecessor comparator.
const byteWriterEntries = [...textEntries,
  ['project', projectFacade, 'packages/project/dist/index'],
  ['scene3d', await import('@egret/engine/scene3d'), 'packages/engine/dist/rendering/scene3d'],
  ['webgpu/scene3d', await import('@egret/engine/webgpu/scene3d'), 'packages/engine/dist/web/scene3d'],
  ['web/input', mouseFacade, 'packages/engine/dist/web/input'],
];
const byteWriterSourceEntries = {...assetGroupSourceEntries,
  scene3d: 'packages/engine/rendering/scene3d.ts',
  'webgpu/scene3d': 'packages/engine/web/scene3d.ts',
  'web/input': 'packages/engine/web/input.ts',
};
const byteWriterModule = await import(new URL('../packages/runtime/dist/ByteWriter.js', import.meta.url));
if (JSON.stringify(Object.keys(byteWriterModule)) !== JSON.stringify(byteWriterValues))
  throw new Error('runtime: canonical ByteWriter runtime export surface mismatch');
for (const name of byteWriterValues) {
  if (runtimeFacade[name] !== byteWriterModule[name]) throw new Error('runtime: ByteWriter module identity mismatch: ' + name);
  if (facade[name] !== runtimeFacade[name]) throw new Error('root: ByteWriter runtime identity mismatch: ' + name);
}
if (typeof byteWriterModule.ByteWriter !== 'function' || typeof byteWriterModule.BYTE_WRITER_LIMITS !== 'object'
    || byteWriterModule.BYTE_WRITER_LIMITS === null || !Object.isFrozen(byteWriterModule.BYTE_WRITER_LIMITS)
    || JSON.stringify(Object.keys(byteWriterModule.BYTE_WRITER_LIMITS)) !== JSON.stringify(['maxBytes'])
    || byteWriterModule.BYTE_WRITER_LIMITS.maxBytes !== 16777216)
  throw new Error('runtime: canonical ByteWriter limits/value surface mismatch');
for (const [entry, values, stem] of byteWriterEntries) {
  const sourceFile = byteWriterSourceEntries[entry];
  const checkedFiles = [sourceFile, stem + '.js', stem + '.d.ts'];
  if (entry !== 'root' && entry !== 'runtime') {
    const code = checkedFiles.map(file => byteReaderStrip(readFileSync(path.join(root, file), 'utf8'))).join('\n');
    for (const name of byteWriterValues) if (name in values || new RegExp('\\b' + name + '\\b').test(code))
      throw new Error(entry + ': root/runtime-only ByteWriter port leaked: ' + name);
    if (byteWriterModuleReference.test(code)) throw new Error(entry + ': root/runtime-only ByteWriter module leaked');
    continue;
  }
  if (typeof values.ByteWriter !== 'function' || typeof values.BYTE_WRITER_LIMITS !== 'object' || values.BYTE_WRITER_LIMITS === null)
    throw new Error(entry + ': ByteWriter value surface missing');
  const target = entry === 'root' ? '@egret/runtime' : './ByteWriter.js';
  for (const file of checkedFiles) {
    const code = byteReaderStrip(readFileSync(path.join(root, file), 'utf8'));
    const ports = [...code.matchAll(/export(\s+type)?\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];?/g)].filter(match =>
      byteWriterValues.some(name => new RegExp('\\b' + name + '\\b').test(match[2])) || /(?:^|\/)ByteWriter\.js$/.test(match[3]));
    const remainder = ports.reduce((text, match) => text.replace(match[0], ''), code);
    // Each root has one original named value forward, in source and emissions.
    // An erased alias, split clause or unrelated target is not that forward.
    if (ports.length !== 1 || ports[0][1] || ports[0][3] !== target
        || JSON.stringify(ports[0][2].split(',').map(name => name.trim()).sort()) !== JSON.stringify(byteWriterValues)
        || byteWriterValues.some(name => new RegExp('\\b' + name + '\\b').test(remainder))
        || byteWriterModuleReference.test(remainder))
      throw new Error(entry + ': exact ByteWriter value re-export mismatch: ' + file);
  }
}
// ByteOrder remains the original BR1 erased type. This leaf imports it once
// from ByteReader; it neither declares nor forwards a second public order type.
for (const file of ['packages/runtime/src/ByteWriter.ts', 'packages/runtime/dist/ByteWriter.d.ts']) {
  const code = byteReaderStrip(readFileSync(path.join(root, file), 'utf8'));
  const names = [...code.matchAll(/\bexport\s+(?:declare\s+)?(?:type|interface|function|const|class|enum)\s+(\w+)/g)].map(match => match[1]).sort();
  const exportCount = (code.replace(/^[ \t]*export[ \t]*\{[ \t]*\}[ \t]*;[ \t]*\r?$/gm, '').match(/\bexport\b/g) ?? []).length;
  if (JSON.stringify(names) !== JSON.stringify(byteWriterValues) || exportCount !== 2)
    throw new Error('runtime: canonical ByteWriter declaration/source export surface mismatch: ' + file);
  const orderPorts = [...code.matchAll(/\bimport(\s+type)?\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];?/g)].filter(match =>
    /\bByteOrder\b/.test(match[2]) || /(?:^|\/)ByteReader\.js$/.test(match[3]));
  const remainder = orderPorts.reduce((text, match) => text.replace(match[0], ''), code);
  if (orderPorts.length !== 1 || !orderPorts[0][1] || orderPorts[0][2].trim() !== 'ByteOrder'
      || orderPorts[0][3] !== './ByteReader.js' || byteReaderModuleReference.test(remainder)
      || /\b(?:type|interface|class|enum|const|function)\s+ByteOrder\b/.test(remainder))
    throw new Error('runtime: canonical ByteWriter original ByteOrder type import mismatch: ' + file);
}
const byteWriterEmitted = byteReaderStrip(readFileSync(path.join(root, 'packages/runtime/dist/ByteWriter.js'), 'utf8'));
if (/\bByteOrder\b/.test(byteWriterEmitted) || byteReaderModuleReference.test(byteWriterEmitted))
  throw new Error('runtime: ByteWriter ByteOrder import must be erased');
// A declaration or triple-slash dependency must not acquire a host ambient.
// Keep the earlier generic/BR1 refusals authoritative when they already apply.
for (const file of ['packages/runtime/src/ByteWriter.ts', 'packages/runtime/dist/ByteWriter.js', 'packages/runtime/dist/ByteWriter.d.ts']) {
  const raw = readFileSync(path.join(root, file), 'utf8'), code = byteReaderStrip(raw);
  if (forbidden.test(code) || /\b(?:HTMLElement|Document|Window|Navigator|NodeJS)\b/.test(code)
      || /\/\/\/\s*<reference\s+(?:lib\s*=\s*["']dom(?:\.iterable)?["']|types\s*=\s*["']node["'])/i.test(raw))
    throw new Error(file + ': host ambient dependency');
}
// BW1_BOUNDARY_END
// NS1_BEGIN
// First-party NS1 structure policy. Numeric geometry and rendered pixels require
// separate actual tests; this block does not prove the factory algorithm.
// Own lexical helpers and optional imports keep retained predecessor removal safe.
const ns1Strip = raw => raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const ns1Read = file => ns1Strip(readFileSync(path.join(root, file), 'utf8'));
const ns1Same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const ns1Value = 'createNineSliceGeometry2D';
const ns1Types = ['NineSliceInsets2D', 'NineSliceGeometry2DOptions'];
const ns1Names = [ns1Value, ...ns1Types];
const ns1Mentions = code => ns1Names.some(name => new RegExp('\\b' + name + '\\b').test(code));
const ns1ModuleReference = /["'][^"']*\bNineSliceGeometry2D\.(?:js|ts)["']/;
function ns1Members(raw) {
  const names = raw.split(',').map(name => name.trim());
  return names.every(name => /^[A-Za-z_$][\w$]*$/.test(name)) && new Set(names).size === names.length ? names : null;
}
const ns1Module = await import(new URL('../packages/runtime/dist/NineSliceGeometry2D.js', import.meta.url));
const ns1Runtime = await import('@egret/runtime');
const ns1Root = await import('@egret/engine');
if (!ns1Same(Object.keys(ns1Module), [ns1Value]) || typeof ns1Module[ns1Value] !== 'function')
  throw new Error('NS1: canonical leaf executable surface mismatch');
if (runtimeFacade[ns1Value] !== ns1Module[ns1Value] || ns1Runtime[ns1Value] !== ns1Module[ns1Value])
  throw new Error('NS1: runtime canonical factory identity mismatch');
if (facade[ns1Value] !== ns1Module[ns1Value] || ns1Root[ns1Value] !== ns1Module[ns1Value])
  throw new Error('NS1: root canonical factory identity mismatch');
for (const [label, values, source, stem, target] of [
  ['runtime', ns1Runtime, 'packages/runtime/src/index.ts', 'packages/runtime/dist/index', './NineSliceGeometry2D.js'],
  ['root', ns1Root, 'packages/engine/src/index.ts', 'packages/engine/dist/index', '@egret/runtime'],
]) {
  for (const name of ns1Types) if (name in values) throw new Error('NS1: ' + label + ' type must be erased: ' + name);
  for (const file of [source, stem + '.js', stem + '.d.ts']) {
    const code = ns1Read(file), typed = !file.endsWith('.js');
    const ports = [...code.matchAll(/\bexport(\s+type)?\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];?/g)]
      .filter(match => ns1Mentions(match[2]) || ns1ModuleReference.test('"' + match[3] + '"'));
    const valuePorts = ports.filter(match => !match[1]), typePorts = ports.filter(match => match[1]);
    const remainder = ports.reduce((text, match) => text.replace(match[0], ''), code);
    if (valuePorts.length !== 1 || typePorts.length !== (typed ? 1 : 0)
        || valuePorts[0][3] !== target || !ns1Members(valuePorts[0][2]) || !ns1Same(ns1Members(valuePorts[0][2]), [ns1Value])
        || (typed && (typePorts[0][3] !== target || !ns1Members(typePorts[0][2]) || !ns1Same(ns1Members(typePorts[0][2]), ns1Types)))
        || ns1Mentions(remainder) || ns1ModuleReference.test(remainder))
      throw new Error('NS1: ' + label + ' exact factory/type forwarding mismatch: ' + file);
  }
}
// Only source and declaration own the two interfaces. Emitted JS owns one value.
for (const file of ['packages/runtime/src/NineSliceGeometry2D.ts', 'packages/runtime/dist/NineSliceGeometry2D.d.ts', 'packages/runtime/dist/NineSliceGeometry2D.js']) {
  const raw = readFileSync(path.join(root, file), 'utf8'), code = ns1Strip(raw), emitted = file.endsWith('.js');
  const declared = [...code.matchAll(/\bexport\s+(?:declare\s+)?(function|interface|type|const|let|var|class|enum)\s+([A-Za-z_$][\w$]*)/g)];
  const exportCount = (code.replace(/^[ \t]*export[ \t]*\{[ \t]*\}[ \t]*;[ \t]*\r?$/gm, '').match(/\bexport\b/g) ?? []).length;
  const expectedNames = emitted ? [ns1Value] : ns1Names;
  if (!ns1Same(declared.map(match => match[2]), expectedNames) || exportCount !== expectedNames.length
      || declared.some(match => match[2] === ns1Value ? match[1] !== 'function' : match[1] !== 'interface'))
    throw new Error('NS1: canonical leaf export surface mismatch: ' + file);
  const imports = [...code.matchAll(/\bimport(\s+type)?\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];?/g)];
  const declarationsOnly = file.endsWith('.d.ts');
  const expectedImports = declarationsOnly ? [{type:true, name:'TexturedGeometry2D'}]
    : emitted ? [{type:false, name:'createTexturedGeometry2D'}]
      : [{type:false, name:'createTexturedGeometry2D'}, {type:true, name:'TexturedGeometry2D'}];
  const importRemainder = imports.reduce((text, match) => text.replace(match[0], ''), code);
  if (imports.length !== expectedImports.length || expectedImports.some(expected =>
      imports.filter(match => Boolean(match[1]) === expected.type && match[3] === '@egret/contracts'
        && ns1Members(match[2]) && ns1Same(ns1Members(match[2]), [expected.name])).length !== 1)
      || /\bimport\b|\bfrom\s*["']/.test(importRemainder))
    throw new Error('NS1: canonical leaf contracts import mismatch: ' + file);
  // Retained generic ambient/dependency checks run first and stay authoritative.
  if (forbidden.test(code) || /\b(?:HTMLElement|Document|Window|Navigator|NodeJS)\b/.test(code)
      || /\/\/\/\s*<reference\s+(?:lib\s*=\s*["']dom(?:\.iterable)?["']|types\s*=\s*["']node["'])/i.test(raw))
    throw new Error(file + ': host ambient dependency');
}
// This exact map is local to NS1; it uses no S3D1/MI1/BR1/BW1 namespaces.
const ns1OptionalEntries = [
  ['contracts/resources','@egret/contracts/resources','packages/contracts/src/resources/index.ts','packages/contracts/dist/resources/index'],
  ['project/resources','@egret/project/resources','packages/project/src/resources/index.ts','packages/project/dist/resources/index'],
  ['engine/resources','@egret/engine/resources','packages/engine/src/resources.ts','packages/engine/dist/resources'],
  ['engine/web/resources','@egret/engine/web/resources','packages/engine/web/resources.ts','packages/engine/dist/web/resources'],
  ['contracts', '@egret/contracts', 'packages/contracts/src/index.ts', 'packages/contracts/dist/index'],
  ['project', '@egret/project', 'packages/project/src/index.ts', 'packages/project/dist/index'],
  ['project/spine', '@egret/project/spine', 'packages/project/src/spine/index.ts', 'packages/project/dist/spine/index'],
  ['runtime/text', '@egret/runtime/text', 'packages/runtime/src/text/index.ts', 'packages/runtime/dist/text/index'],
  ['web', '@egret/engine/web', 'packages/engine/web/index.ts', 'packages/engine/dist/web/index'],
  ['webgpu', '@egret/engine/webgpu', 'packages/engine/web/webgpu.ts', 'packages/engine/dist/web/webgpu'],
  ['text', '@egret/engine/text', 'packages/engine/src/text.ts', 'packages/engine/dist/text'],
  ['web/text', '@egret/engine/web/text', 'packages/engine/web/text.ts', 'packages/engine/dist/web/text'],
  ['web/input', '@egret/engine/web/input', 'packages/engine/web/input.ts', 'packages/engine/dist/web/input'],
  ['scene3d', '@egret/engine/scene3d', 'packages/engine/rendering/scene3d.ts', 'packages/engine/dist/rendering/scene3d'],
  ['webgpu/scene3d', '@egret/engine/webgpu/scene3d', 'packages/engine/web/scene3d.ts', 'packages/engine/dist/web/scene3d'],
];
for (const [label, specifier, source, stem] of ns1OptionalEntries) {
  const values = await import(specifier);
  const code = [source, stem + '.js', stem + '.d.ts'].map(ns1Read).join('\n');
  for (const name of ns1Names) if (name in values || new RegExp('\\b' + name + '\\b').test(code))
    throw new Error('NS1: ' + label + ' root/runtime-only port leaked: ' + name);
  if (ns1ModuleReference.test(code)) throw new Error('NS1: ' + label + ' root/runtime-only leaf module leaked');
}
// NS1_END

// M15_RESOURCE_RECOVERY_BOUNDARY_BEGIN
// Additive semantic maintenance for the already selected optional assembly.
// Values continue through public entries; private product units are read as text.
const m15ResourceSurfaces = [
  ['contracts/resources','packages/contracts/src/resources/index.ts','packages/contracts/dist/resources/index',
    ['validateResourceBuildPlanDescription','evaluateResourceBuildKeys','validateResourceBuildDescription','admitResourceManifest','buildResourceManifest','serializeResourceManifest','isAdmittedResourceManifest','getResourceManifestIdentityInputs'],
    ['ResourceBuildSourceEntry','ResourceBuildPlanDescription','ResourceBuildKeyEntry','ResourceBuildKeyPlan','ResourceBuildEntry','ResourceBuildDescription','ResourceManifestEntry','AdmittedResourceManifest','ResourceManifestDiagnosticCode','ResourceManifestDiagnostic','ResourceManifestResult','ResourceManifestIdentityInputs'],
    {'./manifestAdmission.js':{value:['validateResourceBuildPlanDescription','evaluateResourceBuildKeys','validateResourceBuildDescription','admitResourceManifest','buildResourceManifest','serializeResourceManifest','isAdmittedResourceManifest','getResourceManifestIdentityInputs']},
      '../ResourceManifest.js':{type:['ResourceBuildSourceEntry','ResourceBuildPlanDescription','ResourceBuildKeyEntry','ResourceBuildKeyPlan','ResourceBuildEntry','ResourceBuildDescription','ResourceManifestEntry','AdmittedResourceManifest','ResourceManifestDiagnosticCode','ResourceManifestDiagnostic','ResourceManifestResult','ResourceManifestIdentityInputs']}}],
  ['project/resources','packages/project/src/resources/index.ts','packages/project/dist/resources/index',
    ['describeResourceBuild','parseResourceManifest','serializeResourceManifest','describeContentRecipes','bindContentArtifacts','createContentAdoption'],
    ['ResourceBuildPlanDescription','ResourceBuildDescription','ResourceBuildEntry','ResourceManifestEntry','AdmittedResourceManifest','ContentProducer','ContentOutputFile','ContentOutput','ContentBoundOutput','ContentArtifactBinding','ContentAdoptionOptions'],
    {'./manifest.js':{value:['describeResourceBuild','parseResourceManifest','serializeResourceManifest']},
      './content.js':{value:['describeContentRecipes','bindContentArtifacts','createContentAdoption'],type:['ContentProducer','ContentOutputFile','ContentOutput','ContentBoundOutput','ContentArtifactBinding','ContentAdoptionOptions']},
      '@egret/contracts/resources':{type:['ResourceBuildPlanDescription','ResourceBuildDescription','ResourceBuildEntry','ResourceManifestEntry','AdmittedResourceManifest']}}],
  ['engine/resources','packages/engine/src/resources.ts','packages/engine/dist/resources',
    ['createManifestAssetBinding','createContentLoader'],['ManifestBinding','ManifestAssetBinding','ManifestAssetGroup','ManifestGroupOptions','ContentBinding','ContentProviders','ContentProviderFactory','ContentGroup','ContentLoader'],
    {'./manifestResourceState.js':{value:['createManifestAssetBinding']},
      './contentLoader.js':{value:['createContentLoader']},
      './contentTypes.js':{type:['ContentBinding','ContentProviders','ContentProviderFactory','ContentGroup','ContentLoader']},
      './manifestResourceTypes.js':{type:['ManifestBinding','ManifestAssetBinding','ManifestAssetGroup','ManifestGroupOptions']}}],
  ['engine/web/resources','packages/engine/web/resources.ts','packages/engine/dist/web/resources',
    ['createManifestByteSource','createManifestTextureProvider','createManifestContentLoader'],['ManifestByteSource','ManifestByteSourceOptions','ManifestByteSourceStatus','ManifestTextureProvider','ManifestTextureProviderStatus','ManifestTextureProviderOptions','ManifestContentLoader'],
    {'./ManifestByteSource.js':{value:['requireManifestByteSource','createManifestByteSource'],type:['ManifestByteSource','ManifestByteSourceOptions','ManifestByteSourceStatus']},
      './BrowserTextureProvider.js':{value:['createManifestPngTextureProvider'],type:['BrowserPngPorts','ManifestTextureProvider','ManifestTextureProviderStatus']},
      '@egret/runtime':{value:['EgretError'],type:['Scope']},
      '@egret/engine':{type:['Engine']},
      '@egret/engine/resources':{value:['createContentLoader'],type:['ContentGroup','ContentLoader','ManifestGroupOptions']},
      '@egret/contracts/resources':{type:['AdmittedResourceManifest']}}],
];
for (const [entry,source,stem,values,types,rules] of m15ResourceSurfaces) {
  const namespace=m15ResourceEntries.find(row=>row[0]===entry)[1];
  if (!sceneEqual(Object.keys(namespace),values)) throw new Error('M15: exact resource runtime surface mismatch: '+entry);
  for (const file of [source,stem+'.d.ts',stem+'.js']) {
    const code=sceneRead(file),emitted=file.endsWith('.js');
    sceneSurface(code,file,values,emitted?[]:types);
    sceneClauses(code,file,rules);
    if (entry!=='engine/web/resources') {
      // These three facades are canonical re-exports, with no local substitute.
      for (const [target,ports] of Object.entries(rules)) {
        for (const name of ports.value??[]) sharedForward(code,name,false,target,file);
        if (!emitted) for (const name of ports.type??[]) sharedForward(code,name,true,target,file);
      }
      if (code.replace(/\bexport(?:\s+type)?\s*\{[^}]+\}\s*from\s*['"][^'"]+['"]\s*;?/g,'').trim())
        throw new Error('M15: resource barrel contains a local implementation: '+file);
    } else {
      sharedForward(code,'createManifestByteSource',false,'./ManifestByteSource.js',file);
      if (!emitted) {
        for (const name of ['ManifestByteSource','ManifestByteSourceOptions','ManifestByteSourceStatus']) sharedForward(code,name,true,'./ManifestByteSource.js',file);
        for (const name of ['ManifestTextureProvider','ManifestTextureProviderStatus']) sharedForward(code,name,true,'./BrowserTextureProvider.js',file);
      }
    }
    if (emitted && types.some(name=>new RegExp('\\b'+name+'\\b').test(code.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g,''))))
      throw new Error('M15: resource type runtime erasure mismatch: '+file);
  }
}
// Whole-clause multiplicity is independent of the generic per-edge admission.
for (const [file,expectedClauses] of Object.entries(m15DeepClauses)) {
  const code=sceneRead(file);
  const actual=[...code.matchAll(/\b(import|export)(\s+type)?\s*\{([^}]+)\}\s*from\s*['"](@egret\/contracts\/resources|#egret-manifest-resources|@egret\/runtime\/ui|@egret\/engine\/resources|@egret\/engine)['"]/g)]
    .map(match=>({operation:match[1],kind:match[2]?'type':'value',members:match[3].split(',').map(member=>member.trim().replace(/\s+/g,' ')).filter(Boolean),target:match[4]}));
  if (!sceneEqual(actual.map(m15ClauseKey),expectedClauses.map(m15ClauseKey)))
    throw new Error('M15: exact named resource clause mismatch: '+file);
}
// Pure metadata and the selected pure SHA unit cannot acquire browser/Node ports.
for (const file of Object.keys(m15ResourceRecoveryLiteralClosure).filter(file=>
    file.startsWith('packages/contracts/') || file.startsWith('packages/project/'))) {
  const raw=readFileSync(path.join(root,file),'utf8'),code=assetGroupStrip(raw);
  if (/\b(?:fetch|crypto|TextEncoder|TextDecoder|HTMLElement|Document|Window|Navigator|NodeJS|GPUDevice)\b/.test(code)
      || /\/\/\/\s*<reference\s+(?:lib\s*=\s*["']dom(?:\.iterable)?["']|types\s*=\s*["']node["'])/i.test(raw))
    throw new Error('M15: resource metadata acquired a host dependency: '+file);
}
const m15ErasedLeaves = [
  ['packages/contracts/src/ResourceManifest.ts','packages/contracts/dist/ResourceManifest',m15ResourceSurfaces[0][4]],
  ['packages/engine/src/manifestResourceTypes.ts','packages/engine/dist/manifestResourceTypes',['ManifestBinding','ManifestAssetBinding','ManifestAssetGroup','ManifestGroupOptions']],
  ['packages/engine/src/contentTypes.ts','packages/engine/dist/contentTypes',['ContentBinding','ContentProviders','ContentProviderFactory','ContentGroup','ContentLoader']],
  ['packages/engine/web/sharedDeviceSession.ts','packages/engine/dist/web/sharedDeviceSession',m15SessionTypes],
  ['packages/engine/web/sharedFrameUpload.ts','packages/engine/dist/web/sharedFrameUpload',m15UploadTypes],
];
for (const [source,stem,types] of m15ErasedLeaves) {
  for (const file of [source,stem+'.d.ts']) sceneSurface(sceneRead(file),file,[],types);
  if (sceneRead(stem+'.js').replace(/\s+/g,'')!=='export{};')
    throw new Error('M15: metadata type module contains runtime behavior: '+stem);
}
const m15HostFacades=['webgpu','scene3d','webgl2','webgl2Scene3d'];
for (const stem of m15HostFacades) for (const [directory,suffix] of [['web','.ts'],['dist/web','.d.ts'],['dist/web','.js']]) {
  const file='packages/engine/'+directory+'/'+stem+suffix,code=sceneRead(file);
  if (suffix==='.js') {
    if (m15SharedHostTypes.some(name=>new RegExp('\\b'+name+'\\b').test(code))
        || /['"]\.\/(?:sharedDeviceSession|sharedFrameUpload)\.js['"]/.test(code))
      throw new Error('M15: shared Host types acquired a runtime edge: '+file);
  } else {
    for (const name of m15SessionTypes) sharedForward(code,name,true,'./sharedDeviceSession.js',file);
    for (const name of m15UploadTypes) sharedForward(code,name,true,'./sharedFrameUpload.js',file);
  }
}
const m15PublicSourceFiles=[...new Set([
  ...Object.values(assetGroupSourceEntries),
  'packages/engine/src/layout.ts','packages/engine/web/text.ts','packages/engine/web/input.ts','packages/engine/web/image.ts',
  'packages/engine/rendering/scene3d.ts','packages/engine/web/scene3d.ts','packages/engine/web/webgl2.ts','packages/engine/web/webgl2Scene3d.ts',
  'packages/project/src/spine/index.ts','packages/project/src/atlas/index.ts',
])];
const m15PrivateNames=[
  'createManifestGroupOwner','ManifestGroupOwner','ManifestGroupContext','ManifestBindingState',
  'requireManifestBinding','requireManifestAssetRef','manifestBindingBrand','manifestBindingValue','manifestGroupBrand',
  'requireManifestByteSource','ManifestPngOwner','ManifestPngJob','ManifestPngProviderOptions','createManifestPngTextureProvider',
  'collectPreparedSharedFrameContent','BitmapCaptureView','sharedFrameUploadBrand',
  'SharedHostResourceCurrent','SharedPageCopyDiagnostics2D','RetentionResourceGauges','RetentionLedgerDiagnostics','NativeUnknownDiagnostics','GLNativeResourceDiagnostics',
  'ManifestByteSourceCounters','ManifestTextureProviderCounters',
];
// Preserve only the four established erased text forwards; later M15 ports stay named.
const m15RetainedTextTypeStars = {
  'packages/runtime/src/text/index.ts':'./types.js',
  'packages/runtime/dist/text/index.d.ts':'./types.js',
  'packages/engine/src/text.ts':'@egret/runtime/text',
  'packages/engine/dist/text.d.ts':'@egret/runtime/text',
};
for (const source of m15PublicSourceFiles) {
  const stem=source.replace('/src/','/dist/').replace('/web/','/dist/web/').replace('/rendering/','/dist/rendering/').replace(/\.ts$/,'');
  for (const file of [source,stem+'.js',stem+'.d.ts']) {
    const code=sceneRead(file);
    let wildcardRemainder=code;
    if (Object.hasOwn(m15RetainedTextTypeStars,file)) {
      const retained=[...code.matchAll(/\bexport\s+type\s*\*\s+from\s*['"]([^'"]+)['"]\s*;?/g)];
      if (retained.length!==1 || retained[0][1]!==m15RetainedTextTypeStars[file])
        throw new Error('M15: retained text type wildcard mismatch: '+file);
      wildcardRemainder=code.replace(retained[0][0],'');
    }
    if (/\bexport\s*(?:type\s*)?\*/.test(wildcardRemainder)) throw new Error('M15: public wildcard export forbidden: '+file);
    const exported=[...code.matchAll(/\bexport(?:\s+type)?\s*\{([^}]+)\}/g)].map(match=>match[1]).join('\n')
      + '\n' + [...code.matchAll(/\bexport\s+(?:declare\s+)?(?:type|interface|function|const|let|var|class|enum)\s+(\w+)/g)].map(match=>match[1]).join('\n');
    for (const name of m15PrivateNames) if (new RegExp('\\b'+name+'\\b').test(exported))
      throw new Error('M15: private resource/candidate authority exported: '+file+'/'+name);
    if (source!=='packages/engine/web/resources.ts' && ['ManifestByteSourceStatus','ManifestTextureProvider','ManifestTextureProviderStatus'].some(name=>new RegExp('\\b'+name+'\\b').test(exported)))
      throw new Error('M15: manifest diagnostics leaked outside the selected resource entry: '+file);
    if (!m15HostFacades.some(name=>source==='packages/engine/web/'+name+'.ts')
        && (m15SharedHostTypes.some(name=>new RegExp('\\b'+name+'\\b').test(code))
          || /['"][^'"]*\/(?:sharedDeviceSession|sharedFrameUpload)\.js['"]/.test(code)))
      throw new Error('M15: shared Host metadata leaked outside exact optional entries: '+file);
  }
}
// Ordinary PNG assembly has only an erased edge to manifest ownership.
for (const [file,names] of [
  ['packages/engine/web/BrowserTextureProvider.ts',['ManifestPngOwner','ManifestPngJob']],
  ['packages/engine/dist/web/BrowserTextureProvider.d.ts',['ManifestPngOwner']],
]) {
  const code=sceneRead(file),clauses=[...code.matchAll(/\bimport(\s+type)?\s*\{([^}]+)\}\s*from\s*['"]\.\/ManifestByteSource\.js['"]/g)];
  if (clauses.length!==1 || !clauses[0][1] || !sceneEqual(clauses[0][2].split(',').map(name=>name.trim()),names))
    throw new Error('M15: ordinary PNG manifest dependency must remain erased: '+file);
}
if (/\bManifestByteSource\b|['"]\.\/ManifestByteSource\.js['"]/.test(sceneRead('packages/engine/dist/web/BrowserTextureProvider.js')))
  throw new Error('M15: ordinary PNG runtime acquired manifest source dependency');
const m15EngineDeclaration=sceneRead('packages/engine/dist/Engine.d.ts').replace(/\s+/g,'');
for (const signature of [
  'capturePreparedSharedFrame(ticket:BitmapBindingTicket,options:SharedFrameOptions2D):SharedRenderFrame2D;',
  'createManifestGroup(scope:Scope,manifest:AdmittedResourceManifest,roots:readonlystring[],bindings:readonlyManifestBinding[],options?:ManifestGroupOptions):ManifestAssetGroup;',
]) if (m15EngineDeclaration.split(signature).length!==2)
  throw new Error('M15: exact Engine optional resource/candidate method mismatch');
for (const file of ['packages/runtime/src/sharedFrameCapture.ts','packages/runtime/dist/sharedFrameCapture.d.ts']) {
  const code=sceneRead(file);
  if (!/export\s+(?:declare\s+)?function\s+collectSharedFrameContent\s*\(\s*stage\s*:\s*Stage\s*\)\s*:\s*CapturedSharedContent2D\b/.test(code))
    throw new Error('M15: public shared traversal acquired candidate authority: '+file);
}
// M15_RESOURCE_RECOVERY_BOUNDARY_END


// M3.1 optional UI uses the existing exact surface and literal-edge mechanisms.
// Retained predecessor fixtures remove their own helpers. UI uses permanent imports only.
const uiRead=file=>readFileSync(path.join(root,file),'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'').trim();
const uiSame=(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
const uiGraphEdges=code=>[...code.matchAll(/\b(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)].map(match=>['literal',match[1]]);
const uiValues=['createUiRoot'];
const uiTypes=['LayoutNode','UiInvalidationKind','UiLimits','VirtualRecord','VirtualDataSource','RowBindContext','UiLeafPrepareContext','UiLeafContent','RowBinding','RowUnbindInfo','RowRetention','UiRowPointerNotification','UiRootOptions','UiPreparation','UiCommitResult','UiRowSnapshot','UiCounters','VirtualListSnapshot','UiSnapshot','VirtualListHandle','UiRoot'];
const runtimeUiValues=['UiHeightIndex','captureUiLayout','createUiDisplayOperations','planUiLayout'];
for(const [entry,values]of [['engine',await import('@egret/engine/ui')],['runtime',await import('@egret/runtime/ui')]])
  if(!uiSame(Object.keys(values),entry==='engine'?uiValues:runtimeUiValues))throw new Error('M3.1: exact optional UI values mismatch: '+entry);
for(const [file,typed]of [['packages/engine/src/ui/index.ts',true],['packages/engine/dist/ui/index.js',false],['packages/engine/dist/ui/index.d.ts',true]]){
  const expected="export{createUiRoot}from'./uiRoot.js';"+(typed?"exporttype{"+uiTypes.join(',')+"}from'./types.js';":'');
  if(uiRead(file).replace(/\s+/g,'').replaceAll('"',"'")!==expected)throw new Error('M3.1: exact optional UI facade mismatch: '+file);
}
for(const [label,values,stem]of textEntries){
  const declaration=uiRead(stem+'.d.ts');
  for(const name of [...uiValues,...uiTypes,...runtimeUiValues])
    if(name in values||new RegExp('\\b'+name+'\\b').test(declaration))throw new Error('M3.1: optional UI leaked outside its entry: '+label+'/'+name);
}
const uiFactoryAllowed={
  'src/Engine.ts':1,'src/pointerInput.ts':1,'src/keyboardInput.ts':1,'src/ui/uiRoot.ts':1,
  'dist/Engine.js':1,'dist/pointerInput.js':1,'dist/keyboardInput.js':1,'dist/ui/uiRoot.js':1,
};
const managedStateAllowed=['DisplayObject','DisplayObjectContainer','Scope','displayHitState','displayVisualState','paragraph/Paragraph'];
for(const pkg of ['runtime','engine'])for(const file of [...files(path.join(root,'packages',pkg,'src')),...files(path.join(root,'packages',pkg,'dist'))]){
  if(!/\.(?:ts|js)$/.test(file))continue;
  const relative=path.relative(path.join(root,'packages',pkg),file).split(path.sep).join('/'),body=uiRead('packages/'+pkg+'/'+relative);
  for(const [,target]of uiGraphEdges(body))if(target.startsWith('.')){
    const resolved=path.relative(path.join(root,'packages',pkg),path.resolve(path.dirname(file),target)).split(path.sep).join('/');
    if(pkg==='engine'&&/^(?:src|dist)\/internal\/uiFactoryState\.js$/.test(resolved)&&!Object.hasOwn(uiFactoryAllowed,relative))
      throw new Error('M3.1: private UI authority imported outside named modules: '+relative);
    if(pkg==='runtime'&&/^(?:src|dist)\/ui\//.test(resolved)&&!relative.includes('/ui/')){
      const layer=relative.startsWith('src/')?'src':'dist';
      if(resolved!==layer+'/ui/managedState.js'||!managedStateAllowed.some(name=>relative===layer+'/'+name+(layer==='src'?'.ts':'.js')))
        throw new Error('M3.1: root runtime acquired optional UI logic: '+relative);
    }
    if(pkg==='engine'&&/^(?:src|dist)\/ui\//.test(resolved)&&!relative.includes('/ui/'))
      throw new Error('M3.1: root engine acquired optional UI logic: '+relative);
  }
}
for(const file of ['packages/runtime/src/ui/managedState.ts','packages/runtime/dist/ui/managedState.js','packages/engine/src/internal/uiFactoryState.ts','packages/engine/dist/internal/uiFactoryState.js']){
  const body=uiRead(file);
  if(/\b(?:setTimeout|setInterval|queueMicrotask|requestAnimationFrame|fetch|Worker|Date|performance)\b/.test(body)||/\bimport\s*\(/.test(body))
    throw new Error('M3.1: eager UI authority acquired automatic host work: '+file);
}


// Optional sequence controls preserve the default entries and eager private bridge.
const sequenceValues=['createSequenceController'];
const sequenceTypes=["SequenceMarker","SequenceControllerOptions","SequenceControllerState","SequenceEventSource","SequenceControllerEvent","SequenceSeekRequest","SequenceControllerStatus","SequenceController"];
const sequenceFacade=await import('@egret/engine/animation');
if(!uiSame(Object.keys(sequenceFacade),sequenceValues))throw new Error('M2.2: exact optional sequence values mismatch');
for(const [file,typed]of [['packages/engine/src/animation/index.ts',true],['packages/engine/dist/animation/index.js',false],['packages/engine/dist/animation/index.d.ts',true]]){
 const expected="export{createSequenceController}from'./sequenceController.js';"+(typed?"exporttype{"+sequenceTypes.join(',')+"}from'./types.js';":'');
 if(uiRead(file).replace(/\s+/g,'').replaceAll('"',"'")!==expected)throw new Error('M2.2: exact optional sequence facade mismatch: '+file);
}
if(Object.keys(await import('./../packages/engine/dist/animation/types.js')).length!==0)throw new Error('M2.2: sequence types acquired runtime values');
const sequencePrivate=['SequenceTargetClaims','createSequenceTargetClaims','SequenceScopePort','SequenceControllerEnginePort','SequenceControllerEngineOwner','registerSequenceControllerEngine','requireSequenceControllerEngine','SequenceCoordinator','getSequenceCoordinator'];
for(const [label,values,stem]of [...textEntries,['engine/ui',await import('@egret/engine/ui'),'packages/engine/dist/ui/index']]){
 const declaration=uiRead(stem+'.d.ts');
 for(const name of [...sequenceValues,...sequenceTypes,...sequencePrivate])if(name in values||new RegExp('\\b'+name+'\\b').test(declaration))throw new Error('M2.2: sequence authority leaked outside optional entry: '+label+'/'+name);
}
for(const name of sequencePrivate)if(name in sequenceFacade||new RegExp('\\b'+name+'\\b').test(uiRead('packages/engine/dist/animation/index.d.ts')))throw new Error('M2.2: private sequence authority leaked: '+name);
const sequenceFactoryImporters=new Set(['src/Engine.ts','dist/Engine.js','src/animation/sequenceController.ts','dist/animation/sequenceController.js','src/animation/sequenceCoordinator.ts','dist/animation/sequenceCoordinator.js','dist/animation/sequenceCoordinator.d.ts']);
const sequenceClaimImporters=new Set(['src/Engine.ts','dist/Engine.js','src/sequencePlayback.ts','dist/sequencePlayback.d.ts','src/internal/sequenceControllerFactoryState.ts','dist/internal/sequenceControllerFactoryState.d.ts']);
for(const file of [...files(path.join(root,'packages/engine/src')),...files(path.join(root,'packages/engine/dist'))]){
 if(!/\.(?:ts|js)$/.test(file))continue;
 const relative=path.relative(path.join(root,'packages/engine'),file).split(path.sep).join('/');
 for(const [,target]of uiGraphEdges(uiRead('packages/engine/'+relative)))if(target.startsWith('.')){
  const resolved=path.relative(path.join(root,'packages/engine'),path.resolve(path.dirname(file),target)).split(path.sep).join('/');
  if(/^(?:src|dist)\/animation\//.test(resolved)&&!relative.includes('/animation/'))throw new Error('M2.2: default engine acquired optional sequence logic: '+relative);
  if(/^(?:src|dist)\/internal\/sequenceControllerFactoryState\.js$/.test(resolved)&&!sequenceFactoryImporters.has(relative))throw new Error('M2.2: private sequence factory imported outside named modules: '+relative);
  if(/^(?:src|dist)\/sequenceTargetClaims\.js$/.test(resolved)&&!sequenceClaimImporters.has(relative))throw new Error('M2.2: private sequence claims imported outside named modules: '+relative);
 }
}
for(const file of ['packages/engine/src/sequenceTargetClaims.ts','packages/engine/dist/sequenceTargetClaims.js','packages/engine/src/internal/sequenceControllerFactoryState.ts','packages/engine/dist/internal/sequenceControllerFactoryState.js',...Object.keys(m22SequenceLiteralClosure).filter(file=>file.includes('/animation/'))]){
 if(/\b(?:setTimeout|setInterval|queueMicrotask|requestAnimationFrame|fetch|Worker|Date|performance)\b/.test(uiRead(file))||/\bimport\s*\(/.test(uiRead(file)))throw new Error('M2.2: sequence controller acquired automatic host work: '+file);
}

// M3.3 keyboard is an exact opt-in graph sharing the eagerly authenticated
// Engine/Scope and UI delivery authorities; default entries never load it.
const keyboardGraph={
 'src/keyboardInput.ts':['./internal/mouseInputFactoryState.js','./internal/uiFactoryState.js','./keyboardInputTypes.js','./keyboardInputTypes.js','./mouseInput.js','@egret/runtime','@egret/runtime'],
 'src/keyboardInputTypes.ts':['./Engine.js','@egret/runtime'],
 'src/input.ts':['./keyboardInput.js','./keyboardInputTypes.js','./pointerInput.js','./pointerInputTypes.js'],
 'web/BrowserKeyboardInput.ts':['#egret-keyboard-input','#egret-keyboard-input','@egret/runtime'],
 'web/keyboard.ts':['#egret-keyboard-input','./BrowserKeyboardInput.js'],
 'dist/keyboardInput.js':['./internal/mouseInputFactoryState.js','./internal/uiFactoryState.js','@egret/runtime'],
 'dist/keyboardInput.d.ts':['./keyboardInputTypes.js','./keyboardInputTypes.js'],
 'dist/keyboardInputTypes.d.ts':['./Engine.js','@egret/runtime'],
 'dist/input.js':['./keyboardInput.js','./pointerInput.js'],
 'dist/input.d.ts':['./keyboardInput.js','./keyboardInputTypes.js','./pointerInput.js','./pointerInputTypes.js'],
 'dist/web/BrowserKeyboardInput.js':['#egret-keyboard-input','@egret/runtime'],
 'dist/web/BrowserKeyboardInput.d.ts':['#egret-keyboard-input'],
 'dist/web/keyboard.js':['./BrowserKeyboardInput.js'],
 'dist/web/keyboard.d.ts':['#egret-keyboard-input','./BrowserKeyboardInput.js'],
};
for(const [file,expected] of Object.entries(keyboardGraph)){
 const body=uiRead('packages/engine/'+file),observed=uiGraphEdges(body).map(([,target])=>target).sort();
 if(JSON.stringify(observed)!==JSON.stringify(expected)||/\bimport\s*\(/.test(body))throw new Error('M3.3: exact keyboard graph mismatch: '+file);
 if(/\b(?:setTimeout|setInterval|queueMicrotask|requestAnimationFrame|fetch|Worker|Date|performance)\b/.test(body))throw new Error('M3.3: keyboard acquired automatic host work: '+file);
}
const keyboardTypes=['KeyboardSample','KeyboardCancelReason','KeyboardKeyPayload','KeyboardCancelPayload','KeyboardFocusPayload','KeyboardFocusChange','KeyboardInputOptions','KeyboardTargetOptions','KeyboardTargetRegistration','KeyboardInputSnapshot','KeyboardInputEvents','KeyboardFocusOptions','KeyboardInput'];
for(const [file,typed] of [['packages/engine/web/keyboard.ts',true],['packages/engine/dist/web/keyboard.js',false],['packages/engine/dist/web/keyboard.d.ts',true]]){
 const surface=mouseExports(uiRead(file),file);
 if(!mouseSame(surface.values,['createBrowserKeyboardInput'])||!mouseSame(surface.types,typed?keyboardTypes:[]))throw new Error('M3.3: exact browser keyboard exports mismatch: '+file);
}
if(!mouseSame(Object.keys(await import('@egret/engine/input')),['createPointerInput','createKeyboardInput'])||!mouseSame(Object.keys(await import('@egret/engine/web/keyboard')),['createBrowserKeyboardInput']))throw new Error('M3.3: optional keyboard runtime values mismatch');
for(const [label,values,stem] of textEntries){
 const body=uiRead(stem+'.d.ts');
 for(const name of [...keyboardTypes,'createKeyboardInput','createBrowserKeyboardInput','bindKeyboardSurface','captureMouseInputRuntimePrimitives'])if(name in values||new RegExp('\\b'+name+'\\b').test(body))throw new Error('M3.3: keyboard leaked to default/other entry: '+label+'/'+name);
}
const keyboardAllowed={
 'src/keyboardInput.js':['src/input.ts'],'dist/keyboardInput.js':['dist/input.js','dist/input.d.ts'],
 'src/keyboardInputTypes.js':['src/keyboardInput.ts','src/input.ts'],'dist/keyboardInputTypes.js':['dist/keyboardInput.d.ts','dist/input.d.ts'],
 'web/BrowserKeyboardInput.js':['web/keyboard.ts'],'dist/web/BrowserKeyboardInput.js':['dist/web/keyboard.js','dist/web/keyboard.d.ts'],
};
for(const file of [...files(path.join(root,'packages/engine/src')),...files(path.join(root,'packages/engine/web')),...files(path.join(root,'packages/engine/dist'))]){
 if(!/\.(?:ts|js)$/.test(file))continue;const relative=path.relative(path.join(root,'packages/engine'),file).split(path.sep).join('/');
 for(const [,target] of uiGraphEdges(uiRead('packages/engine/'+relative)))if(target.startsWith('.')){
  const resolved=path.relative(path.join(root,'packages/engine'),path.resolve(path.dirname(file),target)).split(path.sep).join('/');
  if(Object.hasOwn(keyboardAllowed,resolved)&&!keyboardAllowed[resolved].includes(relative))throw new Error('M3.3: keyboard private target escaped its exact optional owners: '+relative);
 }
}
if(!/const primitives=captureMouseInputRuntimePrimitives\(\)/.test(uiRead('packages/engine/src/keyboardInput.ts'))||!/const INPUT_PARENT = Object.getOwnPropertyDescriptor\(DisplayObject.prototype, 'parent'\)/.test(uiRead('packages/engine/src/internal/mouseInputFactoryState.ts')))throw new Error('M3.3: original eager display admission capture missing');
console.log(`Boundary check PASS: four private workspace packages, actual exports resolution, ${inspected} source/build/declaration files, DOM-free core and exact DOM-only web subtree without Node imports/globals.`);
