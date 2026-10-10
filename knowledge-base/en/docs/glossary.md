# Glossary

English | [简体中文](../../Cns/docs/术语表.md)

| Term | Meaning in this project |
| --- | --- |
| New AI creator | A person primarily using AI to make games; prior development experience is observed separately |
| Lightweight 3D | Confirmed initial direction; scale, quality, gameplay, and budgets await benchmark definition |
| Complex UI | Combinations of multiple functions and hierarchies, dynamic layout, text, masks, animation, and interaction |
| Runtime | The scene, resource, input, animation, scheduling, graphics, and host-service system required to execute a game |
| Graphics backend | A concrete WebGPU, WebGL, or native graphics API implementation; distinct from platform-publication adaptation |
| Host | A browser or platform execution environment carrying a game; different clients on the same platform require separate tests |
| Capability profile | Measured host/device functions and limits, with corresponding assets, quality, and fallback rules |
| Frame graph | An execution plan describing rendering steps and resource dependencies, lifetimes, and read/write uses |
| Dirty updates | Updating only invalid CPU data; this does not mean the GPU can redraw only part of the screen |
| First interaction | The player can complete the defined first effective action after cold startup; displaying a loading page is insufficient |
| Sustained performance | Frame time, input, memory, power, and thermal behavior after prolonged operation |
| P95 / P99 | The 95th/99th percentiles of sampled frame times; definitions state whether stalls, background periods, and loading are included |
| Perfect execution after migration | The user's ultimate goal: passing agreed behavior, visual, state, and platform comparisons within declared supported scope |
| RFC | A discussable requirement or approach proposal; it does not imply acceptance |
| ADR | A versioned technical decision and rationale, including status, alternatives, and verification basis |
| Skills / MCP | Task knowledge and tool-access methods; engine tools own actual project semantics and verification |
| Public candidate | Local documentation curated for future public collaboration; public release and applicable authorization confirmation are not yet complete |
