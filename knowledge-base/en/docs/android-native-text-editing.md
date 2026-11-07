# Android native text editing

English | [简体中文](../../Cns/docs/android-native-text-editing.md)

2026-11-07 · One SM-F966U1, device-reported Android 17, Chrome 156.0.8078.79 and Samsung Keyboard 5.9.40.75 · Bounded M3.3 evidence; complete M3/M4 remains OPEN.

The existing [native editor](native-text-editing.md) was exercised through real input/textarea, admitted paired fonts and the shared renderers. The [machine-readable record](https://github.com/cnedwin/Egret_rebuild/blob/main/verification/android-device/native-text-editing-2026-11-07.json) separates actual software-keyboard observations, controlled calls, final-source lifecycle checks and reused predecessor evidence. Prior Android component and cadence/heap results remain unchanged.

## Repairs

Canceling an actual English composition could retire the native session and then receive a synchronous terminal composition callback during readonly/blur. The former busy guard disposed the bridge as reentrant, preventing a later edit. The bridge now ignores input/composition callbacks only after its session token has retired; active-session reentry still refuses. The reproduction contains trusted composition start/update/input and a terminal compositionend with trusted=false; these observations are kept distinct. No API, declaration or touch route changes.

The default form now fits the available CSS width and uses a startup DPR capped at 3. A true width change ends native ownership and recreates only the existing view adapters, preserving Engine, field models, source selection, stable visible-row anchor, paragraph cache and fonts. Each view has its own Scope, disposed on replacement; disposed registrations no longer accumulate in the long-lived model Scope. Keyboard-only height changes keep the active native session. DPR is sampled at Host creation: reopen the preview after an actual DPR change. The fixed preset=verification retains 800×480 and ratio/density 1.

## Recorded scope

| Schedule | Evidence and boundary |
| --- | --- |
| Actual software input, WebGPU | 19 observations: English composition/newline, refusal of conflicting replacement, cancel/reopen, failed/paired font replacement, rotation, Home/return and close. The core matches the final revision; the example precedes only the reviewed view-Scope repair. |
| Actual Chinese keyboard, WebGL2 | Six observations: 9-key Pinyin candidate 你好, one committed value change, usable native owner, software Go and paragraph handoff. Preedit stayed inside the keyboard; this is not a DOM Pinyin-composition claim. Same core, pre-view-Scope example as above. |
| Final view lifecycle, both backends | Nine observations each on exact final example bytes: actual OS landscape/portrait, committed source/selection, Home/return and zero-owned-resource close. This qualifies the view-Scope successor without repeating unchanged software-keyboard schedules. |
| Actual desktop Edge, both backends | 21 fixed and eight responsive checks each. The responsive context emulates a 412px viewport/DPR 3; it is not another phone. Controlled terminal-event regression covers blur teardown separately from physical-keyboard evidence. |
| Retained baseline supplement | Original pre-repair WebGL2 schedule: 24 observations including native backspace, newline and deletion of a surrogate-pair emoji provisioned through CDP. This does not qualify an emoji font or the final source as a whole. |

Counts describe finite schedules, not an acceptance score. Earlier cancel failure, collector failure after twelve observations and view-realization correction remain recorded. A partial or failed run is never promoted to PASS. Logical font, paragraph and lease counters reach zero at close; they do not measure physical memory or garbage collection.

## Device ownership and wake policy

The task uses separately owned pages, a shared phone lease and temporary routes. Each case preserves prior targets, foreground activity, exact rotation values and inherited USB stay-awake settings. Screenshots, serials, target IDs, unrelated URLs and keyboard context remain private. Available decoded responses match captured file hashes; unavailable rows and any missing decoded-source coverage are reported explicitly, alongside the owned server snapshots.

Keep one bounded USB-only wake lease across the authorized development/test batch, including coding gaps. Capture the exact original stay-awake value (or absence), temporarily use value 2, observe actual awake/unlocked state, and check it before every input. Restore the original value at batch exit; an individual case restores its inherited value, not the outer guard's original value. Do not change passwords, security lock, brightness or screen density. Manual lock, credential prompt, power loss or unknown security state stops automated input; a guard cannot bypass authentication.

## Remaining qualification

Only the stated phone/browser/keyboard profile is covered. Other IMEs/dead keys, iPhone, human fingers, system clipboard, assistive technology and native/mini-game adapters remain open. Native and CanvasKit wrapping/ink can differ. The bundled fonts still have no qualified emoji fallback. Full mixed M4, physical memory/energy, GPU duration and M1.2's 10.3ms against an 8ms target remain OPEN. Existing touch contributor ownership is unchanged.
