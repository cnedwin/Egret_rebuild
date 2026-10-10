import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('..', import.meta.url));
const toolingURL = new URL('../tools/b1-webgpu/registryProvenance.mjs', import.meta.url);
const registryAlias = '#egret-textured-frame-state';
const registryName = 'packages/engine/dist/internal/texturedFrameState.js';
const hosts = ['packages/engine/dist/web/CanvasHost.js', 'packages/engine/dist/web/WebGPUHost.js'];
const modes = ['baseline', 'N1', 'N2', 'N3', 'N4', 'N5'];

async function tooling() {
  // This is the real CLI-consumed first-party policy module, not product code or
  // a checker reimplementation. Missing wiring/export is a setup failure, never RED.
  const value = await import(toolingURL.href);
  for (const name of ['resolveB1Dependency', 'validatePrivateRegistryMap', 'resolveRegistryConsumers']) {
    assert.equal(typeof value[name], 'function', `S02/S03 setup missing production-consumed tooling export ${name}; adopt the neutral extraction before assigned RED`);
  }
  return value;
}
function graphAliases() {
  // Literal independent expectations retain the existing five aliases.
  return {
    '#egret-textured-frame-state':'packages/engine/dist/internal/texturedFrameState.js',
    '@egret/contracts':'packages/contracts/dist/index.js',
    '@egret/runtime':'packages/runtime/dist/index.js',
    '@egret/engine':'packages/engine/dist/index.js',
    'robust-predicates':'packages/engine/node_modules/robust-predicates/index.js',
  };
}
function selectedImports(mode) {
  const prefix = mode === 'baseline' ? '/' : `/copy/${mode}/`;
  // This record is the effective imports selected by the real verifier. It is
  // deliberately a literal fixture, not observed browser import-map execution.
  return {
    '#egret-textured-frame-state':prefix + 'packages/engine/dist/internal/texturedFrameState.js',
    '@egret/contracts':'/packages/contracts/dist/index.js',
    '@egret/runtime':'/packages/runtime/dist/index.js',
    '@egret/engine':'/packages/engine/dist/index.js',
    'robust-predicates':'/packages/engine/node_modules/robust-predicates/index.js',
  };
}
function assertPolicyRefusal(action, expected) {
  let caught;
  try { action(); } catch (error) { caught = error; }
  assert.ok(caught instanceof Error, `Assigned ${expected.code} guard admitted malformed policy input`);
  assert.equal(caught.status, 'INCOMPLETE');
  assert.equal(caught.code, expected.code);
  assert.equal(caught.phase, expected.phase);
  assert.equal(caught.field, expected.field);
  assert.deepEqual(caught.expected, expected.expected);
  assert.deepEqual(caught.actual, expected.actual);
}

test('B1 private package alias permits only exact targets and host importers', async t => {
  const { resolveB1Dependency } = await tooling();
  const valid = () => {
    const aliases = graphAliases();
    for (const host of hosts) assert.equal(resolveB1Dependency(registryAlias, host, {repository,aliases}), registryName);
    assert.deepEqual(aliases, graphAliases(), 'Resolver mutated the actual graph alias input');
    return aliases;
  };
  await t.test('two legitimate emitted host imports and existing graph routes resolve', () => {
    const aliases = valid();
    for (const [specifier, expected] of Object.entries(aliases).filter(([name]) => name !== registryAlias)) {
      assert.equal(resolveB1Dependency(specifier, 'packages/engine/dist/web/b1.js', {repository,aliases}), expected);
    }
    assert.equal(resolveB1Dependency('./internal/texturedFrameState.js', 'packages/engine/dist/Engine.js', {repository,aliases}), registryName);
    assert.equal(resolveB1Dependency('../rendering/matrix4.js', hosts[1], {repository,aliases}), 'packages/engine/dist/rendering/matrix4.js');
  });
  for (const parent of ['packages/engine/dist/Engine.js','packages/engine/dist/web/OtherHost.js','packages/engine/dist/rendering/ProbePrivate.js','packages/runtime/dist/index.js','packages/engine/web/CanvasHost.ts','packages/engine/dist/web/../web/CanvasHost.js']) {
    await t.test(`refuses private alias from exact unapproved parent ${parent}`, () => {
      const aliases = valid();
      assertPolicyRefusal(() => resolveB1Dependency(registryAlias, parent, {repository,aliases}), {
        code:'B1_PRIVATE_REGISTRY_IMPORTER_UNAPPROVED',phase:'dependency',field:'parent',
        expected:hosts,actual:parent,
      });
    });
  }
  await t.test('altered private graph target is refused after valid host setup', () => {
    const aliases = valid();
    aliases[registryAlias] = 'packages/engine/dist/index.js';
    assertPolicyRefusal(() => resolveB1Dependency(registryAlias, hosts[1], {repository,aliases}), {
      code:'B1_PRIVATE_REGISTRY_ALIAS_TARGET_MISMATCH',phase:'dependency',field:registryAlias,
      expected:registryName,actual:'packages/engine/dist/index.js',
    });
  });
  await t.test('missing private graph alias is refused after valid host setup', () => {
    const aliases = valid(); delete aliases[registryAlias];
    assertPolicyRefusal(() => resolveB1Dependency(registryAlias, hosts[0], {repository,aliases}), {
      code:'B1_PRIVATE_REGISTRY_ALIAS_MISSING',phase:'dependency',field:registryAlias,
      expected:registryName,actual:undefined,
    });
  });
  await t.test('unknown private graph alias remains forbidden even if present in a map', () => {
    const aliases = valid(); aliases['#egret-textured-frame-states'] = registryName;
    assertPolicyRefusal(() => resolveB1Dependency('#egret-textured-frame-states', hosts[1], {repository,aliases}), {
      code:'B1_PRIVATE_REGISTRY_ALIAS_UNKNOWN',phase:'dependency',field:'specifier',
      expected:registryAlias,actual:'#egret-textured-frame-states',
    });
  });
  await t.test('existing unsupported and escaping relative dependency refusals survive extraction', () => {
    const aliases = valid();
    assert.throws(() => resolveB1Dependency('unknown-runtime', hosts[1], {repository,aliases}), /Unsupported emitted dependency unknown-runtime/);
    assert.throws(() => resolveB1Dependency('../../../../../../../outside.js', hosts[1], {repository,aliases}), assert.AssertionError);
    assert.throws(() => resolveB1Dependency('./CanvasHost.ts', hosts[1], {repository,aliases}), assert.AssertionError);
    // The expected path above is a literal; this normalization only proves that
    // the escaping case actually leaves the admitted repository in this fixture.
    assert.ok(!normalize(resolve(repository, hosts[1], '../../../../../../../outside.js')).startsWith(normalize(repository)));
  });
});

