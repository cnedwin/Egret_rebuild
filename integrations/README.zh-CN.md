<!-- SPDX-License-Identifier: Apache-2.0 -->
# 可选第三方集成

[English](README.md) | 简体中文

可选包 `@egret/integrations` 位于 `integrations/`，独立安装依赖并维护锁文件。工程通过下列子入口按需导入能力。公共接口使用白鹭侧的数据和句柄，不把上游对象交给调用者。

| 能力 | 导入子入口 | 主要 API 与宿主 |
| --- | --- | --- |
| Tiled 与 tmx-parser | `/tiled` | `importTiledMap({ mapPath, files })` 支持有限正交或等距 TMX，以及内联或明确声明的 TSX。由 Node 构建端生成 `egret.tiled-map/1` JSON。 |
| Planck | `/physics` | `createPhysicsWorld(options)`、`createBody`、`advance(seconds)`、`snapshot` 和 `applyLinearImpulse`。浏览器和 Node。 |
| Howler | `/web/audio` | `createAudioBank`、`load`、`play`、`status` 和 `dispose`。浏览器。 |
| idb-keyval | `/web/storage` | `createSaveStore(namespace)`、`get`、`set`、`update`、`delete` 和 `dispose`。支持 IndexedDB 的浏览器。 |
| fflate | `/archive` | `zipAssets` 与 `unzipAssets` 提供有容量限制的内存 ZIP 打包与解包。浏览器和 Node。 |
| ktx-parse | `/texture` | `inspectKtx2` 读取容器和 mip 信息，`decodeKtx2Rgba8` 提供白鹭贴图可用的独立像素。浏览器和 Node。 |
| i18next | `/i18n` | `createLocalization`、`t`、`changeLanguage` 和 `dispose`。浏览器和 Node。 |

各子入口以 `@egret/integrations` 开头。当前以仓库内预览包交付，独立工程可以通过本地文件依赖引用构建后的包并沿用相同导入方式。

## 资源与场景归属

- 在外部 Tiled 编辑器打开 `example/assets/room.tmx` 即可编辑样例。Node 导入器只接收调用者明确提供的 TMX 和 TSX 文本。图层保留空格、水平翻转、垂直翻转和对角变换标记，图集路径由游戏资源加载器读取。有限地图配置以适配器支持范围为准，无限地图、压缩图层和超出范围的图层或对象会给出明确错误。
- 物理使用米、秒和弧度，可用白鹭时钟的增量驱动，也可由项目自己的循环调用 `advance`。固定步进限制追帧次数，并报告丢弃的时间与碰撞事件。刚体快照与 Planck 内部状态相互独立。示例将米转换为像素，并在操作时推进模拟。
- 用 `scope.use(...)` 托管物理世界、音频库、存档句柄和语言实例。关闭 Scope 会释放归属的音轨及运行时句柄。通过 `load` 预加载，再在点击或触摸事件里直接调用 `play`。`voice.started` 和 `onDiagnostic` 可观察实际播放或失败。
- 存档在同一来源内按命名空间隔离。`update` 在一个 IndexedDB 事务中执行同步更新，`undefined` 表示缺失，`delete` 删除数据。释放句柄会保留已有存档。
- ZIP 使用相对资源路径，支持存储与 DEFLATE，带容量限制及 CRC 校验。ZIP64、加密项和流式描述符超出当前配置。输出供资源加载器消费，不执行文件系统写入。
- KTX2 可直接解码紧密排列、左上原点、直通 Alpha 的 sRGB RGBA8 二维纹理。容器检查也能读取其他已支持的元数据和压缩类型。Basis／UASTC 转码和压缩 GPU 上传是独立能力。将返回像素传给现有资源提供者中的 `createImageData2D` 与 `createTexture`。
- 语言实例独立持有词条和当前语言。返回值按白鹭或 DOM 纯文本显示。设置回退词典，使用 `count` 触发复数规则，使用 `values` 插入变量。

## 运行和调试

```sh
pnpm setup:dev
pnpm --dir integrations install --frozen-lockfile --ignore-scripts
pnpm --dir integrations build
pnpm --dir integrations test
pnpm --dir integrations dev
```

打开 `dev` 输出的地址。点击 **运行场景** 会实际播放音频、推进物理、连续更新两次存档并切换语言。**调试信息** 会显示地图尺寸、ZIP 条目、纹理 mip 数、白鹭画布像素、碰撞、播放事件和存档状态。刷新页面可查验存档持久化，**关闭场景** 可释放白鹭 Scope。浏览器开发者工具可利用示例的源映射跟进适配器代码。

运行 `pnpm --dir integrations verify:browser` 可自动验收。Windows 默认使用已安装的 Edge，其他系统先运行 `pnpm --dir integrations exec playwright install chromium` 安装 Playwright Chromium。也可以传入 `chrome` 或 `msedge` 检查现有浏览器。验收覆盖完整场景、重载和清理。

在自己的构建中，可以显式列出所需 TSX，将命令输出重定向为地图产物。

```sh
node integrations/tools/import-tiled.mjs integrations/example/assets room.tmx tiles.tsx
```

适配器使用 `/errors` 中的 `IntegrationError`。应用诊断可统一记录 `integration`、`code`、`message` 和可选的 `cause`。示例使用这套字段显示问题。

依赖版本和许可证见 [第三方声明](THIRD_PARTY_NOTICES)。实际接入请参看[示例代码](example/main.mjs)。
