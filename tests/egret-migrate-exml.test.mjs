// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compileExml, discoverLegacySkins } from '../tools/egret-migrate/exml.mjs';

const namespace = 'http://ns.egret.com/eui';
const skin = inner =>
  '<e:Skin xmlns:e="' + namespace + '" class="skins.Panel" width="480" height="320">' + inner + '</e:Skin>';

test('EXML compiles visible parts, fixed and fluid layout values, and literal text without executing code', () => {
  const file = 'resource/skins/Panel.exml';
  const result = compileExml(
    skin(
      '<e:Group id="content" width="100%" top="14">' +
        '<e:layout><e:VerticalLayout gap="8" paddingLeft="12" horizontalAlign="center"/></e:layout>' +
        '<e:Rect width="240" height="96" fillColor="0x006699" fillAlpha="0.75"/>' +
        '<e:Label id="title" size="24" text="Tea &amp; rice &#x8336;" textColor="#ffeeaa" bold="true"/>' +
        '<e:Button id="open" label="Open" width="40%" skinName="skins.ButtonSkin"/>' +
        '<e:Image source="icon_png" anchorOffsetX="2" scaleX="-1"/>' +
        '<e:Component skinName="skins.Badge"/>' +
        '</e:Group>'
    ),
    { path: file }
  );
  assert.equal(result.className, 'skins.Panel');
  assert.equal(result.sourcePath, file);
  assert.deepEqual(result.root.properties, { width: 480, height: 320 });
  const [content] = result.root.children;
  assert.deepEqual(content.layout, {
    type: 'VerticalLayout',
    properties: { gap: 8, paddingLeft: 12, horizontalAlign: 'center' }
  });
  assert.deepEqual(content.properties, { id: 'content', width: '100%', top: 14 });
  assert.deepEqual(
    content.children.map(child => child.type),
    ['Rect', 'Label', 'Button', 'Image', 'Component']
  );
  assert.deepEqual(content.children[0].properties, { width: 240, height: 96, fillColor: 0x006699, fillAlpha: 0.75 });
  assert.deepEqual(content.children[1].properties, {
    id: 'title',
    size: 24,
    text: 'Tea & rice 茶',
    textColor: 0xffeeaa,
    bold: true
  });
  assert.deepEqual(content.children[2].properties, {
    id: 'open',
    label: 'Open',
    width: '40%',
    skinName: 'skins.ButtonSkin'
  });
});

test('EXML accepts a default EUI namespace, declaration, comments, and an omitted class', () => {
  const result = compileExml(
    '<?xml version="1.0" encoding="utf-8"?>\n<!-- heading -->\n<Skin xmlns="' +
      namespace +
      '"><Label text="ready"/></Skin>',
    { path: 'resource/skin.exml' }
  );
  assert.equal(result.className, null);
  assert.equal(result.root.children[0].type, 'Label');
});

test('EXML refuses unknown constructs, malformed XML, active syntax, unsupported bindings and unresolved skin parts', () => {
  const invalid = [
    '<!DOCTYPE e:Skin [<!ENTITY value SYSTEM "x">]>' + skin('<e:Label text="&value;"/>'),
    skin('<e:Label text="{hostComponent.count()}"/>'),
    skin('<e:Label onclick="execute()"/>'),
    skin('<e:Label text="bad &unknown;"/>'),
    skin('<e:Label id="constructor"/>'),
    skin('<e:Label id="same"/><e:Group id="same"/>'),
    skin('<e:Label includeIn="selected"/>'),
    skin('<e:UnsupportedControl/>'),
    skin('<e:Label>unadmitted text</e:Label>'),
    skin('<e:Group unknown="1"/>'),
    skin('<e:Label size="NaN"/>'),
    skin('<e:Group width="100%%"/>'),
    skin('<e:Group><e:layout><e:HorizontalLayout/><e:BasicLayout/></e:layout></e:Group>'),
    skin('<e:Group><e:Label></e:Group></e:Label>'),
    skin('<e:Group id="x" id="y"/>'),
    skin('<other:Label/>'),
    skin('<e:Label text="unterminated/>')
  ];
  for (const source of invalid) {
    assert.throws(
      () => compileExml(source, { path: 'resource/skin.exml' }),
      error => error.code === 'MIGRATE_EXML_UNSUPPORTED' && error.details.path === 'resource/skin.exml',
      source
    );
  }
});

test('EXML compiles literal binding chains, named states, a list renderer skin and custom components', () => {
  const result = compileExml(
    '<e:Skin xmlns:e="' +
      namespace +
      '" xmlns:game="game.*" states="normal,busy">' +
      '<e:Label id="status" text="{hostComponent.model.name}" text.busy="{\'Wait \' + model.name}" />' +
      '<e:Group includeIn="busy"><game:Badge id="badge" width="20" caption="{model.name}"/></e:Group>' +
      '<e:List id="inventory" width="200" height="120" dataProvider="{items}" itemRenderer="game.Row">' +
      '<e:itemRendererSkinName><e:Skin height="30"><e:Label text="{data.title}"/></e:Skin></e:itemRendererSkinName>' +
      '</e:List></e:Skin>'
  );
  assert.deepEqual(result.root.states, ['normal', 'busy']);
  assert.deepEqual(result.root.children[1].includeIn, ['busy']);
  assert.equal(result.root.children[1].children[0].className, 'game.Badge');
  assert.equal(result.root.children[2].properties.itemRenderer, 'game.Row');
  assert.equal(result.root.children[2].itemRendererSkin.type, 'Skin');
  assert.ok(result.root.children[0].properties.text.binding);
  assert.ok(result.root.children[0].overrides.busy.text.binding);
  assert.throws(() => compileExml(skin('<e:Label text="{model.__proto__.name}"/>')), {
    code: 'MIGRATE_EXML_UNSUPPORTED'
  });
});

