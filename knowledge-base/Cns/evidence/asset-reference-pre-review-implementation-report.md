# 第三轮真实资产参考链实现报告

[English](../../en/evidence/asset-reference-pre-review-implementation-report.md) | 简体中文

记录状态：**DONE_WITH_CONCERNS**。有限参考链的实现、测试先行证据、四种错误变异、报告与截图已完成，代码冻结版本等待独立评审和新鲜复跑。本报告记录评审前快照，不替代其后评审结论。

## 交付文件

新实验根目录：`outputs/白鹭引擎重构工程知识库/experiments/asset-reference-probe/`。

- `reference-chain.mjs`：成熟 glTF/克隆/动画/renderer 与所有权边界。
- `ui-pass.mjs`：同一 WebGL2 context 中独立 shader、VAO、原生 Canvas 文字纹理及色块。
- `integration-tests.mjs`：真实浏览器用例，独立字面期望、真实像素与 dispose 事件断言。
- `probe.js`、`index.html`：中文验证页与验证后的动画示例；手动访问显示“验证完成”，带 runner 的有效令牌才显示“已保存”。
- `server.mjs`：仅 127.0.0.1、自动端口或 ASSET_PROBE_PORT、精确白名单、随机 run token、固定报告路径、256000 bytes 请求上限。
- `run-headless.cjs`：接受 Playwright package root 参数，无机器路径硬编码；新鲜测试 profile、报告来源 SHA256、浏览器版本/诊断、JSON 与截图。
- `README.zh-CN.md`：运行、API、所有权/恢复区别、许可、范围与历史复现方式。
- `history/`：红版、首次实现、恢复清理修正、扩展验证、四种变异和最终绿色 authored source 快照；固定 vendor/assets 保持在实验根目录。

报告家族在 `outputs/白鹭引擎重构工程知识库/evidence/asset-reference-*`。主报告 `asset-reference-probe-results.json` 与主截图 `asset-reference-probe.png` 对应最终绿色；每次 red/failed/variant 另有 runId 独立 JSON/PNG，已有主报告在覆盖前也保留副本。副本/重复运行不计为额外主用例。

## 实际命令与环境

工作目录：`<workspace>`。实际运行均使用以下 Node 和预装 Playwright；sandbox 的首次浏览器启动因 Edge 新 profile 权限失败，未执行测试，不计行为红版。之后经自动审核的 require_escalated 仅运行本机服务器/新浏览器测试 profile。没有安装或访问外部资源。

```powershell
# 干净行为红版，在生产 API 仍为 stub 时执行，exit 1。
& 'node' 'outputs/白鹭引擎重构工程知识库/experiments/asset-reference-probe/run-headless.cjs' '<Playwright package root>' red-clean

# 最终绿色，四种变异恢复且中文标签完成后执行，exit 0。
& 'node' 'outputs/白鹭引擎重构工程知识库/experiments/asset-reference-probe/run-headless.cjs' '<Playwright package root>' green-final
```

恢复清理失败/修正、扩展验证与变异使用同一命令，只把最后 label 分别替换为表格中的 label。变异是在最小 authored source 中删改一个目标片段，保存全部执行源码快照，然后运行，finally 恢复绿色源码。无生产 test-only 开关。

浏览器：Edge `154.0.4258.62`，`installed_edge_fresh_test_profile`；Windows desktop、WebGL2、640×400、DPR 1、antialias false。没有时间、功耗、手机或 production-host 数据。主截图已实际查看，能看到中文列表、原生中文文字、透背景棋盘及绿色蒙皮圆柱。

## 红/绿与错误运行

每一行 counts 都只是该报告内实际执行的用例数。最终主报告为 **12 executed / 12 passed / 0 failed**，pageErrors 0、consoleDiagnostics 0。最初 11 项红版之后，针对实测恢复后释放错误补强已有恢复用例，再新增 1 项真实解析完成的迟到取消边界；没有把旧运行累计为总数。

