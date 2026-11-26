# Egret Migrate

English | [简体中文](README.zh-CN.md)

Egret Migrate is a local CLI for supported classic Egret 5 Web 2D source projects. It uses the Egret 7 project store and the existing browser verifier. Keep the old project and its runnable browser build alongside the new project.

## Install and run

From an Egret checkout with built packages, pack the local CLI. Use the installed esbuild module and npm CLI entry from your environment.

```text
node tools/egret-migrate/pack.mjs --esbuild <esbuild-module> --npm <npm-cli.js> --out <new-package-dir>
npm install --prefix <tool-folder> <new-package-dir>/egret-migrate-0.5.0.tgz
```

Use the installed `egret-migrate` command or invoke `node <tool-folder>/node_modules/@egret/migrate/bin.mjs` directly. The CLI works outside the engine checkout. Supply a pinned Egret 7.0-series `egret2d.mjs`, an installed esbuild module, Playwright with Chromium and, for preview, qrcode-generator 2.0.4. These tools are selected explicitly.

```text
egret-migrate inspect --source <old-project>
egret-migrate convert --source <old-project> --out <new-project> --engine <egret2d.mjs> --engine-version <7.0.x> --esbuild <esbuild-module>
egret-migrate verify --old <old-built-index.html> --converted <new-project> --scenario <shared-scenario.mjs> --playwright <playwright-index.mjs> --out <new-evidence-directory>
egret-migrate preview --run <new-evidence-directory> --address <LAN-IPv4> --qr-module <qrcode.mjs>
```

The profile reads the classic HTML stage declaration, the Egret engine/compiler configuration, the ordered `manifest.json` game scripts and a local RES manifest. It admits `egret`, `game`, `res`, `assetsmanager`, `promise`, and the supported subset of `eui` and `dragonBones`. The bridge implements the display, listener, image/JSON group and local storage operations covered by the tests. The classic 5.1 profile accepts matching engine/compiler declarations for 5.1.7 and 5.1.9. An explicit `--source-order` JSON array may name portable `src/*.ts` paths in load order. `--resources` selects a different project-relative manifest. Custom runtime modules and dynamic stage sizes require project-specific adaptation.

### A networked lobby from Egret 5.0.14

