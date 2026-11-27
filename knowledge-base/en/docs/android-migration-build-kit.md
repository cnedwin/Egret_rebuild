# Rebuild a migrated Android game

English | [简体中文](../../Cns/docs/android-migration-build-kit.md)

A handoff has three parts: the editable game project, a build kit for the customer's operating system and architecture, and the standalone Gradle application. Keep all three in separate directories. The kit contains the built Egret modules, the 2D and World3D player adapters, the supplied player AAR, the exporter and esbuild 0.28.2. The application owns its Activity, application ID, settings, vendor integrations and signing identity.

## Prepare the kit

In the built engine checkout, use Node 26.7.0. Supply a player AAR built from the same engine revision. Record the engine commit, the AAR digest and the digest of the finished kit manifest in the delivery receipt. For an Android game that imports the classic packet codec or tiled character layers, include `--legacy`. The kit supplies `@egret/legacy/protocol` and `@egret/legacy/scene`. Add `--spine` if the game uses Spine and the recipient has the appropriate distribution rights.

```sh
node runtime-sdk/android/player/pack-build-kit.mjs --esbuild <installed-esbuild-directory> --aar <player.aar> --out <new-kit-directory>
```

From the delivered kit directory, verify the files, then create a Gradle project. Keep the output outside the kit. No engine checkout or npm installation is needed on this path.

```sh
node verify-build-kit.mjs
node runtime-sdk/android/player/create-app.mjs --project <editable-game> --aar libs/egret-player.aar --esbuild node_modules/esbuild --id com.example.game --name "Example" --out <new-application>
```

Use Gradle 8.11.1, JDK 17, Android SDK Platform 36 and Build Tools 35.0.0. Supply `JAVA_HOME` and `ANDROID_HOME`. To build offline from an empty Gradle home, set `EGRET_ANDROID_MAVEN_REPO` to the absolute path of a prepared Maven repository containing the locked plugin and dependencies. The default repositories remain available when this variable is unset. Ship the permitted dependencies and their notices separately, or document where the customer obtains them. For Release, set EGRET_ANDROID_KEYSTORE to the absolute keystore path and set EGRET_ANDROID_KEY_ALIAS, EGRET_ANDROID_STORE_PASSWORD and EGRET_ANDROID_KEY_PASSWORD in the build environment. [Android packaging and signing](android-project-player.md)

## Preserve the Android host when editing gameplay

After changing the game, run the exporter from the kit. It builds the game once and identifies the resulting file tree by SHA-256. The returned path is an immutable game revision. Keep the Gradle application and its build directory between iterations.

```sh
node runtime-sdk/android/player/stage-revision.mjs --project <editable-game> --store <revisions> --esbuild node_modules/esbuild
node runtime-sdk/android/player/stage-revision.mjs --verify <returned-revision-directory>
gradle --offline -p <application> -PegretGameRevision=<returned-revision-directory> assembleDebug
```

The Gradle task validates all revision files, replaces the game's assets in the APK and retains other application assets. Omitting the property builds the original embedded version. When all builds using the store have stopped, the following command keeps two accepted revisions. To select another number, pass `--retain-count N` and one distinct `--keep` digest for each of the N versions. It validates the candidates before removing older managed directories. Leave the store outside the game and the kit.

```sh
node runtime-sdk/android/player/stage-revision.mjs --prune --store <revisions> --keep <accepted-SHA256> --keep <previous-SHA256>
```

## Ship a second local release

Keep the installed game's application ID, signing identity and Android project. Build an accepted first APK with the customer's signing configuration. For the next edition, edit the game and stage a new revision as above. Increase `versionCode` in the existing Android project's `egret-app.json` and update `versionName`. Build the same Android application with the staged game. This preserves Activity registrations, vendor integrations and the application's storage namespace.

