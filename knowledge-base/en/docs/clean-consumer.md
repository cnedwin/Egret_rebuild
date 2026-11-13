# Using the preview from a clean project

English | [简体中文](../../Cns/docs/clean-consumer.md)

This page says what a project outside this repository receives when it uses the default engine today, how that is checked, and which rows are still open. It belongs to [#93](https://github.com/cnedwin/Egret_rebuild/issues/93).

## What the distribution is

The workspace packages are private at version 0.0.0 and are not published to a registry. The distribution that can be handed over is three archives, packed by the pinned pnpm from a built checkout:

| Archive | Role | Declared by the consumer |
| --- | --- | --- |
| `egret-contracts-0.0.0.tgz` | Shared contracts | No, named in an override |
| `egret-runtime-0.0.0.tgz` | Runtime | No, named in an override |
| `egret-engine-0.0.0.tgz` | `@egret/engine` and its 23 entries | Yes, the only dependency |

The engine asks for the other two at version 0.0.0. Because no registry has them, the consumer names their archives under `overrides` in its `pnpm-workspace.yaml`. pnpm 11 reads overrides only from that file.

`@egret/spine` and `@egret/project` are separate packages with their own third-party dependencies. They are not part of this route and the check confirms that they are not installed.

## Run the check

Prepare the checkout as in [getting started](getting-started.md), then name a new directory outside it:

```text
pnpm setup:dev
pnpm exec node tools/verify-clean-consumer.mjs <new absolute directory outside the checkout>
```

Add `--offline` to take `robust-predicates` from the installed copy of the checkout and install without the registry. The run writes `archives/`, `consumer/` and `report.json` into the directory and prints the report. It exits with 1 when a row fails. [The tool](https://github.com/cnedwin/Egret_rebuild/blob/main/tools/verify-clean-consumer.mjs)

| Row | What passes |
| --- | --- |
| `archives` | Each archive holds every module and type file its package declares, the licence text, and dependencies written as versions. |
| `install` | `pnpm install --ignore-scripts` succeeds in the new project. Four packages are installed and none of the optional ones. |
| `entries` | All 23 entries of `@egret/engine` resolve to the declared file inside the consumer, have their type file, and load in Node. |
| `separation` | An entry that is not a web entry loads no web module. An entry that is not a 3D entry loads no 3D module. Only `webgl2` and `webgpu` load `robust-predicates`. Nothing is loaded from outside the consumer. |
| `examples` | The public examples, copied byte for byte, run in the consumer and print what they print in the checkout. |
| `types` | A strict TypeScript consumer of the default entry and of `@egret/engine/layout` compiles against the installed types, and a wrong call is still an error. |
| `notices` | Each installed package carries a licence file. |

The two examples are [`examples/headless.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/headless.mjs) for the default entry and [`examples/layout-headless.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/layout-headless.mjs) for one explicit optional entry, `@egret/engine/layout`.

## Do it by hand

```text
pnpm --dir packages/contracts pack --pack-destination <directory>/archives
pnpm --dir packages/runtime pack --pack-destination <directory>/archives
pnpm --dir packages/engine pack --pack-destination <directory>/archives
```

In `<directory>/consumer`, write `package.json`:

```json
{
  "name": "my-game",
  "private": true,
  "type": "module",
  "dependencies": { "@egret/engine": "file:../archives/egret-engine-0.0.0.tgz" }
}
```

and `pnpm-workspace.yaml`:

```yaml
packages: []
overrides:
  '@egret/contracts': file:../archives/egret-contracts-0.0.0.tgz
  '@egret/runtime': file:../archives/egret-runtime-0.0.0.tgz
```

Then run `pnpm install --ignore-scripts`, copy `examples/headless.mjs` into the directory and run it with `node headless.mjs`.

## Support matrix

| Item | Supported | How it is known |
| --- | --- | --- |
| Node | 26.7.0 | The tool refuses another version. |
| Package manager | pnpm 11.25.0 | The tool refuses another version. |
| Compiler | TypeScript 7.0.2, `module` and `moduleResolution` set to `NodeNext`, `strict` | The `types` row. |
| Module format | ECMAScript modules only. The packages have no CommonJS entry. | The declared exports. |
| Operating system | Linux x64 and Windows x64 | The offline route runs in [`tests/clean-consumer.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/clean-consumer.test.mjs), which is part of the complete Windows suite of continuous integration. The Linux run was made in the development container. |
| Browsers | Not established from a consumer | See the open rows. |

Entries by where they can do their work:

| Group | Entries | From the consumer |
| --- | --- | --- |
| Default | `@egret/engine` | Example run and types compiled |
| Headless, optional | `/layout` | Example run and types compiled |
| Headless, optional | `/text`, `/resources`, `/input`, `/ui`, `/ui/editing`, `/animation`, `/paragraph`, `/world3d` | Resolved and loaded |
| Browser, optional | `/webgl2`, `/webgpu`, `/web/input`, `/web/pointer`, `/web/keyboard`, `/web/image`, `/web/text`, `/web/paragraph`, `/web/resources`, `/web/editing`, `/web/text-input`, `/webgl2/world3d`, `/webgpu/world3d` | Resolved and loaded in Node. Not run in a browser. |

What each capability does, and how far each one is tested in the checkout, is in [current capabilities](core-progress.md).

## Module sets

Measured in the consumer on Linux x64 from the archives of main [215aa9e](https://github.com/cnedwin/Egret_rebuild/commit/215aa9eda94cdf25db50cd00ec598d1afb81887e) with this change. A set is every module that one import loads in Node, unbundled. Gzip is each file compressed at level 9, then summed. A bundler would produce other numbers, and `report.json` of a run holds all 23 rows.

| Entry | Modules | KiB | KiB gzip | Third party |
| --- | ---: | ---: | ---: | --- |
| `@egret/engine` | 80 | 480 | 136 | None |
| `@egret/engine/layout` | 52 | 297 | 85 | None |
| `@egret/engine/webgl2` | 78 | 634 | 163 | robust-predicates |
| `@egret/engine/webgpu` | 81 | 653 | 167 | robust-predicates |
| `@egret/engine/world3d` | 47 | 861 | 238 | None |
| `@egret/engine/webgl2/world3d` | 96 | 1041 | 288 | None |
| `@egret/engine/webgpu/world3d` | 94 | 1029 | 286 | None |

The archives of contracts, runtime and engine were 61 KiB, 334 KiB and 1710 KiB.

## Third-party notices

| Package | Licence | Where the text is | Loaded by |
| --- | --- | --- | --- |
| `@egret/contracts`, `@egret/runtime`, `@egret/engine` | Apache-2.0 | `LICENSE` and `LICENSE.zh-CN.md` in each archive | Every entry, except that `/world3d` loads the engine only |
| `robust-predicates` 3.0.3 | Unlicense | `LICENSE` in the installed package, and [third-party/robust-predicates-3.0.3.LICENSE](https://github.com/cnedwin/Egret_rebuild/blob/main/third-party/robust-predicates-3.0.3.LICENSE) | `/webgl2` and `/webgpu` only |

The [NOTICE](https://github.com/cnedwin/Egret_rebuild/blob/main/NOTICE) file of the repository names the same dependency. It does not travel inside the archives. The Spine runtime and `jsonc-parser` belong to the optional packages and are not installed on this route.

## First interaction

First interaction was not measured from a consumer. The check loads modules in Node and opens no page, so it says nothing about download time, start-up or the first frame. The start-up records that exist belong to examples served from the checkout over loopback, and the targets of M1 and M4 in the [acceptance plan](m4-core-acceptance-plan.md) remain to be measured against an actual artifact, content and network profile.

## Migration notes

Entries that earlier checkpoints had and this distribution does not:

| Removed | Use instead |
| --- | --- |
| `@egret/engine/web`, the Canvas Host, with `captureFrame` and `captureTexturedFrame` | The shared frame, drawn by `createSharedWebGL2Host` from `@egret/engine/webgl2` or `createSharedWebGPUHost` from `@egret/engine/webgpu`. See the [shared render profile](shared-render-profile-contract.md). |
| `@egret/engine/scene3d`, `/scene3d/authoring`, `/webgl2/scene3d`, `/webgpu/scene3d` | [World3D](world3d.md): `@egret/engine/world3d` with `/webgl2/world3d` or `/webgpu/world3d`. It is a different interface, not a renamed one. |

Differences from the legacy Egret API are in [legacy project migration](legacy-project-migration.md). Nothing here converts a legacy project.

## Open rows

- The packages are not published. No install of the engine from a registry was run, and the registry route of the tool was not run in the development container, which has no network.
- The manifests of the three packages have no `license` field. The licence text is in each archive.
- No `files` list narrows the archives. Sources, one package test and compiler configuration travel with the built modules.
- No page was opened from the consumer. Neither back end drew from the installed copy, on any browser or phone.
- First interaction and bundle size under a bundler were not measured.
- A person new to the project has not followed this page. The check is an automated rehearsal and does not close that row.
- The final handoff still depends on [#91](https://github.com/cnedwin/Egret_rebuild/issues/91) and [#92](https://github.com/cnedwin/Egret_rebuild/issues/92).
