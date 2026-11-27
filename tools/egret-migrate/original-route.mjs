// SPDX-License-Identifier: Apache-2.0
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { original5NativeAbi } from '../../runtime-sdk/android/player/original5-abi.mjs';
import { logicalPath } from '../lib/file-identity.mjs';
import { readProjectFile, refuse } from './inspect.mjs';

const fileLimit = 16 * 1024 * 1024;
const totalLimit = 64 * 1024 * 1024;
const scriptLimit = 4095;
const stockCore = /(?:^|\/)egret(?:\.min)?\.js$/;
const webHost = /(?:^|\/)egret\.web(?:\.min)?\.js$/;
const groupKey = name => name.toLowerCase();

function jsonFile(owner, name, limit) {
  const file = readProjectFile(owner, name, limit);
  try {
    return JSON.parse(file.bytes.toString('utf8').replace(/^\uFEFF/, ''));
  } catch {
    refuse('MIGRATE_INPUT_JSON', 'Expected a JSON document.', { path: name });
  }
}

function checkList(list) {
  return (
    Array.isArray(list) &&
    list.length &&
    list.every(name => {
      try {
        return (
          logicalPath(name).endsWith('.js') && name.split('/').every(part => /^[A-Za-z0-9_][A-Za-z0-9._-]*$/.test(part))
        );
      } catch {
        return false;
      }
    })
  );
}

function launchObservation(launch, prepared, published, admitted) {
  const receiptPath = path.resolve(launch);
  const receipt = jsonFile(fs.realpathSync(path.dirname(receiptPath)), path.basename(receiptPath), 1024 * 1024);
  if (
    !/^[0-9a-f]{64}$/.test(receipt?.apkSha256) ||
    typeof receipt.player?.lastError !== 'string' ||
    !receipt.player.lastError.trim()
  ) {
    refuse('MIGRATE_ANDROID_RUN', 'Expected an APK SHA-256 and a player.lastError from the supplied Android launch.');
  }
  // Accept only the standard packaged-script error. Raw errors can contain account or server data.
  const name = /Cannot run project script (original\/[0-9]{4}\.js):/.exec(receipt.player.lastError)?.[1];
  if (!name) return { status: 'unmapped-error', apkSha256: receipt.apkSha256 };
  const ordinal = Number(name.slice('original/'.length, -3));
  const expected = [...admitted.keys()][ordinal];
  let source, mapOrigin;
  if (fs.existsSync(path.join(prepared, 'original-script-map.json'))) {
    source = jsonFile(prepared, 'original-script-map.json', 1024 * 1024)?.[name];
    mapOrigin = 'preparer-source-map';
  } else {
    // Earlier exports kept the ordered groups and renamed bytes but did not write the sidecar.
    const groups = jsonFile(prepared, 'project.json', 65536)?.v8Scripts?.groups;
    const order = ['originalCore', 'originalModules', 'originalGame'].flatMap(key => groups?.[key] ?? []);
    if (order.length !== admitted.size || order[ordinal] !== name)
      refuse('MIGRATE_ANDROID_RUN', 'The earlier prepared groups do not identify the reported script.');
    source = expected;
    mapOrigin = 'earlier-prepared-groups';
  }
  if (!expected || source !== expected)
    refuse('MIGRATE_ANDROID_RUN', 'Script map and published order disagree at the reported script.');
  const staged = readProjectFile(prepared, name, fileLimit).identity;
  if (
    staged.sha256 !== admitted.get(source) ||
    staged.sha256 !== readProjectFile(published, source, fileLimit).identity.sha256
  ) {
    refuse('MIGRATE_ANDROID_RUN', 'The staged and published script bytes differ.', { path: source });
  }
  return {
    status: 'mapped-script',
    mapOrigin,
    apkSha256: receipt.apkSha256,
    packagedPath: name,
    publishedPath: source,
    scriptSha256: staged.sha256,
    association: 'supplied-run-and-prepared-directory'
  };
}

