# Release archives

English | [简体中文](../../Cns/docs/release-archives.md)

The packages in this repository are private and at version 0.0.0. A release is a set of archives made from them, one for each package, attached to a GitHub release. Nothing is published to npm.

## Run and edit the starter

1. Download `egret-first-game.zip` from the [preview.1 release](https://github.com/cnedwin/Egret_rebuild/releases/tag/v0.1.0-preview.1) and extract it into a new folder. Its `package.json` pins the engine archive in that release and esbuild 0.28.2.
2. With Node.js 26.7.0 and npm, run `npm install`, then `npm start`. Open `http://127.0.0.1:8000`. Click the amber square or press Space. It moves 32 stage units per action.
3. In `main.mjs`, change `STEP` from `32` to `64`, save and reload the page. The square now moves twice as far. Press Ctrl+C in the terminal to stop the local server.

## Install a release

```
npm install https://github.com/cnedwin/Egret_rebuild/releases/download/v<version>/egret-engine-<version>.tgz
```

- That one address is enough for the engine: its archive names `@egret/contracts` and `@egret/runtime` by the address of their archives in the same release, and npm fetches them.
- `@egret/project` and `@egret/spine` are installed the same way, from `egret-project-<version>.tgz` and `egret-spine-<version>.tgz`.
- `release.json`, attached beside the archives, gives each archive's name, size and SHA-256.
- pnpm and yarn install from the same addresses.

## What an archive holds

- The built `dist` directory, without source maps; the package's two README files; the repository's `LICENSE` and `NOTICE`.
- A manifest that differs from the one in the repository in four ways: it has the release's version; it is not private; it lists the files above; and each dependency on another package of this workspace is the address of that package's archive.
- The entries, the private import names and the third-party dependencies are as in the repository.

## Make a release

1. Choose a version: three numbers, and for a preview a hyphen and a name, such as `0.1.0-preview.1`.
2. Push the tag `v<version>` on the commit to release.
3. The `Release archives` workflow builds, packs, installs the archives into a clean project, imports them there, and attaches them to a GitHub release of the tag. A version with a hyphen is marked as a pre-release.

To make the archives without releasing them:

```
node tools/build.mjs
node tools/pack-release.mjs --version 0.1.0-preview.1 --out ../release
node tools/verify-release.mjs --version 0.1.0-preview.1 --archives ../release
```

`verify-release` packs a second set whose archives name each other by file address, installs those with npm, and compares them file by file with the set given: only the manifests may differ. It needs the network for `robust-predicates`, `jsonc-parser` and `@esotericsoftware/spine-core`.

## What has been checked

- `tests/pack-release.test.mjs`: versions and addresses, the manifest, refusals, and the contents of all five archives.
- On Linux with Node 26.7.0 and npm, the archives of `0.1.0-preview.1` were installed into a clean project outside the repository, and `@egret/engine`, `@egret/engine/web/game`, `@egret/project` and `@egret/spine` were imported there.

A pre-release rehearsal installed the engine from locally addressed archives in a new Windows project. Headless Edge 157 rendered the square, advanced it by 32 stage units on a click, then by 64 on Space after editing and reloading. The archive-install check uses npm. Independent newcomer, display timing and other package managers have separate acceptance. [Handoff status](https://github.com/cnedwin/Egret_rebuild/issues/93)

[Preview.1](https://github.com/cnedwin/Egret_rebuild/releases/tag/v0.1.0-preview.1) ships from commit `51b12255`. The seven public downloads matched their GitHub SHA-256 digests. A fresh npm project installed the starter's engine, runtime and contracts from the release URLs. A separate installation imported the project and Spine entries and matched all five Egret packages against their tarballs. Windows Edge and Galaxy Z Fold7 Chrome rendered the same game bundles through WebGPU and WebGL2. Changing `STEP` from 32 to 64 doubled the distance observed on each device. The [handoff record](https://github.com/cnedwin/Egret_rebuild/issues/93#issuecomment-6967204747) gives the bundle sizes and the time from navigation to the observed movement, including automated input and pixel capture. Independent newcomer and network startup acceptance remain open.

## Limits

- A release cannot be changed once its tag is used: make a new version.
- An address is longer than a package name and does not take a version range. Publishing to a registry would give both, and is a decision about the `@egret` name on npm that has not been made.
- `@egret/spine` needs `@esotericsoftware/spine-core` 4.3.13, which has its own licence; see the package's README.
