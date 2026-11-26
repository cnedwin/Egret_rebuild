# Egret Migrate

[English](README.md) | 简体中文

Egret Migrate 是面向经典白鹭 5.2 Web 2D 源工程的本地 CLI。它复用白鹭 7 的工程存储和现有浏览器验收工具。保留旧源码和可运行的浏览器构建，用它们对照验收新工程。

## 安装和运行

在已经构建白鹭包的仓库里生成本地 CLI 归档。传入本机安装的 esbuild 模块和 npm CLI 入口。

```text
node tools/egret-migrate/pack.mjs --esbuild <esbuild-module> --npm <npm-cli.js> --out <new-package-dir>
npm install --prefix <tool-folder> <new-package-dir>/egret-migrate-0.2.0.tgz
```

使用安装后的 `egret-migrate` 命令，也可以直接运行 `node <tool-folder>/node_modules/@egret/migrate/bin.mjs`。CLI 可以在引擎仓库之外运行。准备固定版本的白鹭 7.0 系列 `egret2d.mjs`、esbuild 模块和带 Chromium 的 Playwright。扫码预览另需 qrcode-generator 2.0.4。使用时显式传入这些工具的路径。

```text
egret-migrate inspect --source <old-project>
egret-migrate convert --source <old-project> --out <new-project> --engine <egret2d.mjs> --engine-version <7.0.x> --esbuild <esbuild-module>
egret-migrate verify --old <old-built-index.html> --converted <new-project> --scenario <shared-scenario.mjs> --playwright <playwright-index.mjs> --out <new-evidence-directory>
egret-migrate preview --run <new-evidence-directory> --address <LAN-IPv4> --qr-module <qrcode.mjs>
```

工具读取经典 HTML 的舞台声明、引擎与编译器配置、`manifest.json` 中有序的游戏脚本，以及本地 RES 清单。已接纳 `egret`、`game`、`res`、`assetsmanager`、`promise`、受支持范围内的 `eui` 和 `dragonBones` 模块。浏览器适配器提供测试所覆盖的显示、监听、图片和 JSON 资源组及本地存储操作。可以用 `--source-order` 提供按加载顺序排列的工程内 `src/*.ts` 路径数组，用 `--resources` 指定另一份工程内资源清单。自定义运行时模块和动态舞台尺寸需要按工程适配。

### EUI、图集资源与骨骼导出

0.2 版沿用同一工程事务和浏览器宿主。`eui` 默认读取 `resource/default.thm.json`，也可用 `--theme <相对路径>` 指定另一份本地主题。编译器把主题声明的 EXML 作为数据读取，保留皮肤部件 ID、层级、字面量属性、尺寸及受支持的基础与线性布局。支持 Skin、Component、Group、Image、Label、Rect 和 Button 的限定静态子集，业务代码可继续用原 ID 访问部件。未支持的控件、表达式、状态和自定义代码需要 Agent 明确修复。保留原主题并记录任何主题范围调整，部分未实例化的默认皮肤也可能包含未支持声明。适配器复用显示树和作用域文字资源。

传统 RES 图集支持未旋转帧、裁切偏移和已声明子键，复用同一张原生纹理页和现有 SpriteSheet API。页路径来自原声明，裸子键和带图集名的帧键都能解析到同一帧。已兼容的 PNG 保持字节一致；受支持但超出目标解码范围的旧 PNG 可离线规范为 RGBA8，对照解码像素并记录输入输出 SHA-256。非 sRGB 色彩配置和未知语义元数据需要明确适配。缺失、歧义及旋转帧需要明确修复。

为每组已接纳的 DragonBones 骨骼、图集描述及纹理提供本地 JSON 映射：

```json
[{"skeleton":"actor_ske_json","atlas":"actor_tex_json","texture":"actor_tex_png"}]
```

在 `inspect` 和 `convert` 中传入 `--bones <映射.json>`。这些名称是 RES 键，图集声明必须匹配选定的 PNG 及其尺寸。已确认的图集页改名需要在该映射中显式设置 `"allowRenamedPage": true`，报告保存原路径并检查尺寸。转换后的 Web JSON 路径保存中性的原生骨骼描述，兼容工厂通过白鹭 7 显示节点、纹理租约和引擎时钟播放。新游戏没有随附 DragonBones 运行时或商用 Spine SDK，可编辑输出保留原资源。

