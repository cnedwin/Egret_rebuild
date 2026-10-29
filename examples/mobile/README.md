# Responsive Egret examples

English | [简体中文](README.zh-CN.md)

Run `pnpm example:browser` after setup, then open its printed URL. Choose resource actors, independent contacts, managed UI or multilingual paragraphs. Touch, mouse and pen use the existing public input bridge; native controls remain available. Panel backends are explicit WebGL2/WebGPU. Rotation and DPR changes replace the session in order and preserve application state. Effective density is [1,2].

Existing fixed examples and collectors stay byte-identical. Their explicit links retain their original input and pixel contracts. The sequence-control fixed page already accepts native touch clicks; follow its own content preparation instructions. No new Engine feature or automatic qualification claim is added.

Read the [layout, ownership, input and verification contract](../../knowledge-base/en/docs/mobile-examples.md). Reproduce the finite desktop-browser emulation using `node examples/mobile/verify-browser.mjs <playwright-root> <new-output-directory>`, with Playwright 1.62.1 and installed Microsoft Edge. Output must be outside this repository and must not already exist. Physical Android/iPhone, IME and performance acceptance remain open.
