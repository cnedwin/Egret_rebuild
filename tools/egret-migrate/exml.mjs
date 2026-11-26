// SPDX-License-Identifier: Apache-2.0
import { logicalPath } from '../lib/file-identity.mjs';

const euiNamespace = 'http://ns.egret.com/eui';
const wingNamespace = 'http://ns.egret.com/wing';
const controls = new Set(['Skin', 'Group', 'Image', 'Label', 'Rect', 'Button', 'Component']);
const layouts = new Set(['BasicLayout', 'HorizontalLayout', 'VerticalLayout']);
const containers = new Set(['Skin', 'Group', 'Component']);
const fields = source => new Set(source.split(' '));
const commonNumbers = fields(
  'x y width height minWidth minHeight maxWidth maxHeight left right top bottom horizontalCenter verticalCenter percentWidth percentHeight anchorOffsetX anchorOffsetY scaleX scaleY rotation alpha'
);
const commonBooleans = fields('visible touchEnabled touchChildren includeInLayout');
const commonStrings = fields('id name');
const skinNumbers = fields('width height minWidth minHeight maxWidth maxHeight');
const nonnegativeNumbers = fields(
  'width height minWidth minHeight maxWidth maxHeight percentWidth percentHeight size strokeWeight ellipseWidth ellipseHeight paddingLeft paddingRight paddingTop paddingBottom'
);
const controlNumbers = {
  Label: fields('size'),
  Rect: fields('fillAlpha strokeAlpha strokeWeight ellipseWidth ellipseHeight')
};
const controlBooleans = {
  Label: fields('bold italic'),
  Button: fields('enabled'),
  Component: fields('enabled'),
  Group: fields('enabled'),
  Rect: fields('enabled')
};
const controlStrings = {
  Image: fields('source'),
  Label: fields('text fontFamily textAlign verticalAlign'),
  Button: fields('label skinName'),
  Component: fields('skinName')
};
const controlColors = { Label: fields('textColor'), Rect: fields('fillColor strokeColor') };
const layoutNumbers = fields('gap paddingLeft paddingRight paddingTop paddingBottom');
const layoutStrings = fields('horizontalAlign verticalAlign');
const alignments = {
  horizontalAlign: fields('left center right'),
  verticalAlign: fields('top middle bottom'),
  textAlign: fields('left center right')
};
const identifier = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/;
const forbiddenIdentifiers = new Set(['constructor', 'prototype', '__proto__']);

function fail(code, message, details) {
  throw Object.assign(new Error(message), { code, details });
}

function exmlFailure(path, offset, message, extra = {}) {
  fail('MIGRATE_EXML_UNSUPPORTED', message, { path, offset, ...extra });
}

function themeFailure(path, message, extra = {}) {
  fail('MIGRATE_THEME_UNSUPPORTED', message, { path, ...extra });
}

function isIdentifier(value) {
  return (
    typeof value === 'string' &&
    identifier.test(value) &&
    value.split('.').every(part => !forbiddenIdentifiers.has(part))
  );
}

function charAllowed(code) {
  return (
    code === 0x9 ||
    code === 0xa ||
    code === 0xd ||
    (code >= 0x20 && code <= 0xd7ff) ||
    (code >= 0xe000 && code <= 0xfffd) ||
    (code >= 0x10000 && code <= 0x10ffff)
  );
}

function attributesValue(raw, path, offset) {
  const names = { amp: '&', apos: "'", quot: '"', lt: '<', gt: '>' };
  if (raw.includes('<') || [...raw].some(char => !charAllowed(char.codePointAt(0))))
    exmlFailure(path, offset, 'Invalid XML attribute characters.');
  return raw.replace(/[\t\r\n]/g, ' ').replace(/&(?:([^&;\s]+);)?/g, (_, entity) => {
    if (Object.hasOwn(names, entity)) return names[entity];
    if (typeof entity === 'string' && /^#(?:[0-9]+|x[0-9a-fA-F]+)$/.test(entity)) {
      const code = entity[1] === 'x' ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      if (charAllowed(code)) return String.fromCodePoint(code);
    }
    exmlFailure(path, offset, 'Only predefined or numeric XML entities are admitted.');
  });
}

