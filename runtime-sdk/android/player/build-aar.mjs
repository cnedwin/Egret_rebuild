// SPDX-License-Identifier: Apache-2.0
// Compile only the embeddable player. Game scripts, an Activity and signing keys belong to the consumer.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const {values} = parseArgs({options: Object.fromEntries(
  ['out','sdk','ndk','jdk','rust-lib','rust-notice'].map(key => [key,{type:'string'}]))});
function dir(value, label) {
  if (!value) throw new Error('Missing ' + label);
  return path.resolve(value);
}
const output = dir(values.out, '--out');
const sdk = dir(values.sdk ?? process.env.ANDROID_HOME, 'Android SDK');
const ndk = dir(values.ndk ?? process.env.ANDROID_NDK_HOME, 'Android NDK');
const jdk = dir(values.jdk ?? process.env.JAVA_HOME, 'JDK');
const host = {win32:'windows-x86_64', linux:'linux-x86_64', darwin:'darwin-x86_64'}[process.platform];
if (!host) throw new Error('Unsupported build host');
const exe = name => name + (process.platform === 'win32' ? '.exe' : '');
const java = name => path.join(jdk, 'bin', exe(name));
function run(file, args) { execFileSync(file, args, {stdio:'inherit'}); }
mkdirSync(path.dirname(output), {recursive:true});
const work = mkdtempSync(path.join(path.dirname(output), 'player-aar-'));
try {
  const archive = path.join(work, 'archive');
  const jni = path.join(archive, 'jni/arm64-v8a');
  const notices = path.join(archive, 'assets/egret-player-licenses');
  const classes = path.join(work, 'classes');
  for (const location of [jni,notices,classes]) mkdirSync(location, {recursive:true});
  const native = path.join(root, 'runtime-sdk/native');
  let rust = values['rust-lib'];
  if (!rust) {
    run('cargo', ['build','--locked','--offline','--release','--manifest-path',path.join(native,'Cargo.toml'),
      '--target','aarch64-linux-android','--target-dir',path.join(work,'rust')]);
    rust = path.join(work, 'rust/aarch64-linux-android/release/libegret_runtime_native.a');
  }
  run(path.join(ndk, 'toolchains/llvm/prebuilt', host, 'bin', exe('clang')), [
    '--target=aarch64-linux-android26','-DEGRET_ANDROID_PLAYER','-O2','-fPIC','-shared','-Wl,--no-undefined',
    '-Wl,-z,max-page-size=16384','-Wl,--gc-sections','-Wl,-s','-I',path.join(native,'include'),
    path.join(here,'../src/renderer_jni.c'), path.resolve(rust), '-lGLESv3','-landroid','-llog',
    '-ldl','-lm','-o',path.join(jni,'libegret_player.so')]);
  const source = path.join(here,'src/org/egret/runtime/player');
  const javaFiles = readdirSync(source).filter(file => file.endsWith('.java')).sort();
  run(java('javac'), ['-encoding','UTF-8','--release','8','-classpath',path.join(sdk,'platforms/android-35/android.jar'),
    '-d',classes,...javaFiles.map(file => path.join(source,file))]);
  run(java('jar'), ['cf',path.join(archive,'classes.jar'),'-C',classes,'.']);
  const rustNotice = values['rust-notice'] ?? path.join(execFileSync('rustc',['--print','sysroot'],{encoding:'utf8'}).trim(),
    'share/doc/rust/COPYRIGHT-library.html');
  for (const [from,to] of [[rustNotice,'rust-library.html'],[path.join(ndk,'NOTICE'),'android-ndk.txt'],
    [path.join(ndk,'NOTICE.toolchain'),'android-toolchain.txt'],[path.join(root,'LICENSE'),'LICENSE'],
    [path.join(root,'NOTICE'),'NOTICE'],[path.join(root,'third-party/robust-predicates-3.0.3.LICENSE'),'robust-predicates.LICENSE']]) {
    copyFileSync(from,path.join(notices,to));
  }
  copyFileSync(path.join(here,'AndroidManifest.xml'),path.join(archive,'AndroidManifest.xml'));
  copyFileSync(path.join(here,'proguard.txt'),path.join(archive,'proguard.txt'));
  writeFileSync(path.join(archive,'R.txt'),'');
  const result = path.join(work,'player.aar');
  run(java('jar'), ['cMf',result,'-C',archive,'.']);
  if (!existsSync(result)) throw new Error('AAR was not produced');
  copyFileSync(result, output);
} finally { rmSync(work, {recursive:true,force:true}); }
