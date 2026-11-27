// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import {compareReleaseApks, parseApkIdentity} from './compare-release-apks.mjs';

const cert = 'a'.repeat(64);
function app(version, name = 'org.egret.station', signers = [cert]) {
  const badging = "package: name='" + name + "' versionCode='" + version + "' versionName='1.0'\n";
  const signatures = signers.map((hash, i) => 'Signer #' + (i + 1) + ' certificate SHA-256 digest: ' + hash).join('\n');
  return parseApkIdentity(badging, signatures);
}

test('only a higher version for the same app and verified signer set is a local release candidate', () => {
  assert.equal(compareReleaseApks(app(11), app(12)).status, 'ready-for-device-test');
  assert.equal(compareReleaseApks(app(11), app(11)).status, 'version-not-increased');
  assert.equal(compareReleaseApks(app(12), app(11)).status, 'version-not-increased');
  assert.equal(compareReleaseApks(app(11), app(12, 'org.example.other')).status, 'different-application');
  assert.equal(compareReleaseApks(app(11), app(12, undefined, ['b'.repeat(64)])).status, 'review-signing-lineage');
  assert.equal(compareReleaseApks(app(1, undefined, [cert, 'b'.repeat(64)]),
    app(2, undefined, ['b'.repeat(64), cert])).status, 'ready-for-device-test');
});

test('unsupported and incomplete SDK output cannot certify an upgrade', () => {
  const prefix = "package: name='org.egret.station' versionCode='12' versionName='1.0'";
  const signature = 'Signer #1 certificate SHA-256 digest: ' + cert;
  for (const badging of [prefix + " split='config.arm64_v8a'", prefix + " versionCodeMajor='1'", '', prefix.replace("'12'", "'-1'")]) {
    assert.throws(() => parseApkIdentity(badging, signature));
  }
  assert.throws(() => parseApkIdentity(prefix + " split='0'", signature));
  assert.throws(() => parseApkIdentity(prefix + '\napplication-debuggable', signature));
  assert.throws(() => parseApkIdentity(prefix, 'Source Stamp Signer certificate SHA-256 digest: ' + cert));
});