| Label | Run ID | Executed / passed / failed | JSON SHA256 |
|---|---|---|---|
| red（favicon noise） | 3966c2c1-6a8d-4e80-a47c-5112b35b5bfa | 11 / 0 / 11 | 7e5af9e51df97cf765cd1a3493a39338854d5272632206f7842ea4f33b1a4f4d |
| red-clean | 4852e532-7bff-40a8-b13e-dcc29cdb4022 | 11 / 0 / 11 | caac7088fb9c15198587e8df8e59ace9ebabe5e509eea6e4d86839b9123e0158 |
| green-first | 0176f626-604f-44fe-8b95-6bc74e695b05 | 11 / 11 / 0 | 2212b22e2b3e8ab4a2d72a96680f44c21e568cfafad092e78d37e0f93a20f510 |
| cleanup-red | 559adc7d-2b23-427c-baca-c6ccaf46a903 | 11 / 10 / 1 | 533aecd2fd8c076ed8465e0446a37d86cb27814f4e78343ed51c9fdefa4c1f01 |
| cleanup-green（partial） | 7f7d5599-3060-4885-8ab7-5493263ed3eb | 11 / 10 / 1 | efbb022831829ebde2dd0a44a0cf40760862cd57fd676f0d8e9b24ef68860842 |
| cleanup-green-final | 75fcf3b9-4422-4ad8-8a73-dba283749037 | 11 / 11 / 0 | 90d93e277987699172ac049a71c018d7b64b6818c00bb16453bf13da62a0bc56 |
| extended-green | 04c27d26-3633-4d2e-8941-874126b94237 | 12 / 12 / 0 | 4c4408adad6e5a84944cd92a3bbb60f94c1043749a4eab6af0e5549ffeb13eed |
| mutation-no-reset | dd3cbf40-bff5-405c-b092-9ba3b1512be0 | 12 / 11 / 1 | 23a7cce516f5ceb762a1529b24f03799dd06e35ea028c7f21d304b55ef33ac97 |
| mutation-eager-release | ce803cdf-4986-4cf0-ae0b-c3da3d7db3cd | 12 / 11 / 1 | a7e19284c010c78ef11d10c9f1864796be74609ef85b4c8217f4ad1fa2e4e040 |
| mutation-ignore-required | 24a48ab4-155c-437f-a3d4-a5c5e34526c2 | 12 / 11 / 1 | 2a64fb382beaebc6d1ebf5f44fe88560e323acb31ab543003b0846e0dcb4fcd8 |
| mutation-no-ui-restore | 5adc55f4-6335-431c-b198-25617d40d8b9 | 12 / 11 / 1 | d7101abb2c8f6021b36bbe325be97f9a87c102943a8671f94f6b34d9c8fcb1d0 |
| green-final | 5e478aac-c48a-4c2b-85f0-cf0053255da7 | 12 / 12 / 0 | 797177c7d08e5e9ca0924e1d6bb789a2df8e096563bf4cfeac53068bf0a69cfa |

独立 JSON 文件命名为 `asset-reference-{label}-{runId}.json`。在实现者最终运行结束时，主 JSON 与最后一行相同，该轮独立截图 SHA256：`23b9ab75bca50f05a3232fa85a3b9de17b69656d886e79340aa60b0d575cc551`。后续集成复跑会前移主 JSON/PNG 指针，不能把主指针之后的 runId 算作本表实现者运行；本轮绿色请以 `asset-reference-green-final-5e478aac-c48a-4c2b-85f0-cf0053255da7.json/png` 固定版本审计。本报告收尾来源核对时已看到 集成复跑的新 run `352277fd-10d5-499e-80c4-dbe024495e5c` 主指针，12/12、0页面错误/诊断、17来源hash匹配；独立评审结论另行记录。

`../../en/evidence/asset-reference-red-provenance.md` 保存 stub、错误来源及环境启动边界。干净红版 11 项全部因 `Reference chain behavior is not implemented` 失败，没有 page/import/404 问题；required/abort 用例会明确报 Wrong rejection，不能用任意 throw 冒充符合策略。首次 red 的仅一个 favicon 404 已保留，没有删除历史；inline 空 favicon 消除了后续无关噪音。

