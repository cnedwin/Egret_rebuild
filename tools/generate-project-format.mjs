import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// This closed generator owns neither validation policy nor a second field table.
const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const check = args.includes('--check');
const rootIndex = args.indexOf('--root');
const base = rootIndex === -1 ? root : path.resolve(args[rootIndex + 1] ?? '');
if (args.some((arg, index) => arg !== '--check' && arg !== '--root' && !(rootIndex !== -1 && index === rootIndex + 1))) throw Error('Unknown generator argument');
if (rootIndex !== -1 && (!args[rootIndex + 1] || args[rootIndex + 1].startsWith('--'))) throw Error('Missing generator root');
const source = readFileSync(path.join(base, 'packages/contracts/schema/project-format.schema.json'), 'utf8');
const schema = JSON.parse(source);
const keywords = new Set(['$defs', '$ref', 'type', 'const', 'enum', 'oneOf', 'properties', 'required', 'additionalProperties', 'items', 'x-ts-name', 'x-ts-brand', 'x-project-check']);
const checks = ['fixed-version', 'project-id', 'entity-id', 'file-id', 'transaction-id', 'path', 'safe-integer'];
const types = ['null', 'boolean', 'number', 'string', 'array', 'object'];
const defs = schema.$defs;
const identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
const escapePointer = (value) => value.replace(/~/g, '~0').replace(/\//g, '~1');
function requireCondition(value, message) { if (!value) throw Error(message); }
function validate(node, pointer, top = false) {
  requireCondition(node && typeof node === 'object' && !Array.isArray(node), `${pointer}: object schema required`);
  for (const key of Object.keys(node)) requireCondition(keywords.has(key), `${pointer}: unknown keyword ${key}`);
  if (top) {
    requireCondition(Object.keys(node).length === 1 && Object.hasOwn(node, '$defs'), 'Root must contain only $defs');
    requireCondition(defs && typeof defs === 'object' && !Array.isArray(defs), '$defs required');
    for (const [name, child] of Object.entries(defs)) {
      requireCondition(identifier.test(name) && child['x-ts-name'] === name, `Invalid definition name ${name}`);
      validate(child, `#/$defs/${escapePointer(name)}`);
    }
    return;
  }
  requireCondition(!Object.hasOwn(node, '$defs'), `${pointer}: nested $defs unsupported`);
  if (Object.hasOwn(node, 'x-ts-name')) requireCondition(typeof node['x-ts-name'] === 'string' && identifier.test(node['x-ts-name']), `${pointer}: invalid x-ts-name`);
  if (Object.hasOwn(node, 'x-ts-brand')) requireCondition(node.type === 'string' && typeof node['x-ts-brand'] === 'string' && identifier.test(node['x-ts-brand']), `${pointer}: invalid brand`);
  if (Object.hasOwn(node, 'x-project-check')) requireCondition(checks.includes(node['x-project-check']), `${pointer}: unknown project check`);
  const forms = Number(Object.hasOwn(node, '$ref')) + Number(Object.hasOwn(node, 'oneOf')) + Number(Object.hasOwn(node, 'type'));
  requireCondition(forms === 1, `${pointer}: exactly one structural form required`);
  if (node.$ref !== undefined) {
    requireCondition(typeof node.$ref === 'string' && node.$ref.startsWith('#/$defs/') && Object.hasOwn(defs, node.$ref.slice(8)), `${pointer}: unknown ref`);
    requireCondition(Object.keys(node).every(key => ['$ref', 'x-ts-name', 'x-project-check'].includes(key)), `${pointer}: incompatible ref keyword`);
  } else if (node.oneOf !== undefined) {
    requireCondition(Array.isArray(node.oneOf) && node.oneOf.length > 0, `${pointer}: empty union`);
    requireCondition(Object.keys(node).every(key => ['oneOf', 'x-ts-name', 'x-project-check'].includes(key)), `${pointer}: incompatible union keyword`);
    node.oneOf.forEach((child, index) => validate(child, `${pointer}/oneOf/${index}`));
  } else {
    requireCondition(types.includes(node.type), `${pointer}: unknown structural type`);
    const permitted = ['type', 'x-ts-name', 'x-ts-brand', 'x-project-check', 'const', 'enum', ...(node.type === 'object' ? ['properties', 'required', 'additionalProperties'] : []), ...(node.type === 'array' ? ['items'] : [])];
    requireCondition(Object.keys(node).every(key => permitted.includes(key)), `${pointer}: incompatible type keyword`);
    if (Object.hasOwn(node, 'const')) requireCondition(['string', 'number', 'boolean'].includes(node.type) && typeof node.const === node.type, `${pointer}: incompatible const`);
    if (Object.hasOwn(node, 'enum')) requireCondition(!Object.hasOwn(node, 'const') && Array.isArray(node.enum) && node.enum.length > 0 && new Set(node.enum).size === node.enum.length && node.enum.every(value => typeof value === node.type), `${pointer}: incompatible enum`);
    if (node.type === 'array') validate(node.items, `${pointer}/items`);
    if (node.type === 'object') {
      if (node.properties !== undefined) {
        requireCondition(node.properties && typeof node.properties === 'object' && !Array.isArray(node.properties) && Array.isArray(node.required) && new Set(node.required).size === node.required.length && node.required.every(name => Object.hasOwn(node.properties, name)) && node.additionalProperties === false, `${pointer}: closed object vocabulary required`);
        for (const [name, child] of Object.entries(node.properties)) validate(child, `${pointer}/properties/${escapePointer(name)}`);
      } else {
        requireCondition(node.required === undefined, `${pointer}: dictionary cannot have required`);
        validate(node.additionalProperties, `${pointer}/additionalProperties`);
      }
    }
  }
  if (node['x-project-check'] === 'safe-integer') requireCondition(node.type === 'number' || node.$ref, `${pointer}: safe integers must use structural numbers`);
  if (node['x-project-check'] === 'fixed-version') requireCondition(node.type === 'string' && typeof node.const === 'string', `${pointer}: fixed versions require a string const`);
}
validate(schema, '#', true);
const brands = Object.values(defs).flatMap(node => node['x-ts-brand'] ? [node['x-ts-brand']] : []);
requireCondition(new Set(brands).size === brands.length, 'Duplicate brand');
function ts(node) {
  if (node.$ref) return defs[node.$ref.slice(8)]['x-ts-name'];
  if (node['x-ts-brand']) return `string & { readonly [${node['x-ts-brand']}]: true }`;
  if (Object.hasOwn(node, 'const')) return JSON.stringify(node.const);
  if (node.enum) return node.enum.map(value => JSON.stringify(value)).join(' | ');
  if (node.oneOf) return node.oneOf.map(ts).join(' | ');
  if (node.type === 'array') {
    const item = ts(node.items);
    return `readonly ${node.items.oneOf || node.items.enum ? `(${item})` : item}[]`;
  }
  if (node.type === 'object') {
    if (!node.properties) return `{ readonly [key: string]: ${ts(node.additionalProperties)} }`;
    return `{ ${Object.entries(node.properties).map(([name, child]) => `readonly ${identifier.test(name) ? name : JSON.stringify(name)}${node.required.includes(name) ? '' : '?'}: ${ts(child)}`).join('; ')} }`;
  }
  return node.type;
}
const header = `// Generated from project-format.schema.json; source-sha256: ${createHash('sha256').update(source).digest('hex')}\n// DO NOT EDIT. Run node tools/generate-project-format.mjs.\n\n`;
const declarations = brands.map(name => `declare const ${name}: unique symbol;`).join('\n') + '\n\n' + Object.entries(defs).map(([name, node]) => {
  if (node.type === 'object' && node.properties) return `export interface ${name} {\n${Object.entries(node.properties).map(([field, child]) => `  readonly ${identifier.test(field) ? field : JSON.stringify(field)}${node.required.includes(field) ? '' : '?'}: ${ts(child)};`).join('\n')}\n}`;
  return `export type ${name} = ${ts(node)};`;
}).join('\n\n') + '\n';
function descriptor(node, pointer) {
  const result = { schemaPointer: pointer };
  if (node.$ref) result.ref = node.$ref.slice(8);
  if (node.type) result.type = node.type;
  if (Object.hasOwn(node, 'const')) result.const = node.const;
  if (node.enum) result.enum = node.enum;
  if (node['x-project-check']) result.projectCheck = node['x-project-check'];
  if (node.oneOf) result.oneOf = node.oneOf.map((child, index) => descriptor(child, `${pointer}/oneOf/${index}`));
  if (node.items) result.items = descriptor(node.items, `${pointer}/items`);
  if (node.properties) {
    result.properties = Object.entries(node.properties).map(([name, child]) => ({ name, required: node.required.includes(name), node: descriptor(child, `${pointer}/properties/${escapePointer(name)}`) }));
    result.required = node.required;
  }
  if (Object.hasOwn(node, 'additionalProperties')) result.additionalProperties = node.additionalProperties === false ? false : descriptor(node.additionalProperties, `${pointer}/additionalProperties`);
  return result;
}
const descriptorTypes = `export type ProjectCheck = ${checks.map(JSON.stringify).join(' | ')};\nexport interface FormatNode {\n  readonly schemaPointer: string;\n  readonly ref?: string;\n  readonly type?: "null" | "boolean" | "number" | "string" | "array" | "object";\n  readonly const?: string | number | boolean;\n  readonly enum?: readonly (string | number | boolean)[];\n  readonly projectCheck?: ProjectCheck;\n  readonly oneOf?: readonly FormatNode[];\n  readonly items?: FormatNode;\n  readonly properties?: readonly { readonly name: string; readonly required: boolean; readonly node: FormatNode }[];\n  readonly required?: readonly string[];\n  readonly additionalProperties?: false | FormatNode;\n}\n\n`;
const nodes = Object.fromEntries(Object.entries(defs).map(([name, node]) => [name, descriptor(node, `#/$defs/${escapePointer(name)}`)]));
const outputs = {
  'packages/contracts/src/ProjectFormat.generated.ts': header + declarations,
  'packages/project/src/format-shape.generated.ts': header + descriptorTypes + `export const FORMAT_DEFINITIONS = ${JSON.stringify(nodes, null, 2)} as const satisfies Readonly<Record<string, FormatNode>>;\n`,
};
for (const [relative, output] of Object.entries(outputs)) {
  const destination = path.join(base, relative);
  if (check) {
    let current;
    try { current = readFileSync(destination, 'utf8'); } catch { throw Error(`Missing generated format: ${relative}`); }
    if (current !== output) throw Error(`Generated format drift: ${relative}`);
  } else {
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, output);
  }
}
console.log(`Project format ${check ? 'check' : 'generation'} PASS (${Object.keys(defs).length} definitions).`);
