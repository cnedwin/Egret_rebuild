// SPDX-License-Identifier: Apache-2.0
// Video as a display object. A canvas of the page changes colour four times a second. Its stream is shown live on the
// left; on the right, two seconds of it recorded by the page into a WebM file are played back, so the repository carries
// no video file.
import { createEngineForProfile, SHARED_FRAME_PROFILE_2D, Sprite } from '@egret/engine';
import { createBrowserVideo } from '@egret/engine/web/video';
import { createExampleHost } from '../host.mjs';

const WIDTH = 480, HEIGHT = 270, COLOURS = [0xd04040, 0x40c060, 0x4060d0, 0xe0c040], PERIOD = 0.25;
const canvas = document.querySelector('#scene'), status = document.querySelector('#status');
const engine = await createEngineForProfile({ host: await createExampleHost({ canvas, pixelRatio: 1 }) }, SHARED_FRAME_PROFILE_2D);
const scope = engine.createScope();
const frame = Object.freeze({ width: WIDTH, height: HEIGHT, clearColor: 0x14161f, clearAlpha: 1 });
let failure, ended = 0;
const fail = cause => { failure = String(cause?.code ?? cause?.message ?? cause); };

// The picture the videos are made from: one colour for each quarter of a second, from when the page started.
const painter = document.createElement('canvas');
painter.width = 160; painter.height = 90;
const paint = painter.getContext('2d'), started = performance.now();
const colourAt = seconds => COLOURS[Math.floor(seconds / PERIOD) % COLOURS.length];
function repaint() {
  paint.fillStyle = '#' + colourAt((performance.now() - started) / 1000).toString(16).padStart(6, '0');
  paint.fillRect(0, 0, painter.width, painter.height);
}
repaint();
const stream = painter.captureStream(30);

const frames = engine.stage.addChild(scope.use(new Sprite()));
frames.graphics.beginFill(0x2b3550).drawRect(36, 56, 168, 98).endFill().beginFill(0x2b3550).drawRect(276, 56, 168, 98).endFill();
const live = scope.use(createBrowserVideo({ assets: engine.assets, stream }));
live.display.x = 40; live.display.y = 60;
engine.stage.addChild(live.display);
live.play().catch(fail);

// Four seconds of the same stream, recorded by the page and played back as a file.
let recorded;
async function record() {
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' }), chunks = [];
  recorder.ondataavailable = event => chunks.push(event.data);
  const done = new Promise(resolve => { recorder.onstop = resolve; });
  recorder.start(); await new Promise(resolve => setTimeout(resolve, 4000)); recorder.stop(); await done;
  recorded = scope.use(createBrowserVideo({ assets: engine.assets, src: URL.createObjectURL(new Blob(chunks, { type: 'video/webm' })) }));
  recorded.display.x = 280; recorded.display.y = 60;
  engine.stage.addChild(recorded.display);
  recorded.onEnded(() => { ended++; });
}
record().catch(fail);

const act = run => () => { try { run(); } catch (cause) { fail(cause); } };
document.querySelector('#play').addEventListener('click', act(() => { recorded?.play().catch(fail); }));
document.querySelector('#pause').addEventListener('click', act(() => recorded?.pause()));
document.querySelector('#loop').addEventListener('click', act(() => { if (recorded) recorded.loop = !recorded.loop; }));

const view = video => video && { state: video.state, width: video.width, height: video.height, currentTime: video.currentTime, loop: video.loop, ...video.snapshot() };
function show() {
  status.textContent = failure ? 'Failed / 失败：' + failure
    : 'Live / 直播 ' + live.snapshot().frames + ' · recorded / 录像 ' + (recorded ? recorded.state + ' ' + recorded.snapshot().frames : 'recording… / 录制中…') + ' · ended / 播完 ' + ended;
  if (scope.state === 'open') engine.renderSharedFrame(frame);
}
async function tick() {
  try { repaint(); await live.update(); if (recorded) await recorded.update(); show(); } catch (cause) { fail(cause); }
  if (scope.state === 'open') requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

globalThis.__egretVideoExample = {
  colours: COLOURS,
  readSnapshot: () => ({ live: view(live), recorded: view(recorded) ?? null, ended, painted: colourAt((performance.now() - started) / 1000), failure }),
};
