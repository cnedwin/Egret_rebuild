// SPDX-License-Identifier: Apache-2.0
import { logicalPath } from '../lib/file-identity.mjs';

const euiNamespace = 'http://ns.egret.com/eui';
const wingNamespace = 'http://ns.egret.com/wing';
const controls = new Set([
  'Skin',
  'Group',
  'Image',
  'Label',
  'Rect',
  'Button',
  'Component',
  'List',
  'DataGroup',
  'ItemRenderer',
  'Scroller'
]);
const layouts = new Set(['BasicLayout', 'HorizontalLayout', 'VerticalLayout', 'TileLayout']);
const containers = new Set(['Skin', 'Group', 'Component', 'ItemRenderer', 'List', 'DataGroup', 'Scroller']);
const fields = source => new Set(source.split(' '));
const commonNumbers = fields(
  'x y width height minWidth minHeight maxWidth maxHeight left right top bottom horizontalCenter verticalCenter percentWidth percentHeight anchorOffsetX anchorOffsetY scaleX scaleY rotation alpha'
);
const commonBooleans = fields('visible touchEnabled touchChildren includeInLayout');
const commonStrings = fields('id name');
const skinNumbers = fields('width height minWidth minHeight maxWidth maxHeight');
const nonnegativeNumbers = fields(
  'width height minWidth minHeight maxWidth maxHeight percentWidth percentHeight size stroke strokeWeight ellipseWidth ellipseHeight paddingLeft paddingRight paddingTop paddingBottom'
);
const controlNumbers = {
  List: fields('selectedIndex scrollV'),
  DataGroup: fields('scrollV'),
  Group: fields('scrollV'),
  Label: fields('size stroke lineSpacing'),
  Rect: fields('fillAlpha strokeAlpha strokeWeight ellipseWidth ellipseHeight')
};
const controlBooleans = {
  List: fields('requireSelection scrollEnabled useVirtualLayout'),
  DataGroup: fields('scrollEnabled useVirtualLayout'),
  Label: fields('bold italic multiline'),
  Button: fields('enabled'),
  Component: fields('enabled'),
  Group: fields('enabled scrollEnabled'),
  Rect: fields('enabled')
};
const controlStrings = {
  List: fields('itemRenderer itemRendererSkinName skinName'),
  DataGroup: fields('itemRenderer itemRendererSkinName skinName'),
  ItemRenderer: fields('skinName'),
  Image: fields('source'),
  Label: fields('text fontFamily textAlign verticalAlign'),
  Button: fields('label skinName'),
  Component: fields('skinName')
};
const controlColors = { Label: fields('textColor strokeColor'), Rect: fields('fillColor strokeColor') };
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
    const customNamespace = namespace === '*' || (namespace?.endsWith('.*') && isIdentifier(namespace.slice(0, -2)));
    if (
      namespace !== euiNamespace &&
      !(namespace === wingNamespace && local === 'Config') &&
      !(customNamespace && isIdentifier(local) && !local.includes('.'))
    )
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

