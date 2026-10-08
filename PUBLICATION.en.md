# Local candidate and publication status

English | [简体中文](PUBLICATION.md)

Record date: October 8, 2026.

The target remote is [cnedwin/Egret_rebuild](https://github.com/cnedwin/Egret_rebuild). The repository already exists and is public; main already contains the complete Apache-2.0 LICENSE. The original LICENSE Git blob is `261eeb9e9f8b2b4b0d119366dda99c6fd7d35c64`. First-party code and documentation continue to use this configuration; third-party materials retain their respective notices.

This record describes the local candidate packaging point on October 8, 2026. That export did not initialize Git, push, upload, or publish npm packages; the prototype and existing knowledge base remained separate. Consult repository branches and actual records for subsequent commits, draft PRs, and releases. That export does not overwrite main or the existing license.

## Current 0.11.0 asset-core revision

This revision adds independently authored CPU asset acquisition and lease code on top of the preserved 0.10.0 candidate. Its current specification, review, tests, and identities are recorded in [the implementation record](knowledge-base/docs/资源核心实现记录.en.md), [verification](verification/asset-core-verification.json), and source-origin.json. Earlier unchanged-byte export statements below describe their historical first export, not the new resource code. Dependencies and the original LICENSE remain unchanged. This local revision does not establish a remote commit or CI run.

## This export

The prototype source-origin.json allowlist defines the scope of code, tests, examples, tools, and configuration. These retain their original bytes. Root documentation and package READMEs are public projections; the source record describes their original hashes and projection roles. node_modules, dist, tsbuildinfo, and internal work were excluded from the candidate.

Root source-origin.json retains the original source-record SHA, and the identity and hashes of the 0.7.0 input specifications. Internal briefs, reviews, counterexamples, and logs are registered only as identity-only/not-distributed and are not public file links. The knowledge base has been integrated as public version 0.9.0; its current specifications and the prototype's historical inputs are versioned separately.

## Verification and subsequent integration

Export-stage actions are recorded at the packaging point described above. Fixed dependencies were subsequently installed in a separate candidate directory, completing 44/44 behavioral checks, 11 negative type assertions, actual package resolution, and the headless example; see [integration verification](verification/headless-verification.json). Checks of knowledge-base structure, source identity, and historical results are in the [integration integrity record](verification/community-integrity.json). Overall release scope and file digests are in the [export manifest](EXPORT-MANIFEST.json). These results remain limited to the stated CPU and simulated-host scope.

GPU, Native, real browser/mini-game hosts, device interoperability, performance, CI, and the complete product still require their respective acceptance. source-origin.json provides author declarations and source-review clues within a limited scope; it does not guarantee complete originality, rights, or product performance.

The historical 0.10.0 bilingual revision corresponds to knowledge-base 0.10.0 at that time. Every push must follow the [bilingual and public-content checks](knowledge-base/docs/双语文档与推送前检查.en.md) and run `node tools/prepush.mjs`. Language and comment improvements do not expand the scope of technical product acceptance.
