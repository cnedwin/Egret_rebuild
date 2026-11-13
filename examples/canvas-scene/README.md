# Canvas Rectangle Example

English | [简体中文](README.zh-CN.md)

> **Now on the shared Hosts.** This example draws with the shared WebGPU Host by default and with the shared WebGL2 Host under `?backend=webgl2`. The Canvas Host it used before has been removed; the verifier commands named below were written for it and no longer apply. Statements below about the Canvas Host, about choosing Canvas, and about recorded Canvas checks describe earlier versions.

First run `pnpm install --frozen-lockfile --ignore-scripts` and `node tools/build.mjs` (or `node tools/verify.mjs`) at the repository root to generate dist outputs omitted from this source distribution. Serve the repository root over HTTP and open `/examples/canvas-scene/index.html`. Its import map connects the built core and separate web entry; pointer interaction changes rectangles and renders again, demonstrating a bounded scene interaction.

Rendering changes separately require `node tools/verify-canvas.mjs --playwright <installed-playwright-module> --channel msedge --output <private-output-directory>`; PLAYWRIGHT_MODULE can also configure the module. Default prepush runs structural/headless gates and does not include a real browser. The browser must be installed; tooling does not install dependencies.

Run `node tools/serve-canvas.mjs` at the repository root to start the local HTTP server, open its printed URL, and stop it with Ctrl+C.
