# 可选 Spine 内容接入

[English](../../en/docs/spine-content-ingress.md) | 简体中文

M2.1 提供显式启用的 `@egret/spine` 资产 SDK，通过官方 Core 4.3.13 读取 JSON 设置数据，将原始 Spine 图集页面绑定到既有 Egret 纹理，并提供具有资源组生命周期的不可变信息。默认 Engine 入口保持原样。实例、播放与图形由 M2.2／M2.3 负责。

## 版本、权利与参考基础

精确 npm 依赖为 `@esotericsoftware/spine-core@4.3.13`，来源提交 `b7beb2ccbbce667a12c02f44d070644f59b04968`。检查的 1,154,900 字节归档与 registry SHA512 一致，SHA256 为 `761d0f03f84ea073e66a55b11758afb7416cd1494ed20d70c534c324225f52b9`。Editor／导出补丁号与运行库包补丁号不同，接入的导出系列为 4.3。默认拒绝预发行版本头；显式 `allowPrerelease: true` 可用于评估，并保留实际 beta 标签。

白鹭自行实现的适配器及原创数值／像素夹具使用 Apache-2.0。Core 保留 [Spine Runtimes License](https://github.com/cnedwin/Egret_rebuild/blob/main/third-party/spine-core-4.3.13.LICENSE)。本接入采用许可中附带条件的 SDK／库路径：Products 的每位使用者取得自己的 Spine Editor 许可，分发时附上运行库许可和版权声明。另一条已授权路径受 [Editor 第 2 节](https://esotericsoftware.com/spine-editor-license#s2)约束。选择这一条路径并不证明任何个人已取得授权，也不赋予不受限制的再分发权；可选打包不会改变条款。分发者仍须保留适用声明并满足所选路径，SDK 不校验或授予许可。

官方运行库与示例可按[固定提交 README](https://github.com/EsotericSoftware/spine-runtimes/blob/b7beb2ccbbce667a12c02f44d070644f59b04968/README.md)评估。私有评估使用真实 Core 读取原始 Spineboy JSON／二进制，两者均得到 67 骨骼、52 插槽、11 动画，实际导出头为 4.3.75-beta。检查的七个官方 JSON 候选均带该 beta 头。这些事实不构成稳定导出素材集或独立动画语义验收。官方美术、导出数据和运行库实现均未复制到白鹭的第一方源码或公开夹具中。

## 清单配置

使用既有通用清单／构建接口生成并准入的 `egret.resource-manifest/1`。既有 PNG／图集／序列帧及多页内容配方保持原样，本次不注册 Spine Node producer；调用方提供已准入、声明完整性身份的源产物。

| 资源种类 | 导入器（版本 1.0.0） | 产物格式 | 媒体类型 | 有序依赖／设置 |
| --- | --- | --- | --- | --- |
| spine | egret.spine-json | spine-json/4.3-1 | application/json | 一份图集；coreVersion: 4.3.13 |
| spine-atlas | egret.spine-atlas | spine-atlas/4.3-1 | text/plain | 一至十六张不同 PNG；coreVersion: 4.3.13 和有序 pageNames |
| image | egret.png | png/1 | image/png | 无依赖；既有 PNG 配置 |

Spine／图集只接受上述精确设置。产品二进制配置在目录准入时、工厂／provider 工作前即被拒绝。私有二进制格式读取原型单独保留：Core 二进制 API 不提供数量预算，源字节限制不足以约束分配。受约束的二进制解析边界继续留在 M2.1 OPEN，不会静默回退到无约束解析。清单中无关资源仍可由其他加载器使用。页面名称区分大小写，为一至 255 个 UTF-16 单元的 Unicode 标量字符串，不含 ASCII 控制字符；名称次序及实际图集页名必须与图像依赖次序完全一致。名称是绑定标签，不是文件系统路径。

原始图集由 Core 解析。[Spine 格式](https://esotericsoftware.com/spine-atlas-format)中的 90 度旋转为逆时针，而白鹭通用 SpriteSheet 的打包约定是顺时针；本接入不在两者之间强制转换或改写 UV。当前仅接入 straight-alpha PNG 页面，明确拒绝 PMA 页面。采样／颜色等价、PMA 归一化、mips 和实际绘制属于 M2.3 验收。

## 所有权与公共 API

`createSpineContentLoader(engine, ownerScope, manifest, factory, options?)` 捕获显式数据提供器工厂。工厂收到不可变资源 ID／种类及真实清单绑定，提供纹理、元数据字符串 provider。自定义 provider 负责源验证与解码；浏览器门面复用既有 SHA256 传输与原生 PNG 端口。

`loader.load(scope, roots, options?)` 验证同一 Engine 的消费者 Scope，精确选择所请求骨架的依赖闭包，返回具有 `ready`、`getSpine(id)` 和 `dispose()` 的资源组。所有请求根节点整体就绪。`getSpine` 返回资源组生命周期视图，含复制的不可变版本／格式、骨骼／插槽数量、皮肤／动画名称和时长以及页面元数据，不暴露可变 Core 对象、姿态、纹理、绘制指令或播放器。

既有 AssetManager 是唯一缓存与租约权威。原始 ManifestGroup 暂存已验证源；设置数据通过同一管理器保留独立页面租约，重叠资源组共享解析结果，并在就绪前释放暂存元数据。最后一份设置租约释放私有 Core 图集／数据及页面需求。源引用身份隔离同时存在的加载器代际，不建立第二套资源管理器。其他目录失败或取消时，旧就绪组仍可用，由应用决定何时释放旧代际。

消费者 Scope／资源组销毁会取消自身需求；所有者 Scope、加载器或 Engine 关闭会撤销关联组。迟到 provider 结果由既有管理器回收，不会发布部分设置。已复制的信息可作为脱离资源的元数据保留，视图的 `isDisposed` 表明退役。`dispose()` 同步撤销需求；`close()` 进一步等待自身 provider 工作。自定义宿主端口仍由调用方管理，浏览器门面关闭自身 PNG provider 和字节源。

## 边界

目录最多 128 个骨架、512 个已选择资源条目；每加载器最多八个组、每组 32 个根，且继续遵循 ManifestGroup 每依赖闭包 128 个资源的限制。每骨架源产物最多 4 MiB、每图集 256 KiB、每 PNG 8 MiB。Core 输入的 JSON 最多 2,097,152 个 UTF-16 单元，图集最多 262,144；JSON 遍历最多 262,144 个节点、深度 64；页面沿用最大单边 4,096、总像素 1,048,576。

解析后的准入上限为 1,024 骨骼、2,048 插槽、128 皮肤、1,024 动画和 8,192 图集区域。皮肤／动画名称遵循上述标量及名称规则，时长为零至 86,400 秒的有限数。`maxSetupBytes` 默认 16 MiB，允许零以禁用设置发布，最高 64 MiB；计入逻辑输入保留和约定设置记录费用，与图像分开核算。这是逻辑容量契约，不是第三方解析器峰值分配、物理内存或 GC 上限。进入 Core 前，第一方准入账本将累计分配驱动限制为 2,097,152 个逻辑单元，覆盖顶点／权重载荷、序列数量与继承 UV 长度、关联网格插槽成员、时间线帧数组、变形展开及普通／文件夹绘制顺序数组。序列数量最多 4,096，digits 最多八位。列表必须为真实 JSON 数组，权重组须精确消耗声明载荷，绘制顺序偏移须按不同插槽递增，目标不同且位于范围内，同时阻止不前进的顺序循环和小源文件的分配放大。这是准入校验，不是第二套动画解析器。二进制仍被拒绝；本 SDK 不提供任意不可信文件的隔离执行。

## 使用与验证

参见[包指南](https://github.com/cnedwin/Egret_rebuild/blob/main/packages/spine/README.zh-CN.md)。常规 `pnpm build` 在既有 TypeScript 构建图中构建可选叶子包，`pnpm test` 包含公共行为／类型套件。四个核心包原有依赖检查保持原样，另设一项范围限定的可选包依赖／公共边界检查；不为本包重建历史源码快照。

[验证记录](https://github.com/cnedwin/Egret_rebuild/blob/main/verification/spine-content/verification.json)区分源码、受控行为、严格 ES-only 公共消费者及实际桌面浏览器资源检查。程序化夹具为原创数据，不是经过认证的 Editor 导出。浏览器采集器使用默认 Edge、Playwright 1.62.1、真实公共 Engine／Scope、普通 fetch、SHA256 和原生 PNG 解码，检查共享 JSON 设置、真实存活完整图像纹理的精确两页绑定、HTTP503 替换拒绝、确认取消后才发送迟到响应，以及关闭后自身逻辑计数归零。不拦截解码器／密码算法／构造器／原型，不声称渲染或像素验收。

完整所选版本 Spine 支持、独立姿态／事件／像素参考、稳定且有权使用的导出素材来源、播放、共享图形／颜色变体、Android／iPhone、原生宿主和性能仍未完成。M1.2 仍为 10.3 ms，未达 8 ms 目标。本次在 issue #83 内推进 M2.1，保留既有十一个 M2–M4 工作包。

二进制接入须先具备单独受约束的解析边界，这是 M2.1 明确保留的未完成事项。

可选叶子包明确声明浏览器资源工程依赖，干净检出即可构建，不依赖以前残留的生成文件。
