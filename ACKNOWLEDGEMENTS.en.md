# Acknowledgements

English | [简体中文](ACKNOWLEDGEMENTS.md)

## 0.16.0 declaration and 3D references

[jsonc-parser](https://github.com/microsoft/node-jsonc-parser/tree/v3.3.1) 3.3.1 by Microsoft Corporation supplies public-root createScanner/visit under MIT for the existing private project adapter and declaration analysis. Its existing MIT notice and dependency pin remain applicable. The RES profile/report/fixtures and CPU 3D contracts/implementation were independently authored. Founder-supplied historical RES declaration semantics informed compatibility research; exact version/module closure remains unverified and historical private source is not distributed. See [the declaration scope](knowledge-base/docs/legacy-res-declarations.en.md).

The selected [GPUWeb draft](https://github.com/gpuweb/gpuweb/blob/25a5dc4537074c9b3844dd95891f5cfd193f4407/spec/index.bs) at commit 25a5dc4537074c9b3844dd95891f5cfd193f4407 informs nine selected 3D design semantic ranges. This fixed reading and selected TypeScript declarations establish no latest-final-standard, GPU host, pixel or performance acceptance. Depth-free UI and readback after the selected passes are Egret architectural choices, not universal WebGPU requirements. See [3D foundation](knowledge-base/docs/3d-foundation.en.md). Existing research/dependency credits and their historical limitations remain in force.

We thank the projects and communities that publish source code, standards, documentation, and maintenance experience. Acknowledgements record their actual roles and do not imply cooperation or upstream endorsement.

## Current development tools

- [TypeScript](https://github.com/microsoft/TypeScript) 7.0.2 and the local native compiler: compilation and type-checking tools; the prototype records the applicable declaration as Apache-2.0.
- [pnpm](https://pnpm.io/workspaces) 11.25.0: package management and workspace tooling, recorded as MIT in the prototype.
- [Node.js](https://nodejs.org/api/) 24.19.0: the host for development, tests, and headless examples; its MIT license and applicable upstream third-party notices are retained.

Tools are obtained through dependency installation; the local candidate does not include node_modules. contracts/runtime have no third-party runtime dependencies; engine now explicitly depends on robust-predicates 3.0.3 for WebGPU preparation. Versions and notice locations are recorded in [source-origin.json](source-origin.json).

## Research and standards

The knowledge base records mechanism and product research on Cocos, LayaAir, Godot, Three.js, Babylon.js, PlayCanvas, PixiJS, DragonBonesJS, and other projects. It also retains the scope of materials read on HarfBuzz, FreeType, Unicode, WebGPU, WGSL, WebGL, glTF, and MCP. Fixed versions, official links, and pending research status are in the [knowledge-base acknowledgements](knowledge-base/ACKNOWLEDGEMENTS.en.md).

The Three.js r186 research chain actually runs WebGLRenderer, GLTFLoader, AnimationMixer, and SkeletonUtils at fixed commit `9b4a2ac29c63ccb43fd51c5661f2f873ac2c39b8`. It uses the Rigged Simple asset by Cesium (2017), with attribution and the CC-BY-4.0 notice retained alongside the research files. This chain is a third-party research reference in the knowledge base. It is not a runtime dependency of the three core packages and does not count as Egret's independently developed rendering core. See the [third-party notices](knowledge-base/experiments/asset-reference-probe/THIRD_PARTY_NOTICES.en.md) for the full explanation.

First-party code and documentation use the repository's existing [Apache-2.0 license](LICENSE). The respective applicable notices for third-party files, assets, and tools remain in place.

## WebGPU foundational dependency and standards

[robust-predicates](https://github.com/mourner/robust-predicates/tree/v3.0.3) 3.0.3 by Vladimir Agafonkin supplies public `orient2d` for orientation of represented binary64 coordinates. It remains an attributed external dependency under [Unlicense](third-party/robust-predicates-3.0.3.LICENSE); its source is not transplanted into first-party modules. The exact 40820-byte npm artifact, SRI, installed manifest/types/license and six-module 73171-byte installed ESM graph are recorded separately from browser-request observations. These are not transferred or tree-shaken bundle-size figures.

The GPUWeb API references for canvas configuration/current texture, queues, buffers and device errors, plus the W3C WGSL publication, inform the independently authored pass/lifetime contract. Reading dates, consulted URLs, full-spec retrieval limit and earlier failed type/latest fetches remain in [source evidence](knowledge-base/evidence/webgpu-source-evidence.json). Actual browser gate results are separate. These credits imply neither upstream endorsement nor phone/performance/Native SDK acceptance.
