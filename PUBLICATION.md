# Publication guide

English | [简体中文](PUBLICATION.zh-CN.md)

The public repository is [cnedwin/Egret_rebuild](https://github.com/cnedwin/Egret_rebuild), with main as the integration branch. Engineering preview 0.61.0 is integrated through PR #50. Workspace packages remain private at 0.0.0 and the host protocol remains 1.0. Source publication and a production engine release have separate acceptance criteria.

## Prepare a contribution

1. Describe the problem, behavior, affected contracts and verification. Follow the [contribution guide](CONTRIBUTING.md) and [repository collaboration policy](AGENTS.md).
2. Complete both reading editions, source attribution and critical English code comments. Update current document identities after the text is final.
3. Run node tools/prepush.mjs. Rendering changes also require the affected real-browser checks described in AGENTS. Record the actual environment, result and remaining limits.
4. Push the reviewed branch and open a PR under the repository's contribution permissions. Verify the remote commit and, after an authorized merge, the content on main.

Enable the local hooks with git config --local core.hooksPath .githooks. Resolve failures through the normal checks.

## Public scope and provenance

First-party code and documentation use [Apache-2.0](LICENSE). Keep dependency copyrights, licenses, notices and asset credits with their materials. [Source records](source-origin.json) identify first-party implementation, dependencies, research and AI assistance.

Publish maintainable source, examples, specifications and reproducible technical summaries. Keep credentials, private configuration, unauthorized original projects, dependency/build caches and unedited private discussions outside the repository. Raw evidence, sealed source and legal originals retain their identities.

## Acceptance boundaries

The [capability overview](knowledge-base/en/docs/core-progress.md) states the implemented and verified scope. Complete Spine, production hosts, target-device performance, creation tools and legacy migration follow their own acceptance plans. The [Changelog](knowledge-base/en/CHANGELOG.md) and repository history record actual delivery; local checks alone do not establish remote CI or a release.
