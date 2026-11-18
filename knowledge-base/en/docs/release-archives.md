# Egret Engine 7.0 release notes and installation

English | [简体中文](../../Cns/docs/release-archives.md)

**Egret Engine 7.0** continues the engine's version history under the community rebuild. The [`v7.0.1-rc.3` release candidate](https://github.com/cnedwin/Egret_rebuild/releases/tag/v7.0.1-rc.3) builds the following downloads from one tagged commit.

| Use case | Download |
| --- | --- |
| Start with an editable 2D game | [Starter project](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.3/egret-first-game.zip) |
| Add the engine to a web page | [Browser files and licences](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.3/egret-browser.zip). For 2D, choose [`egret2d.js`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.3/egret2d.js) or [`egret2d.mjs`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.3/egret2d.mjs). For World3D, choose [`egret3d.js`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.3/egret3d.js) or [`egret3d.mjs`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.3/egret3d.mjs). |
| Import modules into an npm project | `npm install @egret/engine@next` from the npm registry, or the archives: [`@egret/engine`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.3/egret-engine-7.0.1-rc.3.tgz), [`@egret/contracts`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.3/egret-contracts-7.0.1-rc.3.tgz), [`@egret/runtime`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.3/egret-runtime-7.0.1-rc.3.tgz), [`@egret/project`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.3/egret-project-7.0.1-rc.3.tgz), [`@egret/spine`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.3/egret-spine-7.0.1-rc.3.tgz) |

The [release manifest](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.3/release.json) lists the source commit, file sizes and SHA-256 digests. Serve downloaded browser files from your own game directory or site. Include the licence notices from the browser archive when redistributing them.

`7.0.1-rc.2` was the previous candidate, distributed through [GitHub Releases](https://github.com/cnedwin/Egret_rebuild/releases/tag/v7.0.1-rc.2) only. [`7.0.1-rc.1` was an earlier browser bundle build](https://github.com/cnedwin/Egret_rebuild/pull/367). Projects pinned to `0.1.0-preview.1` can still use the [early engineering preview](https://github.com/cnedwin/Egret_rebuild/releases/tag/v0.1.0-preview.1) and its [original starter ZIP](https://github.com/cnedwin/Egret_rebuild/releases/download/v0.1.0-preview.1/egret-first-game.zip).

## Run and edit the starter

1. Extract the [starter ZIP](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.3/egret-first-game.zip) into a new folder. Its `package.json` pins the engine archive from this release and esbuild 0.28.2.
2. With Node.js 26.7.0 and npm, run `npm install`, then `npm start`. Open `http://127.0.0.1:8000`. Click the amber square or press Space. It moves 32 stage units per action.
3. In `main.mjs`, change `STEP` from `32` to `64`, save and reload the page. The square now moves twice as far. Press Ctrl+C in the terminal to stop the local server.

## Install with npm

The candidate is on the public npm registry under the `next` tag:

```sh
npm install @egret/engine@next
```

`@egret/engine` brings `@egret/contracts` and `@egret/runtime` of the same version. Add `@egret/project@next` for the project format and `@egret/spine@next` for Spine. A candidate is never published as `latest`, so `npm install @egret/engine` without a tag waits for a final 7.0 release.

The same packages also install from GitHub Releases by archive address, without the registry for Egret's own packages:

```sh
npm install https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.3/egret-engine-7.0.1-rc.3.tgz
```

npm then fetches `@egret/contracts` and `@egret/runtime` from the same release. To add project format or Spine support, run `npm install` with the corresponding `.tgz` URL in the table.

## What an archive holds

Each npm archive contains the built `dist` directory, both package READMEs, `LICENSE` and `NOTICE`. The private workspace uses version `0.0.0`. Each packed manifest carries the release version, lists its distributable files and names a licence; a package whose source manifest names none is Apache-2.0. Public entries and third-party dependencies come from the source manifest.

Each package is packed twice. `egret-<name>-<version>.tgz` pins its dependencies on other Egret packages to URLs in the same release. `npm-egret-<name>-<version>.tgz`, the archive published to the registry, names them by the same version. The two hold the same files; only `package.json` differs. `release.json` records the size and SHA-256 of both, and the registry archives' dist-tag.

## Make a release

Create and push a `v<version>` tag on the commit to distribute. The release workflow reads that tag, builds the tagged commit, and uses the same version for the browser files, package archives and starter. GitHub marks versions with a prerelease suffix as prereleases.

Once the GitHub release is published, download `release.json` and the five `npm-*.tgz` archives into a new directory, and run `node tools/publish-registry.mjs --release <directory>` with an npm login that may publish to `@egret`. It holds each archive to `release.json`, publishes the packages in dependency order under `next`, or `latest` for a version without a prerelease suffix, and reads each package's integrity back from the registry. A package already on the registry with the same bytes is left as it is, so the command can be run again after an interruption. `--dry-run` shows what npm would send.

To rehearse packaging and installation of the five npm archives locally, run the following commands.

```sh
node tools/build.mjs
node tools/pack-release.mjs --version 7.0.1-rc.3 --out ../release
node tools/verify-release.mjs --version 7.0.1-rc.3 --archives ../release
node tools/publish-registry.mjs --release ../release --dry-run
```

The install check uses a second set of archives with local file URLs so it can run before publication. It also installs the five registry archives together into a second project, where each finds the others by version. npm downloads third-party dependencies, and the check compares the package payloads against the release archives.

## Earlier engineering preview evidence

- `tests/pack-release.test.mjs`: versions and addresses, the manifest, refusals, and the contents of all five archives.
- On Linux with Node 26.7.0 and npm, the archives of `0.1.0-preview.1` were installed into a clean project outside the repository, and `@egret/engine`, `@egret/engine/web/game`, `@egret/project` and `@egret/spine` were imported there.

A pre-release rehearsal installed the engine from locally addressed archives in a new Windows project. Headless Edge 157 rendered the square, advanced it by 32 stage units on a click, then by 64 on Space after editing and reloading. The archive-install check uses npm. Independent newcomer, display timing and other package managers have separate acceptance. [Handoff status](https://github.com/cnedwin/Egret_rebuild/issues/93)

[Preview.1](https://github.com/cnedwin/Egret_rebuild/releases/tag/v0.1.0-preview.1) ships from commit `51b12255`. The seven public downloads matched their GitHub SHA-256 digests. A fresh npm project installed the starter's engine, runtime and contracts from the release URLs. A separate installation imported the project and Spine entries and matched all five Egret packages against their tarballs. Windows Edge and Galaxy Z Fold7 Chrome rendered the same game bundles through WebGPU and WebGL2. Changing `STEP` from 32 to 64 doubled the distance observed on each device. The [handoff record](https://github.com/cnedwin/Egret_rebuild/issues/93#issuecomment-6967204747) gives the bundle sizes and the time from navigation to the observed movement, including automated input and pixel capture. Independent newcomer and network startup acceptance remain open.

## Limits

- A release cannot be changed once its tag is used: make a new version.
- An address is longer than a package name and does not take a version range; install from the registry for both. Versions before `7.0.1-rc.3` are on GitHub Releases only.
- `@egret/spine` needs `@esotericsoftware/spine-core` 4.3.13, which has its own licence; see the package's README.
