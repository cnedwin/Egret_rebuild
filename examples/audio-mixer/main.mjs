// SPDX-License-Identifier: Apache-2.0
// Music and effects for a page. The mixer has a volume for music and one for effects under a master
// volume, plays one music at a time and fades from one to the next, keeps a sound that is asked for
// again and again to two voices, and is silent while the game is paused or the page is hidden. The
// controls are the page's own: the example is about what is heard.
import { createBrowserAudio } from '@egret/engine/web/audio';
import { chime, tune } from './sounds.mjs';

const KEY = 'egret-audio-example/1', NAMES = ['master', 'music', 'effects'];
const element = id => document.querySelector('#' + id);
const status = element('status'), stateView = element('state'), level = element('level');
let failure;
const fail = cause => { failure = String(cause?.code ?? cause?.message ?? cause); show(); };

// What the person chose last time. A page that may not keep anything starts from the defaults.
const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; } })();
const chosen = name => ({ volume: typeof saved[name]?.volume === 'number' ? saved[name].volume : name === 'music' ? 0.6 : 1, muted: saved[name]?.muted === true });
const audio = createBrowserAudio({
  volume: chosen('master').volume, muted: chosen('master').muted,
  buses: [{ name: 'music', ...chosen('music') }, { name: 'effects', ...chosen('effects') }],
  onError: fail,
});
const mixer = audio.mixer, busOf = name => name === 'master' ? mixer.master : mixer.bus(name);
// What the page sees of the mixer, in the order it happened: the first state, each change, and each press it was given.
const history = [mixer.state];
mixer.subscribe(state => { history.push(state); show(); });
for (const type of ['pointerdown', 'keydown']) addEventListener(type, event => { if (event.isTrusted && history.at(-1) !== 'input') history.push('input'); }, { capture: true });
// A listener of the page on the way out, for the meter.
const analyser = audio.context.createAnalyser(), window_ = new Float32Array(analyser.fftSize);
audio.output.connect(analyser);
function heard() {
  analyser.getFloatTimeDomainData(window_);
  let sum = 0;
  for (const sample of window_) sum += sample * sample;
  return Math.sqrt(sum / window_.length);
}

const [gate, drill, bell, tick] = await Promise.all([
  tune([220, 276, 330, 440, 330, 276]), tune([330, 392, 494, 392, 294, 392], 0.25), chime(), chime(1760, 0.5, 0.35),
].map(bytes => mixer.decode(bytes)));
// Asked for before anybody touched the page: it waits, and is heard from its start when the page may sound.
mixer.playMusic(gate, { fade: 1 });

function keep() {
  try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(NAMES.map(name => [name, { volume: busOf(name).volume, muted: busOf(name).muted }])))); } catch { /* nothing is kept */ }
}
const TEXT = {
  locked: '还没有声音：点一下或按任意键 / No sound yet: press anywhere, or any key',
  running: '正在发声 / Sounding',
  suspended: '已静音 / Silent',
  closed: '已关闭 / Closed',
};
function show() {
  const picture = mixer.snapshot();
  status.textContent = failure === undefined ? TEXT[picture.state] + (picture.suspendedBy.length > 0 ? ' (' + picture.suspendedBy.join(', ') + ')' : '') : 'Failed / 失败: ' + failure;
  element('pause').setAttribute('aria-pressed', String(picture.suspendedBy.includes('game')));
  stateView.textContent = JSON.stringify({ ...picture, music: mixer.music === undefined ? null : mixer.music.sound === gate ? 'gate' : 'drill' }, null, 2);
}
for (const name of NAMES) {
  const slider = element('volume-' + name), box = element('mute-' + name), bus = busOf(name);
  slider.value = String(Math.round(bus.volume * 100)); box.checked = bus.muted;
  // A short fade: a slider moves in steps, a volume should not.
  slider.addEventListener('input', () => { bus.setVolume(Number(slider.value) / 100, { fade: 0.05 }); keep(); show(); });
  box.addEventListener('change', () => { bus.setMuted(box.checked); keep(); show(); });
}
const act = (id, action) => element(id).addEventListener('click', () => { try { action(); } catch (cause) { fail(cause); } show(); });
act('music-a', () => mixer.playMusic(gate, { fade: 1 }));
act('music-b', () => mixer.playMusic(drill, { fade: 1 }));
act('music-stop', () => mixer.stopMusic({ fade: 1 }));
for (const [id, pan] of [['bell-left', -1], ['bell', 0], ['bell-right', 1]]) act(id, () => { mixer.play(bell, { pan }).ended.then(show); });
// Pressed quickly, the oldest of two gives its place: a sound does not pile up on itself.
act('tick', () => { mixer.play(tick, { maxInstances: 2, rate: 0.9 + Math.random() * 0.2 }).ended.then(show); });
act('pause', () => { if (mixer.snapshot().suspendedBy.includes('game')) mixer.resume(); else mixer.suspend(); });

(function meter() {
  level.value = heard();
  if (mixer.state !== 'closed') requestAnimationFrame(meter);
})();
show();

globalThis.__egretAudioExample = {
  readSnapshot: () => ({
    ...mixer.snapshot(), history: [...history], failure, level: heard(), time: audio.context.currentTime, output: audio.context.state, visibility: document.visibilityState,
    music: mixer.music === undefined ? null : mixer.music.sound === gate ? 'gate' : 'drill', position: mixer.music?.position ?? null, status: status.textContent,
  }),
};