`asset-reference-source-snapshot-audit.json` 逐个把 12 个历史报告的 authored source 指到 history 对应快照、固定来源指到当前未修改的 vendor/assets/sources.json。**202 个 SHA256 比对全部匹配、0 mismatch**。审计文件 SHA256：`821c23c0b6e379e10155ec0137c0bf5b40921b7f6d585f7ce9b029747dd72b5f`。早期缺省 ui-pass 不在红版执行来源内。初版 snapshot 来源补足时均与报告 hash 核对；并没有让旧 hash 指向后来绿色源码。复现按 README 将对应快照 authored files 临时复制到根目录，固定来源不变，运行后恢复绿色。不要从 history 子目录直接启动服务器。

## 最终实际用例

| 用例 | 输入与独立预期 | 实际观察 |
|---|---|---|
| real-skinned-animation | 真资产，0/0.7 秒；2 骨骼、>1000 非空像素、姿态和像素变化 | 7311/7214 有色像素；29150 bytes 变化；骨骼变化 |
| independent-shared-instances | 两实例各自 root/skeleton/mixer，0/0.7 offset；共享 geometry/material | 几何/材质同一对象，骨架/骨节点/mixer 各自独立，pose 不同 |
| last-release-lifecycle | acquire 两次，释放首个、渲染第二个、最后释放 | 首次共享 dispose 0；第二个仍可见；最终 geometry/material 各 dispose 1；两实例 root/mixer null；bundleRoot null |
| ui-three-handoff | 干净 no-UI 0.7 秒参照；12 次真实 UI/3D 交接；再次 no-UI | 3D 区逐 byte 相等；UI 有色 12288 pixels，真实文字亮像素 743；GL error 0 |
| native-text-cache-epoch | 原样 `白鹭 é 👩‍💻  `；相同 key、epoch 1、font 24px、resolution 2 | native measureText/fillText 各 4 次，raw 精确一致；相同 key 复用；epoch/style/resolution 分别失效；Canvas width 400 |
| required-extension-policy | 真资产 JSON 增加 Egret_unknown_required 到 required/used | loader 成功前明确 Unsupported required extension 拒绝 |
| optional-extension-policy | 真资产仅 unknown optional used | 允许忽略并渲染；7214 有色像素 |
| actual-context-restore | 实际 WEBGL_lose_context，固定 0.7 秒，丢失后拒绝，再实际 restore | 3D 与文字 UI pixels 均逐 byte 返回；恢复文字亮像素 568；Canvas 再生成；ready；dispose 后 GL error 0 |
| disposed-owner | render 后两次 dispose，再 render/acquire，合成 restored 事件 | 操作拒绝，status disposed，实例与 bundle/UI 根清空，不复活 |
| aborted-initialization | fetch 初始化期间即时 abort | 拒绝 abort，不返回成功 chain |
| aborted-ready-owner | 已加载/render 后 signal abort | owner dispose，后续 render 拒绝，实例 root 清空 |
| late-parsed-owner-abort | 在真实 GLTFLoader.parseAsync 返回真实 parsed scene 后控制 abort | AbortError；真实解析已完成；parsed geometry dispose 1；WebGL allocation 0 |

迟到取消测试仅在测试代码中包装/等待真实上游 parseAsync 结果并触发 controller，不返回假的 scene，也没有假的 loader/renderer。原生文字测试在测试侧暂时观察 native Canvas prototype 调用并 finally 恢复。正式链路没有测试专用开关。

四个错误变异分别证明：删 renderer.resetState 被 `ui-three-handoff` 的 GL1282 拦截（有真实 tex upload/VAO 错误诊断）；提前 releaseShared 被首次共享 dispose 断言拦截；忽略 required preflight 被 required rejection 用例拦截（上游只警告而继续，并不等于本产品允许）；遗漏恢复 UI init 被恢复 Canvas 文字像素空/不同断言拦截。变异诊断保留，未加入绿色统计。固定时刻 pixel equality 仅证明该区域确定性，不单独证明状态错误一定产生不同像素；NO_ERROR 与四个变异是补充证据。

## API 与恢复的最小适配

保留实现合同要求的 create/acquire/release/renderAt/dispose/waitForRestore。增加 `signal`、`setText`、实例 `timeOffset`、公开 `diagnostics`：用于真实 owner invalidation、按 raw/style/epoch 恢复文字与可检查固定时间实例采样，不构建通用资产/编辑器/场景框架。

