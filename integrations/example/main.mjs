// SPDX-License-Identifier: Apache-2.0
import {
    Bitmap, Sprite, createAssetRef, createAssetType, createEngine, createImageData2D, createTexture, isTexture,
} from '@egret/engine';
import { createCanvasHost } from '@egret/engine/web';
import { zipAssets, unzipAssets } from '@egret/integrations/archive';
import { createLocalization } from '@egret/integrations/i18n';
import { createPhysicsWorld } from '@egret/integrations/physics';
import { decodeKtx2Rgba8, inspectKtx2 } from '@egret/integrations/texture';
import { createAudioBank } from '@egret/integrations/web/audio';
import { createSaveStore } from '@egret/integrations/web/storage';
import { createFixtureKtx2 } from './assets/fixture-texture.mjs';

const canvas = document.querySelector('#scene');
const title = document.querySelector('#title');
const status = document.querySelector('#status');
const run = document.querySelector('#run');
const language = document.querySelector('#language');
const close = document.querySelector('#close');
const diagnostic = document.querySelector('#diagnostics');
const details = {};
let engine, scope, closing;

function show(phase, message) {
    status.textContent = message;
    diagnostic.textContent = JSON.stringify(details, null, 2);
    diagnostic.dataset.phase = phase;
}

function fail(error) {
    details.failure = { integration: error?.integration ?? 'example', code: error?.code ?? 'unexpected', message: String(error?.message ?? error),
        ...(error?.cause === undefined ? {} : { cause: String(error.cause?.message ?? error.cause) }) };
    show('failed', 'Failed / 运行失败');
}

async function checkedFetch(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(path + ' returned ' + response.status);
    return response;
}

async function readAtlas() {
    const image = await createImageBitmap(await (await checkedFetch('/tiles.png')).blob());
    try {
        const surface = document.createElement('canvas');
        surface.width = image.width;
        surface.height = image.height;
        const context = surface.getContext('2d');
        context.drawImage(image, 0, 0);
        const pixels = new Uint8Array(context.getImageData(0, 0, image.width, image.height).data);
        return createImageData2D({ width: image.width, height: image.height, pixels });
    } finally {
        image.close();
    }
}

async function shutdown() {
    if (closing) return closing;
    for (const control of [run, language, close]) control.disabled = true;
    closing = (async () => {
        await engine?.dispose();
        details.lifecycle = scope?.state ?? 'closed';
        show('closed', 'Closed / 已关闭');
    })();
    return closing;
}

