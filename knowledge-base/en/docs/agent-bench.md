# The agent benchmark

English | [简体中文](../../Cns/docs/agent-bench.md)

Most games on this engine are written by coding agents. Whether a change to the engine, its guide or its tools helps them is a question about runs, not opinions. The benchmark fixes the work so that runs can be compared:

- twelve briefs;
- one way to start each;
- one message to the agent;
- one way to score what the agent leaves.

Two kinds of comparison use it:

- Codex against Claude Code, or one model against another, at the same engine commit;
- an engine commit against the one before it, with the same agent.

`tools/agent-bench.mjs` does the starting and the scoring. It sends nothing anywhere and asks no model: the agent is run by a person, with the agent's own app.

## The briefs

Each brief is a short paragraph a developer might write, in `tools/agent-bench/briefs/<id>.txt`, in English and in Chinese. There is one brief for each of twelve kinds of game, and each kind has a recipe in [the guide](agent-guide.md#start-a-game). Between them, the briefs cover the four targets of `egret new`.

| Brief | Kind | Target | Title |
| --- | --- | --- | --- |
| `td-canal` | tower defence | web | Lock Keepers |
| `sv-lanterns` | survivors | mobile | Lantern Night |
| `mc-tiles` | match-three with cards | web | Tile Duel |
| `pp-crane` | physics puzzle | web | Crane Yard |
| `dd-ledger` | deduction | wechat | The Missing Ledger |
| `ss-tea` | story sim | mobile | Tea House Spring |
| `rp-pass` | RPG | web | Mountain Pass |
| `sc-kite` | side-scroller | steam | Kite Runner |
| `rh-drum` | rhythm | web | Festival Drum |
| `mg-orchard` | management | wechat | Hill Orchard |
| `tt-dominoes` | tabletop | web | Four Winds Dominoes |
| `a3-duel` | 3D action | steam | Rain Duel |

`node tools/agent-bench.mjs list` lists them and `brief <id>` prints one. A brief does not change within a series: a changed brief, a brief in the other language or another engine commit starts a new series.

## A run

1. Build a checkout at the commit of the series.
2. Start the game:

   ```text
   node tools/agent-bench.mjs start rh-drum runs/s1/rh-drum --agent codex --model <model> [--language zh]
   ```

   This runs `egret new` with the brief's kind of game, target and title, and puts the brief in the folder as `BRIEF.md`. What the folder started from is written beside it, as `rh-drum.bench.json`, where an agent working inside the folder does not read it.
3. Open the agent in the game's folder: Codex or Claude Code started in that folder, allowed to run commands and write files there. It may install Playwright, which `egret verify` needs.
4. Send the one message `start` printed, and nothing else:
   - English: `Make the game that BRIEF.md describes, in this folder.`
   - Chinese: `在这个文件夹里做出 BRIEF.md 描述的游戏。`
5. While it works:
   - A question from the agent is answered only with "Decide yourself." This does not count.
   - Any other help counts as one intervention: an error pasted in, a hint, a file fixed by hand.
   - Stop when the agent says it is done, or at 60 minutes.
6. Save the agent's last message as `rh-drum.said.md` beside the folder: what it says it ran and could not run.
7. Score the folder:

   ```text
   node tools/agent-bench.mjs score runs/s1/rh-drum --minutes 42 --interventions 1 [--playwright <index.mjs>]
   ```

   Playwright is found from the folder or the checkout; otherwise name it.
8. Mark the review. A person plays the game for ten minutes, then marks each item of `review.items` in `rh-drum.score.json` `true` or `false`. A score taken again keeps the marks.
9. Compare: `node tools/agent-bench.mjs table runs/s1/*.score.json` gives a row per run.

## The score

**Health**, out of 100: does the game run and keep to the engine?

| Part | Points | Given when |
| --- | --- | --- |
| tests | 30 | the game's own tests pass: its `npm test`, or every `test/*.test.mjs` under `node --test` |
| checkErrors | 25 | `egret check` finds no error |
| checkWarnings | 5 | and no warning |
| verify | 30 | a blind run of `index.html` through `tools/verify-game.mjs` passes every check |
| engineWarnings | 5 | and the engine warned of nothing in that run |
| notes | 5 | `ENGINE-NOTES.md` is there and every header line is well formed |

A part that could not be run is left out of the total and named under "Not run". A score out of 65 (no browser) is therefore not compared with one out of 100.

**Change**: how much of the starter the run replaced:
- the share of the starter's `src/` files changed or removed;
- files added under `src/` and `test/`;
- tests added;
- whether the README was rewritten.

A healthy game with nothing replaced is the starter, not a game made from the brief.

**Brief met**: the review items a person marked as met. The items are the brief's sentences, in the language of the run, and what the recipe of its kind says done means, less the commands that health already measures. For `rh-drum` there are ten, among them "Each stroke is judged early, on time or late from its event time against the music." and "The clock taken from the music, never from frames."

Read a run by **brief met** first, with **health** as the floor beneath it, and **minutes** and **interventions** as its cost. Compare only runs of one series.

## Calibration

These were measured on November 26, 2026, in headless Chromium with software rendering. No agent took part.

| Folder | Health | Starter replaced | Brief met |
| --- | --- | --- | --- |
| The untouched starter of each of the twelve briefs | 100/100 | 0% | 0 of 7–11 |
| A starter whose `update` makes a text every frame | 90/100: `text-in-update`, `PLAY_MADE_EVERY_FRAME` | 50% | – |
| A starter importing a name its entry does not export, with a failing test | 5/100: tests, check and the browser run all fail | 50% | – |
| OperaDrums, LubanBridge, NightWardens of the games repository | 100/100 | – | – |
| CanalWatch of the games repository | 95/100: one engine file imported by path | – | – |

Health separates a game that is broken or careless from one that runs, and finished games of the games repository score as high as the starter. Health does not separate a finished game from the starter. Change and the review do.

## What it does not measure

- **No agent run is recorded here.** The first series is Codex and Claude Code on the twelve briefs at one commit. A person runs it with both apps, by the steps above. Nothing in this repository starts an agent.
- **The browser run plays blind.** It holds keys, taps and drags, so it does not reach the end of a game. Whether the game does what the brief asks is the review's question.
- **No device.** A WeChat brief is not run in WeChat DevTools or on a phone, and a Steam brief is not built for the desktop or run on a Deck.
- **The review is one person's.** Two people can mark one run differently. A series keeps the same reviewer where it can.

Related: [the agent guide](agent-guide.md), [Play](play.md).
