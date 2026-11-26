// SPDX-License-Identifier: Apache-2.0
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { createProjectStore, parseProjectTransaction, serializeProjectSnapshot } from '@egret/project';
import { ownerRelativePath, samePhysicalPath } from '../lib/file-identity.mjs';
import { browserBuildTypes } from '../verify-game.mjs';
import { hash, inspectLegacyProject, json, readProjectFile, refuse } from './inspect.mjs';

const bridge = new URL('./legacy-web.mjs', import.meta.url);
const schema = '1.0';
const versions = { resourceFormatVersion: schema, toolProtocolVersion: schema };
const entryHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
  <title>Egret game</title>
  <style>html,body,canvas{width:100%;height:100%;margin:0;display:block}body{background:#000}canvas{touch-action:none}</style>
</head>
<body>
  <canvas></canvas>
  <script type="module" src="./game.mjs"></script>
</body>
</html>
`;

function take(result) {
  if (!result.ok) refuse('MIGRATE_PROJECT_REFUSED', 'The project SDK rejected the action.', result.diagnostics);
  return result.value;
}

function write(owner, key, data) {
  const destination = path.join(owner, key);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, data, { flag: 'wx' });
}

function outputOwner(original, output) {
  const resolved = path.resolve(output);
  const parent = fs.realpathSync(path.dirname(resolved));
  const canonical = path.join(parent, path.basename(resolved));
  const old = fs.realpathSync(original);
  if (!samePhysicalPath(resolved, canonical) || samePhysicalPath(old, canonical)) {
    refuse('MIGRATE_OUTPUT_OWNER', 'Choose a new output directory outside the original project.');
  }
  try {
    ownerRelativePath(old, canonical);
  } catch (error) {
    if (error instanceof RangeError) return canonical;
    throw error;
  }
  refuse('MIGRATE_OUTPUT_OWNER', 'Choose a new output directory outside the original project.');
}

function snapshotOf(selection, assetFiles, engineVersion, editText, rememberedProjectId) {
  const projectId = rememberedProjectId ?? 'p_migrated_' + selection.inputSha256.slice(0, 24);
  const store = take(
    createProjectStore({
      projectSchemaVersion: schema,
      projectId,
      revision: 0,
      name: 'Migrated ' + selection.stage.entry,
      versions: { ...versions, engineVersion },
      roots: [],
      entities: [],
      files: [],
      retiredEntityIds: [],
      retiredFileIds: []
    })
  );
  const entity = {
    id: 'e_client',
    name: 'Web client',
    kind: 'legacy-web-client',
    dataSchemaVersion: schema,
    references: [],
    data: { stage: selection.stage, manifest: selection.manifest, resources: selection.resources }
  };
  const importResult = store.commit({
    command: 'edit',
    projectId,
    transactionId: 't_import_legacy_client',
    toolProtocolVersion: schema,
    baseRevision: 0,
    source: {
      actorId: 'a_egret_migrate',
      actorKind: 'legacy-converter',
      intent: 'Import the admitted stage and resource records',
      toolId: 'egret-migrate',
      toolVersion: '0.1.0'
    },
    scope: { entityIds: [entity.id], fileIds: assetFiles.map(file => file.id), metadata: false, roots: true },
    operations: [
      ...assetFiles.map(file => ({ op: 'putFile', file })),
      { op: 'putEntity', entity },
      { op: 'setRoots', roots: [entity.id] }
    ]
  });
  if (importResult.status !== 'committed')
    refuse('MIGRATE_PROJECT_REFUSED', 'The import did not commit.', importResult.diagnostics);
  if (editText === undefined) return { store, receipt: importResult.receipt, repair: null };

  // An Agent may tune imported data in an explicit transaction. Changing resource records needs fresh file admission.
  const edited = store.commit(take(parseProjectTransaction(editText)));
  if (edited.status !== 'committed')
    refuse('MIGRATE_PROJECT_REFUSED', 'The repair did not commit.', edited.diagnostics);
  if (
    edited.receipt.diff.addedFileIds.length ||
    edited.receipt.diff.changedFileIds.length ||
    edited.receipt.diff.removedFileIds.length ||
    edited.receipt.diff.rootsChanged ||
    store.getSnapshot().entities.find(item => item.id === entity.id)?.kind !== entity.kind
  ) {
    refuse('MIGRATE_REBUILD_REQUIRED', 'A repair requires new file admission or changed the client entry.');
  }
  const current = store.getSnapshot().entities.find(item => item.id === entity.id).data;
  const repairedData = JSON.parse(JSON.stringify(current));
  if (
    !isDeepStrictEqual(repairedData.resources, selection.resources) ||
    repairedData.manifest !== selection.manifest ||
    repairedData.stage?.entry !== selection.stage.entry ||
    ![repairedData.stage.width, repairedData.stage.height].every(
      size => Number.isInteger(size) && size > 0 && size <= 8192
    ) ||
    !['contain', 'cover', 'stretch'].includes(repairedData.stage.fit)
  ) {
    refuse('MIGRATE_REBUILD_REQUIRED', 'Resource layout changes require a new conversion.');
  }
  return { store, receipt: importResult.receipt, repair: edited.receipt };
}

function gameSource(sources, entry) {
  return `import * as sdk from './egret2d.mjs';
import { launchLegacyWeb } from './legacy-web.mjs';
const response = await fetch('./project.json');
if (!response.ok) throw new Error('Could not open the migrated project');
const project = await response.json();
const { stage, manifest, resources } = project.entities.find(item => item.id === 'e_client').data;
const host = await launchLegacyWeb(sdk, {
  canvas: document.querySelector('canvas'), ...stage, projectId: project.projectId,
  resources: {
    configUrl: manifest,
    root: resources.resourceRoot + '/',
    resources: resources.resources.map(item => ({ name: item.name, type: item.type, url: resources.files[item.fileIndex].destinationPath })),
    groups: resources.groups.map(item => ({ name: item.name, keys: item.resourceIndices.map(index => resources.resources[index].name) }))
  },
  createMain({egret, RES}) {
${sources.map(({ key, bytes }) => '// ' + key + '\n' + bytes.toString('utf8')).join('\n')}
    return new ${entry}();
  }
});
export { host };
`;
}

export async function convertProject(options) {
  const owner = path.resolve(options.source);
  const selection = inspectLegacyProject(owner, options);
  const out = outputOwner(owner, options.out);
  if (!/^7\.0\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(options.engineVersion ?? '')) {
    refuse('MIGRATE_TARGET_VERSION', 'Choose an exact Egret 7.0 build version.');
  }
  if (typeof options.esbuild?.transform !== 'function') refuse('MIGRATE_COMPILER', 'Provide an esbuild module.');
  const engine = fs.readFileSync(options.engine);
  const sourceFile = fs.readFileSync(bridge);
  const read = key => {
    const found = readProjectFile(owner, key);
    if (found.identity.sha256 !== selection.inputs.find(item => item.path === key)?.sha256) {
      refuse('MIGRATE_INPUT_CHANGED', 'Run inspection again after changing a project input.', { path: key });
    }
    return found.bytes;
  };
  const sources = selection.sources.map(file => ({ key: file.path, bytes: read(file.path) }));
  const assets = selection.resources.files.map(file => ({ key: file.destinationPath, bytes: read(file.sourcePath) }));
  const assetFiles = assets.map(({ key, bytes }, index) => {
    const mime = browserBuildTypes[path.posix.extname(key)]?.split(';')[0];
    if (!mime || !(mime === 'application/json' || mime.startsWith('image/'))) {
      refuse('MIGRATE_RES_UNSUPPORTED', 'Expected a supported local image or JSON file.', { path: key });
    }
    return {
      id: 'f_resource_' + index,
      path: key,
      role: 'asset',
      mediaType: mime,
      sha256: hash(bytes),
      byteLength: bytes.length
    };
  });
  const { store, receipt, repair } = snapshotOf(
    selection,
    assetFiles,
    options.engineVersion,
    options.transaction,
    options.projectId
  );
  let bundled;
  try {
    bundled = await options.esbuild.transform(gameSource(sources, selection.stage.entry), {
      loader: 'ts',
      format: 'esm',
      sourcefile: 'generated-legacy-client.ts',
      target: 'es2022',
      legalComments: 'inline'
    });
  } catch (error) {
    refuse(
      'MIGRATE_COMPILE',
      'Fix the indicated source and run conversion again from a new copy.',
      error.errors?.map(item => ({
        message: item.text,
        line: item.location?.line,
        column: item.location?.column
      })) ?? error.message
    );
  }
  const snapshot = take(serializeProjectSnapshot(store.getSnapshot()));
  const report = {
    schemaVersion: 1,
    status: 'converted',
    original: selection,
    target: { version: options.engineVersion, sha256: hash(engine) },
    projectId: store.getSnapshot().projectId,
    revision: store.getSnapshot().revision,
    receipt,
    repair,
    browserFiles: ['game.mjs', 'legacy-web.mjs', 'egret2d.mjs', ...assets.map(file => file.key)]
  };
  fs.mkdirSync(out);
  for (const item of selection.inputs) write(out, item.path, read(item.path));
  if (options.sources) write(out, 'source-order.json', json(options.sources));
  for (const { key, bytes } of assets) write(out, 'web/' + key, bytes);
  write(out, 'web/index.html', entryHtml);
  write(out, 'web/game.mjs', bundled.code);
  write(out, 'web/legacy-web.mjs', sourceFile);
  write(out, 'web/egret2d.mjs', engine);
  write(out, 'web/project.json', snapshot);
  write(out, 'history.json', take(store.exportHistory()));
  write(out, 'conversion.json', json(report));
  return report;
}