```sh
gradle --offline -p <application> -PegretGameRevision=<accepted-revision-directory> assembleRelease bundleRelease
node runtime-sdk/android/player/compare-release-apks.mjs --previous <first.apk> --candidate <second.apk> --build-tools <android-sdk>/build-tools/35.0.0 --jdk <jdk17>
```

The command verifies both APK signatures using Android Build Tools and reads both manifests. `ready-for-device-test` identifies the same application and current signer set with an increasing version code. A changed signing certificate requires separate review of the signing lineage. Compare the actual device-distributed builds when a store signs them. Use the standalone APKs produced by `assembleRelease`. For a split installation, validate the complete set of APKs delivered by bundletool or the store on the device.

Install the first APK on a dedicated device, make a recognizable save, and restart it. Install the candidate with `adb install -r <second.apk>`. Open the game again and verify the previous state, a change unique to the new edition, and a second successful save. Uninstalling before the upgrade removes the data required by this check.

On Fold7 the first edition saved one move and recovered it after a forced restart. Its optional call to `customer.revision` failed at the real host dispatcher. Edition 102 corrected the game to call the registered `customer.version` handler. Android's package manager returned 102, the new background appeared, and the saved move was still present. A second move survived another restart. Both builds used the extracted offline kit and a local test signer. An external team's own delivery, proprietary channel callbacks and a second GPU family remain to be verified. [Device and build record](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-receiver-upgrade.json)

## Include a channel library

Place the vendor's AARs, JARs and a JSON file together. Supply the filenames with their exact case and the vendor-approved digests. List any local transitive libraries. Pass `--channel <manifest.json>` to `create-app.mjs`. The standalone project rechecks these files when Gradle configures its dependencies. SDK credentials and signing keys stay with the operator.

```json
{"schemaVersion":1,"libraries":[{"file":"Channel.jar","sha256":"<64 lowercase hexadecimal characters>"}]}
```

The application registers the operations its Activity provides. A library's presence in a build establishes packaging. Validate its sign-in, payment confirmation, cancellation, callbacks and release setup against that channel's test service before accepting those features.

## Deliver the editable project and APK tools together

List the files the customer needs to edit and rebuild the game. Include the original project configuration, business scripts, UI sources, art, adapter sources, notices and maintenance instructions that the owner may distribute. A manifest entry is a file relative to the editable game root. Include all application imports and resources. The exporter checks the game bundle from that copied source. The owner reviews the selected files and any credentials embedded in them.

```json
{"schemaVersion":1,"application":{"id":"org.example.lantern","name":"Lantern"},"sourceFiles":["project.json","index.html","main.mjs","lantern.png"]}
```

Run the following from the engine checkout or a kit that includes the handoff command. Supply the SHA-256 of the accepted `kit.json`. A successful export publishes one new folder containing `source/`, `kit/`, the standalone Gradle project `android/` and `handoff.json` with the exact editable file digests. The first three directories can move together to the customer's machine. Keep signing material in the customer's signing environment. For an existing native integration, list approved Android paths under `androidFiles` and pass its source directory using `--android`. For example, a listed `src/main/java/org/egret/example/GameActivity.java` preserves the Activity's SDK registrations.

```sh
node runtime-sdk/android/player/handoff.mjs --project <editable-game> --plan <handoff-plan.json> --kit <accepted-kit> --kit-sha256 <digest> --out <new-delivery>
```

For editor type checking, extend the kit's `game-types.json` in the game’s tsconfig and include the game source. The kit supplies declarations for the player, network adapter and engine imports. Stage changed game assets from `source/` and pass the resulting revision to Gradle as described above. For a connected development device, combine the revision with the device serial from `adb devices`. With a separate Platform Tools installation, pass its absolute adb path using `-PegretAdb=<path>`. The debug task installs over the same package and signing identity, preserving its app data. It restarts the game's launcher Activity. Android reports a signing mismatch if the installed app belongs to another key.

