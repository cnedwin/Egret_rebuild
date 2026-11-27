// SPDX-License-Identifier: Apache-2.0
import fs from 'node:fs';
import path from 'node:path';
import { convertProject } from './convert.mjs';
import { hash, readProjectFile, refuse } from './inspect.mjs';
import { eraserLobbyProfile } from './lobby-profile.mjs';

function localJson(owner, key) {
  const { bytes } = readProjectFile(owner, key, 64 * 1024 * 1024);
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    refuse('MIGRATE_INPUT_JSON', 'Expected a rebuild record in JSON format.', { path: key });
  }
}

/** Rebuild the edited source beside its previous conversion, retaining the save namespace and pinned SDK. */
export async function rebuildProject({ source, out, esbuild, transaction }) {
  const owner = path.resolve(source);
  const previous = localJson(owner, 'conversion.json');
  if (
    previous?.schemaVersion !== 1 ||
    previous.status !== 'converted' ||
    typeof previous.projectId !== 'string' ||
    !Array.isArray(previous.original?.inputs) ||
    !/^[a-f0-9]{64}$/.test(previous.target?.sha256 ?? '') ||
    hash(JSON.stringify(previous.original.inputs)) !== previous.original.inputSha256
  ) {
    refuse('MIGRATE_REBUILD_RECORD', 'Expected a completed conversion with its original input identities.');
  }
  const lobby = previous.original.profile === eraserLobbyProfile;
  const known = previous.rebuildInputs;
  const exists = key => fs.readdirSync(owner).includes(key);
  const explicitOrder =
    !lobby &&
    (known
      ? known.sourceOrder
      : exists('source-order.json') || !previous.original.inputs.some(item => item.path === 'manifest.json'));
  const hasBones = !lobby && (known ? known.bonesMap : previous.original.bones !== undefined);
  let edit = transaction;
  if (edit === undefined && previous.repair) {
    if (!exists('project-transaction.json')) {
      refuse('MIGRATE_REBUILD_TRANSACTION', 'Provide the original repair transaction using --transaction.');
    }
    edit = readProjectFile(owner, 'project-transaction.json').bytes.toString('utf8');
  }
  // Refuse a moved or replaced engine before compiling. Conversion checks the exact bytes it consumes again.
  const engineKey = 'web/egret2d.mjs';
  if (readProjectFile(owner, engineKey).identity.sha256 !== previous.target.sha256) {
    refuse('MIGRATE_REBUILD_ENGINE', 'Restore the pinned Egret browser bundle or choose an explicit new conversion.');
  }
  return convertProject({
    source: owner,
    out,
    engine: path.join(owner, engineKey),
    engineVersion: previous.target.version,
    expectedEngineSha256: previous.target.sha256,
    projectId: previous.projectId,
    esbuild,
    transaction: edit,
    previousInputs: previous.original.inputs,
    ...(lobby
      ? { profile: eraserLobbyProfile, socketUrl: previous.network?.origin ?? undefined }
      : {
          resources: previous.original.manifest,
          theme: previous.original.theme?.themePath,
          sources: explicitOrder ? localJson(owner, 'source-order.json') : undefined,
          bones: hasBones ? localJson(owner, 'bones-map.json') : undefined
        })
  });
}
