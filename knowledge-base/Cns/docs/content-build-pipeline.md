# 可复现的内容构建

[English](../../en/docs/content-build-pipeline.md) | 简体中文

M2.1 构建／运行时配置 · 更新于 2026-10-30 · PNG、单页图集、序列帧及独立的第一方[多页图集配置](multipage-atlas-content.md)。完整 M2.1 仍未验收。

## 从源文件到可播放资源

内容配方把项目中已经登记的源文件交给四种固定导入器。构建过程验证源文件字节、计算依赖键，复用完整缓存或重新导入变化的资源，再将产物绑定到当前项目。图集与序列帧产物沿用现有 SpriteSheet 和 SequenceClip 表示，不增加另一套动画播放器。

首批配置保留准入 PNG 作为主分发产物，并生成按行紧密排列、左上原点、直通 Alpha 的 RGBA8 参考产物。图集元数据生成具名规范帧和序列输入。序列通过依赖序号零引用图集，图集通过序号零引用页面。独立产物中不包含所属项目 ID、资源 ID、文件 ID 或物理路径；这些依赖由准入后的资源清单解析。

示例像素和元数据均为 Apache-2.0 下原创的合成夹具。夹具构建成功不代表真实 Aseprite 导出、其他导出器、授权素材或目标设备已经通过验收。

## 公共边界

| 入口 | 职责 |
| --- | --- |
| `@egret/contracts/resources`：`validateResourceBuildPlanDescription`、`evaluateResourceBuildKeys` | 在产物存在之前验证源描述并计算键，与最终清单构建共享同一权威实现。 |
| `@egret/project/resources`：`describeContentRecipes` | 捕获项目与配方数据、解析源文件、验证有限导入配置与依赖图，构造受保护的生产者和设置封装。 |
| `@egret/project/resources`：`bindContentArtifacts` | 将完整的独立产物描述绑定到项目文件与资源，生成准入清单。 |
| `@egret/project/resources`：`createContentAdoption` | 根据真实绑定准备完整项目事务；不提交调用者的存储，也不证明文件系统已就绪。 |
| 仓库工具 `tools/build-content.mjs` | 读取实际归属文件、运行固定 Node 管线并导出结果与回执；它是构建工具，不是引擎运行时依赖。 |

旧资源描述仍要求真实产物。已有构建键、运行时身份、清单字节和默认包入口保持原有含义，不使用占位哈希，也不增加平行的键算法。

配方格式为 `egret.content-build-recipe/1`，包含一个 `targetProfile` 和若干配方，每项有 `resourceId`、`sourceFileId`、`importer`、`settings`、`artifactFormatVersion`、有序 `dependencies` 与 `provenance`。固定导入器为 `egret.png@1.0.0`、`egret.aseprite-atlas@1.0.0`、`egret.sequence@1.0.0` 和 `egret.atlas-pages@1.0.0`。Aseprite 单页配置为 `aseprite-json-array-1.3.18.6-v1`，拒绝旋转和多页。输出格式分别为 `png/1`、`egret.atlas/1`、`egret.sequence/1` 和独立的 `egret.atlas-pages/1`。

新配方使用受保护的设置封装，纳入配方、输出和参考格式版本、选项以及实际 Node/pngjs/zlib 生产者身份。配方不能指定可执行代码；构建工具在查询缓存前核实已安装版本。目标标签参与现有键算法，但首批导入器生成共享产物；更换标签不代表某个平台或专用纹理转换已经验收。

## 在运行时加载构建产物

可选 `@egret/engine/web/resources` 入口提供 `createManifestContentLoader(engine, manifest, options)`，接收已准入清单和资源基础 URL，复用 ManifestByteSource 检查字节数与 SHA-256、严格解码 UTF-8 元数据，并使用现有浏览器 PNG provider。应用无需再为这些固定格式自行创建资源类型和绑定、解析图集 JSON，或手工装配 SpriteSheet/SequenceClip。

`loader.load(scope, roots, options?)` 选择声明的依赖闭包，返回归 Scope 管理的资源组。只有选中资源全部加载、精确产物格式及相互关系检查通过、图集和序列对象完整装配后，`ready` 才会成功。此后通过 `getImage(id)`、`getAtlas(id)` 和 `getSequence(id)` 取得对应类型的资源。类型不符、未选中 ID、尚未就绪或已退出的资源组都会被拒绝。加载不会自动挂载显示对象、启动播放或推进时钟。

