# Egret Engine 7.0 release notes and installation

English | [简体中文](../../Cns/docs/release-archives.md)

[Egret Engine 7.0.2](https://github.com/cnedwin/Egret_rebuild/releases/tag/v7.0.2) is the stable release of the 7.0 series. The browser files for 2D and 3D, five JavaScript packages and editable starter are built from one source commit.

| Use case | Download |
| --- | --- |
| Start with an editable 2D game | [Starter project](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/egret-first-game.zip) |
| Add the engine to a web page | [Browser files and licences](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/egret-browser.zip). For 2D, choose [`egret2d.js`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/egret2d.js) or [`egret2d.mjs`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/egret2d.mjs). For World3D, choose [`egret3d.js`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/egret3d.js) or [`egret3d.mjs`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/egret3d.mjs). |
| Import modules into an npm project | `npm install @egret/engine` from the npm registry, or the archives: [`@egret/engine`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/egret-engine-7.0.2.tgz), [`@egret/contracts`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/egret-contracts-7.0.2.tgz), [`@egret/runtime`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/egret-runtime-7.0.2.tgz), [`@egret/project`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/egret-project-7.0.2.tgz), [`@egret/spine`](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/egret-spine-7.0.2.tgz) |

The [release manifest](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/release.json) lists the source commit, file sizes and SHA-256 digests. Serve downloaded browser files from your own game directory or site. Include the licence notices from the browser archive when redistributing them.

The previous candidate, [7.0.1-rc.3](https://github.com/cnedwin/Egret_rebuild/releases/tag/v7.0.1-rc.3), remains available from GitHub and by exact version on npm.

On November 22, 2026, GitHub returned 404 for the tags and release downloads of two earlier versions. For historical builds, use the [7.0.1-rc.2 source](https://github.com/cnedwin/Egret_rebuild/tree/859bd0eecdc039ffc34e89c55d5de0986bafb67c), [0.1.0-preview.1 source](https://github.com/cnedwin/Egret_rebuild/tree/51b122555503533a4064736e7cbad4934db70862) or [7.0.1-rc.1 browser-build record](https://github.com/cnedwin/Egret_rebuild/pull/367).

## What's new in 7.0.2

- **Browser 2D and Play.** Consecutive WebGPU frames can share an immutable atlas once its upload is submitted. Both shared rendering backends report actual draw calls. Games with their own mixer can pass `audio: false` to `play` or `play3d` to skip the built-in audio context and preset loading.
- **Spine content builds.** The build tools can emit a runtime manifest for Spine 4.3 JSON or binary skeletons, an atlas and its named PNG pages. Export and redistribution remain subject to the relevant licences. [Spine formats and acceptance](spine-content-ingress.md)
- **World3D.** Authors can build models from signed distance fields, apply surface materials and animate rigs. The example gallery ships 22 static meshes and keeps two live rigs. Its first interactive picture took a median of 1.68 seconds on both WebGL2 and WebGPU in low-quality, USB-served runs on one Galaxy Z Fold7. [Hardware measurements](november-browser-hardware.md)
- **Native and mini-game targets.** The Android Runtime SDK in the source tree builds signed APKs and AABs locally. Its trimmed V8/GLES3 player has Fold7 evidence for a textured racing level, 210-frame driving replay and device recovery. The WeChat exporter was exercised with a simulated `wx` environment. WeChat DevTools, a physical WeChat client and uploading still need separate verification. The Android and WeChat tools ship in the source tree. [Android SDK](https://github.com/cnedwin/Egret_rebuild/tree/v7.0.2/runtime-sdk) · [WeChat export guide](wechat-minigame.md)

## Run and edit the starter

1. Extract the [starter ZIP](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/egret-first-game.zip) into a new folder. Its `package.json` pins the engine archive from this release and esbuild 0.28.2.
2. With Node.js 26.7.0 and npm, run `npm install`, then `npm start`. Open `http://127.0.0.1:8000`. Click the amber square or press Space. It moves 32 stage units per action.
3. In `main.mjs`, change `STEP` from `32` to `64`, save and reload the page. The square now moves twice as far. Press Ctrl+C in the terminal to stop the local server.

## Install with npm

Stable releases use the npm `latest` tag. Candidates use `next`. The following command installs the engine from the default channel.

```sh
npm install @egret/engine
```

`@egret/engine` brings `@egret/contracts` and `@egret/runtime` of the same version. Add `@egret/project` for the project format or `@egret/spine` for Spine. To select the candidate tag explicitly, run `npm install @egret/engine@next`. To pin this version in `package.json`, run `npm install --save-exact @egret/engine@7.0.2`.

The same packages also install from GitHub Releases by archive address, without the registry for Egret's own packages:

```sh
npm install https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/egret-engine-7.0.2.tgz
```

npm then fetches `@egret/contracts` and `@egret/runtime` from the same release. To add project format or Spine support, run `npm install` with the corresponding `.tgz` URL in the table.

## Install the prebuilt browser scripts from npm

The five modular packages provide feature-specific imports. Two additional npm packages distribute the same prebuilt browser scripts as the 7.0.2 GitHub release for games that deploy a single file.

| Game | Install | Module entry | Script to copy |
| --- | --- | --- | --- |
| 2D game | `npm install @egret/2d@7.0.2` | `import { play } from '@egret/2d'` | `egret2d.js` |
| World3D scene and 2D UI | `npm install @egret/3d@7.0.2` | `import { play3d } from '@egret/3d'` | `egret3d.js` |

The 3D bundle includes the 2D game entry. Choose one bundle per game and keep engine objects and resource lifetimes within that instance. [HTML and ES module examples](single-file.md)

## Use one browser collection from GitHub Packages

For projects that consume GitHub Packages, `@cnedwin/egret-browser` combines the four released browser scripts in one dependency. Add `@cnedwin:registry=https://npm.pkg.github.com` to the project's `.npmrc`. This routes only the `@cnedwin` scope to GitHub. The `@egret` modules and separate browser packages keep their normal npm configuration.

```sh
npm login --scope=@cnedwin --registry=https://npm.pkg.github.com --auth-type=legacy
npm install --save-exact @cnedwin/egret-browser@7.0.2
```

GitHub requires authentication for npm downloads even when the package is public. At the password prompt, use a classic personal access token with `read:packages` from an account with access to the package. Import `play` from `@cnedwin/egret-browser` or its `/2d` entry, or import `play3d` from `@cnedwin/egret-browser/3d`. For a plain HTML page, copy one classic script from the package. [GitHub Packages installation and browser examples](https://github.com/cnedwin/Egret_rebuild/blob/main/tools/github-browser-distribution/README.md)

## What an archive holds

Each of the five modular npm archives contains the built `dist` directory, both package READMEs, `LICENSE` and `NOTICE`. The private workspace uses version `0.0.0`. Each packed manifest carries the release version, lists its distributable files and names a licence; a package whose source manifest names none is Apache-2.0. Public entries and third-party dependencies come from the source manifest.

Each modular package is packed twice. `egret-<name>-<version>.tgz` pins its dependencies on other Egret packages to URLs in the same release. `npm-egret-<name>-<version>.tgz`, the archive published to the registry, names them by the same version. The two hold the same files; only `package.json` differs. `release.json` records the size and SHA-256 of both, and the tag used when first publishing the registry archives.

## Make a release

Create and push a `v<version>` tag on the commit to distribute. The release workflow reads that tag, builds the tagged commit, and uses the same version for the browser files, package archives and starter. GitHub marks versions with a prerelease suffix as prereleases.

Once the GitHub release is published, download `release.json` and the five `npm-*.tgz` archives into a new directory, and run `node tools/publish-registry.mjs --release <directory>` with an npm login that may publish to `@egret`. It holds each archive to `release.json`, publishes the packages in dependency order under `next`, or `latest` for a version without a prerelease suffix, and reads each package's integrity back from the registry. A package already on the registry with the same bytes is left as it is, so the command can be run again after an interruption. `--dry-run` shows what npm would send. For `7.0.1-rc.3`, the `latest` tag was moved separately after publication.

For npm staged publishing, first check the release manifest, then run `npm stage publish <archive> --tag latest --access public` for each verified `npm-*.tgz` in dependency order. After approval on npm, read back `dist.integrity` and `dist-tags` for every public package and install by name in an empty project. Use `--tag next` when staging a candidate.

To rehearse packaging and installation of the five npm archives locally, run the following commands.

```sh
node tools/build.mjs
node tools/pack-release.mjs --version 7.0.2 --out ../release
node tools/verify-release.mjs --version 7.0.2 --archives ../release
node tools/publish-registry.mjs --release ../release --dry-run
```

The install check uses a second set of archives with local file URLs so it can run before publication. It also installs the five registry archives together into a second project, where each finds the others by version. npm downloads third-party dependencies, and the check compares the package payloads against the release archives.

## Package the browser distributions from release assets

Maintainers download the assets from the matching GitHub release into one directory and read the SHA-256 of `release.json` from its GitHub asset record. The following command verifies the released scripts and notices and writes two npm archives. Supply a new output directory.

    node tools/pack-browser-npm.mjs --release <downloaded-release-directory> --manifest-sha256 <sha256-from-github> --out <new-directory>

The [GitHub Packages workflow](https://github.com/cnedwin/Egret_rebuild/blob/main/.github/workflows/publish-github-browser.yml) is dispatched manually from `main` for 7.0.2. It checks the release manifest and builds the combined archive with `--target github`, then installs the published package in an empty project. The run summary reports package visibility. Use the package settings to grant community access if the result is `private`. [Package access and visibility](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility)

## Earlier engineering preview evidence

- `tests/pack-release.test.mjs`: versions and addresses, the manifest, refusals, and the contents of all five archives.
- On Linux with Node 26.7.0 and npm, the archives of `0.1.0-preview.1` were installed into a clean project outside the repository, and `@egret/engine`, `@egret/engine/web/game`, `@egret/project` and `@egret/spine` were imported there.

A pre-release rehearsal installed the engine from locally addressed archives in a new Windows project. Headless Edge 157 rendered the square, advanced it by 32 stage units on a click, then by 64 on Space after editing and reloading. The archive-install check uses npm. Independent newcomer, display timing and other package managers have separate acceptance. [Handoff status](https://github.com/cnedwin/Egret_rebuild/issues/93)

[Preview.1](https://github.com/cnedwin/Egret_rebuild/tree/51b122555503533a4064736e7cbad4934db70862) was built from commit `51b12255`. The seven public downloads matched their GitHub SHA-256 digests. A fresh npm project installed the starter's engine, runtime and contracts from the release URLs. A separate installation imported the project and Spine entries and matched all five Egret packages against their tarballs. Windows Edge and Galaxy Z Fold7 Chrome rendered the same game bundles through WebGPU and WebGL2. Changing `STEP` from 32 to 64 doubled the distance observed on each device. The [handoff record](https://github.com/cnedwin/Egret_rebuild/issues/93#issuecomment-6967204747) gives the bundle sizes and the time from navigation to the observed movement, including automated input and pixel capture. Independent newcomer and network startup acceptance remain open.

## Limits

- A release cannot be changed once its tag is used: make a new version.
- An address is longer than a package name and does not take a version range; install from the registry for both. `7.0.1-rc.3` was the first version published to npm.
- `@egret/spine` needs `@esotericsoftware/spine-core` 4.3.13, which has its own licence; see the package's README.
