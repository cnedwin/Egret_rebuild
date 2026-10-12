// SPDX-License-Identifier: Apache-2.0
// Development-only structural checks use installed TS7.0.2 unstable public APIs, never a product parser.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { version } from 'typescript';
import { API } from 'typescript/unstable/sync';
import { SyntaxKind as K } from 'typescript/unstable/ast';

const modules = ['index.ts', 'source-plan.ts', 'source-view.ts', 'profile-plan.ts', 'profile-source.ts'];
const types = ['F2MeshSourceDiagnosticCode', 'F2MeshSourceDiagnostic', 'F2MeshSourceSummary',
  'F2SetupReference', 'F2MeshSourcePlan', 'F2MeshSourceResult', 'F2MeshProfileDiagnosticCode',
  'F2MeshProfileDiagnostic', 'F2MeshProfilePlan', 'F2MeshProfileResult'].sort();
const experiment = 'knowledge-base/experiments/spine-f2';
const fail = reason => { throw new Error('F2_BOUNDARY_' + reason); };
const plain = value => value !== null && typeof value === 'object'
  && Object.getPrototypeOf(value) === Object.prototype && !Array.isArray(value);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const key = file => path.resolve(file).replaceAll('\\', '/').toLowerCase();

export function readF2SourceInput(root) {
  root = path.resolve(root);
  const directory = path.join(root, experiment);
  return { root,
    sources: Object.fromEntries(modules.map(name => [name, fs.readFileSync(path.join(directory, 'src', name), 'utf8')])),
    config: JSON.parse(fs.readFileSync(path.join(directory, 'tsconfig.json'), 'utf8')),
    rootPackage: JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) };
}

function configuration(input) {
  if (!plain(input) || typeof input.root !== 'string' || !path.isAbsolute(input.root)
    || !plain(input.sources) || !equal(Object.keys(input.sources).sort(), [...modules].sort())
    || modules.some(name => typeof input.sources[name] !== 'string')) fail('INPUT');
  if (!plain(input.config) || !equal(Object.keys(input.config).sort(), ['compilerOptions', 'include'])
    || !plain(input.config.compilerOptions) || !equal(input.config.include, ['src/index.ts'])) fail('CONFIG');
  const required = { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext',
    lib: ['ES2022'], types: [], strict: true, noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true, verbatimModuleSyntax: true, noImplicitOverride: true,
    noEmitOnError: true, declaration: true, rootDir: 'src', outDir: 'dist' };
  const actual = input.config.compilerOptions;
  if (!equal(Object.keys(actual).sort(), Object.keys(required).sort())
    || Object.entries(required).some(([name, value]) => !equal(actual[name], value))) fail('CONFIG');
  if (!plain(input.rootPackage) || input.rootPackage.type !== 'module'
    || input.rootPackage.devDependencies?.['jsonc-parser'] !== '3.3.1'
    || input.rootPackage.devDependencies?.typescript !== '7.0.2') fail('DEPENDENCY');
  if (version !== '7.0.2') fail('COMPILER_VERSION');
}