```js
import { createManifestContentLoader } from '@egret/engine/web/resources';

// engine is genuine; manifest has already passed public manifest admission.
const loader = createManifestContentLoader(engine, manifest, { baseUrl });
const dataScope = engine.createScope();
const group = loader.load(dataScope, ['e_sequence', 'e_other']);
await group.ready;

const displayScope = engine.createScope();
const animationScope = engine.createScope();
const sheet = group.getAtlas('e_atlas');
const bitmap = displayScope.use(sheet.createBitmap(sheet.names[0]));
engine.stage.addChild(bitmap);
const playback = engine.createSequencePlayback(
  animationScope, bitmap, group.getSequence('e_sequence'), { mode: 'once' }
);
// The application explicitly starts playback and advances its game clock.
```

非浏览器宿主通过 `@egret/engine/resources` 的 `createContentLoader` 显式接入。provider 工厂接收不可变的 ID、类型和绑定记录，以自身数据方法提供纹理与元数据字符串 provider。该宿主负责字节完整性、解码和 provider 关闭；共享核心验证产物语义，不依赖 DOM、Node 或项目／构建工具。两个工厂均复用原资源管理、播放器及身份算法。

### 所有权、失败和版本替换

一个 loader 对应一份完整的已准入清单和来源目录。它只创建一次类型和绑定；同一 loader 的重叠加载组通过现有 AssetManager 共享资源值，各组独立拥有租约。当前仅接纳四种固定导入器／格式组合。每次加载闭包最多 128 个资源，沿用既有清单组限额与优先级。来源或清单变化时使用新 loader；逻辑资源 ID 相同不能授权跨 loader 或跨代际共享。

组返回的图片租约与 SpriteSheet 均为借用值，不应自行释放租约、销毁图集，或将它们登记到另一个 Scope。应用创建的 Bitmap 和播放控制器归应用 Scope 管理。退出时先清理动画、显示使用者，再清理数据组／Scope。资源组先撤销已装配图集，再释放底层租约。序列 clip 是不可变元数据，不增加资源所有权。

调用 `group.dispose()`、释放组的 Scope、销毁 loader 或关闭 Engine 都会撤销组并取消未完成需求。部分加载或装配失败会清理所有已获得的资源，迟到结果不能使组重新可用。浏览器 loader 的 `loader.close()` 会销毁各组并等待原字节源与 PNG provider 关闭；同步 `dispose()` 不等于原生工作已经结算。`getStatus()` 分开呈现字节源和 provider 的观察，逻辑计数归零不证明物理内存或 GPU 耗时。

替换时，保留当前显示和旧数据组，先准备新资源组。候选完整 `ready` 后，由应用显式切换显示／播放对象，并先退出旧使用者再释放旧数据。候选失败或取消时，当前代际仍可使用。这是应用控制的准备与切换流程，不新增全局热更新事务，也不承诺保持动画播放位置；示例明确重置替换后的播放。

运行时准入检查有界规范化 `egret.atlas/1` 与 `egret.sequence/1` 数据、依赖序号与类型、PNG 实际尺寸、图集和序列输入一致性，以及元数据来源 ID／摘要／长度。元数据上限为 4 MiB；保留原图像限额、1,024 帧上限、名称限额和毫秒时长规则。产物和关系错误在 cause 记录中携带资源 ID 与阶段，原传输／provider 失败保留在错误链中。哈希校验不等于素材权利或生产者签名验证。

## 缓存与失效范围

构建键包括源字节摘要与长度、导入器和输出版本、生产者设置、目标、项目版本锁定、来源声明，以及有序依赖 ID 与键。修改页面会使页面、图集及序列失效，无关图片仍可命中。修改公共项目版本会使所有选中键失效。仅移动相同字节的源文件不会改变独立构建键；依赖 ID 更名可能改变键，因为 ID 属于既有契约。

缓存记录保存所有产物，包括 RGBA 参考。每次命中都检查实际字节长度和哈希。缺失文件可重建；已经存在但内容冲突的文件触发完整性拒绝。补齐不完整记录必须重现原来的完整产物描述；相同键生成不同产物会被拒绝。首批实现不包含自动修复、隔离或垃圾回收。

跨项目命中只复用独立字节。每个项目重新绑定和准入，并拥有自己的不可变文件，不移植缓存清单或事务。缓存属于协作构建环境；字节完整性不等于可信生产者的数字签名。

## 两个明确的提交点

1. **构建代次就绪：**在协作式独占写入锁下暂存已验证文件和清单，再发布完整代次目录。代次身份来自规范描述的哈希，描述包含清单摘要、长度和全部资源产物。文件路径不依赖代次 ID；清单不列出自身配置文件和选择实体，避免哈希与路径自引用。只有就绪后才能发布缓存记录。
2. **项目修订采用：**现有 `ProjectStore.commit` 针对捕获的修订号提交完整资源、文件和选择事务。选择实体记录目标、精确代次、清单文件及资源 ID。就绪后的冲突或取消会保留可复用代次及现有项目选择；成功提交不会被稍后的取消撤销。

