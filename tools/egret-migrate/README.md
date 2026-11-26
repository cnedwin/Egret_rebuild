# Egret Migrate

English | [简体中文](README.zh-CN.md)

Egret Migrate is a local CLI for classic Egret 5.2 Web 2D source projects. It uses the Egret 7 project store and the existing browser verifier. Keep the old project and its runnable browser build alongside the new project.

## Install and run

From an Egret checkout with built packages, pack the local CLI. Use the installed esbuild module and npm CLI entry from your environment.

```text
node tools/egret-migrate/pack.mjs --esbuild <esbuild-module> --npm <npm-cli.js> --out <new-package-dir>
npm install --prefix <tool-folder> <new-package-dir>/egret-migrate-0.1.0.tgz
```

Use the installed `egret-migrate` command or invoke `node <tool-folder>/node_modules/@egret/migrate/bin.mjs` directly. The CLI works outside the engine checkout. Supply a pinned Egret 7.0-series `egret2d.mjs`, an installed esbuild module, Playwright with Chromium and, for preview, qrcode-generator 2.0.4. These tools are selected explicitly.

```text
egret-migrate inspect --source <old-project>
egret-migrate convert --source <old-project> --out <new-project> --engine <egret2d.mjs> --engine-version <7.0.x> --esbuild <esbuild-module>
egret-migrate verify --old <old-built-index.html> --converted <new-project> --scenario <shared-scenario.mjs> --playwright <playwright-index.mjs> --out <new-evidence-directory>
egret-migrate preview --run <new-evidence-directory> --address <LAN-IPv4> --qr-module <qrcode.mjs>
```

The profile reads the classic HTML stage declaration, the Egret engine/compiler configuration, the ordered `manifest.json` game scripts and a local RES manifest. It admits `egret`, `game`, `res`, `assetsmanager` and `promise` module declarations. The bridge implements the display, listener, image/JSON group and local storage operations covered by the tests. Unsupported operations are reported separately. An explicit `--source-order` JSON array may name portable `src/*.ts` paths in load order. `--resources` selects a different project-relative manifest. EUI, EXML, atlas subkeys, custom runtime modules and dynamic stage sizes require project-specific adaptation.

Conversion writes editable TypeScript and its admitted inputs, a `web/` build, `history.json` and `conversion.json` in a new directory. The project-store receipt tracks the imported stage and resource identities. For a data correction, supply `--transaction <json>` based on the import revision. For a source correction, change the editable copy and convert again to another directory. Preserve the reported project ID through `--project-id` when the rebuilt copy needs to retain its storage namespace. Saved browser values are origin-local. Export/import only explicitly selected keys using the game's save format when moving between origins.

Use one self-contained verify-game scenario with the steps `first-action`, `round-finished`, `restart`, `first-action-after-restart` and `save-restored` in order. Assert observable behavior before recording each step. The script may export `viewport` with the browser width and height for matching responsive layouts. The CLI stores both results and will preview only the passing new artifact from that comparison. The legacy entry hash describes the HTML supplied to the verifier. Pin the underlying legacy build separately for repeatable comparisons.

For a LAN test, choose a private local address and install the [qrcode-generator module](https://www.npmjs.com/package/qrcode-generator/v/2.0.4), then pass its `dist/qrcode.mjs`. On a USB-authorized Android device, a preview on `127.0.0.1` can use the printed port with `adb reverse`. Preview expires after 15 minutes. The displayed build SHA-256 identifies the browser files checked on desktop.

## Use with an Agent

Use the `skill/SKILL.md` shipped in the package in each client. Install the same instructions under `.agents/skills/egret-migrate` for Codex or `.claude/skills/egret-migrate` for Claude Code. Import the skill folder through WorkBuddy's local skill upload. Each client uses its own local file and command permissions. For example, ask “Migrate this Egret 5 project to Egret 7.0, preserve its gameplay and save, and verify one whole round.”

## First verification

The standalone package was installed offline in a clean directory. In Windows Chrome 157, both the original Egret 5.2.7 Web build and the adapted Egret 7.0.2 build of the selected single-player Minesweeper case passed one scripted round, including a numbered square opening, flag and unflag, loss, restart and opening a square again. The test held the viewport at 640 × 1136 and the seed at 739081. The Agent's input repair retained the board logic, replaced the scene's EUI presentation and made local PNGs from 13 atlas frames. The sample is external to this package. [Pinned source and license](https://github.com/zjalen/Multi_Minesweeper/tree/57d48a8781bf104a60dac4b47556c0ce3be711d0)

On Galaxy Z Fold7, Chrome 157 decoded the QR image, loaded all 19 matching files over USB preview and replayed that same scenario on hardware WebGL2. The build identity was `cc6038460782728dc0bb96c5b5a3c9d5e558ca831c5bf4a6e63d32111a616eff`. This case has no original board save. It checked persistence of an isolated test value. A separate original game, Dawn Signal Run, checked actual progress on both engine generations and recovered a best result of 3 after reload. Its paired build also passed on Fold7. Existing save import across browser origins, additional EUI layouts and full source-to-platform compatibility remain to be tested. Claude Code and WorkBuddy adapter instructions are available; their host invocation is still pending verification.

See [project migration requirements](https://github.com/cnedwin/Egret_rebuild/blob/main/knowledge-base/en/docs/legacy-project-migration.md) for the complete migration scope.
