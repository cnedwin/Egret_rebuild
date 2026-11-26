# The agent guide and how it learns from games

English | [简体中文](../../Cns/docs/agent-guide.md)

Coding agents write most of the games built on this engine. They need to know the engine's names, and they need the lessons that only come from finishing games: where frames go, what breaks on a phone, what a first-time shader costs. This page describes the guide that gives them both, and the loop that keeps it current with little human review.

## Start a game

Before choosing an API, describe what the player will act on, the change they should see and the next action that change makes possible. Start a building or story game with [the first playable action](https://github.com/cnedwin/Egret_rebuild/blob/main/guide/cards/game/first-playable-world.txt). When movement, landing or impact drives the opening, use [feedback in the character or vehicle](https://github.com/cnedwin/Egret_rebuild/blob/main/guide/cards/game/action-body-feedback.txt). For example, a first jump can show the character stretching at takeoff and compressing on contact with the ground. For a bug in an existing game, use its API name, error code or symptom in the technical guide below.

Budget a procedural 2D scene for the action that changes it. The frame capture admits at most 65,536 mesh triangles. A single large radial glow can add thousands when the player activates it, on top of geometry already attached beyond the camera. For an inexpensive glow, layer a bright core over a couple of flat translucent shapes. Attach scenery in sections and remove sections that have left play. Check the frame before the action, the moment its effects overlap, and whether the next input still moves the player.

See the [paired first-draft study](first-playable-entry-study.md) for the recorded openings and the limits of the comparison.

The [Rainstorm Ferry comparison](agent-guide-routing-study.md) records which pages each agent opened on its own and what each unedited opening let the player do.

## Run a playtest and retry a project edit

Give the agent a locally built game and a trusted, self-contained scenario module. Use [`verify-game`'s browser player](https://github.com/cnedwin/Egret_rebuild/blob/main/tools/verify-game.mjs) to operate rendered controls. After checking the game's response, record `first-action`, `restart` and `first-action-after-restart` with `player.checkpoint(name)`, in that order. The checkout includes a [small beacon game and scenario](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/agent-playtest). Use the existing [single-file build](single-file.md) to generate its `egret2d.mjs`. Copy the example HTML and game module beside the bundle in a build folder.

```text
node tools/agent-playtest.mjs run --project examples/agent-playtest/project.json --web <build-folder> --file game.mjs --file egret2d.mjs --scenario examples/agent-playtest/scenario.mjs --playwright <Playwright-index.mjs> --out <new-run-folder>
node tools/agent-playtest.mjs run --after <failed-run-folder> --transaction <repair.json> --scenario examples/agent-playtest/scenario.mjs --playwright <Playwright-index.mjs> --out <new-retry-folder>
node tools/agent-playtest.mjs preview --run <passing-run-folder> --address <private-LAN-IPv4> --qr-module <qrcode.mjs>
```

The first run stages `index.html`, the listed files and the canonical project snapshot at `project.json`. The example starts with an invalid beacon color. The page starts, and the first tap produces an error code, entity, field, path and revision in `report.json`. The agent can read that report, inspect the snapshot and submit an explicit [project transaction](project-transaction-core-contract.md). Set its base revision to the failed revision and scope the edit to the affected entity. The retry checks the scenario bytes, applies the transaction through the project store and records the receipt alongside browser evidence. Keep the failed run and the retry in separate directories. Changes to source or project files require a new build and a new run.

The preview prints its verified build's SHA-256 and saves `preview-qr.png` in the passing run folder. Scan it from a phone on the same local network and perform the same first action and restart. The preview serves only the selected build files and closes after 15 minutes or Ctrl+C. Select a trusted network and game build. The desktop report and phone playthrough are separate evidence. For the QR encoder, run `npm install --prefix <tool-folder> qrcode-generator@2.0.4` outside the checkout and pass `<tool-folder>/node_modules/qrcode-generator/dist/qrcode.mjs`. [qrcode-generator license and package](https://www.npmjs.com/package/qrcode-generator/v/2.0.4)

On November 26, 2026, Windows Chromium ran the example on WebGL2. Revision 0 returned `PLAYTEST_SIGNAL_COLOR_INVALID` at the first tap. After a transaction changed only the beacon entity, the same scenario checked the lit beacon, an unlit second round and the lit beacon again at revision 1. On a Galaxy Z Fold7, Chrome 157 decoded the saved QR image, loaded the build over USB port forwarding and completed the three steps with automated touch. All four phone build files matched the desktop manifest `32f455a0537a043d40012f9a6658cd7889b8d345f6e815c9ea66e198d6b72c6f`. The Wi-Fi test decoded the QR but Chrome failed to open the page. For USB testing on an Android device authorized for debugging, start the preview on `127.0.0.1`, then use `adb -s <serial> reverse tcp:<port> tcp:<port>` with the printed port. Remove that forwarding rule when the test ends.

## What a developer's agent reads

[`llms.txt`](https://github.com/cnedwin/Egret_rebuild/blob/main/llms.txt) gives an agent four ways in: create a first 2D interaction, start a 3D scene, work on an existing game, or investigate an error. The smallest example responds to Space. The full games link to their runnable checkout sources. With a source-size limit, count the final UTF-8 bytes before delivering the game. Use the [geometry budget card](https://github.com/cnedwin/Egret_rebuild/blob/main/guide/cards/perf/geometry-budget-2d.txt) when procedural 2D effects cause the frame capture to refuse a scene. Read more as you need it:

- [`guide/index.txt`](https://github.com/cnedwin/Egret_rebuild/blob/main/guide/index.txt) names the areas, each in one line with its number of cards and what they answer. `guide/areas/<area>.txt` lists the cards of one area, one line each: the id, the ways of using the engine it applies to (`play`, `play3d`, `engine`, `world3d`, `web`) and what it answers. An area is a folder of cards, so the index stays small however many cards there are; each level stays under 150 lines and 1,500 tokens.
- `guide/cards/<area>/<id>.txt` is one topic in under 800 tokens as printed: short rules, a minimal example, and the measured reason or the game a rule was learnt from.
- `node tools/egret-guide.mjs <question>` prints the best two or three cards within a budget (2,500 tokens by default, `--budget` to change it). A question may be words in English or Chinese, an engine name, an error code or a devtools hint id. `--card <id>` prints one card, `--list` the index of areas, `--list <area>` the cards of an area and `--list all` every area.
- `node tools/egret-guide.mjs --full --out <file>` writes the index, the areas and every card as one file for tools that want a single file. It is a build output and is not committed.
- `node tools/egret.mjs` is the same guide as one command for an agent: `guide <question>`, `card <id>`, `list [<area> | all]` and `explain <ERROR_CODE>`, which prints the runtime's sentence for the code in English and Chinese and then the cards that name it.
- In a game, the engine copy carries the guide. `tools/vendor-game.mjs` writes the command and the cards under `vendor/egret/` and starts them with `vendor/egret.mjs`, so an agent working in the game's folder runs `node vendor/egret.mjs guide <question>` and gets the same answer as in this repository, from the engine commit the game is pinned to. The copy is replaced whole on every refresh, so a card the guide dropped leaves with it. `--no-agent-kit` leaves the guide out.
- [`guide/entries.json`](https://github.com/cnedwin/Egret_rebuild/blob/main/guide/entries.json) lists, for each public engine entry, the other entries it brings in through its imports (`includes`) and the entries that bring it in (`partOf`): `@egret/engine/web/game` brings the pointer, the keyboard and the frame loop. A tool that counts what a game uses (the capability matrix of the games repository) reads it to credit the entries behind the one a game names. `node tools/entry-map.mjs` writes it from the built engine, and `--check` says whether it is current.

Like `llms.txt`, the index and the cards are Markdown text kept as `.txt` files in English only. They are data an agent reads through the command, not reading documents, so they have no Chinese twin; this page is the bilingual description.

No file holds everything, because a developer pays for every token an agent reads. The command needs nothing outside the repository: no network, no model. Ranking is deterministic. A question equal to a card's trigger or id comes first; the others are ordered by the terms they share with the question, each weighted by how rare it is among the cards. Chinese has no spaces between words, so a card also carries Chinese triggers, and one counts when the question contains it anywhere: `node tools/egret-guide.mjs "手机横屏 按钮 点不到"` finds the card on short landscape screens through 手机横屏 and 按钮点不到. A Chinese trigger weighs less when other cards share it or when it is short, because a two-character word appears inside more questions.

A card's front matter records what the checks need: `id`, `title`, `applies`, `triggers` (engine names, error codes, hint ids and symptoms in plain words), `local` (names that belong to a game, not the engine), `evidence` (repository, path, line, commit and the engine pin of the game at that commit), `engine` (the engine commit the card was checked against) and, when it applies, `stale` (what changed since the lesson was learnt). A stale card is printed with its warning, not withheld.

## The loop

```text
games built on the engine ──harvest──▶ proposals ──distill──▶ cards ──merge gate──▶ guide
        ▲                                                                     │
        └──────────── agents use the guide to build and fix games ◀───────────┘
```

### 1. Harvest

`node tools/harvest-games.mjs --games <clone> --commit <commit> --out <new directory>` reads a local clone of a games repository at the commit given, with git, and leaves the clone as it was. For every game with a vendored engine it records:

- the engine pin from `vendor/SOURCE.md` and the entries it names;
- the engine names each module imports, including those of a backend chosen at run time;
- the test files and how many cases each has;
- the claims of README and STATUS by kind of section: verified, known issues, solved and unfinished, in English where the file is bilingual;
- every commit that changed the game, with subject, files outside `vendor/` and size, marking the ones that fixed something and the area they touched.

Repeated fixes are where agents go wrong, so the harvest also proposes changes to the guide. A fix whose subject finds no card is grouped by area into a proposed new card with its evidence. A card is listed for review when its evidence moved or disappeared, or when a game now uses another engine pin than the one the lesson was learnt at. Areas with two or more fixes are listed with the cards that cover them.

The output is private working data: two JSON files, written outside the repository or under the ignored `work/` folder. The repository and commit are always given, so a harvest can be repeated.

### 2. Distill into cards

An agent turns proposals into cards, using its general experience of game development and what the evidence shows. General knowledge from other engines is welcome but is written only with this engine's names. A rule about quality states the measurement it rests on, such as the triangles and draw calls before and after a change, or names the fix commit it came from. Claims stay separate: tests passing, a run played to the end without a page, and a run on a named device are three statements.

### 3. Mechanical checks as the merge gate

`tests/guide.test.mjs` runs with the other tests and decides whether a change to the guide may merge. It needs no human to re-read the cards:

| Check | Holds |
| --- | --- |
| Names | every engine name imported, called or written in a card is exported by the entry named, or by some entry, per the generated API reference and the devtools exports; every member written after a dot is a name in the sources |
| Codes and hints | every error-code trigger is in the generated error code list or in `errorHelp.ts`; every hint trigger is a devtools hint id |
| Size | every card within 800 tokens as printed and 1,000 as a file; the index within 150 lines and 1,500 tokens |
| Index | every card reached from the index once, with the same `applies`; every link resolves |
| Evidence | every card has evidence with repository, path, line, commit and engine pin; evidence in this repository points to an existing line |
| Retrieval | a fixed set of 71 questions, 27 of them in Chinese, returns the expected card first; answers keep to their budget and are the same on every run |
| Harvest | on a small repository made in the test, the harvest reads the pin, imports, tests, claims and fixes and marks a stale card |

The names check reads only generated or source files, so it follows the engine without a ledger of its own. It does not compare bytes and is not part of the evidence lane.

### 4. Agent self-evaluation on fixed briefs

The [Windlamp Post study](first-playable-entry-study.md) compares two raw drafts for one brief. A broader evaluation across briefs is planned for phase 2. A fixed set of game briefs (a small 2D arcade game, a 3D game with touch controls, a game with many lights and loading) is given to agents with and without the guide. Each attempt is judged by what can be measured: whether `node tools/verify-game.mjs` or the game's own Node checks pass, which engine errors were thrown, how many tokens of guide were read, and how many attempts it took. The results are evidence, kept with the commit of the engine and of the guide they ran against. They run in the [evidence lane](evidence-lane.md): they report and never decide a merge, because an agent's run varies between attempts.

### 5. Pruning

Planned for phase 2. A card that the evaluation never retrieves, or whose presence never changes an outcome, is a cost without a benefit. Such a card is merged into another or removed, and the retrieval set is updated with it. A card marked stale is either brought up to date when the harvest shows the lesson still holds at the new pin, or rewritten around what changed.

### 6. From errors and hints to cards

Planned for phase 2. Engine errors carry codes and `@egret/devtools` emits hint ids such as `frames-skipped`. Both already work as questions to the guide (`node tools/egret-guide.mjs FRAME_BUDGET_EXCEEDED`). For an error code the pointer now exists: `node tools/egret.mjs explain <ERROR_CODE>`, or `node vendor/egret.mjs explain` in a game, prints the runtime's sentence for the code in English and Chinese and then the cards whose triggers name it, so a card and its pointer cannot disagree. Hint ids still go to the guide as questions.

### 7. Engine notes back from games

A game that meets a fault of the engine works around it with the engine's own parts and writes the fault into `ENGINE-NOTES.md` at its root, one numbered note per fault ([the card](https://github.com/cnedwin/Egret_rebuild/blob/main/guide/cards/verify/engine-notes.txt)). Under each note's heading one line gives what a program needs:

```html
<!-- engine-note: {"id": "InquestScrolls#3", "status": "open", "topic": "paragraph-without-webassembly", "workaround": ["src/view/plainText.mjs"]} -->
```

`id` is the game's folder, `#` and the note's number. `status` is `open`, `partly`, `worked-around`, `documented` or `resolved`. `topic` names the fault in words joined by dashes, the same in every game that meets it. `workaround` lists the game's files that hold the workaround.

When the engine resolves or documents a fault, the change adds an entry to [`guide/resolved.json`](https://github.com/cnedwin/Egret_rebuild/blob/main/guide/resolved.json): the topic, what the engine did (`resolved`, `partly` or `documented`), what changed in one or two sentences, the commit and pull request, the card to read and the notes it was written for. The engine copy carries the list as it stood at the game's pin. `node vendor/egret.mjs notes`, run in the game's folder, reads its notes against that list, by topic and by id. It prints each note still marked open that the copy has resolved or documented since, what changed, the files to take the workaround out of and the card to read. `--check` exits 1 while one remains. Run from this repository (`node tools/egret.mjs notes <game folder>`), it reads against the newest list and says to refresh the game's engine copy first.

The first entries come from notes of The Inquest Scrolls (#474 to #478) and from faults that four play games shared, fixed earlier and still marked open in those games.

## Ownership and review

Cards are first-party text under Apache-2.0 and are written with AI assistance. The games repository is the evidence, not a dependency: nothing in the engine or the guide imports it. Human review is light by design. The developers' repeated work on the games acts as labelling through their fix commits and STATUS records, and the mechanical checks above stand in for re-reading every card.
