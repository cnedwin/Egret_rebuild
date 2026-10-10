# Texture first-four collection: evidence boundary

[简体中文](../../Cns/docs/texture-first-four-evidence.md) · [Compact record](../../evidence/texture-first-four-collection.json) · [Bitmap region contract](bitmap-region-contract.md)

The recorded desktop collection completed C01/C03/C05/C07 for each of Canvas and WebGPU: **8 captures, 16 PNGs and 192 observation rows**. Independent saved-artifact review recorded **PASS_SAVED_ARTIFACT_INTEGRITY** and checked **1233 preserved copies**. This accepts the saved collection's integrity and internal consistency, not numeric texture tolerances or complete A2.

## What was observed

The 192 rows comprise **32 Canvas straight**, **32 WebGPU encoded-premultiplied** and **128 PNG-composition** observations. They are sample rows, not 192 captures. The independent review decoded the sixteen PNGs, checked their recorded bytes and recalculated the selected rows against literal texels, integer premultiplication and rational source-over reference values.

The selected profile reports Node.js **v24.19.0**, Playwright/Core **1.62.1**, pngjs **7.0.0** and Microsoft Edge **154.0.4258.62**, with no added browser flags. Actual browser DPR was **1**. Engine pixel ratios **1 / 1.5** produced **32×24 / 48×36** backing buffers, with CSS deliberately matching backing dimensions for sampling. This is not a browser-DPR-1.5 result.

Eight Hosts and contexts closed safely, pending ledgers were zero, and the four collector-owned WebGPU devices were destroyed after their borrowed Hosts closed. The recorded external process owner reached active-zero and closed its Job. API cleanup and process retirement remain distinct observations. Preserved source/build identities bind this attempt; later Bitmap crop changes do not inherit it.

## What remains unknown

Every native channel bound is null and the numeric verdict remains **UNKNOWN**: **numericAcceptance=false, wholeA2=false**. Recorded residual maxima are descriptive observations, not tolerance selection. The remaining fourteen cases, Task5b/G5/Task6, confirmation, controls and replay remain incomplete.

Adapter-reported names do not prove hardware acceleration or performance. Timings and memory/process caps are execution guards. This collection does not establish visible Bitmap sequence playback, Native app/SDK, phones, fonts, DragonBones, physical scanout or whole-engine acceptance. Document curation performed no new browser execution or numeric acceptance.
