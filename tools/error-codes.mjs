// SPDX-License-Identifier: Apache-2.0
// Writes the two error code references from the sources and from the sentences the runtime gives.
// Usage: node tools/error-codes.mjs [--check]
// Every code a source file throws is listed under its area with its sentence: the English one is the runtime's own,
// from packages/runtime/dist/errorHelp.js, and so is the Chinese one, which setErrorLanguage('zh') puts in messages. With --check nothing is
// written, and the tool fails when either document differs from what it would write.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeErrorCode } from '../packages/runtime/dist/errorHelp.js';
import { ZH_AREAS } from '../packages/runtime/dist/errorHelpZh.js';

const root = fileURLToPath(new URL('..', import.meta.url));
export const ERROR_CODE_DOCUMENTS = {
  en: 'knowledge-base/en/docs/error-codes.md',
  zh: 'knowledge-base/Cns/docs/error-codes.md'
};
function* sources(directory) {
  for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const relative = directory + '/' + entry.name;
    if (entry.isDirectory()) {
      if (entry.name !== 'dist' && entry.name !== 'node_modules' && entry.name !== 'test' && entry.name !== 'tests')
        yield* sources(relative);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) yield relative;
  }
}
/**
 * The codes of the sources: the first argument of `new EgretError(`, every other capital literal that the runtime has
 * a sentence for, since most parts throw through a helper of their own, and the codes such a helper puts together from
 * the part's name and a short name written at its call. A short name that is only known while running is not found.
 */
