# Prepared subtree example

English | [简体中文](README.zh-CN.md)

Run `pnpm setup:dev` and `pnpm example:browser`, then open `/examples/prepared-subtree/index.html?backend=webgpu` or `?backend=webgl2` on the local server.

Prepare a detached green Mesh/cyan Bitmap under existing transforms, clips and opacity. The red scene remains visible. Commit replaces the CPU child tree. Submit presents the uploaded frame. Abort cancels an uncommitted request; the replay buttons demonstrate immutable captured frames. Reload the page to repeat a completed replacement. Borrowed old nodes/resources are retired only by their owners on Close.

Read the [full contract and evidence](../../knowledge-base/en/docs/prepared-display-subtree.md). CPU publication and Host submission are separate: this example promises neither submission-failure rollback nor device recovery. It is a prerequisite for later Spine RESET integration, not an animation hot-replacement wrapper. Input/focus transactions and performance acceptance remain open.

The fixed desktop collector is `node examples/prepared-subtree/verify.mjs <Playwright-1.62.1/index.mjs> <absolute-output>`. It uses default headed Edge, no extra flags, both shared backends, literal pixel expectations, raw screenshots/readbacks and the actual executed input closure. The [portable summary](verification-summary.json) records the finite result, original failures and limits; full CI and independent review are separate.

All shapes, color pages and expectations are original programmatic content, with no Editor-exported or third-party art. First-party code/content/documentation are independently authored with AI assistance under Apache-2.0. Existing SDK dependency notices remain applicable; this example adds no runtime dependency.