export function inspectOriginalRoute(source, report, options) {
  const { published, prepared, launch } = options;
  if (Boolean(prepared) !== Boolean(launch) || (launch && !published))
    refuse('MIGRATE_ARGUMENTS', 'Use --published, --prepared and --android-run together to map a launch failure.');
  if (report.engineVersion && !/^5\.3\.\d+$/.test(report.engineVersion)) {
    if (launch || published) refuse('MIGRATE_VERSION_UNSUPPORTED', 'The original Android binding admits 5.3.x only.');
    return { status: 'outside-version', nextAction: 'assess-migration-to-7', engineVersion: report.engineVersion };
  }
  const root = published ? path.resolve(published) : source;
  if (!fs.existsSync(path.join(root, 'manifest.json'))) {
    if (launch) refuse('MIGRATE_ANDROID_RUN', 'A matching published manifest is required to map a launch.');
    return { status: 'missing-manifest', nextAction: 'supply-published-5.3-build' };
  }
  const manifest = jsonFile(root, 'manifest.json', 16 * 1024 * 1024);
  if (!checkList(manifest.initial) || !checkList(manifest.game))
    return { status: 'invalid-script-order', path: 'manifest.json', nextAction: 'restore-published-manifest' };
  const { initial, game } = manifest;
  if (published && path.resolve(published) !== source && fs.existsSync(path.join(source, 'manifest.json'))) {
    const original = jsonFile(source, 'manifest.json', 16 * 1024 * 1024);
    if (JSON.stringify([original.initial, original.game]) !== JSON.stringify([initial, game]))
      refuse('MIGRATE_ANDROID_INPUT', 'Source and published manifests declare different script orders.');
  }
  const total = initial.length + game.length;
  const budget = {
    originalEntries: total,
    maxEntries: scriptLimit,
    maxScriptBytes: fileLimit,
    maxTotalBytesIncludingEntry: totalLimit
  };
  if (total > scriptLimit)
    return { status: 'over-budget', budget, path: 'manifest.json', nextAction: 'revise-published-script-layout' };
  const all = [...initial, ...game];
  if (new Set(all.map(groupKey)).size !== total)
    return { status: 'duplicate-scripts', path: 'manifest.json', nextAction: 'restore-unique-manifest-order' };
  const needsCore = !stockCore.test(initial[0]);
  const modules = initial.slice(1).filter(name => !webHost.test(name));
  const groups = [
    { name: 'originalCore', files: 1, first: initial[0], last: initial[0] },
    ...(modules.length
      ? [{ name: 'originalModules', files: modules.length, first: modules[0], last: modules.at(-1) }]
      : []),
    { name: 'originalGame', files: game.length, first: game[0], last: game.at(-1) }
  ];
  const admitted = new Map();
  const issues = { missing: [], oversized: [], invalidUtf8: [] };
  const counts = { missing: 0, oversized: 0, invalidUtf8: 0 };
  const record = (kind, name) => {
    counts[kind]++;
    if (issues[kind].length < 8) issues[kind].push(name);
  };
  let bytes = 0,
    examinedBytes = 0,
    beyondByteBudget = false;
  const versions = new Set();
  let nativeAbi, abiDiagnostic;
  const digest = createHash('sha256');
  for (const name of [initial[0], ...modules, ...game]) {
    const stat = fs.lstatSync(path.join(root, name), { throwIfNoEntry: false });
    if (!stat) {
      record('missing', name);
      continue;
    }
    bytes += stat.size;
    if (stat.size > fileLimit) {
      record('oversized', name);
      continue;
    }
    if (examinedBytes + stat.size > totalLimit) {
      beyondByteBudget = true;
      continue;
    }
    const file = readProjectFile(root, name, Math.min(fileLimit, totalLimit - examinedBytes));
    examinedBytes += file.identity.bytes;
    admitted.set(name, file.identity.sha256);
    digest.update(JSON.stringify([name, file.identity.sha256]) + '\n');
    try {
      const js = new TextDecoder('utf-8', { fatal: true }).decode(file.bytes);
      if (name === initial[0]) {
        for (const match of js.matchAll(/\.engineVersion\s*=\s*["']([0-9]+\.[0-9]+\.[0-9]+)["']/g))
          versions.add(match[1]);
        if (versions.size === 1 && /^5\.3\.\d+$/.test([...versions][0])) {
          try {
            nativeAbi = original5NativeAbi(js);
          } catch (error) {
            abiDiagnostic = error.message;
          }
        }
      }
    } catch {
      record('invalidUtf8', name);
    }
  }
  const [version] = versions;
  if (launch && (counts.missing || counts.oversized || counts.invalidUtf8 || beyondByteBudget))
    refuse('MIGRATE_ANDROID_RUN', 'Mapping a launch requires a complete original script inventory.');
  const observation = launch ? launchObservation(launch, path.resolve(prepared), root, admitted) : undefined;
  let status = 'ready-for-preparation',
    nextAction = 'prepare-original5-and-test-startup';
  if (beyondByteBudget || bytes >= totalLimit || counts.oversized) {
    status = 'over-budget';
    nextAction = 'revise-published-script-layout';
  } else if (counts.missing) {
    status = 'missing-published-scripts';
    nextAction = 'compile-or-supply-original-scripts';
  } else if (counts.invalidUtf8) {
    status = 'invalid-encoding';
    nextAction = 'supply-original-utf8-scripts';
  } else if (versions.size !== 1 || needsCore) {
    status = 'review-core';
    nextAction = 'identify-original-core-and-abi';
  } else if (!/^5\.3\.\d+$/.test(version)) {
    status = 'outside-version';
    nextAction = 'assess-migration-to-7';
  } else if (abiDiagnostic) {
    status = 'review-core-abi';
    nextAction = 'qualify-original-core-abi';
  } else if (report.engineVersion && report.engineVersion !== version) {
    status = 'review-version';
    nextAction = 'compare-declared-and-published-core';
  } else if (observation) {
    status = 'observed-startup-failure';
    nextAction =
      observation.status === 'mapped-script' ? 'inspect-mapped-script-and-rerun' : 'inspect-native-startup-error';
  }
  return {
    status,
    nextAction,
    ...(version && { reportedCoreVersion: version }),
    ...(nativeAbi && { nativeAbi }),
    ...(abiDiagnostic && { abiDiagnostic }),
    budget,
    groups,
    scriptBytesPresent: bytes,
    inspectedBytes: examinedBytes,
    inspectedScripts: admitted.size,
    orderedInputsSha256: digest.digest('hex'),
    counts,
    examples: issues,
    ...(observation && { observation })
  };
}
