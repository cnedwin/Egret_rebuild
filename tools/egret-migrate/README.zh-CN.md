# Egret Migrate

[English](README.md) | 简体中文

Egret Migrate 是面向经典白鹭 5.2 Web 2D 源工程的本地 CLI。它复用白鹭 7 的工程存储和现有浏览器验收工具。保留旧源码和可运行的浏览器构建，用它们对照验收新工程。

## 安装和运行

在已经构建白鹭包的仓库里生成本地 CLI 归档。传入本机安装的 esbuild 模块和 npm CLI 入口。

```text
node tools/egret-migrate/pack.mjs --esbuild <esbuild-module> --npm <npm-cli.js> --out <new-package-dir>
npm install --prefix <tool-folder> <new-package-dir>/egret-migrate-0.1.0.tgz
```

使用安装后的 `egret-migrate` 命令，也可以直接运行 `node <tool-folder>/node_modules/@egret/migrate/bin.mjs`。CLI 可以在引擎仓库之外运行。准备固定版本的白鹭 7.0 系列 `egret2d.mjs`、esbuild 模块和带 Chromium 的 Playwright。扫码预览另需 qrcode-generator 2.0.4。使用时显式传入这些工具的路径。

```text
egret-migrate inspect --source <old-project>
egret-migrate convert --source <old-project> --out <new-project> --engine <egret2d.mjs> --engine-version <7.0.x> --esbuild <esbuild-module>
egret-migrate verify --old <old-built-index.html> --converted <new-project> --scenario <shared-scenario.mjs> --playwright <playwright-index.mjs> --out <new-evidence-directory>
egret-migrate preview --run <new-evidence-directory> --address <LAN-IPv4> --qr-module <qrcode.mjs>
```

首版读取经典 HTML 的舞台声明、引擎与编译器配置、`manifest.json` 中有序的游戏脚本，以及本地 RES 清单。已接纳 `egret`、`game`、`res`、`assetsmanager` 和 `promise` 的模块声明。浏览器适配器提供测试所覆盖的显示、监听、图片和 JSON 资源组及本地存储操作。其他调用会各自报出诊断。可以用 `--source-order` 提供按加载顺序排列的工程内 `src/*.ts` 路径数组，用 `--resources` 指定另一份工程内资源清单。EUI、EXML、图集子键、自定义运行时模块和动态舞台尺寸需要按工程适配。

转换将可编辑 TypeScript 及已接纳的输入、`web/` 构建、`history.json` 和 `conversion.json` 写入新目录。工程事务回执记录导入的舞台和资源身份。修正工程数据可传入基于导入修订的 `--transaction <json>`。修正源码时编辑副本，再转换到另一个新目录。需要复用存档命名空间时，通过 `--project-id` 保持报告里的工程 ID。浏览器存档按站点来源隔离。跨站点迁移时，按游戏自己的数据格式选择并导入所需键。

为两版使用同一份独立的 verify-game 场景，按顺序记录 `first-action`、`round-finished`、`restart`、`first-action-after-restart` 和 `save-restored`，每步先断言玩家能观察到的行为。场景可导出包含浏览器宽高的 `viewport` 以对齐响应式布局。CLI 保存两版结果，只为该次对照通过的新构建生成预览。旧版入口哈希记录传入验收的 HTML。为了能复跑对照，还要单独固定对应旧构建。

局域网验收使用私有地址，安装 [qrcode-generator 模块](https://www.npmjs.com/package/qrcode-generator/v/2.0.4) 并传入它的 `dist/qrcode.mjs`。已授权 USB 调试的 Android 可以把预览绑定到 `127.0.0.1`，用输出的端口配置 `adb reverse`。预览 15 分钟后失效。终端报告的构建 SHA-256 对应桌面验收所用的浏览器文件。

## 在 Agent 中使用

三个客户端共用包里的 `skill/SKILL.md`。Codex 放在 `.agents/skills/egret-migrate`，Claude Code 放在 `.claude/skills/egret-migrate`，WorkBuddy 用本地技能上传导入同一个目录。文件和命令权限由各自客户端控制。可以直接说：“把这个白鹭 5 游戏迁到 7.0，保留玩法和存档，验证一局能完整玩完。”

## 首次验收

独立包已在干净目录离线安装。白鹭 5.2.7 的原 Web 构建和适配后的 7.0.2 构建，均在 Windows Chrome 157 跑完同一局单人扫雷。脚本检查打开数字格、标记与取消标记、输局、重开及再次开格，使用 640 × 1136 视口和随机种子 739081。Agent 修复保留棋盘逻辑，替换场景内的 EUI 呈现，并把 13 个图集帧转换为独立本地 PNG。样例独立于本包。 [固定版本和许可](https://github.com/zjalen/Multi_Minesweeper/tree/57d48a8781bf104a60dac4b47556c0ce3be711d0)

Galaxy Z Fold7 上的 Chrome 157 识别了二维码图片，经 USB 预览读取全部 19 个匹配文件，在硬件 WebGL2 上复跑同一套操作。构建身份为 `cc6038460782728dc0bb96c5b5a3c9d5e558ca831c5bf4a6e63d32111a616eff`。原扫雷没有棋盘存档，这一案例单独验证了测试值持久化。原创对照游戏 Dawn Signal Run 在两代引擎上验证了真实游戏进度，刷新后恢复最佳成绩 3。该对照的通过构建也在 Fold7 上完成了验证。跨浏览器来源导入已有存档、更多 EUI 布局及目标平台完整兼容仍待验收。Claude Code 和 WorkBuddy 已有接入说明，客户端调用仍待实测。

完整阶段目标见[旧工程迁移规格](https://github.com/cnedwin/Egret_rebuild/blob/main/knowledge-base/Cns/docs/%E6%97%A7%E5%B7%A5%E7%A8%8B%E8%BF%81%E7%A7%BB.md)。
