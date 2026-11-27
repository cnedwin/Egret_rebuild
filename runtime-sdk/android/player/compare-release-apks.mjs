// SPDX-License-Identifier: Apache-2.0
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';

/** Inspect standalone APKs built with the player's positive 32-bit version code. */
export function parseApkIdentity(badging, certificates) {
  const row = badging.split(/\r?\n/).find(line => line.startsWith('package: ')) ?? '';
  const applicationId = /\bname='([^']+)'/.exec(row)?.[1];
  const code = /\bversionCode='([1-9]\d*)'/.exec(row)?.[1];
  if (!applicationId || !code || Number(code) > 2147483647 ||
      /\bsplit='[^']+'/.test(row) || /\bversionCodeMajor='(?!0')[^']+'/.test(row) ||
      /^application-debuggable\s*$/m.test(badging)) {
    throw new Error('Expected a standalone Android player APK with a supported version code');
  }
  const signerDigests = [...certificates.matchAll(/^Signer #\d+ certificate SHA-256 digest:\s*([0-9a-f]{64})\s*$/gim)]
    .map(match => match[1].toLowerCase()).sort();
  if (!signerDigests.length || new Set(signerDigests).size !== signerDigests.length) {
    throw new Error('Cannot identify the APK signing certificates');
  }
  return {applicationId, versionCode: Number(code), signerDigests};
}

export function compareReleaseApks(previous, candidate) {
  let status = 'ready-for-device-test';
  if (previous.applicationId !== candidate.applicationId) status = 'different-application';
  else if (candidate.versionCode <= previous.versionCode) status = 'version-not-increased';
  else if (previous.signerDigests.join() !== candidate.signerDigests.join()) status = 'review-signing-lineage';
  return {status, previous, candidate};
}

function inspect(file, buildTools, jdk) {
  const executable = process.platform === 'win32' ? '.exe' : '';
  const apk = path.resolve(file);
  const options = {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, windowsHide: true};
  const certs = execFileSync(path.join(jdk, 'bin', 'java' + executable),
    ['-jar', path.join(buildTools, 'lib', 'apksigner.jar'), 'verify', '--print-certs', apk], options);
  const manifest = execFileSync(path.join(buildTools, 'aapt2' + executable), ['dump', 'badging', apk], options);
  return parseApkIdentity(manifest, certs);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const {values} = parseArgs({options: Object.fromEntries(
    ['previous','candidate','build-tools','jdk'].map(name => [name, {type:'string'}]))});
  const jdk = values.jdk || process.env.JAVA_HOME;
  if (!values.previous || !values.candidate || !values['build-tools'] || !jdk) {
    throw new Error('Supply --previous, --candidate, --build-tools and JAVA_HOME or --jdk');
  }
  const results = [values.previous, values.candidate].map(file => inspect(file, values['build-tools'], jdk));
  const comparison = compareReleaseApks(...results);
  console.log(JSON.stringify(comparison, null, 2));
  if (comparison.status !== 'ready-for-device-test') process.exitCode = 2;
}
