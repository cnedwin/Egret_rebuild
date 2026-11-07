// SPDX-License-Identifier: Apache-2.0
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildResourceManifest} from '@egret/contracts/resources';
import {authorFontExample} from '../../tools/content/author-font-example.mjs';
import {createExampleServer} from '../../tools/serve-example.mjs';
import {fingerprintFile, ownerRelativePath, samePhysicalPath} from '../../tools/lib/file-identity.mjs';
import {localPackage} from '../../tools/lib/local-package.mjs';
import {buildOriginalContent} from '../animation-outfits/author.mjs';
import {openStudioProject} from './project.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const base = '/examples/outfit-studio/';
const projectModules = [
  'api', 'canonical', 'commit', 'diagnostics', 'diff', 'edit', 'format-shape.generated',
  'history', 'history-bytes', 'index', 'integer-token', 'internal', 'json-foundation',
  'limits', 'live-input', 'paths', 'public', 'replay-cost', 'restore', 'shape', 'state',
  'store', 'text-input', 'unicode', 'validate-snapshot', 'validate-transaction', 'validation-order'
];
const json = value => Buffer.from(JSON.stringify(value) + '\n');

function alternatePalette(original) {
  const values = new Map(original.values);
  values.set('e_warm', original.values.get('e_cool'));
  values.set('e_cool', original.values.get('e_warm'));
  const entries = original.manifest.entries.map(entry => {
    const {buildKey, runtimeIdentity, ...input} = entry;
    const bytes = values.get(entry.id);
    const identity = {sha256:createHash('sha256').update(bytes).digest('hex'),byteLength:bytes.length};
    return {...input,source:{...input.source,...identity},artifact:{...input.artifact,...identity}};
  });
  const result = buildResourceManifest({...original.manifest,format:'egret.resource-build/1',entries});
  if (!result.ok) throw new Error(result.diagnostics[0].code);
  return {manifest:result.value,values};
}

export async function createStudioServer(projectFile = path.join(import.meta.dirname, 'project.json')) {
  const project = openStudioProject(fs.readFileSync(projectFile, 'utf8'));
  const font = await authorFontExample();
  const server = createExampleServer();
  const shared = server.listeners('request')[0];
  const routes = new Map();
  const resource = (url, bytes, type) => routes.set(url, {bytes,type});
  const file = (url, relative, type) => routes.set(url, {relative,type});
  const javascript = 'text/javascript; charset=utf-8';
  const applicationJson = 'application/json; charset=utf-8';

  file(base + 'index.html', 'examples/outfit-studio/index.html', 'text/html; charset=utf-8');
  file(base + 'style.css', 'examples/outfit-studio/style.css', 'text/css; charset=utf-8');
  for (const name of ['main', 'project', 'assets', 'scene', 'ui']) file(base + name + '.mjs', `examples/outfit-studio/${name}.mjs`, javascript);
  resource(base + 'project.json', Buffer.from(project.serialize()), applicationJson);
  resource(base + 'config.json', json({fontConfig:font.configPath}), applicationJson);
  for (const name of projectModules) {
    const relative = `packages/project/dist/${name}.js`;
    file('/' + relative, relative, javascript);
  }
  const jsonc = localPackage(root, path.join(root, 'node_modules/jsonc-parser'), 'jsonc-parser', '3.3.1');
  for (const name of ['main.js','impl/edit','impl/format','impl/parser','impl/scanner','impl/string-intern']) {
    const source = path.join(jsonc, 'lib/esm', name.endsWith('.js') ? name : name + '.js');
    file('/studio-deps/jsonc-parser/' + name, ownerRelativePath(root, source), javascript);
  }
  const original = buildOriginalContent();
  for (const [palette, content] of [['studio', original], ['alternate', alternatePalette(original)]]) {
    const folder = `${base}content/${palette}/`;
    resource(folder + 'manifest.json', json(content.manifest), applicationJson);
    for (const entry of content.manifest.entries) {
      resource(folder + entry.artifact.path, content.values.get(entry.id), entry.artifact.mediaType);
    }
  }

  // Extend the shared loopback server with exact paths for this sample and its project entry.
  server.off('request', shared);
  server.on('request', (request, response) => {
    let pathname;
    try { pathname = new URL(request.url, 'http://127.0.0.1').pathname; }
    catch { return shared(request, response); }
    const route = routes.get(pathname);
    if (!route) return shared(request, response);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, {Allow:'GET, HEAD','Cache-Control':'no-store'}).end();
      return;
    }
    try {
      if (route.relative) fingerprintFile(root, route.relative);
      const bytes = route.bytes ?? fs.readFileSync(path.join(root, route.relative));
      response.writeHead(200, {'Content-Type':route.type,'Content-Length':bytes.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch {
      response.writeHead(404, {'Cache-Control':'no-store'}).end('Missing Studio input. Run pnpm setup:dev.');
    }
  });
  return server;
}

if (process.argv[1] && samePhysicalPath(path.resolve(process.argv[1]), fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--project')) throw new Error('Usage: node examples/outfit-studio/serve.mjs [--project path]');
  const server = await createStudioServer(args[1]);
  server.listen(4173, '127.0.0.1', () => console.log(`http://127.0.0.1:4173${base}index.html`));
}