async function start() {
    const mapBytes = new Uint8Array(await (await checkedFetch('/map.json')).arrayBuffer());
    const packed = zipAssets([{ path: 'room.json', bytes: mapBytes }, { path: 'checker.ktx2', bytes: createFixtureKtx2() }]);
    const files = new Map(unzipAssets(packed).map(asset => [asset.path, asset.bytes]));
    const map = JSON.parse(new TextDecoder().decode(files.get('room.json')));
    const ktx2 = files.get('checker.ktx2');
    const header = inspectKtx2(ktx2);
    const atlas = await readAtlas();
    const layer = map.layers.find(entry => entry.kind === 'tile');
    const tileset = map.tilesets[0];

    engine = await createEngine({ host: createCanvasHost({ canvas, pixelRatio: 1 }) });
    scope = engine.createScope();
    const type = createAssetType('integration-demo-texture', isTexture);
    engine.assets.register(type, {
        async load(ref) {
            if (ref.id === 'checker') return createTexture(createImageData2D(decodeKtx2Rgba8(ktx2)));
            const tileId = Number(ref.id.slice('tile-'.length));
            return createTexture(atlas, {
                x: tileset.margin + (tileId % tileset.columns) * (tileset.tileWidth + tileset.spacing),
                y: tileset.margin + Math.floor(tileId / tileset.columns) * (tileset.tileHeight + tileset.spacing),
                width: tileset.tileWidth, height: tileset.tileHeight,
            });
        },
        dispose(texture) { texture.dispose(); },
    });
    const names = ['tile-0', 'tile-1', 'checker'];
    const assets = engine.createAssetGroup(scope, names.map(name => createAssetRef(type, name)));
    const textures = new Map((await assets.ready).map((lease, index) => [names[index], lease]));
    for (const [index, cell] of layer.cells.entries()) {
        if (cell === null) continue;
        const bitmap = engine.stage.addChild(scope.use(new Bitmap(textures.get('tile-' + cell.tileId))));
        bitmap.x = 8 + (index % map.width) * map.tileWidth;
        bitmap.y = 8 + Math.floor(index / map.width) * map.tileHeight;
        // Flip around the tile's opposite edge to keep its grid position.
        if (cell.flipX) { bitmap.x += map.tileWidth; bitmap.scaleX = -1; }
        if (cell.flipY) { bitmap.y += map.tileHeight; bitmap.scaleY = -1; }
    }
    const image = engine.stage.addChild(scope.use(new Bitmap(textures.get('checker'))));
    image.x = 80;
    image.y = 8;
    image.scaleX = image.scaleY = 8;
    const actor = engine.stage.addChild(scope.use(new Sprite()));
    actor.graphics.beginFill(0xf4b369).drawRect(0, 0, 6, 6).endFill();

    const world = scope.use(createPhysicsWorld({ gravity: { x: 0, y: 10 }, stepSeconds: 1 / 60, maxSubSteps: 8 }));
    world.createBody({ type: 'static', position: { x: 4, y: 7 }, shape: { kind: 'box', width: 8, height: 1 } });
    const body = world.createBody({ type: 'dynamic', position: { x: 2, y: 0 }, shape: { kind: 'circle', radius: .5 } });
    const audioEvents = [];
    const audio = scope.use(createAudioBank({
        clips: { tone: { src: ['/tone.wav'], format: ['wav'] } },
        onDiagnostic(event) { audioEvents.push(event.event); },
    }));
    const saves = scope.use(createSaveStore('egret-integration-example'));
    const other = scope.use(createSaveStore('egret-integration-example-isolation'));
    const localized = scope.use(await createLocalization({
        language: 'en', fallbackLanguage: 'en',
        resources: { en: { title: 'Egret integrations' }, 'zh-CN': { title: '白鹭第三方集成' } },
    }));

    function paint() {
        const { position } = body.snapshot();
        actor.x = 8 + position.x * 8;
        actor.y = 8 + position.y * 7;
        engine.renderFrame({ width: 112, height: 80, clearColor: 0x1c2b29, clearAlpha: 1 });
        const ctx = canvas.getContext('2d');
        details.render = {
            tilePixel: Array.from(ctx.getImageData(10, 10, 1, 1).data),
            ktxPixel: Array.from(ctx.getImageData(84, 12, 1, 1).data),
        };
    }

    function showLanguage() {
        title.textContent = localized.t('title');
        document.documentElement.lang = localized.language;
        details.language = localized.language;
    }

    details.map = { format: map.format, orientation: map.orientation, width: map.width, height: map.height,
        tilesets: map.tilesets.length, populated: layer.cells.filter(Boolean).length };
    details.archive = { entries: files.size, bytes: packed.length };
    details.texture = { width: header.width, height: header.height, mipLevels: header.levels.length };
    details.save = { runs: (await saves.get('runs')) ?? 0, isolated: (await other.get('runs')) === undefined };
    await audio.load('tone');
    details.audio = { events: audioEvents };
    paint();
    showLanguage();
    show('ready', 'Ready / 已就绪');

    const listener = new AbortController();
    scope.use({ dispose() { listener.abort(); } });
    run.disabled = language.disabled = close.disabled = false;
    run.addEventListener('click', async () => {
        run.disabled = true;
        language.disabled = true;
        try {
            // Keep play in the genuine browser gesture before awaiting storage or translation.
            const voice = audio.play('tone');
            const started = voice.started.then(() => voice.isPlaying());
            void started.catch(() => {});
            let steps = 0;
            let contacts = 0;
            for (let index = 0; index < 120; index++) {
                const result = world.advance(1 / 60);
                steps += result.steps;
                contacts += result.contacts.filter(event => event.phase === 'begin').length;
            }
            const playing = await started;
            voice.stop();
            const increment = count => (typeof count === 'number' ? count : 0) + 1;
            await Promise.all([saves.update('runs', increment), saves.update('runs', increment)]);
            details.save.runs = await saves.get('runs');
            details.physics = { steps, contacts, position: body.snapshot().position };
            details.audio = { playing, stopped: !voice.isPlaying(), events: audioEvents };
            await localized.changeLanguage('zh-CN');
            showLanguage();
            paint();
            show('complete', 'Run complete / 运行完成');
        } catch (error) {
            if (!closing) fail(error);
        } finally {
            if (!closing) run.disabled = language.disabled = false;
        }
    }, { signal: listener.signal });
    language.addEventListener('click', async () => {
        try {
            await localized.changeLanguage(localized.language === 'en' ? 'zh-CN' : 'en');
            showLanguage();
            show(diagnostic.dataset.phase, 'Language changed / 语言已切换');
        } catch (error) { fail(error); }
    }, { signal: listener.signal });
    close.addEventListener('click', () => { void shutdown().catch(fail); }, { signal: listener.signal });
    window.addEventListener('pagehide', event => { if (!event.persisted) void shutdown().catch(() => {}); }, { signal: listener.signal });
}

void start().catch(async error => {
    try { await engine?.dispose(); }
    catch (cleanup) { details.cleanupFailure = String(cleanup?.message ?? cleanup); }
    fail(error);
});
