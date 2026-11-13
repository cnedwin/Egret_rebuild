// SPDX-License-Identifier: Apache-2.0
// Acquire the shared phone lease before installing the separate lab package.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const artifactDirectory = path.resolve(process.argv[2] ?? dir);
const apk = path.join(artifactDirectory, 'ChromePublic-JY133-Angle.apk');
const lock = process.env.JY_PHONE_LOCK;
const adb = process.env.JY_ADB;
assert(lock && adb && path.isAbsolute(lock) && path.isAbsolute(adb), 'Set JY_PHONE_LOCK and JY_ADB to absolute paths');
const expectedPackage = 'org.chromium.chrome';
const expectedVersion = '157.0.8103.78';
const sha = createHash('sha256').update(readFileSync(apk)).digest('hex');
const badging = readFileSync(path.join(artifactDirectory, 'apk-badging.txt'), 'utf8');
assert(badging.includes("name='" + expectedPackage + "'") &&
  badging.includes("versionName='" + expectedVersion + "'") &&
  badging.includes('arm64-v8a') && badging.includes('E: profileable') &&
  /android:shell.*(?:0xffffffff|true)/i.test(badging),
  'APK badging or profileability does not match the diagnostic build');

const connected = execFileSync(adb, ['devices', '-l'], { encoding: 'utf8', timeout: 10000 })
  .split(/\r?\n/).map(line => /^(\S+)\s+device\s+.*\bmodel:SM_F966U1\b/.exec(line))
  .filter(Boolean);
assert.equal(connected.length, 1, 'One authorized Fold7 required');
const serial = connected[0][1];
const runAdb = (...args) => execFileSync(adb, ['-s', serial, ...args], {
  encoding: 'utf8', timeout: 180000, windowsHide: true,
}).trim();
const owner = randomUUID();
writeFileSync(lock, JSON.stringify({ owner, pid: process.pid, startedAt: new Date().toISOString() }), { flag: 'wx' });
try {
  assert.equal(runAdb('get-state'), 'device');
  const packagePaths = runAdb('shell', 'pm', 'list', 'packages', expectedPackage).split(/\r?\n/);
  assert(!packagePaths.includes('package:' + expectedPackage),
    'An existing diagnostic package must be inspected before installing');
  const installed = runAdb('install', apk);
  assert.equal(installed.split(/\r?\n/).at(-1), 'Success');
  assert.match(runAdb('shell', 'pm', 'path', expectedPackage), /^package:/);
  const state = runAdb('shell', 'dumpsys', 'package', expectedPackage);
  assert(state.includes('versionName=' + expectedVersion));
  assert(/\bPROFILEABLE_BY_SHELL\b/.test(state));
  writeFileSync(path.join(artifactDirectory, 'install-receipt.json'), JSON.stringify({
    installedAt: new Date().toISOString(), package: expectedPackage, version: expectedVersion,
    arm64: true, profileableByShell: true, sha256: sha, adbStatus: installed,
  }, null, 2) + '\n', { flag: 'wx' });
} finally {
  const current = JSON.parse(readFileSync(lock, 'utf8'));
  assert.equal(current.owner, owner, 'Device lease no longer belongs to this process');
  unlinkSync(lock);
}
