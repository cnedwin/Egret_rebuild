# Browser Graphics Capabilities and Pixel Research Prototype

English | [简体中文](../../../Cns/experiments/browser-probe/README.md)

Run `node server.mjs` here and open its printed local address in the test browser. The service listens locally only; results save to `../../evidence/browser-probe-results.json`. Close it afterward.

The program checks WebGL2 depth, transparency order, rectangular clipping, and context recovery, and attempts WebGPU device creation/clear/readback. It loads no commercial game/historical source and measures no performance, skeletons, text, or complete 3D assets. Desktop browser and actual hardware/driver paths are recorded truthfully. API/page availability cannot substitute for mini-game-host, phone, native, or performance certification.

Documentation location changed on October 10, 2026. Run the recorded experiment commands from the unchanged shared directory `knowledge-base/experiments/browser-probe` relative to the repository root. This reading-file relocation does not rerun the experiment or alter its original evidence.