test('theme discovery reads only declared local EXML paths, including default skin paths', () => {
  const files = new Map([
    [
      'resource/default.thm.json',
      JSON.stringify({
        skins: { 'eui.Button': 'resource/Button.exml', Panel: 'skins.Panel' },
        exmls: ['resource/Panel.exml'],
        autoGenerateExmlsList: true
      })
    ],
    ['resource/Panel.exml', skin('<e:Button id="open"/>')],
    ['resource/Button.exml', '<e:Skin xmlns:e="' + namespace + '"/>']
  ]);
  const seen = [];
  const result = discoverLegacySkins(key => {
    seen.push(key);
    assert.ok(files.has(key), key);
    return { bytes: Buffer.from(files.get(key)) };
  });
  assert.deepEqual(seen, ['resource/default.thm.json', 'resource/Panel.exml', 'resource/Button.exml']);
  assert.deepEqual(result.skins, { 'eui.Button': 'resource/Button.exml', Panel: 'skins.Panel' });
  assert.deepEqual(
    result.exmls.map(file => file.sourcePath),
    ['resource/Panel.exml', 'resource/Button.exml']
  );
  assert.equal(result.exmls[0].className, 'skins.Panel');
});

test('theme discovery refuses non-portable, ambiguous and unknown declaration paths before using them', () => {
  for (const declaration of [
    { skins: {}, exmls: ['https://example.org/Skin.exml'] },
    { skins: {}, exmls: ['../escape.exml'] },
    { skins: {}, exmls: ['resource/Panel.exml', 'resource/panel.exml'] },
    { skins: { 'eui.Button': 'Unknown.Skin' }, exmls: [] },
    { skins: {}, exmls: [], styles: { common: {} } },
    { skins: {}, exmls: [{ path: 'resource/Panel.exml', gjs: 'compiled' }] }
  ]) {
    assert.throws(
      () =>
        discoverLegacySkins(key => ({
          bytes: Buffer.from(key === 'resource/default.thm.json' ? JSON.stringify(declaration) : skin(''))
        })),
      { code: 'MIGRATE_THEME_UNSUPPORTED' }
    );
  }
});

// Validate only a Wing editor marker and a theme self-reference; neither becomes a runtime node.
test('an empty Wing Config and exact theme self-path carry no runtime behavior', () => {
  const source =
    '<e:Skin xmlns:e="' +
    namespace +
    '" xmlns:w="http://ns.egret.com/wing"><w:Config id="16569ab8646"/><e:Label text="Ready"/></e:Skin>';
  const result = compileExml(source);
  assert.deepEqual(
    result.root.children.map(node => node.type),
    ['Label']
  );
  const theme = discoverLegacySkins(key => ({
    bytes: Buffer.from(
      key.endsWith('json')
        ? JSON.stringify({ path: 'resource/default.thm.json', exmls: ['resource/ready.exml'] })
        : source
    )
  }));
  assert.equal(theme.exmls.length, 1);
  assert.throws(() => compileExml(source.replace('id="16569ab8646"', 'url="external"')), {
    code: 'MIGRATE_EXML_UNSUPPORTED'
  });
  assert.throws(() => discoverLegacySkins(() => ({ bytes: Buffer.from('{"path":"another.json"}') })), {
    code: 'MIGRATE_THEME_UNSUPPORTED'
  });
});

test('button skins own their part IDs and tile groups accept row gaps', () => {
  const button =
    '<e:Button><e:skinName><e:Skin><e:Image id="face" fillMode="clip" scale9Grid="2,3,5,6"/></e:Skin></e:skinName></e:Button>';
  const tree = compileExml(
    skin(
      '<e:Group><e:layout><e:TileLayout horizontalGap="4" verticalGap="9"/></e:layout>' +
        button.repeat(2) +
        '<e:Label multiline="true"/><e:Rect locked="true"/></e:Group>'
    )
  ).root.children[0];
  assert.deepEqual(tree.layout.properties, { horizontalGap: 4, verticalGap: 9 });
  assert.deepEqual(tree.children[0].inlineSkin.children[0].properties.scale9Grid, { x: 2, y: 3, width: 5, height: 6 });
  assert.equal(tree.children[2].properties.multiline, true);
  assert.deepEqual(tree.children[3].properties, {});
  assert.throws(() => compileExml(skin(button.replace('<e:Button>', '<e:Button skinName="Other">'))), {
    code: 'MIGRATE_EXML_UNSUPPORTED'
  });
  assert.throws(() => compileExml(skin(button.replace('2,3,5,6', '1,2'))), { code: 'MIGRATE_EXML_UNSUPPORTED' });
});

test('unsupported alignments, wrap modes, tile orientations and root attributes are rejected before execution', () => {
  for (const source of [
    skin('<e:Label textAlign="justify"/>'),
    skin('<e:Label wordWrap="true"/>'),
    skin('<e:Label multiline="automatic"/>'),
    skin('<e:Label stroke="-1"/>'),
    skin('<e:Group><e:layout><e:TileLayout orientation="columns"/></e:layout></e:Group>'),
    skin('<e:Group><e:layout><e:VerticalLayout horizontalAlign="justify"/></e:layout></e:Group>'),
    skin('<e:Group><e:layout><e:BasicLayout gap="1"/></e:layout></e:Group>'),
    skin('<e:Rect minWidth="20" maxWidth="10"/>'),
    '<e:Skin xmlns:e="' + namespace + '" alpha="0.5"/>'
  ])
    assert.throws(() => compileExml(source), { code: 'MIGRATE_EXML_UNSUPPORTED' }, source);
});