const expectedImports = {
  'index.ts': [],
  'source-plan.ts': [
    ['@egret/project/spine', 'value', ['createSpineImportPlan', 'SPINE_IMPORT_LIMITS']],
    ['@egret/project/spine', 'type', ['SpineImportInput', 'SpineImportPlan', 'SpineImportDiagnostic',
      'SpineSourceSpan', 'SpineProvenance', 'SpineTextSource', 'SpinePageBinding']],
    ['./source-view.js', 'value', ['createSourceView', 'sourceProperty']],
    ['./source-view.js', 'type', ['SourceNode']],
  ],
  'source-view.ts': [
    ['jsonc-parser', 'value', ['visit']],
    ['jsonc-parser', 'type', ['JSONPath', 'JSONVisitor']],
    ['@egret/project/spine', 'type', ['SPINE_IMPORT_LIMITS', 'SpineSourceSpan']],
  ],
  'profile-plan.ts': [
    ['@egret/project/spine', 'type', ['SpineImportInput', 'SpineImportDiagnostic', 'SpineSourceSpan']],
    ['./source-plan.js', 'value', ['prepareF2MeshSource']],
    ['./source-plan.js', 'type', ['F2MeshSourcePlan', 'F2MeshSourceResult']],
    ['./profile-source.js', 'value', ['qualifyF2Profile', 'createProfileInternalDiagnostic']],
  ],
  'profile-source.ts': [
    ['@egret/project/spine', 'type', ['SpineSourceSpan']],
    ['./source-plan.js', 'type', ['F2MeshSourcePlan']],
    ['./profile-plan.js', 'type', ['F2MeshProfileDiagnostic', 'F2MeshProfileDiagnosticCode', 'F2MeshProfilePlan']],
    ['./source-view.js', 'value', ['sourceProperty']],
    ['./source-view.js', 'type', ['SourceNode']],
  ],
};
const normalizedImports = rows => rows.map(([route, phase, names]) =>
  JSON.stringify([route, phase, [...names].sort()])).sort();
const nameOf = node => node?.kind === K.Identifier || node?.kind === K.StringLiteral ? node.text : undefined;
const visit = (node, callback) => {
  callback(node);
  node.forEachChild(child => { visit(child, callback); });
};

function imports(file, module) {
  const rows = [];
  visit(file, node => {
    if (node.kind === K.ImportEqualsDeclaration || node.kind === K.ImportType) fail('IMPORT');
    if (node.kind !== K.ImportDeclaration) return;
    const route = node.moduleSpecifier?.kind === K.StringLiteral ? node.moduleSpecifier.text : undefined;
    const clause = node.importClause;
    if (route === undefined || node.attributes !== undefined || clause === undefined
      || clause.name !== undefined || clause.namedBindings?.kind !== K.NamedImports
      || clause.namedBindings.elements.length === 0) fail('IMPORT');
    // TS7 represents import type with phaseModifier, not the old ImportClause.isTypeOnly field.
    const typeOnly = clause.phaseModifier === K.TypeKeyword;
    if (clause.phaseModifier !== undefined && !typeOnly) fail('IMPORT');
    const names = clause.namedBindings.elements.map(element => {
      if (element.propertyName !== undefined || element.isTypeOnly && !typeOnly) fail('IMPORT');
      const name = nameOf(element.name);
      if (name === undefined) fail('IMPORT');
      return name;
    });
    if (new Set(names).size !== names.length) fail('IMPORT');
    rows.push([route, typeOnly ? 'type' : 'value', names]);
  });
  if (!equal(normalizedImports(rows), normalizedImports(expectedImports[module]))) fail('IMPORT');
  // No re-export edge outside the single experimental entry is admitted.
  if (module !== 'index.ts') visit(file, node => {
    if (node.kind === K.ExportDeclaration && node.moduleSpecifier !== undefined) fail('IMPORT');
  });
  return rows;
}

function entry(file) {
  const values = [], erased = [], edges = [];
  // Every public name belongs to its specified module and erasure phase.
  const routes = new Map([
    ['./source-plan.js', { values: ['createF2MeshSourcePlan'], types: types.filter(name => !name.startsWith('F2MeshProfile')) }],
    ['./profile-plan.js', { values: ['createF2MeshProfilePlan'], types: types.filter(name => name.startsWith('F2MeshProfile')) }],
  ]);
  for (const node of file.statements) {
    if (node.kind !== K.ExportDeclaration || node.moduleSpecifier?.kind !== K.StringLiteral
      || node.attributes !== undefined || node.exportClause?.kind !== K.NamedExports) fail('ENTRY');
    const allowed = routes.get(node.moduleSpecifier.text);
    if (allowed === undefined) fail('ENTRY');
    edges.push({ file: 'index.ts', route: node.moduleSpecifier.text, phase: node.isTypeOnly ? 'type' : 'value' });
    for (const element of node.exportClause.elements) {
      if (element.propertyName !== undefined || element.isTypeOnly && !node.isTypeOnly) fail('ENTRY');
      const name = nameOf(element.name);
      if (name === undefined || !(node.isTypeOnly ? allowed.types : allowed.values).includes(name)) fail('ENTRY');
      (node.isTypeOnly ? erased : values).push(name);
    }
  }
  if (!equal(values.sort(), ['createF2MeshProfilePlan', 'createF2MeshSourcePlan']) || !equal(erased.sort(), types)) fail('ENTRY');
  return edges;
}

