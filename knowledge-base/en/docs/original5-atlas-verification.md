# Original Egret 5 atlas and native display

Use the app below to compare the original 5.3.10 WebGL host with the Android Runtime. The original engine, EUI, RES and game modules come from a release you have permission to use. The fixture supplies its own game code and generates a two-region PNG.

```sh
node runtime-sdk/examples/original5-atlas/prepare.mjs --modules <5.3.10-libs/modules> --out <new-dir>
node runtime-sdk/examples/original5-atlas/prepare.mjs --modules <5.3.10-libs/modules> --out <another-new-dir> --nine-slice
```

Serve the generated directory over local HTTP and open `reference.html`. Pass the same directory as `--project` to the [Android player exporter](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/android/README.md). The default scene changes the image and its two-colour label when the circular Shape or EUI image is tapped. Backgrounding and reopening preserve the visible state. The [Fold7 report](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-original5-atlas.json) records the original browser comparison, glyph coverage, touch misses, recovery and texture release.

The nine-slice variant advances through an ordinary bitmap, a 44 × 32 panel, a 3 × 3 panel smaller than its borders, a replacement atlas region, an ordinary bitmap again, and disposal while still attached. Tap the yellow rectangle five times. Open `reference-fold7.html` at a 1236 × 824 viewport and device scale factor 1 to reproduce the phone's displayed size. Compare logical pixel centres. All 779 RGB samples matched on this route. A separate 192 × 128 reference differed at four edge pixels of the 3 × 3 panel. The [nine-slice report](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-original5-nine-slice.json) retains both comparisons.

The original 5.x bitmap layout selects the source and destination rectangles. The Runtime packs these regions into one indexed mesh on the existing texture page. Disposing the sheet cleared its displayed consumer and released the page. The measurements cover axis-aligned atlas regions, synthetic taps and the stated devices.