```sh
gradle --offline -p <application> -PegretDevice=<serial> -PegretGameRevision=<revision> egretRunDebug
gradle --offline -p <application> -PegretGameRevision=<revision> assembleRelease bundleRelease
```

### Update a running debug installation

Install the debug APK once and open the game inside its Activity. Stage the edits, then send the revision to that same game's private development store. The command verifies the local receipt, sends new content by SHA-256, and starts a fresh Activity pointing to the selected revision. Existing game saves stay in place. The report's `assetBytesSent` counts asset contents. `assetTransportBytes` includes the Windows USB transfer's Base64 encoding. Manifest and activation traffic are additional.

```sh
node runtime-sdk/android/player/sync-debug.mjs --app ./application --device <serial> --revision ./revisions/<digest>
node runtime-sdk/android/player/sync-debug.mjs --app ./application --device <serial> --embedded
```

The second command returns to the game embedded in the APK. Start a new debug build after changing Java, channel libraries, the native renderer or the player AAR. Release applications with debugging disabled always open their packaged assets. The device retains uploaded blobs for subsequent revisions.

### Register the vendor's SDK

The Activity supplies a map of names to `ProjectHostServices.Handler`. Each handler receives one JSON request and a reply object. Return a cancellation action for pending work. Use `closeSession()` to detach vendor listeners. With the exported network profile, pass the same map as the fourth argument to `GameNetwork.open(activity, "game", listener, channels)`. Keep this call when restoring an original Activity in a handoff. Use the vendor's official Activity lifecycle and result forwarding where required.

```java
Map<String, ProjectHostServices.Handler> channels = new HashMap<>();
channels.put("channel.locale", (request, reply) -> {
    reply.resolve(JSONObject.quote(Locale.getDefault().toLanguageTag()));
    return null;
});
player = GameNetwork.open(this, "game", listener, channels);
```

The game reads the value with `await services.host.call('channel.locale', null, services.signal)`. The example uses Android locale. The operator supplies login, purchase, acknowledgements and credentials through the registered SDK.

## Packaging the original Egret 5.3.x JavaScript engine

For an existing 2D Android title, the kit can load the game's original Egret engine, EUI, RES and business scripts on the embedded V8 host. The original engine owns its classes, event dispatch, validation, input hit testing and game clock. Its native display bindings submit to the shared player and Rust GLES3 renderer. Use a fresh native view when reopening a game. The `@egret/legacy` migration route remains available for games adopting Egret 7 APIs.

Start with the game's already published `manifest.json` and files, including the original JS modules and license notices. Provide the stage size, entry class, packaged resource paths and decoded dimensions of each PNG. For example, a build configuration for a game with one atlas is:

```json
{"entryClass":"Main","width":480,"height":270,"frameRate":30,"assets":["resource/default.res.json"],"images":[{"path":"resource/atlas.png","width":256,"height":128}]}
```

```sh
node verify-build-kit.mjs
node runtime-sdk/android/player/prepare-original5.mjs --source ../published5 --config ../original5.json --out ../prepared-game
node runtime-sdk/android/player/create-app.mjs --project ../prepared-game --aar ./libs/egret-player.aar --esbuild ./node_modules/esbuild --layout embedded --id org.example.originalgame --out ../android-game
gradle --offline -p ../android-game assembleDebug
```

Use the embedded V8 AAR. The preparation step checks the original manifest and copies the engine modules and game JS unchanged, in order. The default identifies the core as the first `egret.js` or `egret.min.js` and replaces the matching browser host script with the native host. For renamed published files, specify the exact `coreScript` and `webHostScript` paths. Include additional license files and all packaged text, binary and PNG assets needed by RES in the resource list. Keep `original-script-map.json` from the prepared directory. It maps compact diagnostic names such as `original/0007.js` back to the original source path. It stays outside the APK. Continue with the ordinary signed APK/AAB build instructions above. If a source checkout omits compiled business JS, compile it first with its matching Egret toolchain.

