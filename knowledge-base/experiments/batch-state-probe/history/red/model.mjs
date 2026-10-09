// Research baseline intentionally omits state boundaries so the tests can falsify it.
export function buildBatches(commands, maxVertices = 96) {
  const batches = [];
  for (const command of commands) {
    const key = command.texture;
    let b = batches.at(-1);
    if (!b || b.key !== key || (b.commands.length + 1) * 6 > maxVertices) {
      b = { key, texture: command.texture, pipeline: command.pipeline, clip: command.clip, commands: [] };
      batches.push(b);
    }
    b.commands.push(command);
  }
  return batches;
}

export function executeBatchesCPU(batches, width, height, textures) {
  const out = new Float64Array(width * height * 4);
  for (const batch of batches) {
    const texel = textures[batch.texture];
    for (const command of batch.commands) {
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const r = command.rect, clip = batch.clip;
        if (x < r[0] || y < r[1] || x >= r[2] || y >= r[3]) continue;
        if (clip && (x < clip[0] || y < clip[1] || x >= clip[2] || y >= clip[3])) continue;
        const src = command.color.map((v, k) => v * texel[k]);
        const at = (y * width + x) * 4;
        for (let k = 0; k < 3; k++) {
          if (batch.pipeline === 'add') out[at + k] = Math.min(1, src[k] * src[3] + out[at + k]);
          else out[at + k] = src[k] * src[3] + out[at + k] * (1 - src[3]);
        }
        out[at + 3] = src[3] + out[at + 3] * (1 - src[3]);
      }
    }
  }
  return [...out];
}