GLTFLoader 承担解析，SkeletonUtils 承担克隆骨骼，AnimationMixer 承担成熟轨道/pose 更新，WebGLRenderer 承担成熟渲染和资源恢复。归一化只使用资产包 bounds 与父级 transform；没有改写几何、骨架、动画数据或材质。一个调用方拥有 RAF，renderAt 是唯一帧入口；链模块不创建 RAF/setAnimationLoop，demo 停止/pagehide 取消唯一 RAF 并 dispose。

geometry/material 是 CPU 共享 bundle；最后一个实例 release 或 owner dispose 才 releaseShared 并清空引用集合、bundleRoot 与 clips。每个实例清理 mixer stop/uncacheRoot 和 skeleton GPU texture、renderer renderLists，并把 root/mixer 设 null。最终释放后不可 acquire；新 owner 可以新建。

真实恢复后首次实现释放产生 7 个旧句柄 delete warning；新增清理断言实际红版 GL1282。通过固定 r186 代码路径与最小差分定位：旧 WebGLGeometries 的 onGeometryDispose 闭包以及骨骼纹理 onTextureDispose 闭包保留恢复前 GPU handles。仅 geometry 在 lost 时无效化消除 6 条，骨骼纹理在 lost 时无效化后剩余 1 条消失；最终恢复与清理均 NO_ERROR。**该结论只限本参考链可复现路径，不宣称 r186 所有场景的上游缺陷。**

onLost 调用成熟公共 geometry.dispose / instance skeleton.dispose 是对已经失效 GPU allocation/旧 listener 的撤销，保留 CPU geometry/material/骨架 nodes/pose/动画/共享引用；lost 状态下 GL delete 本身是 no-op，成熟 dispose 事件清除旧监听。恢复由 Three 自行重新上传与创建骨骼 texture，不换 renderer，不另造恢复渲染器。该 GPU 失效事件与最后引用时的 CPU bundle 释放清楚分开；实测无丢失场景最终共享 dispose 正好一次，不能把一次 lost 中的 GPU dispose 事件解释成 CPU bundle 提前结束。

UI 在同一 WebGL2 context 明确 context alpha/premultiplication、Canvas unpack、fragment output 与 blend 一致；独立 program/VAO，显式依赖状态；回 Three 前 resetState。恢复时重新创建 UI GL 资源并按保留 raw/style 再生成 Canvas texture。字体系统 smoke 证据没有升级为覆盖/IME/性能验收。

## Concerns 与未决事项

- 本轮只验证桌面 Edge/WebGL2 + 固定 RiggedSimple 蒙皮圆柱，不是完整角色或游戏资产。无设备矩阵、context恢复全纹理格式/材质路径、phone、生产 host、时序/功耗、完整 2D 或迁移 acceptance。未知 optional policy 只按当前样本演示。
- requiredProfile 明确不包含未配置 Draco/KTX2/meshopt decoder；其他列出扩展依赖成熟 loader，未逐个做产品兼容验收。不重新解释全部上游 warn 分支。
- preserveDrawingBuffer=true 便于 reference pixel readback，没有推出它是生产配置。缓存只有当前文字纹理，未实现通用字号/段落/emoji/CJK/IME体系；覆盖与文字性能仍未验收。
- 初始化取消覆盖即时 fetch、真实 parse 结果后、ready owner；没有对第三方 parser 每一种失败路径、OOM、shader编译错误或外部多文件 glTF 部分失败进行全资源泄漏分析。
- 没有实际进程 GC/heap snapshot 证明所有外部引用消失；本实现清空持有 root/mixer/bundle/texture 集合并清空 renderLists，测试观察的是所有权根与成熟 dispose 事件。调用方自己留住的实例/mesh 引用不在本 owner 能强制删除范围。
- 初次本地Edge启动因测试环境权限限制未执行用例，后续获授权的本地运行完成复跑；该启动限制不计为行为测试失败。source hash audit 与红/变异重复运行本身不扩大主测试数量。
- 该评审前快照未观察到尚未修复的行为失败；当时仍需独立检查代码、来源和许可，复跑绿色版本并评估知识库集成。本报告不表示完整引擎已完成。
