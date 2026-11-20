// SPDX-License-Identifier: Apache-2.0
// Spine 4.3 through the content build: the atlas over its PNG pages and a skeleton exported as JSON or binary become
// artifacts of one generation, kept byte for byte as exported, that the Spine loader reads from the build's manifest.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createEngine } from '@egret/engine';
import { createProjectStore } from '@egret/project';
import { createSpineContentLoader } from '@egret/spine';
import { buildResourceManifest } from '@egret/contracts/resources';
import { buildContentProject } from '../../../tools/content/build.mjs';
import { host } from '../../../tests/helpers.mjs';
import { fixture, ports, codes, atlas, source } from './fixtures.mjs';
import { encodeSkeleton } from './binaryFixture.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const provenance = {
  origin: 'Egret original numerical Spine content fixture',
  license: 'Apache-2.0',
  notice: 'Programmatically authored source/pixels; no Editor-export certification or commercial art.'
};
const sourceFiles = {
  e_a: ['a.png', 'image/png'],
  e_b: ['b.png', 'image/png'],
  e_atlas: ['character.atlas', 'text/plain'],
  e_json: ['character.json', 'application/json'],
  e_binary: ['character.skel', 'application/octet-stream']
};
/** A project whose sources are the Spine fixture's, with a recipe for each; `replace` swaps a source's bytes. */
function project(t, { replace = {}, recipes: change = r => r, root } = {}) {
  const values = fixture({ includeBinary: true }).values;
  for (const [id, bytes] of Object.entries(replace)) values.set(id, Buffer.from(bytes));
  root ??= mkdtempSync(path.join(os.tmpdir(), 'egret-spine-build-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of ['sources', 'build', 'cache']) mkdirSync(path.join(root, dir), { recursive: true });
  const files = Object.entries(sourceFiles).map(([id, [name, mediaType]]) => {
    const bytes = values.get(id);
    writeFileSync(path.join(root, 'sources', name), bytes);
    return {
      id: 'f_' + id.slice(2),
      path: 'sources/' + name,
      role: 'source',
      mediaType,
      sha256: sha(bytes),
      byteLength: bytes.length
    };
  });
  const recipe = (resourceId, id, artifactFormatVersion, dependencies = [], settings = {}) => ({
    resourceId,
    sourceFileId: 'f_' + resourceId.slice(2),
    importer: { id, version: '1.0.0' },
    settings,
    artifactFormatVersion,
    dependencies,
    provenance
  });
  const recipes = change([
    recipe('e_a', 'egret.png', 'png/1'),
    recipe('e_b', 'egret.png', 'png/1'),
    recipe('e_atlas', 'egret.spine-atlas', 'spine-atlas/4.3-1', ['e_a', 'e_b'], {
      coreVersion: '4.3.13',
      pageNames: ['a.png', 'b.png']
    }),
    recipe('e_json', 'egret.spine-json', 'spine-json/4.3-1', ['e_atlas'], { coreVersion: '4.3.13' }),
    recipe('e_binary', 'egret.spine-binary', 'spine-binary/4.3-1', ['e_atlas'], { coreVersion: '4.3.13' })
  ]);
  const store = createProjectStore({
    projectSchemaVersion: '1.0',
    projectId: 'p_spine_build',
    revision: 0,
    name: 'Spine content build',
    versions: { engineVersion: '0.0.0', resourceFormatVersion: '1.0', toolProtocolVersion: '1.0' },
    roots: [],
    entities: [],
    files,
    retiredEntityIds: [],
    retiredFileIds: []
  });
  assert.equal(store.ok, true, JSON.stringify(store.diagnostics));
  return {
    root,
    values,
    options: {
      projectStore: store.value,
      projectRoot: root,
      recipe: { format: 'egret.content-build-recipe/1', targetProfile: 'web-shared/1', recipes },
      cacheRoot: path.join(root, 'cache'),
      outputRoot: path.join(root, 'build'),
      selectorId: 'e_generation',
      transactionId: 't_spine'
    }
  };
}
const caches = result => Object.fromEntries(result.receipt.resources.map(r => [r.resourceId, r.cache]));
/** What the Spine loader reads: the build's manifest, and each entry's artifact bytes as the build wrote them. */
function built(p, result) {
  const values = new Map(
    result.manifest.entries.map(e => [e.id, readFileSync(path.join(p.root, e.artifact.path))])
  );
  return { manifest: result.manifest, values };
}
async function load(t, data, ids) {
  const engine = await createEngine({ host: host().adapter }),
    owner = engine.createScope(),
    loader = createSpineContentLoader(engine, owner, data.manifest, ports(data).factory);
  t.after(async () => {
    loader.dispose();
    await loader.close();
    await engine.dispose();
  });
  const group = loader.load(engine.createScope(), ids);
  await group.ready;
  return group;
}

// Break caught: leave Spine out of the content build, rewrite an export instead of keeping it, or give the loader
// settings it refuses.
test('SB01 a Spine atlas and its JSON and binary skeletons build into one generation that the Spine loader reads', async t => {
  const p = project(t),
    result = await buildContentProject(p.options);
  assert.equal(result.status, 'adopted');
  for (const id of ['e_atlas', 'e_json', 'e_binary'])
    assert.deepEqual(built(p, result).values.get(id), p.values.get(id), id + ' is kept as it was exported');
  const entry = id => result.manifest.entries.find(e => e.id === id);
  assert.deepEqual(
    ['e_atlas', 'e_json', 'e_binary'].map(id => entry(id).artifact.mediaType),
    ['text/plain', 'application/json', 'application/octet-stream']
  );
  assert.deepEqual({ ...entry('e_atlas').settings.options }, { coreVersion: '4.3.13', pageNames: ['a.png', 'b.png'] });
  const group = await load(t, built(p, result), ['e_json', 'e_binary']);
  const json = group.getSpine('e_json').info,
    binary = group.getSpine('e_binary').info;
  assert.deepEqual([json.format, json.boneCount, json.slotCount], ['json', 2, 2]);
  assert.deepEqual([binary.format, binary.boneCount, binary.slotCount], ['binary', 2, 2]);
  assert.deepEqual(
    json.pages.map(page => page.name),
    ['a.png', 'b.png']
  );
});

// Break caught: rebuild everything for one changed skeleton, or keep a skeleton built over an atlas that changed.
test('SB02 a second build is all cache hits, and a changed source rebuilds itself and what depends on it alone', async t => {
  const p = project(t),
    first = await buildContentProject(p.options);
  const again = await buildContentProject({ ...p.options, transactionId: 't_again' });
  assert.deepEqual(Object.values(caches(again)), ['hit', 'hit', 'hit', 'hit', 'hit']);
  assert.equal(again.generationId, first.generationId, 'the same sources give the same generation');
  const skeleton = source();
  skeleton.animations.walk = {};
  const json = project(t, { replace: { e_json: JSON.stringify(skeleton) } });
  const changed = await buildContentProject({ ...json.options, cacheRoot: p.options.cacheRoot });
  assert.deepEqual(caches(changed), { e_a: 'hit', e_atlas: 'hit', e_b: 'hit', e_binary: 'hit', e_json: 'miss' });
  const moved = project(t, { replace: { e_atlas: atlas.replace('bounds: 0,0,2,2\n\nb.png', 'bounds: 0,0,1,1\n\nb.png') } });
  const relaid = await buildContentProject({ ...moved.options, cacheRoot: p.options.cacheRoot });
  assert.deepEqual(caches(relaid), { e_a: 'hit', e_atlas: 'miss', e_b: 'hit', e_binary: 'miss', e_json: 'miss' });
});

// Break caught: admit an atlas whose page size is not its picture's, a binary of another series, a skeleton the 4.3
// reader refuses, or page names that do not match the dependencies; or change the project or the output on refusal.
test('SB03 a Spine source the 4.3 reader refuses stops the build before anything is published or adopted', async t => {
  const refused = async (options, pattern) => {
    const p = project(t, options),
      before = p.options.projectStore.getSnapshot();
    await assert.rejects(buildContentProject(p.options), error => {
      assert.match(error.code + ' ' + error.message, pattern);
      return true;
    });
    assert.equal(p.options.projectStore.getSnapshot(), before, 'the project is unchanged');
    const written = readdirSync(path.join(p.root, 'build'), { recursive: true }).map(String);
    assert.equal(written.filter(name => name.endsWith('manifest.json')).length, 0, 'no generation is published');
  };
  await refused({ replace: { e_atlas: atlas.replace('size: 2,2', 'size: 3,2') } }, /CONTENT_IMPORT_SPINE.*a\.png is 3x2/);
  await refused({ replace: { e_atlas: 'a.png\nsize: 2,2\nnot an atlas line\n' } }, /CONTENT_IMPORT_SPINE.*SPINE_ATLAS/);
  await refused(
    { replace: { e_binary: encodeSkeleton(source(), { version: '4.2.43' }) } },
    /CONTENT_IMPORT_SPINE.*"4\.2\.43"/
  );
  await refused({ replace: { e_binary: [1, 2, 3] } }, /CONTENT_IMPORT_SPINE.*no version/);
  await refused({ replace: { e_json: JSON.stringify(source('4.2.0')) } }, /CONTENT_IMPORT_SPINE.*SPINE_VERSION/);
  await refused({ replace: { e_json: '{"skeleton":' } }, /CONTENT_IMPORT_SPINE.*SPINE_JSON/);
  const pageNames = names => recipes =>
    recipes.map(r => (r.resourceId === 'e_atlas' ? { ...r, settings: { ...r.settings, pageNames: names } } : r));
  await refused({ recipes: pageNames(['a.png']) }, /CONTENT_BUILD_ADMISSION/);
  await refused({ recipes: pageNames(['a.png', 'a.png']) }, /CONTENT_BUILD_ADMISSION/);
  await refused({ recipes: pageNames(['a.png', 'c.png']) }, /CONTENT_IMPORT_SPINE/);
  const core = recipes =>
    recipes.map(r => (r.resourceId === 'e_json' ? { ...r, settings: { coreVersion: '4.3.12' } } : r));
  await refused({ recipes: core }, /CONTENT_BUILD_ADMISSION/);
  const skeletonOverPages = recipes =>
    recipes.map(r => (r.resourceId === 'e_json' ? { ...r, dependencies: ['e_a'] } : r));
  await refused({ recipes: skeletonOverPages }, /CONTENT_BUILD_ADMISSION/);
});

// Break caught: let the loader take an envelope that names another format, or one without its producer.
test('SB04 the Spine loader takes the build envelope only as the build writes it', async t => {
  const p = project(t),
    result = await buildContentProject(p.options),
    data = built(p, result);
  // The same manifest built again with one entry's settings changed, so that only the settings are wrong.
  const changed = mutate => {
    const { projectId, targetProfile, versions } = data.manifest;
    const entries = JSON.parse(JSON.stringify(data.manifest.entries)).map(({ buildKey: _, runtimeIdentity: __, ...e }) => e);
    mutate(entries.find(e => e.id === 'e_json').settings);
    const rebuilt = buildResourceManifest({ format: 'egret.resource-build/1', projectId, targetProfile, versions, entries });
    assert.equal(rebuilt.ok, true, JSON.stringify(rebuilt.diagnostics));
    return rebuilt.value;
  };
  const same = await load(t, { ...data, manifest: changed(() => {}) }, ['e_json']);
  assert.equal(same.getSpine('e_json').info.format, 'json', 'the unchanged envelope is read');
  for (const mutate of [
    s => (s.outputFormatVersion = 'spine-json/4.2-1'),
    s => delete s.producer,
    s => (s.options = []),
    s => (s.recipeSchemaVersion = 2),
    s => (s.referenceFormatVersion = 'rgba8/1')
  ]) {
    const engine = await createEngine({ host: host().adapter });
    t.after(() => engine.dispose());
    assert.throws(
      () => createSpineContentLoader(engine, engine.createScope(), changed(mutate), ports(data).factory),
      error => codes(error).includes('SPINE_PROFILE_FAILED')
    );
  }
});