/** Read a bounded XML tree without a DOM, DTD, entity definitions, or executable expressions. */
function readXml(source, path) {
  if (typeof source !== 'string' || Buffer.byteLength(source, 'utf8') > 1024 * 1024)
    exmlFailure(path, 0, 'EXML must be text no larger than one MiB.');
  const text = source.startsWith('\uFEFF') ? source.slice(1) : source;
  const namePattern = /[A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?/y;
  const spacePattern = /[\t\r\n ]*/y;
  const stack = [];
  let root;
  let cursor = 0;
  let count = 0;

  function readName() {
    namePattern.lastIndex = cursor;
    const match = namePattern.exec(text);
    if (!match) exmlFailure(path, cursor, 'Expected an XML name.');
    cursor = namePattern.lastIndex;
    return match[0];
  }

  function skipSpace() {
    spacePattern.lastIndex = cursor;
    spacePattern.exec(text);
    const hadSpace = cursor !== spacePattern.lastIndex;
    cursor = spacePattern.lastIndex;
    return hadSpace;
  }

  const declaration = /^<\?xml\s+version\s*=\s*(?:"1\.0"|'1\.0')(?:\s+encoding\s*=\s*(?:"utf-8"|'utf-8'))?\s*\?>/i.exec(
    text
  );
  if (declaration) cursor = declaration[0].length;
  while (cursor < text.length) {
    skipSpace();
    if (cursor === text.length) break;
    const offset = cursor;
    if (text.startsWith('<!--', cursor)) {
      const close = text.indexOf('-->', cursor + 4);
      if (close < 0 || text.slice(cursor + 4, close).includes('--')) exmlFailure(path, offset, 'Invalid XML comment.');
      cursor = close + 3;
      continue;
    }
    if (!text.startsWith('<', cursor) || text.startsWith('<!', cursor) || text.startsWith('<?', cursor))
      exmlFailure(path, offset, 'Unexpected text, declaration, or processing instruction.');
    cursor++;
    if (text[cursor] === '/') {
      cursor++;
      const name = readName();
      skipSpace();
      if (text[cursor] !== '>' || stack.at(-1)?.name !== name)
        exmlFailure(path, offset, 'Mismatched or malformed XML closing tag.');
      stack.pop();
      cursor++;
      continue;
    }

    const name = readName();
    const attributes = new Map();
    let selfClosing = false;
    for (;;) {
      const hadSpace = skipSpace();
      if (text.startsWith('/>', cursor)) {
        selfClosing = true;
        cursor += 2;
        break;
      }
      if (text.startsWith('>', cursor)) {
        cursor++;
        break;
      }
      if (!hadSpace || attributes.size >= 64) exmlFailure(path, cursor, 'Invalid or excessive XML attributes.');
      const key = readName();
      if (attributes.has(key)) exmlFailure(path, cursor, 'Duplicate XML attribute.', { attribute: key });
      skipSpace();
      if (text[cursor++] !== '=') exmlFailure(path, cursor - 1, 'Expected an XML attribute assignment.');
      skipSpace();
      const quote = text[cursor++];
      if (quote !== '"' && quote !== "'") exmlFailure(path, cursor - 1, 'Expected a quoted XML attribute.');
      const end = text.indexOf(quote, cursor);
      if (end < 0) exmlFailure(path, cursor, 'Unclosed XML attribute.');
      attributes.set(key, attributesValue(text.slice(cursor, end), path, cursor));
      cursor = end + 1;
    }
    if (++count > 4096 || stack.length >= 64) exmlFailure(path, offset, 'EXML exceeds its structural bounds.');
    const namespaces = new Map(stack.at(-1)?.namespaces);
    for (const [key, value] of attributes) {
      if (key === 'xmlns' || key.startsWith('xmlns:')) {
        namespaces.set(key === 'xmlns' ? '' : key.slice(6), value);
        attributes.delete(key);
      }
    }
    const [prefix, local] = name.includes(':') ? name.split(':') : ['', name];
    const namespace = namespaces.get(prefix);
    if (namespace !== euiNamespace && !(namespace === wingNamespace && local === 'Config'))
      exmlFailure(path, offset, 'Only declared EUI elements and Wing editor metadata are supported.', {
        element: name
      });
    const node = { name, local, namespace, offset, namespaces, attributes, children: [] };
    if (stack.length) stack.at(-1).children.push(node);
    else {
      if (root) exmlFailure(path, offset, 'Expected a single EXML root.');
      root = node;
    }
    if (!selfClosing) stack.push(node);
  }
  if (stack.length || !root) exmlFailure(path, cursor, 'Incomplete EXML document.');
  return root;
}

function literalNumber(value, path, offset, key) {
  if (
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) ||
    !Number.isFinite(Number(value)) ||
    Math.abs(Number(value)) > 1_000_000
  )
    exmlFailure(path, offset, 'Expected a finite numeric EXML property.', { property: key });
  return Number(value);
}

