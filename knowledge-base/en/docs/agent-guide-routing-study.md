# Rainstorm Ferry: what agents find and build from two Egret entries

English | [简体中文](../../Cns/docs/agent-guide-routing-study.md) · [Original drafts, reference reads and recordings](https://raw.githubusercontent.com/cnedwin/Egret_rebuild/main/guide/studies/rainstorm-ferry.zip)

The new landing page gives authors four direct routes and is 8,490 UTF-8 bytes shorter. In the pair with working tools, the new entry led the author to three targeted cards and a graphics reference. It reached a measured intermediate draft under the byte limit and then timed out before delivering a game. The initial, permission-limited pair produced two playable openings.

## Pair with working reference tools

| Result | Old entry | New entry |
| --- | --- | --- |
| References opened by the author | First playable action and action feedback | First playable action, 2D geometry budget, action feedback, and Graphics |
| Initial prompt + returned reference body | 34,991 + 4,647 = 39,638 bytes | 26,501 + 16,923 = 43,424 bytes |
| Source-size checks during authoring | None | 25,883 → 24,248 → 23,766 bytes |
| Final output | 26,546 bytes in 295.633 s, 2,546 bytes above the limit | No final output within 480 s |
| First 20 seconds of play | Clicked the crate, the highlighted deck slot, then the helm. At 11 s the crate was aboard. At 13.4 s the loaded ferry was visibly off the dock. | The final-response file was empty. There was no game to open or film. |

The recorded intermediate sizes are tool results. The final source byte count and the existence of a playable game are separate checks. In this pair the shorter entry reduced the initial input while the author’s additional reading increased the combined bytes. This run shows which guidance the author found and how it used the counter. Its missing final output leaves the gameplay comparison for this pair incomplete.

## First pair: tool requests were blocked

The old-entry author opened no references and finished with 29,650 source bytes, 5,650 over the limit. The candidate author requested the action feedback, first playable action and 2D geometry budget cards. The runner denied all three requests before they reached the reference tool. Its unchanged draft took 23,809 bytes, with 191 to spare.

Both games showed the box on deck by second 11 and moved the ferry away with the box aboard. In the old-entry game the player clicked the crate, the marked deck slot, then the helm. The boat was visibly clear of the dock at 13.50 s. The candidate game used one HUD control to carry, load, untie and launch. The boat had begun leaving by second 18. These recordings show two successful opening routes. The first pair measured link selection and gameplay under the recorded tool restriction.

## How the comparison ran

The new request was “做一款名叫《暴雨渡口》的 2D 小游戏。暴雨就要来了，玩家要把第一箱货装上渡船，再让船驶离码头。” Both authors started with identical HTML, game module and Egret 2D bundle from `5792d800`. Each used `gpt-6.2-sol` with medium reasoning, one final answer, 480 seconds and a 24,000 UTF-8 byte limit for the game source. The starting title was updated for the new brief in both arms.

The old entry came from `ff93e89e`. The candidate puts four tasks above a runnable starter, links full examples and updates the first-interaction and rendering guidance. Each author got only its own entry in the prompt, with the same tools for opening references and counting UTF-8 bytes. References came from each arm’s frozen snapshot. The initial prompt plus returned reference text had a combined limit of 96,000 bytes, with at most 18,000 bytes per read and 18 tool calls. The authors chose what to open and could count text before submitting. A recorded read means the reference tool returned its contents. Each game was run after its original draft was sealed.

Every recorded game was opened in a fresh Windows Chrome for Testing 157 session using SwiftShader WebGL2 and a 960 × 540 viewport. The driver saw random labels and used visible instructions to select at most one operation at 4, 8, 12 and 16 seconds. Each continuous clip started at navigation. Each pair had one attempt per entry and used scripted input. First-time human play remains outside the experiment.
