# Acknowledgements

English | [简体中文](ACKNOWLEDGEMENTS.md)

We thank the projects and communities that publish source code, standards, documentation, and maintenance experience. Acknowledgements record their actual roles and do not imply cooperation or upstream endorsement.

## Current development tools

- [TypeScript](https://github.com/microsoft/TypeScript) 7.0.2 and the local native compiler: compilation and type-checking tools; the prototype records the applicable declaration as Apache-2.0.
- [pnpm](https://pnpm.io/workspaces) 11.25.0: package management and workspace tooling, recorded as MIT in the prototype.
- [Node.js](https://nodejs.org/api/) 24.19.0: the host for development, tests, and headless examples; its MIT license and applicable upstream third-party notices are retained.

Tools are obtained through dependency installation; the local candidate does not include node_modules. The three core packages have no third-party runtime dependencies. Versions and notice locations are recorded in [source-origin.json](source-origin.json).

## Research and standards

The knowledge base records mechanism and product research on Cocos, LayaAir, Godot, Three.js, Babylon.js, PlayCanvas, PixiJS, DragonBonesJS, and other projects. It also retains the scope of materials read on HarfBuzz, FreeType, Unicode, WebGPU, WGSL, WebGL, glTF, and MCP. Fixed versions, official links, and pending research status are in the [knowledge-base acknowledgements](knowledge-base/ACKNOWLEDGEMENTS.en.md).

The Three.js r186 research chain actually runs WebGLRenderer, GLTFLoader, AnimationMixer, and SkeletonUtils at fixed commit `9b4a2ac29c63ccb43fd51c5661f2f873ac2c39b8`. It uses the Rigged Simple asset by Cesium (2017), with attribution and the CC-BY-4.0 notice retained alongside the research files. This chain is a third-party research reference in the knowledge base. It is not a runtime dependency of the three core packages and does not count as Egret's independently developed rendering core. See the [third-party notices](knowledge-base/experiments/asset-reference-probe/THIRD_PARTY_NOTICES.en.md) for the full explanation.

First-party code and documentation use the repository's existing [Apache-2.0 license](LICENSE). The respective applicable notices for third-party files, assets, and tools remain in place.
