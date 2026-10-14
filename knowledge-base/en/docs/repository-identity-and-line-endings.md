# Repository path identity and line endings

English | [简体中文](../../Cns/docs/仓库路径身份与换行规范.md)

This policy governs repository tooling and publication. Engine runtime APIs are unchanged.

## Paths identify an owner and a complete relative file

A public file fingerprint contains an owner-relative path, byte length and SHA-256. Paths use `/`, retain authored case, and include every directory component. A basename cannot replace the complete path. Published keys reject absolute paths, backslashes, empty/dot/parent segments, Windows alternate streams and nonportable trailing dots or spaces.

Physical command and filesystem locations are a different domain. Tooling accepts absolute Windows drive/UNC spellings with either separator and compares lexical owner keys using Windows path semantics; POSIX comparisons preserve case and literal backslashes. A lexical match establishes spelling equivalence, not the identity of a filesystem object. File reads additionally check containment, actual component spelling and symbolic links. No general Junction alias or private import permission follows.

Compiler diagnostic paths use the same owner conversion. The compiler's line, column, code and full message stay exact. A changed diagnostic message is a changed result, never something path normalization may hide.

Keep raw-payload hashing, complete case-preserving logical paths, and structured pin fields as separate contracts. Newly authored closed pin literals use the documented field order `path`, `bytes`, `sha256` and allow exactly those fields. Compare logical pins using their complete closed fields or an explicitly documented canonical shape; object-property insertion order is not file identity. A required serialization order describes the pin representation, while raw SHA-256 still authenticates the payload. Do not normalize EOL, BOM, Unicode, case, or logical path spelling before recording fingerprints. Apply explicit Windows semantics only to comparisons of physical filesystem paths.

## Preserve raw bytes before computing a fingerprint

SHA-256 always covers the original bytes. Never normalize CRLF, a BOM, source text, Unicode or whitespace while computing a source fingerprint. Path representation can be portable while content identity remains exact.

The repository's `.gitattributes` disables implicit text conversion with `* -text`. This avoids Git silently changing a payload after its working bytes were reviewed, including when a contributor's `core.autocrlf` is enabled. Git can still show ordinary text diffs. No account-wide Git setting or bulk renormalization is needed. See [Git attributes](https://git-scm.com/docs/gitattributes).

Editor defaults request UTF-8 without BOM, LF and one final newline for authored text. Markdown hard-break spaces remain meaningful. Preserved upstream originals and raw historical material have editor overrides; these files must not be reformatted incidentally.

## Write newly authored text explicitly

The Node authoring entry is `tools/write-repository-text.mjs --path <owner-relative-file>`, with authored text on standard input. The PowerShell wrapper is `knowledge-base/tools/Write-CanonicalText.ps1 -RelativePath <owner-relative-file> -Text <text>`; its Node executable can be set with `-Node`. Parent directories must already exist. Use these entries for first-party authored text, never to copy preserved originals, raw receipts or historical evidence.

The pure `canonicalTextBytes` helper converts authored CRLF to LF, preserves interior blank lines and Markdown hard-break spaces, removes only surplus terminal LF characters and ensures one final LF for nonempty text. Empty text produces empty bytes. It rejects a BOM, bare CR, NUL and isolated UTF-16 surrogate. The writers apply that rule before a new content fingerprint is recorded; fingerprint reads remain byte-exact.

Run the knowledge-base validator with `-CheckOnly` during verification so checking does not replace its saved historical result record.

## Check every new or changed file before delivery

The mandatory repository hygiene gate examines visible public files, including untracked files. New and edited authored text must be valid UTF-8, contain no BOM, CR or NUL, and end with one newline without an extra blank EOF line. Required text is classified before decoding; malformed text cannot evade checking by claiming to be binary. Binary extensions and preserved originals have explicit rules.

An exact baseline records older noncanonical text by complete relative path, byte length and raw SHA-256. Only those unchanged bytes are exempt. Editing such a file requires canonical text and the normal affected source/evidence reviews. Baselines do not authorize later CRLF edits or changing historical fingerprints.

Staged files are compared with the actual Git blob bytes and current working file. Publication mode also requires a clean checkout and compares the full committed snapshot. NUL-separated Git inventories retain spaces and Unicode filenames without shell splitting. A mismatch fails before public delivery; the gate never fixes, stages or rewrites files itself.

Use the shared identity helper for new verification and delivery tooling. Do not add another basename-only comparison, platform-blind lowercase conversion or content-normalizing hash. The contribution agreement and push hook make these checks part of subsequent packages.

## Evidence and limits

The 0.45.1 implementation record distinguishes pure path tests, real isolated Git fixtures, full local gates, actual push, PR merge and Main readback. Editor guidance alone is not enforcement. Logical cleanup or a passing repository check establishes neither physical-device performance nor complete PNG, Spine or migration acceptance. Existing historical failures and source identities remain preserved.