function execution(file) {
  const narrowing = new Set(['Float16Array', 'Float32Array', 'Float64Array', 'Int8Array', 'Uint8Array',
    'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'BigInt64Array', 'BigUint64Array']);
  const host = new Set(['globalThis', 'global', 'self', 'window', 'document', 'navigator', 'process', 'Buffer', 'XMLHttpRequest',
    'fetch', 'Worker', 'HTMLElement', 'HTMLCanvasElement', 'GPUDevice']);
  visit(file, node => {
    if (node.kind === K.Identifier && narrowing.has(node.text)) fail('NARROWING');
    if (node.kind === K.Identifier && host.has(node.text)) fail('AMBIENT');
    // Refuse aliases of these execution facilities as well as direct calls.
    if (node.kind === K.Identifier && ['require', 'eval', 'Function', 'JSON'].includes(node.text)) fail('EXECUTION');
    if (node.kind === K.CallExpression && node.expression.kind === K.ImportKeyword) fail('EXECUTION');
    if (node.kind === K.PropertyAccessExpression && node.name.text === 'constructor'
      || node.kind === K.ElementAccessExpression && node.argumentExpression?.kind === K.StringLiteral
        && node.argumentExpression.text === 'constructor') fail('EXECUTION');
    if (node.modifiers?.some(modifier => modifier.kind === K.DeclareKeyword)
      || node.kind === K.ModuleDeclaration) fail('AMBIENT');
  });
}

export function checkF2SourceBoundary(input) {
  configuration(input);
  const root = path.resolve(input.root), directory = path.join(root, experiment);
  const configFile = path.join(directory, 'tsconfig.json');
  const overlay = new Map([[key(configFile), JSON.stringify(input.config)],
    ...modules.map(name => [key(path.join(directory, 'src', name)), input.sources[name]])]);
  // Only the exact ordinary experiment inputs are overlaid. All SDK/dependency
  // files use the real installed filesystem; no synthetic package or product graph is supplied.
  const api = new API({ cwd: root, fs: {
    readFile: file => overlay.get(key(file)),
    fileExists: file => overlay.has(key(file)) ? true : undefined,
  } });
  let snapshot;
  try {
    snapshot = api.updateSnapshot({ openProjects: [configFile] });
    const project = snapshot.getProject(configFile);
    if (project === undefined) fail('AST_SETUP');
    const files = new Map();
    for (const name of modules) {
      const filename = path.join(directory, 'src', name);
      const file = project.program.getSourceFile(filename);
      if (file === undefined || file.text !== input.sources[name]) fail('AST_SOURCE');
      if (project.program.getSyntacticDiagnostics(filename).length !== 0) fail('SYNTAX');
      if (file.referencedFiles.length !== 0 || file.typeReferenceDirectives.length !== 0
        || file.libReferenceDirectives.length !== 0) fail('AMBIENT');
      files.set(name, file);
    }
    const graph = modules.flatMap(name => imports(files.get(name), name).map(row => ({ file: name, route: row[0], phase: row[1] })));
    for (const name of modules) execution(files.get(name));
    graph.push(...entry(files.get('index.ts')));
    const sourcePins = modules.map(name => ({ file: name,
      sha256: createHash('sha256').update(input.sources[name]).digest('hex') }));
    return { status: 'F2_SOURCE_BOUNDARY_PASS', compilerVersion: version, sourcePins,
      publicValues: 2, publicTypes: types.length, modules: modules.length, graph,
      scope: 'Source AST/configuration/declared dependency only; no product execution or rendering acceptance.' };
  } finally {
    try { snapshot?.dispose(); } finally { api.close(); }
  }
}
