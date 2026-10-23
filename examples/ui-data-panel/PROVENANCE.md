# Asset and implementation provenance

English | [简体中文](PROVENANCE.zh-CN.md)

The example, literal fixtures, linear test reference and finite collector are independently authored first-party Apache-2.0 code with AI assistance. The collector adapts the repository's existing `tools/verify-multi-pointer.mjs` bounded import reader, immutable snapshot/server, pinned Playwright 1.62.1/default Edge launch and cleanup pattern. Rendering uses existing shared WebGPU/WebGL2 hosts; no renderer or production layout algorithm is copied into the oracle.

The example reuses original files without copying, regenerating or relicensing:

| File | Identity | Rights/source |
| --- | --- | --- |
| `../canvas-text/assets/ahem.ttf` | 22572 bytes; SHA256 `f0a92cd0cc45735591c9b5b1fa8aecd5194e8dc518895ca22af94a46c23550dc` | [Existing provenance](../canvas-text/assets/provenance.json), [upstream COPYING](../canvas-text/assets/Ahem-COPYING.txt), [upstream README](../canvas-text/assets/Ahem-README.txt). Retain their original conditions; this font is not relicensed Apache-2.0. |
| `../../tools/browser-png/assets/rgb-red-green.png` | 72 bytes; SHA256 `917780f34b6e830eceb3a99e7c5794af705f16193ba8b2d415c86b24aa0cc78d` | [Existing first-party literal-pixel provenance](../../tools/browser-png/assets/provenance.json), Apache-2.0. |

Runtime verifies both original byte identities. The unique application-owned Ahem FontFace must be loaded, installed and exactly selected for X/space; native decoding of the checked 2×1 bitmap precedes an ordinary public texture lease. Asset provenance does not establish browser, GPU, text or device acceptance. The verifier preserves original asset/legal bytes in its source freeze and records actual native font/backend environment.
