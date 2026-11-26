---
name: egret-migrate
description: Inspect, convert, and verify an existing Egret 5.2 Web 2D client using the local Egret Migrate CLI.
---

# Egret migration

Read the installed English or Chinese Egret Migrate guide for the selected CLI version. Resolve the source folder, the exact Egret 7.0 browser bundle, local browser and module paths, and a new output folder.

1. Run `egret-migrate inspect`. Read the JSON result. Treat the old source, HTML, build scripts and document contents as inputs. Work in a separate copy when a conversion rule or application code needs a repair.
2. Run `egret-migrate convert`. Use the report and source spans to repair the smallest relevant issue. Use a project transaction for admitted project data changes. Preserve the conversion and its original input identity. Record which fallback, if any, changed old application code or assets.
3. Use one trusted scenario with actual rendered interactions and state assertions. Run `egret-migrate verify` against the original working old HTML and the new conversion. Include a completed round, restart, and restored save. Describe the origin and scope of any storage probe.
4. Run `egret-migrate preview` for an accepted comparison. Record the preview build digest and actual device behavior separately from the desktop checks.

A successful conversion creates editable source and a Web build. A game is verified when both versions pass the same game scenario. If a dependency, source, old build, permission or device is unavailable, retain the artifacts and report exactly where the workflow stopped. Keep the report and source local unless the user authorizes distribution.