test('browser private alias is exact and required', async t => {
  const { validatePrivateRegistryMap, resolveRegistryConsumers } = await tooling();
  for (const mode of modes) {
    const expectedURL = (mode === 'baseline' ? '/' : `/copy/${mode}/`) + 'packages/engine/dist/internal/texturedFrameState.js';
    const valid = () => {
      const imports = selectedImports(mode);
      const before = structuredClone(imports);
      assert.equal(validatePrivateRegistryMap(imports, mode), imports, 'Validator replaced rather than admitted the production-consumed record');
      assert.deepEqual(imports, before, 'Validator repaired or mutated the chosen map');
      assert.equal(imports[registryAlias], expectedURL);
      const consumers = resolveRegistryConsumers(mode, {imports});
      assert.deepEqual(consumers.map(value => value.importer), ['packages/engine/dist/Engine.js', ...hosts]);
      assert.deepEqual(consumers.map(value => value.url), [expectedURL, expectedURL, expectedURL]);
      return imports;
    };
    const refuse = (imports, expected) => {
      assertPolicyRefusal(() => validatePrivateRegistryMap(imports, mode), expected);
      // The real observer must consume that same validator rather than return
      // unvalidated routes after a disconnected helper happens to pass its test.
      assertPolicyRefusal(() => resolveRegistryConsumers(mode, {imports}), expected);
    };
    await t.test(`${mode} literal valid selected effective map is admitted`, () => { valid(); });
    await t.test(`${mode} missing exact alias is refused`, () => {
      const imports = valid(); delete imports[registryAlias];
      refuse(imports, {
        code:'B1_PRIVATE_REGISTRY_ALIAS_MISSING',phase:'map',field:registryAlias,
        expected:expectedURL,actual:undefined,
      });
    });
    for (const unknown of ['#egret-textured-frame-states','#egret-extra']) await t.test(`${mode} unknown private alias ${unknown} is refused while exact alias remains valid`, () => {
      const imports = valid(); imports[unknown] = expectedURL;
      refuse(imports, {
        code:'B1_PRIVATE_REGISTRY_ALIAS_UNKNOWN',phase:'map',field:'specifier',
        expected:registryAlias,actual:unknown,
      });
    });
    for (const altered of ['/packages/engine/dist/index.js','/packages/engine/internal/texturedFrameState.js', mode === 'baseline' ? '/copy/N1/packages/engine/dist/internal/texturedFrameState.js' : '/packages/engine/dist/internal/texturedFrameState.js']) await t.test(`${mode} altered exact alias target ${altered} is refused`, () => {
      const imports = valid(); imports[registryAlias] = altered;
      refuse(imports, {
        code:'B1_PRIVATE_REGISTRY_ALIAS_TARGET_MISMATCH',phase:'map',field:registryAlias,
        expected:expectedURL,actual:altered,
      });
    });
    await t.test(`${mode} inherited alias does not satisfy own required mapping`, () => {
      valid();
      const imports = selectedImports(mode); delete imports[registryAlias];
      Object.setPrototypeOf(imports, {[registryAlias]:expectedURL});
      refuse(imports, {
        code:'B1_PRIVATE_REGISTRY_ALIAS_MISSING',phase:'map',field:registryAlias,
        expected:expectedURL,actual:undefined,
      });
    });
  }
});