Use `eraser-lobby` with the upstream repository root containing both `client/` and `socket.io/`. The profile imports the original lobby and room classes, their two skins, the list-row and button skins, the two button images and the bundled Socket.IO client. It selects these inputs from the checkout and records their identities. The rest of the game can stay in the source tree. [Reference checkout](https://github.com/EraserTeam/EraserSanGuoSha/tree/30c315bb7296efd0518eb0c31dd0e4d115742b69)

```text
egret-migrate inspect --profile eraser-lobby --source <EraserSanGuoSha-root>
egret-migrate convert --profile eraser-lobby --source <EraserSanGuoSha-root> --out <new-project> --engine <egret2d.mjs> --engine-version <7.0.x> --esbuild <esbuild-module> --socket-url http://127.0.0.1:43676
```

Start the original Node game server separately. Set its `PORT` to the port used above to enable the original multi-room flow. Serve the generated `web/` directory over HTTP. The Socket.IO origin defaults to the page origin when both services share an origin. Use an explicit loopback origin when running them on separate local ports.

Open the output in two independent browser sessions. In A, click **创建房间** (create room). In B, click **刷新列表** (refresh), select the row with A's room number and click **加入房间** (join). Verify that both clients reach the match handoff for the same room after the server starts the game. Leaving before the second player joins can be checked in a fresh room. The playable card table, persistence and reconnect behavior require separate migration work.

The Windows reference run used two isolated Chromium 157 sessions with software WebGL2 and an unchanged source checkout. Leaving and refreshing removed the first room from the list. In the next room, both canvases and their accessible status text showed the same room number, two players and distinct seats. The original server logged both joins and the start of that room. The two clients used the imported Socket.IO bytes without a replacement protocol. Mobile input and rendering performance were outside this run.

### EUI, atlas resources and skeletal exports

Use the same import transaction and browser host for static and dynamic skins. For `eui`, the default theme is `resource/default.thm.json`; select another admitted local theme with `--theme <relative-path>`. The compiler reads declared EXML as data. It preserves named skin parts, nesting, literal properties, sizing and supported basic/linear layouts. Application code can access skin parts by their original IDs. Version 0.3 also binds property chains such as `{hostComponent.model.title}` and `{data.name}`, registers project components referenced by a qualified EXML name, and applies state-specific properties and membership. Replace a bound model and detach and reattach the screen when verifying an import. The parser reports unsupported expressions at the declaration. Keep the original theme and record any reduced theme selection; unused default skins may have unsupported declarations. The bridge uses the existing display tree and scoped labels.

The `data-scale-mode` of `index.html` is kept. `showAll`, `noBorder` and `exactFit` keep a stage of the design's size. `fixedWidth`, `fixedHeight`, `fixedNarrow` and `fixedWide` size the stage as Egret 5 did. When the window changes, `stage.stageWidth` and `stage.stageHeight` follow it, EUI lays its roots out again against the new size, and the stage dispatches `egret.Event.RESIZE`. `noScale` is refused at `inspect`.

Traditional RES sheets with unrotated frames, trim offsets and declared subkeys use one native page and the existing SpriteSheet API. The page is referenced by its authored local path. Both bare declared subkeys and qualified sheet/frame names can resolve the same frame. Compatible PNGs are kept byte-for-byte; supported legacy PNGs outside the target decoding profile can be normalized offline to RGBA8, with decoded pixels compared and old/new SHA-256 recorded. Non-sRGB color profiles and unknown semantic metadata require explicit adaptation. Missing or ambiguous names and rotated frames need an explicit repair.

Supply a local JSON mapping for every admitted DragonBones skeleton/atlas/texture set:

```json
[{"skeleton":"actor_ske_json","atlas":"actor_tex_json","texture":"actor_tex_png"}]
```

Pass `--bones <mapping.json>` to both `inspect` and `convert`. These names are RES keys. The declared atlas page must match the selected PNG and its dimensions. A known page rename requires `"allowRenamedPage": true` on that mapping; the report records the original path and checks the dimensions. The converter writes editable original source and neutral native bone descriptors at the corresponding Web JSON resource paths. The compatibility factory accepts those descriptors and plays them using Egret 7 display nodes, texture leases and the engine clock. No DragonBones runtime or licensed Spine SDK is distributed with the new game. The original resources remain in the editable output.

The supported skeletal subset is local-transform DragonBones 5.x rigid region rigs, parent-first bones, ordinary attachment order, unrotated and trimmed rectangles, bounded animation channels, linear/stepped interpolation, finite and looping clips, and admitted slot display/alpha changes. Version 0.3 adds disabled scale inheritance, held single-frame poses and additive region slots. Weighted meshes, IK, deformation timelines, animated draw order, nonlinear easing and layered blending require further conversion. The importer diagnoses unsupported declarations. An Agent can adapt the source/export with its owner, or produce separately licensed Spine data using the Egret 7 Spine path and verify the pose and behavior. Automated conversion to Spine and arbitrary DragonBones skeletons is pending.

Basic layout resolves edge constraints and percent dimensions. `eui.ArrayCollection` changes update a `List` or `DataGroup` with typed item renderers. Verify selection, cancellation, row ordering and vertical scroll against the old game. With a fixed row height, a vertical virtual list reuses renderers as items enter and leave the viewport. Variable-height rows use the full layout. A Scroller can also host a plain Group. Reparenting it through a legacy container releases scrolling immediately. When mixing in a raw Egret 7 container, clear `scroller.viewport = null` before moving the Group. Row-major TileLayout supports fixed-size cells, horizontal and vertical gaps, and padding. Inline button skins give each button its own named parts. Check navigation, state changes and saved progress against a runnable copy of the original game. Other tile orientations, live skin replacement and stroked text need separate migration rules. Custom legacy events can bubble and be canceled. The engine retains ownership of pointer and stage events.

Conversion writes editable TypeScript and its admitted inputs, a `web/` build, `history.json` and `conversion.json` in a new directory. The project-store receipt tracks the imported stage and resource identities. For a data correction, supply `--transaction <json>` based on the import revision. For a source correction, change the editable copy and convert again to another directory. Preserve the reported project ID through `--project-id` when the rebuilt copy needs to retain its storage namespace. Saved browser values are origin-local. Export/import only explicitly selected keys using the game's save format when moving between origins.

Use one self-contained verify-game scenario with the steps `first-action`, `round-finished`, `restart`, `first-action-after-restart` and `save-restored` in order. Assert observable behavior before recording each step. The script may export `viewport` with the browser width and height for matching responsive layouts. The CLI stores both results and will preview only the passing new artifact from that comparison. The legacy entry hash describes the HTML supplied to the verifier. Pin the underlying legacy build separately for repeatable comparisons.

For a LAN test, choose a private local address and install the [qrcode-generator module](https://www.npmjs.com/package/qrcode-generator/v/2.0.4), then pass its `dist/qrcode.mjs`. On a USB-authorized Android device, a preview on `127.0.0.1` can use the printed port with `adb reverse`. Preview expires after 15 minutes. The displayed build SHA-256 identifies the browser files checked on desktop.

## Use with an Agent

Use the `skill/SKILL.md` shipped in the package in each client. Install the same instructions under `.agents/skills/egret-migrate` for Codex or `.claude/skills/egret-migrate` for Claude Code. Import the skill folder through WorkBuddy's local skill upload. Each client uses its own local file and command permissions. For example, ask “Migrate this Egret 5 project to Egret 7.0, preserve its gameplay and save, and verify one whole round.”

## First verification

The standalone package was installed offline in a clean directory. In Windows Chrome 157, both the original Egret 5.2.7 Web build and the adapted Egret 7.0.2 build of the selected single-player Minesweeper case passed one scripted round, including a numbered square opening, flag and unflag, loss, restart and opening a square again. The test held the viewport at 640 × 1136 and the seed at 739081. The Agent's input repair retained the board logic, replaced the scene's EUI presentation and made local PNGs from 13 atlas frames. The sample is external to this package. [Pinned source and license](https://github.com/zjalen/Multi_Minesweeper/tree/57d48a8781bf104a60dac4b47556c0ce3be711d0)

On Galaxy Z Fold7, Chrome 157 decoded the QR image, loaded all 19 matching files over USB preview and replayed that same scenario on hardware WebGL2. The build identity was `cc6038460782728dc0bb96c5b5a3c9d5e558ca831c5bf4a6e63d32111a616eff`. This case has no original board save. It checked persistence of an isolated test value. A separate original game, Dawn Signal Run, checked actual progress on both engine generations and recovered a best result of 3 after reload. Its paired build also passed on Fold7. Existing save import across browser origins, additional EUI layouts and full source-to-platform compatibility remain to be tested. Claude Code and WorkBuddy adapter instructions are available; their host invocation is still pending verification.

## Version 0.2 verification

Lantern Guardian is an original migration control authored for this test, with three nested EXML skins, a three-bone/three-slot DragonBones 5.5 rig, three clips, a playable three-move round, dynamic score and progress UI, restart and a saved best score. The old side used the genuine Egret 5.2.7 WebGL/EUI/DragonBones runtime; the new side used Egret 7.0.2 and the native region descriptor. The same source TypeScript and EXML were admitted without gameplay edits. Both passed the five ordered browser checkpoints in Chrome 157 (Windows, software WebGL), including observed upper/lower lamp poses and restored best score 3. The independently installed CLI produced the verified 11-file Web artifact `39b2600b3e81f78bd4469823c2131dc742d19b6d8167694c13b8123047b5885b`. Layout and sampled colors supported the gameplay assertions; font baselines and animation sampling phase differ between the renderers.

Galaxy Z Fold7 (Chrome 157, hardware WebGL2) decoded the local QR, loaded all 11 identical browser files and passed the same five checkpoints by physical-device touch, including upward strike, downward guard and best score 3 restored on reload. The first run observed the score change but missed a transient animation pose during screenshot sampling; a repeat on the unchanged build at higher stage sampling cadence passed. The original failure is retained. The original source and test scenario are reproducible from `tests/fixtures/egret-migrate-eui/` with a local copy of the [Egret 5.2.7 SDK build](https://github.com/egret-labs/egret-core/tree/v5.2.7/build) and esbuild 0.27.4. The preparation tool verifies the five old runtime files and stages them locally instead of distributing them.

```text
node tests/fixtures/egret-migrate-eui/prepare.mjs --legacy-libs <Egret-5.2.7-build> --esbuild <esbuild-module> --out <old-fixture>
egret-migrate convert --source <old-fixture> --bones tests/fixtures/egret-migrate-eui/bones.json --out <new-fixture> --engine <egret2d.mjs> --engine-version 7.0.2 --esbuild <esbuild-module>
egret-migrate verify --old <old-fixture>/index.html --converted <new-fixture> --scenario tests/fixtures/egret-migrate-eui/scenario.mjs --playwright <playwright-module> --out <new-proof>
```

The earlier Minesweeper case was also rerun with its original 13-frame packed atlas, retaining the previously adapted UI and board logic. The first run exposed text chunks in the old PNG that the target decoder refuses. Offline normalization preserved the decoded RGBA plane, retained the original file outside `web/`, and removed the need to crop 13 separate PNGs. The final desktop round/restart/storage-probe comparison passed. This reuses the historical game and does not add a new saved-board capability.

Separately, the historical Egret CoreExample DragonBoy asset (DragonBones 5.0, 19 bones, 18 slots, four clips) was tested with its original skeleton, atlas and PNG. In ten controlled samples across stand, walk, jump and fall, old/new browser poses agreed over 180 visible slot transforms, with maximum position difference approximately 0.00000125 stage units and occupancy IoU 97.78–98.24%. Color/edge smoothing was not identical. These are specific animation results, not a complete game or a performance benchmark. [Historical example source](https://github.com/egret-labs/egret-examples)

The pinned [Egret 5.2.2 `dbplay` training project](https://github.com/xiashu/egret-code/tree/8f4a47b79fd574913689936ecd5c16462dc576ba/%E9%BE%99%E9%AA%A8%E7%AF%87/dbplay) also displayed two distinct original run poses in Chromium. Version 0.3 exercises its 37-bone character and separate light effect as animation references. This training project has no full game round. No independent, licensed historical 5.x game satisfying all three complex EUI/EXML, skeletal animation and playable-save requirements was established in this batch. A commercial-scale combined migration remains open, with these separate controls providing concrete next-step evidence. No historical art or SDK binaries are included in the CLI.

## Version 0.3 comparisons

- **Animal Chess.** The original Egret 5.0.15 browser game and the adapted Egret 7 build followed the same seeded board on Windows Chromium 157 with software WebGL. Both revealed 16 pieces, completed the same 14 moves through elimination and accepted the first move after reloading. At six checkpoints the piece states and ordering matched. The presented 600 × 600 images had mean absolute RGB differences of 4.01–4.54 on a 0–255 scale. On a Galaxy Z Fold7, Chrome 157 with an Adreno 830 decoded the preview QR and replayed the same 14 moves and six checkpoints via automated touch. The game has no saved-board feature. Two project files changed in the migration copy: the theme selection excludes 13 unused stock skins, and the entry removes unused template registrations and replaces access to the private child array with public display traversal. All game textures stayed in their original formats. The target was built from engine commit `0728eccc`; the archived 7.0.2 browser bundle used by earlier controls rejected the JPEG backgrounds. [Pinned game source](https://github.com/tangjx/cubs/tree/ae7da87b961a3c7fd8f1ef6bd4ec3aac914efbc2)
- **Historical region animation.** The Egret 5.2.2 player and Egret 7.0.2 played ten clips of the same 37-bone, 36-slot character. Across 28 poses and 1,008 slot comparisons, visibility and ordering agreed. The largest visible-slot origin difference was 0.00000633 stage units. Silhouette intersection over union was 98.80–99.38%. The separate three-slot additive effect measured 95.73–96.62%. These checks used Chromium 157 software WebGL. Smoothing and color differences remain visible in a pixel comparison. [Pinned dbplay project](https://github.com/xiashu/egret-code/tree/8f4a47b79fd574913689936ecd5c16462dc576ba)
- **Historical goods list.** On Egret 5.1.9 and Egret 7, an existing custom renderer showed seven names, descriptions and loaded icons. Both versions selected the second item, scrolled by dragging and selected the final item. Editing and replacing the selected last item kept index 6 and the settled scroll position of 224 stage units in both versions. Its description and icon updated. The old list virtualized its rows. The new list instantiated all seven. The component TypeScript and two EXML skins were byte-identical. The migrated harness mounts just the goods list. Eight PNGs with embedded color profiles were converted in the browser, with matching decoded RGBA hashes for each input/output pair. Other screens in the original application remain unverified. [Pinned component source](https://github.com/JuntaoWu/egret-demo/tree/dfb9f4e8b304c1d3792c17d8d2d62cda7c21c1d9)
- **Dynamic stock panel.** An original control runs the same EXML and TypeScript on Egret 5.2.7 and Egret 7.0.2. Six checkpoints cover selecting rows using screen coordinates, replacing the model, entering a conditional state, editing the collection, scrolling 32 units and reentering the screen. Separate regression tests exercise duplicate items and binding disposal when the entire game closes. The previous Lantern Guardian receipt covers its own restoration of a saved score.

Reproduce the original inventory screen with four local Egret 5.2.7 libraries and esbuild 0.27.4. The fixture checks the library hashes and writes both builds, screenshots and a comparison report to a new directory.

```text
node tests/fixtures/egret-migrate-dynamic-ui/verify.mjs --legacy-libs <Egret-5.2.7-build> --engine <egret2d.mjs> --esbuild <esbuild-module> --playwright <playwright-module> --browser <chromium-executable> --out <new-directory>
```

One candidate for a combined online benchmark is UniversalIdle on Egret 5.2.33. Its project includes game-specific EXML and DragonBones data. A complete run needs a rebuilt client, a generated `config.pack` and the game's STOMP and MongoDB services. The checked-in client has no confirmed game path that plays the bundled character. Its end-to-end gameplay, persistence and artwork rights still need independent evidence. [Pinned source](https://github.com/MoeCrow/UniversalIdle/tree/dc200eeee78318dc6d3ab9760196c9be3e8e4e41)

Use the comparator with a fixed legacy browser build and a fixed target bundle. For older Wing projects, 5.0.15 stores the SDK in `egret_version`. The 5.1.9 profile reads matching engine and compiler declarations. A preloaded tween module in these two profiles does not convert game-side calls to unsupported tween APIs. Register such calls as explicit migration work.

See [project migration requirements](https://github.com/cnedwin/Egret_rebuild/blob/main/knowledge-base/en/docs/legacy-project-migration.md) for the complete migration scope.
