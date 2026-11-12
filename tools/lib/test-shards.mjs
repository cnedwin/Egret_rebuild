// SPDX-License-Identifier: Apache-2.0
// Split the complete test file list across parallel jobs without omitting or repeating a file.

/** Parse `<index>/<count>`; the index counts from one. */
export function parseShard(text) {
  const match = typeof text === 'string' ? /^([1-9][0-9]?)\/([1-9][0-9]?)$/.exec(text) : null;
  const index = match ? Number(match[1]) : 0, count = match ? Number(match[2]) : 0;
  if (!match || index > count || count > 16) throw new TypeError('A shard is <index>/<count> with 1 <= index <= count <= 16');
  return { index, count };
}

/**
 * Deal the files into `count` hands and return hand `index`.
 * The slow files are dealt first, in their listed order, so that no hand collects several of them;
 * every other file follows in the order given. A slow entry that no longer exists is ignored,
 * so the hands always form an exact partition of `files`.
 */
export function selectShard(files, index, count, slow = []) {
  if (!Array.isArray(files) || files.some(file => typeof file !== 'string' || !file) || new Set(files).size !== files.length) {
    throw new TypeError('A list of distinct test files is required');
  }
  if (!Array.isArray(slow) || new Set(slow).size !== slow.length) throw new TypeError('The slow list holds distinct files');
  if (!Number.isInteger(index) || !Number.isInteger(count) || count < 1 || index < 1 || index > count) {
    throw new RangeError('The shard index lies between one and the shard count');
  }
  const present = new Set(files), first = slow.filter(file => present.has(file)), early = new Set(first);
  const order = [...first, ...files.filter(file => !early.has(file))];
  return order.filter((_, position) => position % count === index - 1);
}
