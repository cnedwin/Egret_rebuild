<!-- SPDX-License-Identifier: Apache-2.0 -->
# Optional third-party integrations

English | [简体中文](README.zh-CN.md)

The optional `@egret/integrations` package lives in `integrations/`. Its dependencies and lockfile are installed separately from the engine. Import the capabilities your project uses through the named subpaths below. Public contracts contain Egret-facing values, with no vendor objects crossing the adapter boundary.

| Capability | Import subpath | Public calls and host |
| --- | --- | --- |
| Tiled and tmx-parser | `/tiled` | `importTiledMap({ mapPath, files })` compiles finite orthogonal or isometric TMX with inline or declared TSX tilesets. Run in Node and pass the resulting `egret.tiled-map/1` JSON to the game. |
| Planck | `/physics` | `createPhysicsWorld(options)`, `createBody`, `advance(seconds)`, `snapshot` and `applyLinearImpulse`. Browser and Node. |
| Howler | `/web/audio` | `createAudioBank`, `load`, `play`, `status` and `dispose`. Browser. |
| idb-keyval | `/web/storage` | `createSaveStore(namespace)`, `get`, `set`, `update`, `delete` and `dispose`. Browser with IndexedDB. |
| fflate | `/archive` | `zipAssets` and `unzipAssets` for bounded, in-memory ZIP assets. Browser and Node. |
| ktx-parse | `/texture` | `inspectKtx2` reads container and mip metadata. `decodeKtx2Rgba8` supplies owned pixels for Egret textures. Browser and Node. |
| i18next | `/i18n` | `createLocalization`, `t`, `changeLanguage` and `dispose`. Browser and Node. |

All subpaths start with `@egret/integrations`. The package is a repository-local preview. An application in another checkout can declare a local file dependency on the built package and use the same imports.

## Asset and scene ownership

- Tiled stays an external editor. Open `example/assets/room.tmx` there to edit the sample. The Node importer only accepts caller-declared TMX and TSX text. Tile layers preserve empty cells and the horizontal, vertical and diagonal flags. Use the resulting atlas paths with the game's asset loader. The finite profile supports the map features listed in the adapter, with explicit errors for infinite maps, compressed layers and unsupported layer/object features.
- The physics world accepts metres, seconds and radians. Use the existing Egret clock's delta, or call `advance` from your own loop. Fixed stepping limits catch-up and reports dropped time and contacts. Body snapshots are independent of Planck's internal state. The demo converts metres to pixels and advances the world on demand.
- Register the world, audio bank, save-store handle and translator with `scope.use(...)`. Closing the scope releases owned voices and runtime handles. A Howler voice belongs to its bank. Preload with `load` and call `play` directly from a click or tap. Read `voice.started` and listen to `onDiagnostic` for actual play or failure.
- Saves are isolated by namespace within the origin. The updater is synchronous inside one IndexedDB transaction. `undefined` means absent, and `delete` removes the value. Disposing a handle leaves its stored data intact.
- ZIP uses relative asset paths, stored or DEFLATE payloads, size limits and CRC checks. ZIP64, encrypted entries and streaming descriptors are outside this profile. It returns bytes for an asset loader and performs no filesystem writes.
- Direct KTX2 pixel decoding covers tightly packed, top-left, straight sRGB RGBA8 2D textures. Container inspection also reports other supported metadata and compression schemes. Basis/UASTC transcoding and compressed GPU upload are separate. Use the resulting pixels with `createImageData2D` and `createTexture` inside the existing asset provider.
- Translators own their dictionaries and language independently. Use the returned strings as Egret or DOM plain text. Supply a fallback catalog, and use `count` for plural rules and `values` for interpolation.

## Run and debug

```sh
pnpm setup:dev
pnpm --dir integrations install --frozen-lockfile --ignore-scripts
pnpm --dir integrations build
pnpm --dir integrations test
pnpm --dir integrations dev
```

Open the URL printed by `dev`. **Run scene** starts real audio, steps physics, updates a save twice and switches language. The **Diagnostics** panel shows the imported map dimensions, ZIP entries, texture mip count, pixels from Egret's canvas, collision count, audio events and save state. Reload to check persistence. **Close scene** releases the Egret scope. Browser DevTools can step through the adapter and example sources via the example bundle's source map.

Run `pnpm --dir integrations verify:browser` for automated acceptance. On Windows the default is installed Edge. Other systems use Playwright Chromium after `pnpm --dir integrations exec playwright install chromium`. Pass a channel such as `chrome` or `msedge` to test an installed browser. The verifier checks the complete scene, the reload and cleanup.

To produce normalized JSON for your own map, list the exact declared TSX inputs and redirect stdout into your build output.

```sh
node integrations/tools/import-tiled.mjs integrations/example/assets room.tmx tiles.tsx
```

The adapters use `IntegrationError` from `/errors`. Log `integration`, `code`, `message` and the optional `cause` at the application's diagnostic boundary. The demo reports those fields without relying on global vendor logging.

Dependency versions and licensing are recorded in [Third-party notices](THIRD_PARTY_NOTICES). The actual runnable integration example is in [example](example/main.mjs).