// Bindings are a list of literal strings and property paths, interpreted without generating executable code.
function binding(value, path, node, key) {
  if (!value.startsWith('{') || !value.endsWith('}'))
    exmlFailure(path, node.offset, 'Expected one complete binding expression.', { property: key });
  const expression = value.slice(1, -1).trim();
  const token = /(?:"((?:[^"\\]|\\["\\])*)"|'((?:[^'\\]|\\['\\])*)'|([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*))/y;
  const parts = [];
  let offset = 0;
  for (;;) {
    token.lastIndex = offset;
    const match = token.exec(expression);
    if (!match || parts.length === 32 || (match[3] && !isIdentifier(match[3])))
      exmlFailure(path, node.offset, 'Unsupported EXML binding expression.', { property: key });
    parts.push(match[3] ? { path: match[3].split('.') } : { literal: (match[1] ?? match[2]).replace(/\\(.)/g, '$1') });
    offset = token.lastIndex;
    while (/\s/.test(expression[offset] ?? 'x')) offset++;
    if (offset === expression.length) return { binding: parts };
    if (expression[offset++] !== '+')
      exmlFailure(path, node.offset, 'Only string concatenation and property paths are supported.');
    while (/\s/.test(expression[offset] ?? 'x')) offset++;
  }
}

function stateNames(value, path, node) {
  const list = value.split(',').map(name => name.trim());
  if (
    list.length > 64 ||
    new Set(list).size !== list.length ||
    list.some(name => !isIdentifier(name) || name.includes('.'))
  )
    exmlFailure(path, node.offset, 'Invalid or duplicate EXML state name.');
  return list;
}

function readProperties(node, path, ids, layout = false) {
  const properties = new Map();
  for (const [key, value] of node.attributes) {
    const type = node.local;
    if (key === 'class' && type === 'Skin') continue;
    if (type === 'Rect' && key === 'locked' && ['true', 'false'].includes(value)) continue;
    if (type === 'Image' && key === 'fillMode' && ['scale', 'clip'].includes(value)) {
      properties.set(key, value);
      continue;
    }
    if (type === 'Image' && key === 'scale9Grid') {
      const values = value.split(',').map(part => literalNumber(part.trim(), path, node.offset, key));
      if (values.length !== 4 || values.some(n => n < 0) || !values[2] || !values[3])
        exmlFailure(path, node.offset, 'Expected a nonnegative nine-slice rectangle with a positive center.');
      const [x, y, width, height] = values;
      properties.set(key, { x, y, width, height });
      continue;
    }
    if (layout && type === 'TileLayout') {
      if (!['horizontalGap', 'verticalGap', 'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom'].includes(key))
        exmlFailure(path, node.offset, 'Unsupported row-major tile layout property.', { property: key });
      const number = literalNumber(value, path, node.offset, key);
      if (number < 0) exmlFailure(path, node.offset, 'Tile spacing must be nonnegative.');
      properties.set(key, number);
      continue;
    }
    if (type === 'Skin' && !skinNumbers.has(key))
      exmlFailure(path, node.offset, 'Skin root properties must describe its dimensions.', { property: key });
    if (layout && type === 'BasicLayout')
      exmlFailure(path, node.offset, 'BasicLayout needs no linear layout properties.', { property: key });
    const custom = node.namespace !== euiNamespace && !layout;
    const customProperty = custom && isIdentifier(key) && !key.includes('.') && !/^on/i.test(key);
    if (value.includes('{') || value.includes('}')) {
      if (
        layout ||
        ['Skin'].includes(type) ||
        ['id', 'skinName', 'itemRenderer', 'itemRendererSkinName'].includes(key) ||
        !(
          customProperty ||
          commonNumbers.has(key) ||
          commonBooleans.has(key) ||
          key === 'name' ||
          controlNumbers[type]?.has(key) ||
          controlBooleans[type]?.has(key) ||
          controlStrings[type]?.has(key) ||
          controlColors[type]?.has(key) ||
          (['List', 'DataGroup'].includes(type) && key === 'dataProvider')
        )
      )
        exmlFailure(path, node.offset, 'Binding target has no migration rule.', { property: key });
      properties.set(key, binding(value, path, node, key));
      continue;
    }
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
        if (key === 'stroke' && number > 512)
          exmlFailure(path, node.offset, 'Outline radius exceeds 512.', { property: key });
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
    } else if (
      layout ? layoutStrings.has(key) : commonStrings.has(key) || controlStrings[type]?.has(key) || customProperty
    ) {
      if (key === 'itemRenderer' && !isIdentifier(value))
        exmlFailure(path, node.offset, 'Invalid item renderer class.');
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

function compileNode(node, path, ids, knownStates = []) {
  const custom = node.namespace !== euiNamespace;
  const metadata = {};
  const simple = new Map();
  const special = new Map();
  if (node.local === 'Skin') {
    knownStates = node.attributes.has('states') ? stateNames(node.attributes.get('states'), path, node) : [];
    if (knownStates.length) metadata.states = knownStates;
  }
  for (const [key, value] of node.attributes) {
    if (key === 'states' && node.local === 'Skin') continue;
    if (key === 'includeIn' || key === 'excludeFrom') {
      const names = stateNames(value, path, node);
      if (
        node.local === 'Skin' ||
        names.some(name => !knownStates.includes(name)) ||
        metadata.includeIn ||
        metadata.excludeFrom
      )
        exmlFailure(path, node.offset, 'Unknown or conflicting conditional state.', { property: key });
      metadata[key] = names;
    } else if (key.includes('.')) {
      const [property, name, extra] = key.split('.');
      if (
        node.local === 'Skin' ||
        extra !== undefined ||
        !knownStates.includes(name) ||
        !isIdentifier(property) ||
        ['id', 'skinName', 'itemRenderer', 'itemRendererSkinName'].includes(property)
      )
        exmlFailure(path, node.offset, 'Unsupported state override.', { property: key });
      if (!special.has(name)) special.set(name, new Map());
      special.get(name).set(property, value);
    } else simple.set(key, value);
  }
  if (special.size)
    metadata.overrides = Object.fromEntries(
      [...special].map(([name, attributes]) => [name, readProperties({ ...node, attributes }, path, ids)])
    );
  if (!custom && !controls.has(node.local))
    exmlFailure(path, node.offset, 'EXML control requires a migration rule.', { element: node.local });
  const properties = readProperties({ ...node, attributes: simple }, path, ids);
  const children = [];
  let layout;
  for (const child of node.children) {
    // Wing stores preview dimensions alongside the editor ID. They do not describe a display node.
    if (child.namespace === wingNamespace) {
      if (
        node.local !== 'Skin' ||
        child.children.length ||
        [...child.attributes.keys()].some(key => !['id', 'scale9Grid', 'width', 'height'].includes(key)) ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(child.attributes.get('id') ?? '')
      )
        exmlFailure(path, child.offset, 'Unsupported Wing metadata.');
      continue;
    }
    if (
      child.namespace === euiNamespace &&
      child.local === 'skinName' &&
      ['Button', 'Component'].includes(node.local)
    ) {
      if (
        metadata.inlineSkin ||
        properties.skinName ||
        child.attributes.size ||
        child.children.length !== 1 ||
        child.children[0].namespace !== euiNamespace ||
        child.children[0].local !== 'Skin'
      )
        exmlFailure(path, child.offset, 'Expected one inline component skin.');
      // Each component owns its named skin parts independently of its enclosing scene.
      metadata.inlineSkin = compileNode(child.children[0], path, new Set());
      continue;
    }
    if (!containers.has(node.local) && !custom)
      exmlFailure(path, child.offset, 'The control does not admit declarative children.', { element: node.local });
    if (node.local === 'Scroller' && !custom) {
      const wrapped = child.namespace === euiNamespace && child.local === 'viewport';
      const viewport = wrapped ? child.children[0] : child;
      if (
        children.length ||
        (wrapped && (child.attributes.size || child.children.length !== 1)) ||
        viewport?.namespace !== euiNamespace ||
        !['List', 'DataGroup', 'Group'].includes(viewport.local)
      )
        exmlFailure(path, child.offset, 'A vertical Scroller requires exactly one Group, List or DataGroup viewport.');
      children.push(compileNode(viewport, path, ids, knownStates));
    } else if (
      child.namespace === euiNamespace &&
      child.local === 'itemRendererSkinName' &&
      ['List', 'DataGroup'].includes(node.local)
    ) {
      if (
        metadata.itemRendererSkin ||
        properties.itemRendererSkinName ||
        child.attributes.size ||
        child.children.length !== 1 ||
        child.children[0].namespace !== euiNamespace ||
        child.children[0].local !== 'Skin'
      )
        exmlFailure(path, child.offset, 'Expected a single inline renderer skin.');
      metadata.itemRendererSkin = compileNode(child.children[0], path, new Set());
    } else if (child.namespace === euiNamespace && child.local === 'layout') {
      const definition = child.children[0];
      if (
        layout !== undefined ||
        child.attributes.size ||
        child.children.length !== 1 ||
        definition?.namespace !== euiNamespace ||
        !layouts.has(definition?.local) ||
        definition.children.length
      )
        exmlFailure(path, child.offset, 'Expected one supported layout declaration.');
      layout = { type: definition.local, properties: readProperties(definition, path, ids, true) };
    } else {
      if (child.local === 'Skin') exmlFailure(path, child.offset, 'Only the root may declare a Skin.');
      if (['List', 'DataGroup'].includes(node.local))
        exmlFailure(path, child.offset, 'List children require an item renderer skin.');
      children.push(compileNode(child, path, ids, knownStates));
    }
  }
  return {
    type: custom ? 'Custom' : node.local,
    ...(custom ? { className: node.namespace === '*' ? node.local : node.namespace.slice(0, -1) + node.local } : {}),
    properties,
    children,
    ...metadata,
    ...(layout === undefined ? {} : { layout })
  };
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
  const customComponents = new Set();
  function collect(node) {
    if (node.type === 'Custom') customComponents.add(node.className);
    if (node.properties.itemRenderer && node.properties.itemRenderer !== 'eui.ItemRenderer')
      customComponents.add(node.properties.itemRenderer);
    if (node.inlineSkin) collect(node.inlineSkin);
    if (node.itemRendererSkin) collect(node.itemRendererSkin);
    node.children.forEach(collect);
  }
  for (const skin of exmls) collect(skin.root);
  return {
    themePath,
    skins: Object.fromEntries(skins),
    exmls,
    ...(customComponents.size ? { customComponents: [...customComponents].sort() } : {})
  };
}
