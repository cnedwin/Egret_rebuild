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