function readProperties(node, path, ids, layout = false) {
  const properties = new Map();
  for (const [key, value] of node.attributes) {
    const type = node.local;
    if (key === 'class' && type === 'Skin') continue;
    if (type === 'Skin' && !skinNumbers.has(key))
      exmlFailure(path, node.offset, 'Skin root properties must describe its dimensions.', { property: key });
    if (layout && type === 'BasicLayout')
      exmlFailure(path, node.offset, 'BasicLayout needs no linear layout properties.', { property: key });
    if (value.includes('{') || value.includes('}'))
      exmlFailure(path, node.offset, 'EXML expressions require an explicit migration rule.', { property: key });
    if (!layout && key === 'id') {
      if (!isIdentifier(value) || value.includes('.') || ids.has(value))
        exmlFailure(path, node.offset, 'Expected a unique safe skin part ID.', { id: value });
      ids.add(value);
    }
    if (layout ? layoutNumbers.has(key) : commonNumbers.has(key) || controlNumbers[type]?.has(key)) {
      if ((key === 'width' || key === 'height') && value.endsWith('%')) {
        const percent = literalNumber(value.slice(0, -1), path, node.offset, key);
        if (percent < 0) exmlFailure(path, node.offset, 'Expected a nonnegative percentage.', { property: key });
        properties.set(key, percent + '%');
      } else {
        const number = literalNumber(value, path, node.offset, key);
        if (nonnegativeNumbers.has(key) && number < 0)
          exmlFailure(path, node.offset, 'Expected a nonnegative layout or style value.', { property: key });
        if (['alpha', 'fillAlpha', 'strokeAlpha'].includes(key) && (number < 0 || number > 1))
          exmlFailure(path, node.offset, 'Expected alpha between zero and one.', { property: key });
        properties.set(key, number);
      }
    } else if (!layout && (commonBooleans.has(key) || controlBooleans[type]?.has(key))) {
      if (value !== 'true' && value !== 'false')
        exmlFailure(path, node.offset, 'Expected a literal boolean.', { property: key });
      properties.set(key, value === 'true');
    } else if (!layout && controlColors[type]?.has(key)) {
      if (!/^(?:#|0x)[0-9a-fA-F]{6}$/.test(value))
        exmlFailure(path, node.offset, 'Expected a six-digit RGB color.', { property: key });
      properties.set(key, Number.parseInt(value.replace(/^(?:#|0x)/, ''), 16));
    } else if (layout ? layoutStrings.has(key) : commonStrings.has(key) || controlStrings[type]?.has(key)) {
      if (Object.hasOwn(alignments, key) && !alignments[key].has(value))
        exmlFailure(path, node.offset, 'Unsupported layout or label alignment.', { property: key, value });
      properties.set(key, value);
    } else exmlFailure(path, node.offset, 'EXML property requires a migration rule.', { element: type, property: key });
  }
  for (const axis of ['Width', 'Height']) {
    const minimum = properties.get('min' + axis),
      maximum = properties.get('max' + axis);
    if (minimum !== undefined && maximum !== undefined && minimum > maximum)
      exmlFailure(path, node.offset, 'Minimum EUI dimension exceeds its maximum.', { axis });
  }
  return Object.fromEntries(properties);
}

function compileNode(node, path, ids) {
  if (!controls.has(node.local))
    exmlFailure(path, node.offset, 'EXML control requires a migration rule.', { element: node.local });
  const properties = readProperties(node, path, ids);
  const children = [];
  let layout;
  for (const child of node.children) {
    // Wing's empty Config ID is editor bookkeeping and has no runtime display behavior.
    if (child.namespace === wingNamespace) {
      if (
        node.local !== 'Skin' ||
        child.children.length ||
        child.attributes.size !== 1 ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(child.attributes.get('id') ?? '')
      )
        exmlFailure(path, child.offset, 'Unsupported Wing metadata.');
      continue;
    }
    if (!containers.has(node.local))
      exmlFailure(path, child.offset, 'The control does not admit declarative children.', { element: node.local });
    if (child.local === 'layout') {
      const definition = child.children[0];
      if (
        layout !== undefined ||
        child.attributes.size ||
        child.children.length !== 1 ||
        !layouts.has(definition?.local) ||
        definition.children.length
      )
        exmlFailure(path, child.offset, 'Expected one supported layout declaration.');
      layout = { type: definition.local, properties: readProperties(definition, path, ids, true) };
    } else {
      if (child.local === 'Skin') exmlFailure(path, child.offset, 'Only the root may declare a Skin.');
      children.push(compileNode(child, path, ids));
    }
  }
  return { type: node.local, properties, children, ...(layout === undefined ? {} : { layout }) };
}

/** Compile the admitted static EUI skin grammar to data for the migration bridge. */
export function compileExml(text, { path = '<EXML>' } = {}) {
  const node = readXml(text, path);
  if (node.local !== 'Skin' || node.namespace !== euiNamespace) exmlFailure(path, node.offset, 'Expected a Skin root.');
  const className = node.attributes.get('class') ?? null;
  if (className !== null && !isIdentifier(className)) exmlFailure(path, node.offset, 'Invalid skin class name.');
  return { className, root: compileNode(node, path, new Set()), sourcePath: path };
}

function portableExml(value, themePath) {
  if (typeof value !== 'string' || !value.endsWith('.exml'))
    themeFailure(themePath, 'Expected a local EXML path.', { entry: value });
  try {
    return logicalPath(value);
  } catch {
    themeFailure(themePath, 'Expected a portable EXML path.', { entry: value });
  }
}

const themeFields = new Set(['skins', 'exmls', 'styles', 'autoGenerateExmlsList', 'path']);
const record = value => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Discover theme-owned EXML files through the caller's admitted read function. No directory or network scan occurs. */
export function discoverLegacySkins(read, themePath = 'resource/default.thm.json') {
  let declaration;
  const bytes = read(themePath).bytes;
  try {
    declaration = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    themeFailure(themePath, 'Expected a UTF-8 JSON theme declaration.');
  }
  if (
    !record(declaration) ||
    Object.keys(declaration).some(key => !themeFields.has(key)) ||
    (declaration.path !== undefined && declaration.path !== themePath) ||
    (declaration.skins !== undefined && !record(declaration.skins)) ||
    (declaration.exmls !== undefined && !Array.isArray(declaration.exmls)) ||
    (declaration.autoGenerateExmlsList !== undefined && typeof declaration.autoGenerateExmlsList !== 'boolean') ||
    (declaration.styles !== undefined && (!record(declaration.styles) || Object.keys(declaration.styles).length))
  )
    themeFailure(themePath, 'Theme declaration requires a migration rule.');

  const keyByFold = new Map();
  const sources = [];
  const remember = value => {
    const key = portableExml(value, themePath);
    const previous = keyByFold.get(key.toLowerCase());
    if (previous !== undefined && previous !== key)
      themeFailure(themePath, 'Case-ambiguous theme paths.', { entries: [previous, key] });
    if (previous === undefined) {
      keyByFold.set(key.toLowerCase(), key);
      sources.push(key);
    }
  };
  for (const key of declaration.exmls ?? []) remember(key);
  const skins = Object.entries(declaration.skins ?? {});
  for (const [key, value] of skins) {
    if (!isIdentifier(key) || typeof value !== 'string')
      themeFailure(themePath, 'Invalid default skin mapping.', { key });
    if (value.endsWith('.exml')) remember(value);
    else if (!isIdentifier(value)) themeFailure(themePath, 'Expected a local skin class or EXML path.', { key });
  }

  if (sources.length > 512) themeFailure(themePath, 'Theme exceeds the supported number of EXML files.');
  const classes = new Set();
  const exmls = sources.map(path => {
    const bytes = read(path).bytes;
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      themeFailure(themePath, 'EXML is not valid UTF-8.', { path });
    }
    const compiled = compileExml(text, { path });
    if (compiled.className !== null) {
      if (classes.has(compiled.className))
        themeFailure(themePath, 'Duplicate EXML class.', { className: compiled.className });
      classes.add(compiled.className);
    }
    return compiled;
  });
  for (const [key, value] of skins) {
    if (!value.endsWith('.exml') && !classes.has(value))
      themeFailure(themePath, 'Default skin class is not declared in the admitted EXML.', { key, value });
  }
  return { themePath, skins: Object.fromEntries(skins), exmls };
}
