// SPDX-License-Identifier: Apache-2.0
// Builds and verifies an arm64 debug APK with the installed SDK, NDK and JDK.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { prepareV8 } from './v8-dependencies.mjs';

const {values} = parseArgs({
  options: Object.fromEntries(['scene', 'output', 'sdk', 'ndk', 'jdk', 'platform', 'build-tools',
    'rust-lib', 'rust-notice', 'cargo', 'keystore', 'v8-profile', 'v8-cache'].map((name) => [name, {type: 'string'}]))
});
const here = path.dirname(fileURLToPath(import.meta.url));
const native = path.join(here, '../native');
const windows = process.platform === 'win32';
const executable = (name) => windows ? name + '.exe' : name;
function required(value, label) {
  if (!value) throw new Error('Missing ' + label);
  return path.resolve(value);
}
function run(file, args, options = {}) {
  const result = spawnSync(file, args, {stdio: 'inherit', ...options});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(path.basename(file) + ' exited ' + result.status);
}
const scene = required(values.scene, '--scene');
const output = required(values.output, '--output (APK path)');
const sdk = required(values.sdk ?? process.env.ANDROID_HOME, '--sdk / ANDROID_HOME');
const ndk = required(values.ndk ?? process.env.ANDROID_NDK_HOME, '--ndk / ANDROID_NDK_HOME');
const jdk = required(values.jdk ?? process.env.JAVA_HOME, '--jdk / JAVA_HOME');
const platform = path.join(sdk, 'platforms', values.platform ?? 'android-35', 'android.jar');
const buildTools = path.join(sdk, 'build-tools', values['build-tools'] ?? '35.0.0');
const tool = (name) => path.join(buildTools, executable(name));
const java = (name) => path.join(jdk, 'bin', executable(name));
const host = {win32: 'windows-x86_64', linux: 'linux-x86_64', darwin: 'darwin-x86_64'}[process.platform];
if (!host) throw new Error('Unsupported NDK build host');
const llvm = path.join(ndk, 'toolchains', 'llvm', 'prebuilt', host, 'bin');
mkdirSync(path.dirname(output), {recursive: true});
const work = mkdtempSync(path.join(path.dirname(output), 'apk-build-'));
const working = (...segments) => path.join(work, ...segments);
for (const directory of ['classes', 'dex', 'assets/scene', 'lib/arm64-v8a']) {
  mkdirSync(working(directory), {recursive: true});
}
const sceneFiles = ['fixture.json', 'atlas.rgba', 'frames.bin', 'host.html', 'host.js',
  'LICENSE', 'NOTICE', 'robust-predicates.LICENSE'];
for (const name of sceneFiles) {
  copyFileSync(path.join(scene, name), working('assets', 'scene', name));
}
let rustNotice = values['rust-notice'];
if (!rustNotice) {
  const sysroot = spawnSync('rustc', ['--print', 'sysroot'], {encoding: 'utf8'});
  if (sysroot.status !== 0) throw new Error('Supply --rust-notice from the Rust toolchain used for the archive');
  rustNotice = path.join(sysroot.stdout.trim(), 'share/doc/rust/COPYRIGHT-library.html');
}
mkdirSync(working('assets', 'licenses'), {recursive: true});
for (const [from, to] of [[rustNotice, 'rust-library.html'], [path.join(ndk, 'NOTICE'), 'android-ndk.txt'],
  [path.join(ndk, 'NOTICE.toolchain'), 'android-toolchain.txt']]) {
  copyFileSync(from, working('assets', 'licenses', to));
}
let archive;
if (values['rust-lib']) {
  archive = required(values['rust-lib'], '--rust-lib');
} else {
  run(values.cargo ?? 'cargo', ['build', '--locked', '--release', '--manifest-path',
    path.join(native, 'Cargo.toml'), '--target', 'aarch64-linux-android', '--target-dir', working('rust')]);
  archive = working('rust', 'aarch64-linux-android', 'release', 'libegret_runtime_native.a');
}
run(path.join(llvm, executable('clang')), ['--target=aarch64-linux-android26', '-O2', '-fPIC',
  '-shared', '-Wl,--no-undefined', '-Wl,-z,max-page-size=16384', '-Wl,--gc-sections', '-Wl,-s',
  '-I', path.join(native, 'include'), path.join(here, 'src/renderer_jni.c'), archive,
  '-lGLESv3', '-landroid', '-llog', '-ldl', '-lm', '-o', working('lib/arm64-v8a/libegret_sample.so')]);
