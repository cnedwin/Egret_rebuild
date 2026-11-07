# Native editing in managed UI

English | [简体中文](README.zh-CN.md)

After pnpm setup:dev, run node examples/text-editing/serve.mjs and open the printed loopback URL. The server builds an immutable font manifest from the existing bundled Noto resources; source bytes/licenses stay unchanged. Choose WebGL2 or WebGPU through the page links.

Activate name or description to use a real input/textarea over the shared-rendered UI. Enter finishes the name and inserts a newline in the description; Tab/Shift+Tab follow existing row focus. Cancel discards provisional composition while retaining ordinary committed edits. Width, density, scroll and paired-font replacement reuse existing UI, paragraph, Scope and asset ownership. The native element returns to the readonly paragraph only after a matching publication. No new touch implementation is included.

Use the [SDK contract](../../knowledge-base/en/docs/native-text-editing.md) for integration: prepare/commit UI, sync native placement and schedule the existing capture path from onChange/onInvalidate. The default bundled fonts cover selected Latin/Arabic/CJK text, not all emoji. Missing-glyph publication keeps native text visible; supply a qualified font or explicitly change the source. The native/readonly engines can wrap differently.

Run node examples/text-editing/verify-browser.mjs <playwright-root> <new-output-directory-outside-checkout> with installed Playwright 1.62.1 and default Edge. It performs one finite WebGL2/WebGPU batch, saves actual source identities/screenshots/results, and retains original failures. [Recorded summary](verification-summary.json). Controlled composition/paste events are not physical IME/system clipboard evidence. Real IME, phones, accessibility, other hosts and performance remain separate requirements. The page's diagnostic state contains only local example data; product hosts must not persist personal text in logs.

Default preview fits the scene CSS width and caps startup DPR at 3. Add preset=verification to retain the fixed 800×480, ratio/density-1 fixture. True width changes end editing and replace only a separately scoped view; keyboard-only height changes keep the native session. Models, fonts and the visible stable-row anchor survive width changes. Reopen after an actual DPR change. The collector selects the fixed preset explicitly and also checks responsive behavior. See [Android native-input observations and limits](../../knowledge-base/en/docs/android-native-text-editing.md); the broader qualification requirements above remain open.

## Popup and modal flow

Append layers=1 to the existing URL to use profile details, a draft rename dialog and return to the list. Save changes the original name; Cancel leaves it intact. The same UI, fonts/cache and input channels are used. Overlay logical focus does not force a native keyboard; activate the dialog field explicitly. Default/fixed verification retains its separate profile. See the [layer contract](../../knowledge-base/en/docs/ui-layers.md) and [scoped summary](layer-verification-summary.json).