每个目标只有一个活动选择实体。重新构建必须复用该选择器 ID；为同一目标引入第二个选择器会在发布前被拒绝。其他目标可在资源归属互不重叠时共存。

就绪前再次核实源文件。取消在有界同步导入调用之间以及就绪、采用之前观察，不能中断同步解码器内部。构建不会删除旧代次文件。文件系统发布与项目采用是两个独立事务，不承诺跨系统原子提交或掉电持久性。CLI 导出新的候选快照，不覆盖现有项目文件，也不更新第二个当前版本指针。

## 限额与依赖

顺序执行器最多接纳 64 MiB 去重源文件字节、128 MiB 完整产物和 64 MiB 累计 PNG 扫描行工作量，后者计算两次解压。这些是逻辑准入与工作量预算，不是进程物理内存或显存上限。清单继续采用 4 MiB、4,096 个资源、8,192 条边和深度 32 的限额；项目事务和引用限额可能提前拒绝一次完整采用。

每张 PNG 限制为编码 8 MiB、单边 4,096、总像素 1,048,576、1,024 个块。准入配置为 RGB/RGBA8、非隔行和选定的 sRGB 兼容元数据。所有准入块都检查 CRC；在调用 pngjs 公共解码接口前，Node 公共解压接口检查精确扫描行长度、完整流结束以及尾随输入。保留直通 Alpha 与编码通道值，不增加 Gamma 调整、预乘、重压缩或自研编解码器。透明像素的不可见 RGB 保留通过离线测试验证，与浏览器合成分开。

构建期依赖固定为 MIT 的 `pngjs 7.0.0`，原始声明保留在 `third-party/pngjs-7.0.0.LICENSE`。Node 仍为 26.7.0。[pngjs](https://github.com/pngjs/pngjs) 和 [Node zlib](https://nodejs.org/api/zlib.html) 公共接口提供编解码与校验基础。白鹭的配方、所有权、缓存、绑定和事务集成独立实现；依赖不进入默认 Engine/Runtime 包。

## 验证与剩余范围

专项测试覆盖实际源字节、冷暖构建、反向依赖失效、重新绑定项目、参考产物缺失或损坏、源文件漂移、取消及修订冲突。PNG 测试包含独立编写的像素、滤波预期和畸形流。存储测试使用真实临时目录，不替换文件系统；无法创建符号链接的环境限制与实际目录联接、路径测试分别记录。独立评审检查源码和结果证据，不只检查测试数量。

类型化内容 loader 接入之前，2026-10-23 的历史生成产物浏览器运行在 Windows x64、Node 26.7.0、Playwright 1.62.1 和无头 Microsoft Edge 155.0.4283.62 下通过五项检查：加载已提交的四资源候选快照，对初始、推进及结束帧逐一比较全部 72 个原生 Canvas 像素，并验证清理后的所有权计数归零。公开结果摘要（仓库中的 `examples/content-build/verification-summary.json`）记录环境、检查和原始回执哈希；它是公开投影，不替代保留的原始记录。该历史结果不证明新 loader 及其失败、取消、替换路径已经通过。当前采集器补充这些有限 Canvas 场景，每次新运行单独记录结果。浏览器功能证据不等于真机、WebGPU/WebGL2 或性能验收；完整合并门禁及 GitHub 集成另行记录。

M2.1 仍需完成授权 Spine JSON/二进制/多页导入、字体产物、选定目标变体、mip/旋转/压缩验收和完整功能清单。M2.2–M2.4、复杂 UI、IME 与 Android/iPhone 真机验收仍按各自工作包推进。M1.2 全脏场景实测 10.3 ms 对比 8 ms 目标的缺口保持开放。

2026-10-29 的类型化加载器浏览器验证在 Windows x64、Node 26.7.0、Playwright 1.62.1 和无界面 Microsoft Edge 156.0.4314.50 中通过全部 13 项有限检查。保存的 8 份完整帧读回各自匹配全部 72 个独立指定的 Canvas 像素。真实哈希不符响应被拒绝；真实 HTTP 请求挂起后取消，迟到结果不会发布；失败或取消的替换保留当前版本，同一逻辑 ID 的第二次真实构建能够切换到自身逆序的动画帧。所有版本加载器的 source/provider 当前计数归零，应用、上下文、浏览器和服务器均完成清理。当前验证摘要保留原始结果哈希及历史摘要。本次不构成 GPU 后端、手机、物理内存、性能或完整 M2.1 验收。

新增第一方 `egret.atlas-pages@1.0.0` 使用 `egret.atlas-pages/1`、空设置及一至十六个有序 PNG 依赖；资源组通过 `getAtlasPages` 和 `getAtlasPage` 读取。页面命名、上限和裁剪／旋转由独立的[多页契约](multipage-atlas-content.md)规定；既有 Aseprite／序列帧格式与所有权不变。
