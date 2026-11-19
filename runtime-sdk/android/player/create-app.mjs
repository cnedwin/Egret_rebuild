// SPDX-License-Identifier: Apache-2.0
import { copyFile, lstat, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { exportProject } from './export-project.mjs';

const {values} = parseArgs({options: Object.fromEntries(
  ['project','aar','esbuild','id','layout','out'].map(name => [name,{type:'string'}]))});
const {id, project, aar, esbuild, out, layout = 'standalone'} = values;
if (!out || !project || !aar || !esbuild || !/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/.test(id ?? '')) {
  throw new Error('Supply --project, --aar, --esbuild, --id (Android application ID) and --out');
}
if (layout !== 'standalone' && layout !== 'embedded') throw new Error('Expected standalone or embedded layout');
const activity = layout === 'standalone' ? 'GameActivity' : 'LibraryActivity';
const destination = path.resolve(out);
try { await lstat(destination); throw new Error('Use a new destination'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(path.dirname(destination), {recursive:true});
const work = await mkdtemp(path.join(path.dirname(destination), 'egret-app-'));
try {
  const source = path.join(work, 'src/main');
  const java = path.join(source, 'java/org/egret/example');
  await mkdir(path.join(work, 'libs'), {recursive:true});
  await mkdir(java, {recursive:true});
  await copyFile(aar, path.join(work, 'libs/egret-player.aar'));
  await copyFile(new URL('./consumers/GameInsets.java', import.meta.url), path.join(java, 'GameInsets.java'));
  await copyFile(new URL('./consumers/' + activity + '.java', import.meta.url), path.join(java, activity + '.java'));
  await exportProject(project, path.join(source, 'assets/game'), esbuild);
  await writeFile(path.join(work, 'settings.gradle'), "pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }\ndependencyResolutionManagement { repositories { google(); mavenCentral() } }\nrootProject.name = 'EgretGame'\n");
  await writeFile(path.join(work, 'build.gradle'), [
    "plugins { id 'com.android.application' version '8.7.3' }",
    "android {", "    namespace 'org.egret.example'", "    compileSdk 35", "    buildToolsVersion '35.0.0'",
    "    defaultConfig {", "        applicationId '" + id + "'", "        minSdk 26",
    "        targetSdk 35", "        versionCode 1", "        versionName '1.0'", "    }", "}",
    "dependencies { implementation files('libs/egret-player.aar') }", ""
  ].join('\n'));
  await writeFile(path.join(source, 'AndroidManifest.xml'), [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<manifest xmlns:android="http://schemas.android.com/apk/res/android">',
    '    <application android:label="' + (layout === 'standalone' ? 'Egret Game' : 'Egret Game Library') + '"',
    '        android:allowBackup="false" android:theme="@android:style/Theme.Material.NoActionBar">',
    '        <activity android:name="org.egret.example.' + activity + '" android:exported="true" android:windowSoftInputMode="adjustResize">',
    '            <intent-filter>', '                <action android:name="android.intent.action.MAIN"/>',
    '                <category android:name="android.intent.category.LAUNCHER"/>', '            </intent-filter>',
    '        </activity>', '    </application>', '</manifest>', ''
  ].join('\n'));
  await rename(work, destination);
} finally { await rm(work, {recursive:true,force:true}); }
