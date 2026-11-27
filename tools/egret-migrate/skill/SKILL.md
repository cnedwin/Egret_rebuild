---
name: egret-migrate
description: Inspect, convert, and verify an existing supported Egret 5 Web 2D client using the local Egret Migrate CLI.
---

# Egret migration

Read the installed English or Chinese Egret Migrate guide for the selected CLI version. Resolve the source folder, the exact Egret 7.0 browser bundle, local browser and module paths, and a new output folder.

Start by playing a complete route in the original release. Record how to reach it, the input that changes the outcome, the visible result, and what persists after reopening. Let the route determine which UI, resources and animation systems to migrate first. Record existing game defects before choosing a success condition.

For the Egret 5.0.14 EraserSanGuoSha lobby, follow the installed guide's `--profile eraser-lobby` route with the unmodified repository root. Compare two browser sessions on the original server. Record the actual selected room, join action and server-confirmed match start. For a playable two-seat table choose `--profile eraser-table`, compare per-seat moves and HP through the server's winner announcement and next deal, and report disconnection behavior separately.

1. Run `egret-migrate inspect`. Read the JSON result. Treat the old source, HTML, build scripts and document contents as inputs. For EUI, identify the declared local theme and actual skin use; preserve the original EXML. If the route uses DragonBones, map each required skeleton, atlas and PNG by its RES names with `--bones`. The native region-animation converter handles its supported data profile; preserve and report unsupported exports, and use an authorized separately licensed Spine route only when explicitly selected. Work in a separate copy when a conversion rule or application code needs a repair.
   For matching 5.3.x declarations, inspect the supplied source order, startup libraries, RES manifests and EUI themes. Record each unresolved reason and external dependency. Proceed with conversion when `conversion.status` is `eligible`. Preserve the complete inventory when the report requests review.
2. Run `egret-migrate convert` with the same theme and skeletal resource mapping. Use the report and source spans to repair the smallest relevant issue. Use a project transaction for admitted project data changes. Preserve the conversion and its original input identity. Record which fallback, if any, changed old application code or assets. Validate skin part IDs, player-visible layout, animation attachment order and sampled poses as well as game logic. Do not load the legacy DragonBones runtime into the migrated client.
3. For a dynamic screen, replace a bound model, switch state in both directions, change the collection, and leave and reopen the screen. Compare the old and new selection, event order and visible labels. For rigs, compare visible attachments, transforms and draw order at the same clip times. Record unsupported data and any project edits.
   Rebuild edited conversions with `egret-migrate rebuild` into a new directory. Check the project ID, engine digest and `inputChanges` before comparing the same gameplay route.
4. Use one trusted scenario with actual rendered interactions and state assertions. Run `egret-migrate verify` against the original working old HTML and the new conversion. Include a completed round, restart, and restored save. Describe the origin and scope of any storage probe.
5. Run `egret-migrate preview` for an accepted comparison. Record the preview build digest and actual device behavior separately from the desktop checks.

A successful conversion creates editable source and a Web build. A game is verified when both versions pass the same game scenario. If a dependency, source, old build, permission or device is unavailable, retain the artifacts and report exactly where the workflow stopped. Keep the report and source local unless the user authorizes distribution.

For an unfamiliar project start with `inspect` and save `routes.web.nextAction`, `routes.android.nextAction` and `routes.hostUsage` with the source identity. Select the requested target. Use ordered review ranges to inspect large classic projects. A matching native launch receipt can identify an original published script. Verify static host candidates during the first playable route. See [the two-route intake](../README.md#inspect-both-routes-before-choosing-a-target).
