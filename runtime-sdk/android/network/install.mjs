// SPDX-License-Identifier: Apache-2.0
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const dependencies = new Map([
  ['Java-WebSocket-1.6.0.jar', 'eae29213e4f16515639c28957200f011b3967fffcada1962cf0255d24919c22f'],
  ['slf4j-api-2.0.13.jar', 'e7c2a48e8515ba1f49fa637d57b4e2f590b3f5bd97407ac699c3aa5efb1204a9']
]);

/** Stage only reviewed local dependencies and origins into the Android consumer. The default player stays offline. */
export async function installPlayerNetwork(project, activity, filename) {
  const config = JSON.parse(await readFile(filename, 'utf8'));
  if (!config || Object.keys(config).length !== 2 || config.schemaVersion !== 1 ||
      !Array.isArray(config.origins) || !config.origins.length || config.origins.length > 32)
    throw new TypeError('Expected 1 to 32 secure origins in a version 1 network config.');
  const origins = config.origins.map(input => {
    if (typeof input !== 'string') throw new TypeError('Expected an HTTPS or WSS origin.');
    const uri = new URL(input);
    // Emit URI-safe literal ASCII only. Path, credentials and user-controlled Java code never enter the Activity.
    if (!['https:', 'wss:'].includes(uri.protocol) || !/^[a-z0-9.:[\]-]+$/i.test(uri.host) ||
        input !== uri.origin || uri.port === '0') throw new TypeError('Use a canonical HTTPS/WSS origin without a path.');
    return uri.origin;
  });
  const archiveList = JSON.parse(await readFile(path.join(project, 'egret-channel.json'), 'utf8').catch(() => {
    throw new Error('--network requires --channel with the pinned Java-WebSocket and SLF4J JARs.');
  }));
  for (const [file, sha256] of dependencies) {
    if (!archiveList.libraries.some(item => item.file === file && item.sha256 === sha256))
      throw new Error('Missing pinned network dependency: ' + file);
  }
  const src = path.join(project, 'src/main');
  const provider = 'java/org/egret/runtime/network/PlayerNetwork.java';
  await mkdir(path.dirname(path.join(src, provider)), { recursive:true });
  await copyFile(new URL('./src/org/egret/runtime/network/PlayerNetwork.java', import.meta.url), path.join(src, provider));
  const licenseDir = path.join(src, 'assets/licenses');
  await mkdir(licenseDir, { recursive:true });
  for (const name of ['Java-WebSocket-1.6.0.LICENSE','slf4j-2.0.13.LICENSE'])
    await copyFile(new URL('./licenses/' + name, import.meta.url), path.join(licenseDir, name));
  const java = path.join(src, 'java/org/egret/example');
  const factory = [
    '// SPDX-License-Identifier: Apache-2.0',
    'package org.egret.example;',
    'import android.app.Activity;',
    'import java.util.Arrays;',
    'import java.util.Collections;',
    'import java.util.HashMap;',
    'import java.util.Map;',
    'import org.egret.runtime.player.ProjectHostServices;',
    'import org.egret.runtime.network.PlayerNetwork;',
    'import org.egret.runtime.player.EgretPlayerView;',
    '',
    'final class GameNetwork {',
    '    static EgretPlayerView open(Activity activity, String game, EgretPlayerView.Listener listener) {',
    '        return open(activity, game, listener, Collections.emptyMap());',
    '    }',
    '    static EgretPlayerView open(Activity activity, String game, EgretPlayerView.Listener listener,',
    '                                Map<String, ProjectHostServices.Handler> channels) {',
    '        Map<String, ProjectHostServices.Handler> services = new HashMap<>(channels);',
    '        if (services.containsKey(PlayerNetwork.ACTION)) throw new IllegalArgumentException("Duplicate network action");',
    '        PlayerNetwork network = new PlayerNetwork(Arrays.asList(' + origins.map(origin=>JSON.stringify(origin)).join(', ') + '));',
    '        services.put(PlayerNetwork.ACTION, network);',
    '        return new EgretPlayerView(activity, game, listener, services);',
    '    }',
    '}',
    ''
  ];
  await writeFile(path.join(java, 'GameNetwork.java'), factory.join('\n'));
  const activityFile = path.join(java, activity + '.java');
  const template = await readFile(activityFile, 'utf8');
  const constructor = 'new EgretPlayerView(this, "game",';
  if (template.split(constructor).length !== 2) throw new Error('Missing project player constructor in ' + activity);
  await writeFile(activityFile, template.replace(constructor, 'GameNetwork.open(this, "game",'));
}
