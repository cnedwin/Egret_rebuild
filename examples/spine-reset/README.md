# Spine asset version RESET

English | [中文](README.zh-CN.md)

Run `pnpm build`, `node examples/spine-reset/author.mjs`, then `pnpm example:browser`. Open [WebGPU](http://127.0.0.1:4173/examples/spine-reset/index.html?backend=webgpu) or [WebGL2](http://127.0.0.1:4173/examples/spine-reset/index.html?backend=webgl2). Node 26.7.0 and pnpm 11.25.0 remain pinned.

The left character replaces one Spine asset version; the right character retains an independent player borrowing the initial shared asset. Version one has a red body/blue head; version two has a narrower green body/yellow head. Both are original programmatic JSON/atlas/PNG content. The author command preserves source and artifact copies in ignored work storage and uses the existing public manifest builder. It does not alter any supplied artwork or certify an Editor export.

Use Prepare, CPU commit, then Submit. Prepare loads and initializes a detached time-zero candidate and stages its genuine frame. The old pixels stay visible through CPU commit; Submit performs the separate Host presentation. Cancel and Invalid animation retain the old active player. Move old then reject changes its pose after preparation, observes genuine stale CPU refusal, disposes the upload and presents the still-active old player. Step is application-owned explicit Engine time. The example does not advance automatically.

**Prepare v2, keep playing** uses `requestPreserving` in place of the reset request. The candidate takes up the active player's tracks, skins, rate and position where they stand when it is captured, so after CPU commit and Submit the new version is drawn where the old one was in its animation, and the loop goes on without delivering an event twice. A command that has not been applied yet, or a mix under way, refuses the request; Step and try again.

Replacing again automatically retires only a previous slot-owned instance/group; the initial borrowed group and sibling remain alive. Replay retired demonstrates immutable saved-frame retention. Close explicitly retires the caller-owned initial content and loaders, separately closes Engine/Host and exposes logical cleanup counts.

Read the [fixed CPU RESET contract](../../knowledge-base/en/docs/spine-reset-slot.md). Do not wait for Host idle while intentionally holding an upload; dispose or submit it first. Genuine upload readiness/generation, CPU commit, submit and completion are distinct. Native submit can throw after issuing drawing, so this example makes no GPU atomic rollback or recovery claim.

Reproduce finite native checks with:

~~~text
node examples/spine-reset/verify.mjs <absolute-playwright-1.62.1-index.mjs> <new-absolute-output-directory-outside-repository>
~~~

The collector uses default headed Edge, no additional flags or native interception, authentic transport and both backends. It retains exact executed-input fingerprints, unmodified RGBA/PNG and close observations. Five literal points distinguish each character and background; one-channel-value tolerance is allowed. See [verification-summary.json](verification-summary.json) for the portable result; raw execution remains separate from independent review, full CI and publication.

For keeping the playback, run `node examples/spine-reset/verify-preserve.mjs <absolute-playwright-index.mjs> <new-absolute-output-directory>`. It launches installed Edge headed; a third argument, `software`, uses the bundled browser with software rendering. On 2026-11-14 the WebGL2 case passed its nine checks that way in headless Chromium 153. **The WebGPU case and every hardware row have not been run**: that machine's software WebGPU adapter loses its device when this example starts.

Original first-party code, geometry, pixels, tests and docs are independently authored with AI assistance under Apache-2.0. The optional official Spine Core 4.3.13 runtime keeps its [original conditional license](../../third-party/spine-core-4.3.13.LICENSE). No runtime source or commercial art is copied into these fixtures. Stable licensed Editor exports, full physics/event compatibility, phones/native hosts, complete M2.4 and M1.2 performance remain OPEN.

## Device recovery

The same example now offers explicit recovery replay and generation-checked replacement using the existing Host. See the [application recovery contract](../../knowledge-base/en/docs/spine-recovery-integration.md). CPU RESET, controlled application tests and actual native loss evidence remain separate; historical verification-summary.json is unchanged.
