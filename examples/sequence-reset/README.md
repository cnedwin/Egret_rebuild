# Sequence RESET example

English | [简体中文](README.zh-CN.md)

Replace A with a new immutable content generation while B keeps its own sequence clock. A starts red/green/blue/yellow at 250 ms per frame; v2 uses cyan/magenta/blue/white at 500 ms per frame. These literal colors and durations are original first-party fixtures under Apache-2.0. The author reuses `examples/sequence-controls/sources/page.png`, `atlas.json` and the first three recipes, rewrites only private generated copies, then runs the existing content builder. No external art, exporter qualification or new dependency is introduced.

Build the repository, create `work/sequence-reset`, then run `node examples/sequence-reset/author.mjs <absolute work/sequence-reset directory>`. Start the existing example server and open `/examples/sequence-reset/index.html?backend=webgpu&config=/work/sequence-reset/run-XXXXXX/config.json` using the returned directory; substitute `webgl2` for the second backend. The page controls advance, load/stage, CPU commit, Host submit, explicit resume, cancellation and close separately.

Run the finite actual-browser collector with `node examples/sequence-reset/verify.mjs <installed Playwright 1.62.1 index.mjs> <new absolute evidence directory outside the repository>`. It creates both content generations, records pre-launch source/emitted/declaration identities, then verifies literal readbacks and screenshots on both native Hosts, retained cancelled/retired frames and logical cleanup. Earlier failed runs are retained separately; no hidden rebuild, native interception or device flag is used.

See the [contract](../../knowledge-base/en/docs/sequence-reset.md). Successful commit leaves the candidate paused at zero and leaves a previously running borrowed initial controller paused. Host readiness/submission/settlement are separate; no post-publication rollback, device recovery, phone, performance or complete M2.4 claim is made.