当前支持局部变换的 DragonBones 5.x 刚性图片骨骼、父节点优先的层级、普通附件顺序、未旋转的裁切矩形、有限的动画通道、线性与阶跃插值、有限和循环片段以及受支持的插槽显示和透明度变化。对于网格、IK、非标准继承、非线性曲线、染色等未支持能力，转换会给出诊断，2.x 导出也在当前范围之外。Agent 可在工程所有者授权下适配源码或导出，也可通过白鹭 7 的 Spine 路径接入具备单独许可的数据，再做姿态与行为验证。自动转换至 Spine 和任意 DragonBones 骨骼仍待完成。

基础布局支持边约束和百分比尺寸。横纵布局支持主轴尺寸固定的子项，相对剩余空间分配、TileLayout、Scroll/List 控件、数据绑定、状态、实时换肤及多行带描边文字仍需明确迁移。手动派发不支持的传播方式会报错。兼容层支持回归已覆盖的命名非冒泡通知和指针事件。

转换将可编辑 TypeScript 及已接纳的输入、`web/` 构建、`history.json` 和 `conversion.json` 写入新目录。工程事务回执记录导入的舞台和资源身份。修正工程数据可传入基于导入修订的 `--transaction <json>`。修正源码时编辑副本，再转换到另一个新目录。需要复用存档命名空间时，通过 `--project-id` 保持报告里的工程 ID。浏览器存档按站点来源隔离。跨站点迁移时，按游戏自己的数据格式选择并导入所需键。

为两版使用同一份独立的 verify-game 场景，按顺序记录 `first-action`、`round-finished`、`restart`、`first-action-after-restart` 和 `save-restored`，每步先断言玩家能观察到的行为。场景可导出包含浏览器宽高的 `viewport` 以对齐响应式布局。CLI 保存两版结果，只为该次对照通过的新构建生成预览。旧版入口哈希记录传入验收的 HTML。为了能复跑对照，还要单独固定对应旧构建。

