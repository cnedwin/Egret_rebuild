# The agent guide and how it learns from games

English | [简体中文](../../Cns/docs/agent-guide.md)

Coding agents write most of the games built on this engine. They need to know the engine's names, and they need the lessons that only come from finishing games: where frames go, what breaks on a phone, what a first-time shader costs. This page describes the guide that gives them both, and the loop that keeps it current with little human review.

## What a developer's agent reads

[`llms.txt`](https://github.com/cnedwin/Egret_rebuild/blob/main/llms.txt) is the one page an agent reads to write a small game. Everything beyond it is in the guide, delivered on demand:

- [`guide/index.txt`](https://github.com/cnedwin/Egret_rebuild/blob/main/guide/index.txt) lists every card in one line: its id, the ways of using the engine it applies to (`play`, `play3d`, `engine`, `world3d`, `web`) and what it answers. It stays under 150 lines.
- `guide/cards/<area>/<id>.txt` is one topic in under 800 tokens as printed: short rules, a minimal example, and the measured reason or the game a rule was learnt from.
- `node tools/egret-guide.mjs <question>` prints the best two or three cards within a budget (2,500 tokens by default, `--budget` to change it). A question may be words, an engine name, an error code or a devtools hint id. `--card <id>` prints one card and `--list` the index.
- `node tools/egret-guide.mjs --full --out <file>` writes the index and every card as one file for tools that want a single file. It is a build output and is not committed.

Like `llms.txt`, the index and the cards are Markdown text kept as `.txt` files in English only. They are data an agent reads through the command, not reading documents, so they have no Chinese twin; this page is the bilingual description.

No file holds everything, because a developer pays for every token an agent reads. The command needs nothing outside the repository: no network, no model. Ranking is deterministic. A question equal to a card's trigger or id comes first; the others are ordered by the terms they share with the question, each weighted by how rare it is among the cards.

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
| Retrieval | a fixed set of 23 questions returns the expected card first; answers keep to their budget and are the same on every run |
| Harvest | on a small repository made in the test, the harvest reads the pin, imports, tests, claims and fixes and marks a stale card |

The names check reads only generated or source files, so it follows the engine without a ledger of its own. It does not compare bytes and is not part of the evidence lane.

### 4. Agent self-evaluation on fixed briefs

Planned for phase 2. A fixed set of game briefs (a small 2D arcade game, a 3D game with touch controls, a game with many lights and loading) is given to agents with and without the guide. Each attempt is judged by what can be measured: whether `node tools/verify-game.mjs` or the game's own Node checks pass, which engine errors were thrown, how many tokens of guide were read, and how many attempts it took. The results are evidence, kept with the commit of the engine and of the guide they ran against. They run in the [evidence lane](evidence-lane.md): they report and never decide a merge, because an agent's run varies between attempts.

### 5. Pruning

Planned for phase 2. A card that the evaluation never retrieves, or whose presence never changes an outcome, is a cost without a benefit. Such a card is merged into another or removed, and the retrieval set is updated with it. A card marked stale is either brought up to date when the harvest shows the lesson still holds at the new pin, or rewritten around what changed.

### 6. From errors and hints to cards

Planned for phase 2. Engine errors carry codes and `@egret/devtools` emits hint ids such as `frames-skipped`. Both already work as questions to the guide (`node tools/egret-guide.mjs FRAME_BUDGET_EXCEEDED`). The next step is a pointer from each to its card: a line that a developer sees with an error or a hint, naming the card id to ask for. The pointer will be generated from the cards' triggers, so a card and its pointers cannot disagree, and the merge gate will check that every pointer names an existing card.

## Ownership and review

Cards are first-party text under Apache-2.0 and are written with AI assistance. The games repository is the evidence, not a dependency: nothing in the engine or the guide imports it. Human review is light by design. The developers' repeated work on the games acts as labelling through their fix commits and STATUS records, and the mechanical checks above stand in for re-reading every card.
