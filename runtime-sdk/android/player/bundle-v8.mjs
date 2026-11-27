// SPDX-License-Identifier: Apache-2.0
import { appendFileSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareV8 } from '../v8-dependencies.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

// Keep extraction outside the published AAR. Only the pinned runtime, arm64 ELF,
// applicable notices, and the selected profile's data cross this boundary.
export async function bundleV8({profile, cache, work, archive, jar, strip, run}) {
  const working = (...parts) => path.join(work, 'upstream-v8', ...parts);
  for (const dir of ['assets/licenses', 'lib/arm64-v8a']) mkdirSync(working(dir), {recursive:true});
  const v8 = await prepareV8({profile, cache, working, jar, strip, run});
  for (const name of v8.entries) {
    let destination;
    if (name.startsWith('lib/')) destination = 'jni/' + name.slice(4);
    else if (name.startsWith('assets/licenses/')) destination = 'assets/egret-player-licenses/' + path.basename(name);
    else if (name === 'assets/v8-profile.txt') destination = 'assets/egret-player-host.txt';
    else if (name === 'assets/icudtl.dat' || name === 'assets/icu-sha256.txt') destination = 'assets/egret-player-v8/' + path.basename(name);
    else throw new Error('Unknown pinned runtime entry: ' + name);
    const target = path.join(archive, destination);
    mkdirSync(path.dirname(target), {recursive:true});
    copyFileSync(working(name), target);
  }
  const assets = path.join(archive, 'assets/egret-player-v8');
  mkdirSync(assets, {recursive:true});
  copyFileSync(path.join(here,'v8/project-bootstrap.js'), path.join(assets,'bootstrap.js'));
  mkdirSync(path.join(archive,'libs'), {recursive:true});
  copyFileSync(v8.classes, path.join(archive,'libs/javet.jar'));
  // Javet resolves Java classes and callback signatures from native code.
  // Its published consumer file is empty. Preserve that ABI in an R8-enabled game.
  appendFileSync(path.join(archive, 'proguard.txt'), [
    '', readFileSync(v8.consumerRules, 'utf8'),
    '-keepattributes RuntimeVisibleAnnotations,AnnotationDefault',
    '-keep class com.caoccao.javet.** { *; }',
    '-keepclassmembers class org.egret.runtime.player.** { @com.caoccao.javet.annotations.V8Function <methods>; }', ''
  ].join('\n'));
  return v8.classes;
}

// javac sees one factory. The base AAR has no class linkage to the optional VM.
export function writeHostFactory(work, profile) {
  const expression = profile === 'webview' ? 'new PlayerScripts(owner, activity, project)' :
    'new JavetProjectScripts(owner, activity, project, PROFILE)';
  const file = path.join(work, 'BundledScripts.java');
  writeFileSync(file, [
    'package org.egret.runtime.player;', 'final class BundledScripts {',
    '    static final String PROFILE = "' + profile + '";',
    '    static ScriptSession open(EgretPlayerView owner, android.app.Activity activity, ProjectAssets project) throws Exception {',
    '        return ' + expression + ';', '    }', '}', ''
  ].join('\n'));
  return file;
}