const source = path.join(here, 'src/org/egret/runtime/sample');
const javaFiles = readdirSync(source).filter((name) => name.endsWith('.java')).sort().map(name => path.join(source, name));
const v8 = values['v8-profile'] === undefined ? null : await prepareV8({
  profile: values['v8-profile'],
  cache: path.resolve(values['v8-cache'] ?? path.join(path.dirname(output), 'v8-cache')),
  working, jar: java('jar'), strip: path.join(llvm, executable('llvm-strip')), run
});
// The Javet arm64 ELF Android notes declare API 29. The Rust/System WebView host targets API 26.
const minSdk = v8 ? '29' : '26';
if (v8) javaFiles.push(path.join(here, 'v8/org/egret/runtime/sample/JavetScene.java'));
run(java('javac'), ['-encoding', 'UTF-8', '--release', '8', '-classpath',
  [platform, ...(v8 ? [v8.classes] : [])].join(path.delimiter), '-d', working('classes'), ...javaFiles]);
run(java('jar'), ['cf', working('classes.jar'), '-C', working('classes'), '.']);
run(java('java'), ['-cp', path.join(buildTools, 'lib/d8.jar'), 'com.android.tools.r8.D8',
  '--min-api', minSdk, '--lib', platform, '--output', working('dex'), working('classes.jar'), ...(v8 ? [v8.classes] : [])]);
run(tool('aapt2'), ['link', '--manifest', path.join(here, 'AndroidManifest.xml'), '-I', platform,
  '--min-sdk-version', minSdk, '-o', working('base.apk')]);
run(java('jar'), ['uf', working('base.apk'), '-C', working('dex'), 'classes.dex', '-C', work, 'lib',
  '-C', work, 'assets']);
run(tool('zipalign'), ['-f', '-P', '16', '4', working('base.apk'), working('aligned.apk')]);
// This is a local debug identity only. Retain it to update installations made with the same build directory.
const key = values.keystore ? path.resolve(values.keystore) : path.join(path.dirname(output), 'egret-debug.p12');
if (!existsSync(key)) {
  run(java('keytool'), ['-genkeypair', '-storetype', 'PKCS12', '-keystore', key, '-alias', 'egret-debug',
    '-keyalg', 'RSA', '-keysize', '2048', '-validity', '3650', '-dname', 'CN=Egret Runtime Local Debug',
    '-storepass', 'android', '-keypass', 'android']);
}
const signer = path.join(buildTools, 'lib', 'apksigner.jar');
run(java('java'), ['-jar', signer, 'sign', '--ks', key, '--ks-key-alias', 'egret-debug',
  '--ks-pass', 'pass:android', '--out', output, working('aligned.apk')]);
run(java('java'), ['-jar', signer, 'verify', '--verbose', output]);
run(tool('zipalign'), ['-c', '-P', '16', '4', output]);
const badging = spawnSync(tool('aapt2'), ['dump', 'badging', output], {encoding: 'utf8'});
if (badging.status !== 0 || !badging.stdout.split(/\r?\n/).includes("minSdkVersion:'" + minSdk + "'")) {
  throw new Error('Signed APK does not declare minSdkVersion ' + minSdk);
}
// Some Windows aapt2 versions emit backslashes inside nested asset ZIP names.
// Verify identities in the final signed APK exactly as Android's AssetManager reads them.
const listing = spawnSync(java('jar'), ['tf', output], {encoding: 'utf8'});
if (listing.status !== 0) throw new Error('Cannot inspect signed APK');
const names = listing.stdout.trim().split(/\r?\n/);
for (const name of ['AndroidManifest.xml', 'classes.dex', 'lib/arm64-v8a/libegret_sample.so',
  'assets/licenses/rust-library.html', 'assets/licenses/android-ndk.txt', 'assets/licenses/android-toolchain.txt',
  ...sceneFiles.map((file) => 'assets/scene/' + file), ...(v8?.entries ?? [])]) {
  if (names.filter((entry) => entry === name).length !== 1) throw new Error('Invalid APK entry: ' + name);
}
if (names.some((name) => name.includes('\\'))) throw new Error('Nonportable APK entry');
console.log(JSON.stringify({apk: output, bytes: statSync(output).size, buildDirectory: work}));
