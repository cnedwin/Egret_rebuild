# Release archives

English | [简体中文](../../Cns/docs/release-archives.md)

The packages in this repository are private and at version 0.0.0. A release is a set of archives made from them, one for each package, attached to a GitHub release. Nothing is published to npm.

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

Not checked: the workflow itself, which runs only when a tag is pushed; installing with pnpm or yarn; a browser page built from an installed release, which [the clean consumer check](clean-consumer.md) covers for the private archives.

## Limits

- A release cannot be changed once its tag is used: make a new version.
- An address is longer than a package name and does not take a version range. Publishing to a registry would give both, and is a decision about the `@egret` name on npm that has not been made.
- `@egret/spine` needs `@esotericsoftware/spine-core` 4.3.13, which has its own licence; see the package's README.
