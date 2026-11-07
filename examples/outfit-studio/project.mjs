// SPDX-License-Identifier: Apache-2.0
import {createProjectStore, parseProjectSnapshot, serializeProjectSnapshot} from '@egret/project';

export const outfits = Object.freeze(['default', 'cool-coat', 'warm-hat', 'both']);
export const palettes = Object.freeze(['studio', 'alternate']);

function unwrap(result) {
  if (!result.ok) throw new Error(result.diagnostics[0].code);
  return result.value;
}

function character(entity) {
  const {id, name, data} = entity;
  if (!name.trim() || name.length > 40 || /[\r\n\t]/.test(name)) {
    throw new Error('Use a single-line name of 1 to 40 UTF-16 units');
  }
  if (!outfits.includes(data.outfit)) throw new Error('Unknown outfit');
  if (!palettes.includes(data.palette)) throw new Error('Unknown palette');
  return {id, name, outfit:data.outfit, palette:data.palette};
}

export function skins(outfit) {
  if (outfit === 'default') return ['default'];
  if (outfit === 'both') return ['default', 'cool-coat', 'warm-hat'];
  return ['default', outfit];
}

export function openStudioProject(text) {
  const snapshot = unwrap(parseProjectSnapshot(text, {maxSnapshotUtf8Bytes:64 * 1024}));
  if (snapshot.projectId !== 'p_outfit_studio' || snapshot.roots.length !== 2 ||
      snapshot.entities.length !== 2 || snapshot.files.length || snapshot.entities.some(entity =>
        entity.kind !== 'outfit-character' || entity.dataSchemaVersion !== '1.0' || entity.references.length)) {
    throw new Error('Expected a two-character Outfit Studio project');
  }
  snapshot.entities.forEach(character);
  const store = unwrap(createProjectStore(snapshot));

  function get(id) {
    const entity = store.getSnapshot().entities.find(row => row.id === id);
    if (!entity) throw new Error('Unknown character');
    return entity;
  }

  return Object.freeze({
    get revision() { return store.getSnapshot().revision; },
    characters() { return store.getSnapshot().roots.map(id => character(get(id))); },
    character(id) { return character(get(id)); },
    edit(id, changes) {
      const previous = get(id);
      const before = character(previous);
      const after = {...before, ...changes, id};
      const entity = {...previous, name:after.name, data:{...previous.data, outfit:after.outfit, palette:after.palette}};
      character(entity);
      if (before.name === after.name && before.outfit === after.outfit && before.palette === after.palette) return before;

      // Only explicit studio actions write a revision. Playback and drafts stay in runtime state.
      const baseRevision = store.getSnapshot().revision;
      const result = store.commit({
        command:'edit', toolProtocolVersion:'1.0', projectId:snapshot.projectId,
        transactionId:`t_studio_${baseRevision + 1}`, baseRevision,
        source:{actorId:'studio',actorKind:'creator',intent:'Edit character',toolId:'outfit-studio',toolVersion:'1'},
        scope:{entityIds:[id],fileIds:[],metadata:false,roots:false},
        operations:[{op:'putEntity',entity}]
      });
      if (result.status !== 'committed') throw new Error(result.diagnostics[0]?.code ?? 'Project edit refused');
      return character(get(id));
    },
    serialize() { return unwrap(serializeProjectSnapshot(store.getSnapshot())) + '\n'; }
  });
}
