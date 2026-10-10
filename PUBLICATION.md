# Publication guide

English | [简体中文](PUBLICATION.zh-CN.md)

The public repository is [cnedwin/Egret_rebuild](https://github.com/cnedwin/Egret_rebuild), with `main` as the integration branch. The current engineering preview is **0.20.0**; workspace packages remain private at `0.0.0` and protocol pins remain `1.0`. Publishing source and documents does not establish a production release or complete product acceptance.

## Prepare a contribution

1. Keep the change scoped and reviewable. Follow the [contribution guide](CONTRIBUTING.md) and [Agent agreement](AGENTS.md); update the relevant specifications, sources and necessary regressions.
2. Organize publishable content and complete both language editions. Keep the knowledge base in `en/` and `Cns/`, use English filenames in `en/`, and complete critical English code comments. Review attribution and translation meaning; synchronize current document identities and registry views.
3. Run `node tools/prepush.mjs` against the final candidate. For affected rendering, run the corresponding real-browser gates documented in AGENTS. Record exact source/build identities, environments, results and unverified work.
4. Push under the user's or repository maintainer's actual authorization and open a reviewable PR. Check the remote branch and PR after upload; after an authorized merge, verify the content on `main`. Local commits and passing checks alone do not establish these remote outcomes.

Enable the repository hook after cloning with `git config --local core.hooksPath .githooks`. Fix check failures instead of bypassing the hook. See the [bilingual pre-push policy](knowledge-base/en/docs/bilingual-documentation-and-prepush-checks.md).

## Public scope and provenance

First-party code and documentation use the existing [Apache-2.0 license](LICENSE). Preserve third-party copyright, licenses, NOTICE files and asset attribution. [Source records](source-origin.json) distinguish independent implementation, dependencies, research references and public projections.

Publish authorized source, examples, specifications and curated evidence. Exclude dependency/build caches, private execution output, credentials, private configuration, unauthorized original project packages and unedited internal discussions. Shared evidence and upstream legal originals keep their identity; public projections record their relationship to original material.

[Localization inventory](localization.json) records the current bilingual documents. Historical export manifests, reviews and verification reports retain the files, identities and action scope recorded at their own checkpoints; they do not describe a new upload automatically. Consult the [Changelog](knowledge-base/en/CHANGELOG.md) and actual repository history for subsequent changes.

## Acceptance boundaries

Document publication and language maintenance do not expand technical acceptance. The [Spine requirement](knowledge-base/en/docs/spine-animation-support-and-acceptance.md) is confirmed, with implementation and acceptance still pending. Browser graphics, production mini-game/Native hosts, target-device performance, CI, editor/Agent workflows and complete legacy migration require their own evidence. Report only the checks and remote actions actually completed for the submitted revision.
