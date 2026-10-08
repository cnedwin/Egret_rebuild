import { createLab } from './renderer.mjs';
const results = [], assert = (condition, msg) => { if (!condition) throw new Error(msg); };
async function check(name, fn) { try { results.push({ name, status: 'passed', observations: await fn() ?? {} }); } catch (e) { results.push({ name, status: 'failed', error: e.message }); } }
const { runId } = await (await fetch('/meta')).json();
const canvas = document.querySelector('canvas');
const lab = createLab(canvas);
const rect = (box, color, pipeline = 'straight', clip = null, texture = 'white', uv = [0, 0, 1, 1]) => ({ rect: box, color, pipeline, clip, texture, uv });
const environment = lab.environment;
const W = canvas.width, H = canvas.height;
const close = (p, expected, tolerance = 3) => expected.every((v, i) => Math.abs(v - p[i]) <= tolerance);
function perCommandReference(commands) {
  // Independent pixel-first oracle: no batch builder or batch executor.
  const bytes = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let color = [0, 0, 0, 0];
    for (const c of commands) {
      if (c.texture !== 'white') throw new Error('This oracle only supports the white fixture');
      if (x < c.rect[0] || y < c.rect[1] || x >= c.rect[2] || y >= c.rect[3]) continue;
      if (c.clip && (x < c.clip[0] || y < c.clip[1] || x >= c.clip[2] || y >= c.clip[3])) continue;
      const a = c.color[3], old = color;
      color = [0, 1, 2].map(k => Math.min(1, c.color[k] * a + old[k] * (c.pipeline === 'add' ? 1 : 1 - a))).concat(a + old[3] * (1 - a));
    }
    bytes.push(...color.map(v => Math.round(v * 255)));
  }
  return bytes;
}
await check('实际UI几何合批像素等于独立CPU参考', () => {
  const commands = [rect([0, 0, W, H], [.1, .2, .3, 1]), rect([16, 16, 96, 96], [1, 0, 0, .5]), rect([24, 24, 112, 112], [0, 1, 0, .5]), rect([32, 32, 128, 128], [0, 0, 1, .5]), rect([128, 16, 200, 104], [.2, .2, 1, .4], 'add'), rect([0, 0, W, H], [1, .4, .1, .2], 'straight', [64, 64, 160, 128])];
  lab.clear(); const stats = lab.ui(commands); const gpu = lab.readAll();
  const cpu = perCommandReference(commands);
  let maxChannelError = 0, mismatches = 0;
  for (let i = 0; i < gpu.length; i++) { const delta = Math.abs(gpu[i] - cpu[i]); maxChannelError = Math.max(maxChannelError, delta); if (delta > 3) mismatches++; }
  assert(mismatches === 0, `GPU reference mismatches ${mismatches}, max ${maxChannelError}`);
  assert(stats.drawCalls < commands.length, 'Compatible geometry was not actually merged');
  return { ...stats, commands: commands.length, pixels: W * H, tolerance: 3, maxChannelError, oracle: 'independent_pixel_first_per_command_without_batch_builder' };
});
await check('裁剪错误分批产生实际GPU像素反例', () => {
  const commands = [rect([0, 0, W, H], [0, 0, 1, 1], 'straight', [0, 0, 32, 32]), rect([0, 0, W, H], [1, 0, 0, 1], 'straight', [32, 0, 64, 32])];
  lab.clear(); lab.ui(commands); const good = lab.read(48, 16);
  const wrong = [{ texture: 'white', pipeline: 'straight', clip: commands[0].clip, commands }];
  lab.clear(); lab.ui(commands, wrong); const bad = lab.read(48, 16);
  assert(close(good, [255, 0, 0, 255]), 'Correct clip consumer failed'); assert(!close(bad, good), 'Wrong clip boundary was not detected'); return { good, bad };
});
await check('混合模式错误分批产生实际GPU像素反例', () => {
  const commands = [rect([0, 0, 64, 64], [1, 0, 0, .5]), rect([0, 0, 64, 64], [0, 1, 0, .5], 'add')];
  lab.clear(); lab.ui(commands); const good = lab.read(16, 16);
  lab.clear(); lab.ui(commands, [{ texture: 'white', pipeline: 'straight', clip: null, commands }]); const bad = lab.read(16, 16);
  assert(close(good, [128, 128, 0, 191]), 'Correct blend consumer failed'); assert(!close(bad, good), 'Wrong pipeline boundary was not detected'); return { good, bad };
});
await check('程序3D网格经过透视变换且与UI在同一目标合成', () => {
  lab.clear([.03, .05, .09, 1]); lab.mesh(.45); const center = lab.read(128, 100);
  assert(center[2] > 120, 'Perspective cube not observed at expected central interior');
  lab.ui([rect([112, 84, 144, 116], [1, .2, .1, .5])]); const overlay = lab.read(128, 100);
  const expected = [Math.round(127.5 + center[0] * .5), Math.round(25.5 + center[1] * .5), Math.round(12.75 + center[2] * .5), 255];
  assert(close(overlay, expected), 'UI overlay/depth state leaked'); return { mesh: { triangles: 12, projection: 'perspective', material: 'unlit_vertex_color' }, center, overlay, expected };
});
await check('两段CPU骨骼几何在两个确定帧改变像素覆盖', () => {
  lab.clear(); lab.bones(0); const a = lab.readAll(); lab.clear(); lab.bones(1); const b = lab.readAll();
  let changed = 0; for (let p = 0; p < W * H; p++) if (a[p * 4] !== b[p * 4] || a[p * 4 + 1] !== b[p * 4 + 1]) changed++;
  assert(changed > 150, 'Bone pose failed to change expected geometry coverage');
  return { bones: 2, sampleTimes: [0, 1], changedPixels: changed, limitation: 'Rigid two-segment transform only; not imported animation, constraints, skin weights, attachments or event semantics.' };
});
await check('序列帧图集切换两个确定帧且采样正确', () => {
  lab.clear(); lab.ui([rect([200, 16, 232, 48], [1, 1, 1, 1], 'straight', null, 'sequence', [0, 0, 1 / 3, 1])]); const first = lab.read(216, 32);
  lab.clear(); lab.ui([rect([200, 16, 232, 48], [1, 1, 1, 1], 'straight', null, 'sequence', [1 / 3, 0, 2 / 3, 1])]); const second = lab.read(216, 32);
  assert(close(first, [255, 40, 40, 255]) && close(second, [40, 255, 80, 255]), 'Atlas frame selection was incorrect'); return { first, second, atlas: 'authored_3x1_RGBA_fixture', filtering: 'nearest' };
});
await check('混合场景重建后保持指定帧像素', async () => {
  lab.scene(.45); const before = lab.readAll(); await lab.restore(); lab.scene(.45); const after = lab.readAll();
  assert(before.some((v, i) => i % 4 !== 3 && v !== before[i % 4]), 'A blank scene is not evidence of restoration');
  let differences = 0; for (let i = 0; i < before.length; i++) if (Math.abs(before[i] - after[i]) > 3) differences++;
  assert(differences === 0, `Restored scene pixel differences ${differences}`); return { comparedChannels: before.length, tolerance: 3, differences };
});
lab.scene(.45);
const counts = { total: results.length, passed: results.filter(x => x.status === 'passed').length, failed: results.filter(x => x.status === 'failed').length };
const report = { schemaVersion: 1, experiment: 'local_mixed_scene_graphics_probe', runId, checkedAtUtc: new Date().toISOString(), environment, counts, results, limitations: ['Authored procedural mesh, rigid two-bone sprite geometry, generated glyph texture and 3x1 color atlas only.', 'No actual character/model import, PBR/light/shadow, full skeleton constraints/attachments/skin or arbitrary masks.', 'Only local desktop WebGL2; no WebGPU scene backend, mini-game/native host, mobile, FPS/timing/power or migration acceptance.', 'Not a production engine/runtime, studio or scene/asset format implementation.'] };
for (const row of results) { const tr = document.createElement('tr'); for (const value of [row.name, row.status === 'passed' ? '通过' : '失败', JSON.stringify(row.observations ?? row.error)]) { const td = document.createElement('td'); td.textContent = value; tr.appendChild(td); } document.querySelector('tbody').appendChild(tr); }
document.querySelector('#environment').textContent = JSON.stringify({ environment, limitations: report.limitations }, null, 2);
await fetch('/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) });
document.querySelector('#state').textContent = `已保存：${counts.passed}通过，${counts.failed}失败`;
