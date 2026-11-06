# Publication guide

English | [简体中文](PUBLICATION.zh-CN.md)

The public repository is [cnedwin/Egret_rebuild](https://github.com/cnedwin/Egret_rebuild), with main as integration branch. The 2026-11-07 review uses main f869b37; [current capabilities](knowledge-base/en/docs/core-progress.md) and the changelog describe later delivery than the historical 0.61 checkpoint. Workspace packages remain private 0.0.0 and Host protocol 1.0. Source publication, clean-consumer distribution and a complete product release have separate acceptance.

## Prepare a contribution

1. Describe the problem, behavior, affected contracts and verification. Follow the [contribution guide](CONTRIBUTING.md) and [repository collaboration policy](AGENTS.md).
2. Complete both reading editions, source attribution and critical English code comments. Update current document identities after the text is final.
3. Use affected local feedback during editing and the normal committed push hook before review submission. Before merge, the final candidate must pass the complete integrated gate, independent source/results/bilingual review and affected real-browser checks described in AGENTS. Reuse unchanged evidence by exact input comparison; record actual environments and open limits.
4. Push the reviewed branch and open a PR under the repository's contribution permissions. Verify the remote commit and, after an authorized merge, the content on main.

Enable the local hooks with git config --local core.hooksPath .githooks. Resolve failures through the normal checks.

## Public scope and provenance

First-party code and documentation use [Apache-2.0](LICENSE). Keep dependency copyrights, licenses, notices and asset credits with their materials. [Source records](source-origin.json) identify first-party implementation, dependencies, research and AI assistance.

Publish maintainable source, examples, specifications and reproducible technical summaries. Keep credentials, private configuration, unauthorized original projects, dependency/build caches and unedited private discussions outside the repository. Raw evidence, sealed source and legal originals retain their identities.

## Acceptance boundaries

The [capability overview](knowledge-base/en/docs/core-progress.md) states the implemented and verified scope. Complete Spine, production hosts, target-device performance, creation tools and legacy migration follow their own acceptance plans. The [Changelog](knowledge-base/en/CHANGELOG.md) and repository history record actual delivery; local checks alone do not establish remote CI or a release.