export function collectErrorCodes() {
  const codes = new Set();
  for (const name of ['contracts', 'runtime', 'engine', 'spine'])
    for (const file of sources('packages/' + name)) {
      if (file.endsWith('/errorHelp.ts') || file.endsWith('/errorHelpZh.ts')) continue;
      const text = fs.readFileSync(path.join(root, file), 'utf8');
      for (const match of text.matchAll(/new EgretError\(\s*['"]([A-Z][A-Z0-9_]*[A-Z0-9])['"]/g)) codes.add(match[1]);
      for (const match of text.matchAll(/['"]([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)['"]/g))
        if (describeErrorCode(match[1], 'en') !== '') codes.add(match[1]);
      // A part that throws through a helper of its own, which puts the part's name before a short one: the helper is the
      // function on whose line the prefix is joined to its argument, and the codes are its calls with a short name written out.
      for (const helper of text.matchAll(
        /(?:const|let|function)\s+(\w+)\b(?:(?!\b(?:const|let|function)\b)[\s\S]){0,400}?new EgretError\(\s*['"]([A-Z][A-Z0-9_]*_)['"]\s*\+\s*\w+\s*[,)]/g
      )) {
        const calls = new RegExp('\\b' + helper[1] + '\\(\\s*[\'"]([A-Z][A-Z0-9_]*[A-Z0-9])[\'"]', 'g');
        for (const call of text.matchAll(calls)) codes.add(helper[2] + call[1]);
      }
    }
  return [...codes].sort();
}

// The Chinese sentences are the runtime's own, in packages/runtime/src/errorHelpZh.ts.
const areaOf = code => ZH_AREAS.find(([prefix]) => code === prefix || code.startsWith(prefix + '_'));
const describeZh = code => describeErrorCode(code, 'zh');

const HEAD = {
  en: `# Error codes

English | [简体中文](../../Cns/docs/error-codes.md)

Every error this SDK throws is an \`EgretError\` with a \`code\`. This page lists each code with what it means. It is written by \`node tools/error-codes.mjs\` from the sources, and \`tests/error-codes.test.mjs\` fails when this page no longer matches them.

## Reading an error

| Part | Holds |
| --- | --- |
| \`error.code\` | The code, in capitals. It is stable: a program compares it |
| \`error.message\` | The code and the sentence below. It is for people and its wording may change. \`setErrorLanguage('zh')\` from \`@egret/engine\` puts the Chinese sentence there instead |
| \`error.cause\` | What made this error happen, when something did: the Host's own error behind \`FRAME_RENDER_FAILED\`, or what an application callback threw |
| \`error.cleanupErrors\` | What went wrong while cleaning up after the error, if anything |

A code is an area and what went wrong there. The area is how the code begins, and the ending says what happened: \`..._OPTIONS_INVALID\` for options that are not valid, \`..._CLOSED\` and \`..._DISPOSED\` for something used after its end, \`..._REENTRANT\` for a call made from inside its own callback, \`..._LIMIT\` and \`..._BUDGET\` for a limit that was passed, and \`..._FAILED\` for a failure whose cause is in \`cause\`.

Sentences that also say what to do were written for the codes a game meets most. The others are put together from the area and the ending, or written one by one where a code has no ending of the usual kind. \`describeErrorCode(code, 'en' | 'zh')\` gives the sentence of a code to a program.\n\nThe rows are the codes the sources name whole. Some parts put a code together from their area and a short name while running, so a code can be thrown that has no row here; its message carries its sentence all the same, made by the same rule.

## The codes a game meets first

| Code | Meaning |
| --- | --- |
`,
  zh: `# 错误码

[English](../../en/docs/error-codes.md) | 简体中文

本 SDK 抛出的每个错误都是带 \`code\` 的 \`EgretError\`。本页列出每个错误码及其含义。它由 \`node tools/error-codes.mjs\` 根据源码生成；当本页与源码不一致时 \`tests/error-codes.test.mjs\` 会失败。

## 怎样读一个错误

| 部分 | 内容 |
| --- | --- |
| \`error.code\` | 大写的错误码。它是稳定的：程序用它来比较 |
| \`error.message\` | 错误码加一句说明，默认是英文。先调用 \`@egret/engine\` 的 \`setErrorLanguage('zh')\`，之后创建的错误就带本页的中文说明。它是给人看的，措辞可能调整 |
| \`error.cause\` | 导致这个错误的原因（如果有）：\`FRAME_RENDER_FAILED\` 背后 Host 自己的错误，或应用回调抛出的内容 |
| \`error.cleanupErrors\` | 出错后清理时又出现的问题（如果有） |

错误码由"哪个部分"和"出了什么问题"组成。开头表示部分，结尾表示发生了什么：\`..._OPTIONS_INVALID\` 表示选项无效，\`..._CLOSED\` 和 \`..._DISPOSED\` 表示在结束之后还在使用，\`..._REENTRANT\` 表示在自己的回调里又调用了自己，\`..._LIMIT\` 和 \`..._BUDGET\` 表示超出了上限，\`..._FAILED\` 表示失败，原因在 \`cause\` 中。

游戏最常遇到的错误码有专门写的说明，其中包含该怎么做。其余说明由部分和结尾拼成；结尾不属于常见种类的错误码则逐个写了说明。\`describeErrorCode(code, 'en' | 'zh')\` 把某个错误码的说明交给程序。\n\n表中各行是源码里完整写出的错误码。有些部分在运行时用自己的前缀加一个短名拼出错误码，所以可能抛出本页没有列出的错误码；它的 message 仍然带有按同样规则生成的说明。

## 游戏最先遇到的错误码

| 错误码 | 含义 |
| --- | --- |
`
};
const FIRST = [
  'FRAME_RENDER_FAILED',
  'WEBGL2_BACKPRESSURE',
  'WEBGPU_BACKPRESSURE',
  'CLOCK_DELTA_LIMIT',
  'OBJECT_DISPOSED',
  'SCOPE_CLOSED',
  'ENGINE_CLOSED',
  'ENGINE_MISMATCH',
  'DISPLAY_VALUE_INVALID',
  'FRAME_TRANSFORM_INVALID',
  'FRAME_BUDGET_EXCEEDED',
  'FRAME_IMAGE_BUDGET',
  'GRAPHICS_FILL_REQUIRED',
  'GRAPHICS_VALUE_INVALID',
  'ASSET_PROVIDER_MISSING',
  'ASSET_LOAD_FAILED',
  'BITMAP_TEXTURE_REQUIRED',
  'ASYNC_EVENT_HANDLER',
  'VIDEO_PLAY_REFUSED',
  'WEBGL2_CONTEXT_LOST',
  'WEBGPU_DEVICE_LOST',
  'WEBGPU_UNAVAILABLE'
];
const GROUPS = {
  en: ['All codes, by area', 'Other codes', 'Code', 'Meaning'],
  zh: ['全部错误码，按部分排列', '其他错误码', '错误码', '含义']
};

/** The text of one of the two documents, 'en' or 'zh', for the given codes. */
export function buildErrorCodeDocument(language, codes) {
  const say = language === 'en' ? code => describeErrorCode(code, 'en') : describeZh,
    cell = code => say(code) || '—';
  let out = HEAD[language];
  for (const code of FIRST) {
    if (!codes.includes(code)) throw new Error('A code listed first is no longer thrown: ' + code);
    out += '| `' + code + '` | ' + cell(code) + ' |\n';
  }
  out += '\n## ' + GROUPS[language][0] + '\n';
  // Areas in the order of their names; a code of no area goes last.
  const names = [...new Set(ZH_AREAS.map(([prefix]) => prefix))].sort(),
    byArea = new Map(names.map(name => [name, []])),
    other = [];
  for (const code of codes) {
    const area = areaOf(code);
    if (area) byArea.get(area[0]).push(code);
    else other.push(code);
  }
  const table = rows =>
    '| ' +
    GROUPS[language][2] +
    ' | ' +
    GROUPS[language][3] +
    ' |\n| --- | --- |\n' +
    rows.map(code => '| `' + code + '` | ' + cell(code) + ' |\n').join('');
  for (const name of names) {
    const rows = byArea.get(name);
    if (rows.length !== 0) out += '\n### ' + name + '\n\n' + table(rows);
  }
  if (other.length !== 0) out += '\n### ' + GROUPS[language][1] + '\n\n' + table(other);
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const codes = collectErrorCodes(),
    check = process.argv.includes('--check');
  let stale = 0;
  for (const language of ['en', 'zh']) {
    const text = buildErrorCodeDocument(language, codes),
      file = path.join(root, ERROR_CODE_DOCUMENTS[language]);
    if (check) {
      if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) {
        console.error('Out of date: ' + ERROR_CODE_DOCUMENTS[language] + '. Run node tools/error-codes.mjs');
        stale++;
      }
    } else fs.writeFileSync(file, text);
  }
  const without = codes.filter(code => describeErrorCode(code, 'en') === '' || describeErrorCode(code, 'zh') === '');
  console.log(
    codes.length +
      ' codes; ' +
      without.length +
      ' without a sentence' +
      (without.length ? ': ' + without.join(', ') : '') +
      (check ? (stale ? '; documents OUT OF DATE' : '; documents current') : '; documents written')
  );
  process.exitCode = stale ? 1 : 0;
}
