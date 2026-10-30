# Paragraph geometry example

English | [简体中文](README.zh-CN.md)

Run `pnpm example:browser` and open `/examples/paragraph-geometry/index.html`. The existing UI and shared renderer paint a multilingual paragraph, selected source ranges and a caret. DOM forms supply source offsets and local query coordinates; no scene touch listeners are added.

Use `?backend=webgl2` or `?backend=webgpu`. The example borrows the existing identified optional paragraph runtime/fonts without adding default engine dependencies. Read the [contract](../../knowledge-base/en/docs/paragraph-text-geometry.md). It is a readonly geometry preview, not an editor or IME/device/performance qualification.
