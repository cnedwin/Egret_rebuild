# International documentation layout

English | [简体中文](../../Cns/docs/documentation-layout.md)

Egret Rebuild welcomes a worldwide open-source community. Public introductions start in English and include a Chinese introduction or a complete Chinese companion. Default repository, package and example reading entrypoints use English; Chinese companions use `.zh-CN.md`.

All knowledge-base reading documents, including explanatory evidence and historical experiment READMEs, live under `knowledge-base/en/` for English and `knowledge-base/Cns/` for Chinese. English directory components and filenames use English words or established API names. A small English-first bilingual README at the knowledge-base root routes to both full editions.

Current design and implementation topics live under each edition's `docs/`. Historical research rounds live under `archive/`, with research or plan, execution and independent audit in one record per round. Keep original dates, failures and evidence links when consolidating; an archive is not a new verification run. The repository-wide agent agreement applies throughout the knowledge base.

The six authoritative Chinese registry/current-version views live under `Cns/`; their English translations live under `en/` and resolve to corresponding English reading files through exact registered path mappings. IDs, states, numbers, dependencies and historical evidence identities remain shared.

Executable experiments, assets, vendor files, neutral machine evidence and original license notices stay in their shared directories. Run historical experiment commands from their stated shared directory. A retained upstream legal original remains byte-identical beside its assets; reading copies follow the language roots.

Maintain both language editions, update relative links and source identities, review public content and translation meaning, and run the complete `node tools/prepush.mjs` before every GitHub push. Structural checks enforce the layout and path correspondence; they do not certify translation meaning, product performance or full-engine acceptance. See the [relocation record](../../documentation-layout.json) for old and new reading identities.