局域网验收使用私有地址，安装 [qrcode-generator 模块](https://www.npmjs.com/package/qrcode-generator/v/2.0.4) 并传入它的 `dist/qrcode.mjs`。已授权 USB 调试的 Android 可以把预览绑定到 `127.0.0.1`，用输出的端口配置 `adb reverse`。预览 15 分钟后失效。终端报告的构建 SHA-256 对应桌面验收所用的浏览器文件。

## 在 Agent 中使用

三个客户端共用包里的 `skill/SKILL.md`。Codex 放在 `.agents/skills/egret-migrate`，Claude Code 放在 `.claude/skills/egret-migrate`，WorkBuddy 用本地技能上传导入同一个目录。文件和命令权限由各自客户端控制。可以直接说：“把这个白鹭 5 游戏迁到 7.0，保留玩法和存档，验证一局能完整玩完。”

## 首次验收

独立包已在干净目录离线安装。白鹭 5.2.7 的原 Web 构建和适配后的 7.0.2 构建，均在 Windows Chrome 157 跑完同一局单人扫雷。脚本检查打开数字格、标记与取消标记、输局、重开及再次开格，使用 640 × 1136 视口和随机种子 739081。Agent 修复保留棋盘逻辑，替换场景内的 EUI 呈现，并把 13 个图集帧转换为独立本地 PNG。样例独立于本包。 [固定版本和许可](https://github.com/zjalen/Multi_Minesweeper/tree/57d48a8781bf104a60dac4b47556c0ce3be711d0)

Galaxy Z Fold7 上的 Chrome 157 识别了二维码图片，经 USB 预览读取全部 19 个匹配文件，在硬件 WebGL2 上复跑同一套操作。构建身份为 `cc6038460782728dc0bb96c5b5a3c9d5e558ca831c5bf4a6e63d32111a616eff`。原扫雷没有棋盘存档，这一案例单独验证了测试值持久化。原创对照游戏 Dawn Signal Run 在两代引擎上验证了真实游戏进度，刷新后恢复最佳成绩 3。该对照的通过构建也在 Fold7 上完成了验证。跨浏览器来源导入已有存档、更多 EUI 布局及目标平台完整兼容仍待验收。Claude Code 和 WorkBuddy 已有接入说明，客户端调用仍待实测。

## 0.2 版验收

Lantern Guardian 是为本次验收独立编写的原创迁移标杆，包含三套嵌套 EXML 皮肤、三根骨骼和三个插槽的 DragonBones 5.5 动画、三个动作、可操作的三步玩法、动态成绩和进度 UI、重开及最高分存档。旧版使用真实白鹭 5.2.7 WebGL/EUI/DragonBones 运行时，新版使用白鹭 7.0.2 与原生图片骨骼描述。TypeScript 和 EXML 无需修改玩法即可进入转换。两版均在 Windows Chrome 157（软件 WebGL）通过同一套五步浏览器检查，包含灯笼上下动作像素及恢复最高分 3。独立安装 CLI 生成的 11 个浏览器文件经过验收，构建身份为 `39b2600b3e81f78bd4469823c2131dc742d19b6d8167694c13b8123047b5885b`。布局与采样颜色符合玩法断言，两代引擎字体基线及动画采样相位仍有差异。

Galaxy Z Fold7（Chrome 157、硬件 WebGL2）识别本地二维码，读取完全一致的 11 个浏览器文件，并通过真机触控完成同一套五步检查，包含向上攻击、向下防御及刷新后恢复最高分 3。首轮已经取得得分变化，但截图采样错过瞬时动画姿态；在同一构建上提高舞台采样频率复验通过，原失败记录保留。原创源码及场景位于 `tests/fixtures/egret-migrate-eui/`。使用本地 [白鹭 5.2.7 SDK 构建](https://github.com/egret-labs/egret-core/tree/v5.2.7/build) 和 esbuild 0.27.4 即可复跑。准备工具核对五个旧运行时文件并在本地组装，无需随工具分发旧运行时。

```text
node tests/fixtures/egret-migrate-eui/prepare.mjs --legacy-libs <Egret-5.2.7-build> --esbuild <esbuild-module> --out <old-fixture>
egret-migrate convert --source <old-fixture> --bones tests/fixtures/egret-migrate-eui/bones.json --out <new-fixture> --engine <egret2d.mjs> --engine-version 7.0.2 --esbuild <esbuild-module>
egret-migrate verify --old <old-fixture>/index.html --converted <new-fixture> --scenario tests/fixtures/egret-migrate-eui/scenario.mjs --playwright <playwright-module> --out <new-proof>
```

此前的扫雷案例也用原始 13 帧打包图集复验，保留已适配的界面和棋盘逻辑。首轮发现旧 PNG 的文本块使目标解码器拒绝。离线规范化保留解码 RGBA 像素，原文件保存在 `web/` 之外，省去裁切 13 个单独 PNG 的步骤。最终桌面同局玩法、重开及存储测试值对照通过。此处复用真实历史游戏，尚无棋盘存档能力。

另外，历史 Egret CoreExample 的 DragonBoy 资产（DragonBones 5.0，19 根骨骼、18 个插槽、四个动作）以原骨骼、图集和 PNG 进行验证。stand、walk、jump、fall 的 10 个固定采样姿态共对照 180 次可见插槽变换，位置最大差异约为 0.00000125 舞台单位，画面覆盖区域 IoU 为 97.78%–98.24%。颜色与边缘平滑存在差异。这一结论针对该动画，无完整玩法或性能结论。 [历史示例出处](https://github.com/egret-labs/egret-examples)

固定版本的 [白鹭 5.2.2 `dbplay` 教学工程](https://github.com/xiashu/egret-code/tree/8f4a47b79fd574913689936ecd5c16462dc576ba/%E9%BE%99%E9%AA%A8%E7%AF%87/dbplay) 原版也在 Chromium 显示了两个不同 run 姿态。其 37 根骨骼导出及未实际使用的复杂默认皮肤仍需后续迁移，工程没有完整的一局玩法。本轮未确认同时具备许可明确、复杂 EUI/EXML、骨骼动画以及整局玩法和存档的独立历史 5.x 游戏，商业级完整迁移仍待验收。上述各项对照为后续实现提供具体证据。CLI 未纳入历史美术资产或 SDK 二进制。

完整阶段目标见[旧工程迁移规格](https://github.com/cnedwin/Egret_rebuild/blob/main/knowledge-base/Cns/docs/%E6%97%A7%E5%B7%A5%E7%A8%8B%E8%BF%81%E7%A7%BB.md)。