For custom startup code, import `installOriginal5Project` from `@egret/android-original5` in the prepared game's `main.mjs`. The optional `remoteRequest` hook supplies an explicitly configured HTTPS transport. An application requiring its existing channel SDK must connect the appropriate native provider. Package assets and app-private saves use the existing RSDK services. A 5.3.x ABI version alone cannot certify a game's private engine extensions, advanced filters, dynamic scripts, editing widgets or operating backend.

A browser plugin can inspect globals while the original module is being evaluated. Set `hostAdapter` in the preparation configuration to the relative path of a self-contained project-owned ES module. Its optional `installHost({defineGlobal,services})` export runs before the original modules. The same module may export `remoteRequest` for the original HTTP loader. Register the actual channel provider and preserve its success, failure and cancellation behavior. For example:

```js
export function installHost({defineGlobal, services}) {
  defineGlobal('readDeviceLocale', () => services.host.call('channel.locale', null, services.signal));
}
```

A private 5.3.10 project reached its original login and server selection screens on a Galaxy Z Fold7. Its archive library used a project-owned native export binding. Its mouse plugin installed the browser context-menu handler only where a document exists. Its native-host check accepted both the old Runtime 2 identifier and the Android player's native identifier. The project retained its original touch dispatcher, channel calls and backend request logic.

The original login group loaded all 69 entries. Android's system editor accepted the test input, the original login button advanced to server selection, and a process restart restored the input from app-private storage. The packaged build had no live server with which to authenticate or populate the list. A channel-specific remote image was unavailable. The theme compiled 929 of its 935 declared skins from the available source. [Physical device results](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-original5-login-ui.json)

An empty original `TextField` paints its authored background and one-unit border. An EUI `EditableText` supplies its editable value when opening the native editor so the prompt leaves the full character limit available. Password fields require a secure host binding. Players supporting subtree effects accept a single `egret.ColorMatrixFilter`. Changing its `matrix` updates each attached subtree. Assign `filters = null` to restore its own colors. Other filters and older player protocols report unsupported attachment.

### Tested interfaces of the original engine

On the Fold7 the original 5.3.10 project loaded a PNG through RES, painted two EUI images from one atlas and laid out a two-colour Chinese label. Tapping the painted circle or atlas button advanced the saved counter; tapping the circle's transparent corner left it unchanged. Restarting the process restored the counter. An original input TextField opened Android's real editor, appended `34` to `12`, and received one focus-in, two change events and one focus-out. The old InputController applies the game's text restrictions. Password entry currently requires a separate secure binding. [Atlas and resource evidence](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-original5-atlas.json) · [System editor evidence](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-original5-editor.json)

The kit loads one VM per application. Recheck the game's actual engine modules and third-party SDKs when opting into a different V8 profile. Register native endpoints before plugins execute. Keep permission dialogs, vendor Activity callbacks, secure storage and transactions in their supported platform service. The commands above qualify a packaged project on Android. Original 5 modules on iOS, arbitrary browser DOM plugins and all point releases of Egret 5 remain separate compatibility targets.

### Packaging original 5.3 scripts

The preparer reads the original core before it starts. Tags 5.3.1 and 5.3.2 use native display ABI 4. The core shipped in the 5.3.2 tag identifies itself as 5.3.1. Tags 5.3.5 through 5.3.10 use ABI 5. With a manually identified build, set `nativeAbi` in the preparation configuration. An explicit value that conflicts with an identified core is rejected. The atlas generator accepts `--engine-version` with the version reported by that core.

Original builds request `v8ScriptMode: "classic"`. Some debug EUI modules use block-level function declarations with classic browser scope. A file can still opt into strict mode itself. Projects with the existing default keep strict execution. Use a separate app process when embedding projects that request different process-wide V8 modes. [Version coverage and pixel checks](original5-atlas-verification.md)
