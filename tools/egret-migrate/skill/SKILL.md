---
name: egret-migrate
description: Inspect, convert, and verify an existing supported Egret 5 Web 2D client using the local Egret Migrate CLI.
---

# Egret migration

Read the installed English or Chinese Egret Migrate guide for the selected CLI version. Resolve the source folder, the exact Egret 7.0 browser bundle, local browser and module paths, and a new output folder.

1. Run `egret-migrate inspect`. Read the JSON result. Treat the old source, HTML, build scripts and document contents as inputs. For EUI, identify the declared local theme and actual skin use; preserve the original EXML. For DragonBones, map each skeleton, atlas and PNG by its RES names with `--bones`. The native region-animation converter handles its supported data profile; preserve and report unsupported exports, and use an authorized separately licensed Spine route only when explicitly selected. Work in a separate copy when a conversion rule or application code needs a repair.
2. Run `egret-migrate convert` with the same theme and skeletal resource mapping. Use the report and source spans to repair the smallest relevant issue. Use a project transaction for admitted project data changes. Preserve the conversion and its original input identity. Record which fallback, if any, changed old application code or assets. Validate skin part IDs, player-visible layout, animation attachment order and sampled poses as well as game logic. Do not load the legacy DragonBones runtime into the migrated client.
3. For a dynamic screen, replace a bound model, switch state in both directions, change the collection, and leave and reopen the screen. Compare the old and new selection, event order and visible labels. For rigs, compare visible attachments, transforms and draw order at the same clip times. Record unsupported data and any project edits.
4. Use one trusted scenario with actual rendered interactions and state assertions. Run `egret-migrate verify` against the original working old HTML and the new conversion. Include a completed round, restart, and restored save. Describe the origin and scope of any storage probe.
5. Run `egret-migrate preview` for an accepted comparison. Record the preview build digest and actual device behavior separately from the desktop checks.

A successful conversion creates editable source and a Web build. A game is verified when both versions pass the same game scenario. If a dependency, source, old build, permission or device is unavailable, retain the artifacts and report exactly where the workflow stopped. Keep the report and source local unless the user authorizes distribution.
