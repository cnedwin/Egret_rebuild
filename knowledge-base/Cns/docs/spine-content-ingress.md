# 可选 Spine 内容接入

[English](../../en/docs/spine-content-ingress.md) | 简体中文

M2.1 提供显式启用的 `@egret/spine` 资产 SDK，通过官方 Core 4.3.13 读取 JSON 设置数据，将原始 Spine 图集页面绑定到既有 Egret 纹理，并提供具有资源组生命周期的不可变信息。默认 Engine 入口保持原样。独立播放实例见下文；有界共享渲染接入及剩余 M2.3 资格见下文。

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

`loader.load(scope, roots, options?)` 验证同一 Engine 的消费者 Scope，精确选择所请求骨架的依赖闭包，返回具有 `ready`、`getSpine(id)` 和 `dispose()` 的资源组。所有请求根节点整体就绪。`getSpine` 返回资源组生命周期视图，含复制的不可变版本／格式、骨骼／插槽数量、皮肤／动画名称和时长以及页面元数据，资产视图不暴露可变 Core 对象、姿态、纹理或绘制指令；下述独立身份校验工厂可创建播放实例。

既有 AssetManager 是唯一缓存与租约权威。原始 ManifestGroup 暂存已验证源；设置数据通过同一管理器保留独立页面租约，重叠资源组共享解析结果，并在就绪前释放暂存元数据。最后一份设置租约释放私有 Core 图集／数据及页面需求。源引用身份隔离同时存在的加载器代际，不建立第二套资源管理器。其他目录失败或取消时，旧就绪组仍可用，由应用决定何时释放旧代际。

消费者 Scope／资源组销毁会取消自身需求；所有者 Scope、加载器或 Engine 关闭会撤销关联组。迟到 provider 结果由既有管理器回收，不会发布部分设置。已复制的信息可作为脱离资源的元数据保留，视图的 `isDisposed` 表明退役。`dispose()` 同步撤销需求；`close()` 进一步等待自身 provider 工作。自定义宿主端口仍由调用方管理，浏览器门面关闭自身 PNG provider 和字节源。

## 边界

目录最多 128 个骨架、512 个已选择资源条目；每加载器最多八个组、每组 32 个根，且继续遵循 ManifestGroup 每依赖闭包 128 个资源的限制。每骨架源产物最多 4 MiB、每图集 256 KiB、每 PNG 8 MiB。Core 输入的 JSON 最多 2,097,152 个 UTF-16 单元，图集最多 262,144；JSON 遍历最多 262,144 个节点、深度 64；页面沿用最大单边 4,096、总像素 1,048,576。

解析后的准入上限为 1,024 骨骼、2,048 插槽、128 皮肤、1,024 动画和 8,192 图集区域。皮肤／动画名称遵循上述标量及名称规则，时长为零至 86,400 秒的有限数。`maxSetupBytes` 默认 16 MiB，允许零以禁用设置发布，最高 64 MiB；计入逻辑输入保留和约定设置记录费用，与图像分开核算。这是逻辑容量契约，不是第三方解析器峰值分配、物理内存或 GC 上限。进入 Core 前，第一方准入账本将累计分配驱动限制为 2,097,152 个逻辑单元，覆盖顶点／权重载荷、序列数量与继承 UV 长度、关联网格插槽成员、时间线帧数组、变形展开及普通／文件夹绘制顺序数组。序列数量最多 4,096，digits 最多八位。列表必须为真实 JSON 数组，权重组须精确消耗声明载荷，绘制顺序偏移须按不同插槽递增，目标不同且位于范围内，同时阻止不前进的顺序循环和小源文件的分配放大。这是准入校验，不是第二套动画解析器。二进制仍被拒绝；本 SDK 不提供任意不可信文件的隔离执行。

## 使用与验证

参见[包指南](https://github.com/cnedwin/Egret_rebuild/blob/main/packages/spine/README.zh-CN.md)。常规 `pnpm build` 在既有 TypeScript 构建图中构建可选叶子包，`pnpm test` 包含公共行为／类型套件。四个核心包原有依赖检查保持原样，另设一项范围限定的可选包依赖／公共边界检查；不为本包重建历史源码快照。

[验证记录](https://github.com/cnedwin/Egret_rebuild/blob/main/verification/spine-content/verification.json)区分源码、受控行为、严格 ES-only 公共消费者及实际桌面浏览器资源检查。程序化夹具为原创数据，不是经过认证的 Editor 导出。浏览器采集器使用默认 Edge、Playwright 1.62.1、真实公共 Engine／Scope、普通 fetch、SHA256 和原生 PNG 解码，检查共享 JSON 设置、真实存活完整图像纹理的精确两页绑定、HTTP503 替换拒绝、确认取消后才发送迟到响应，以及关闭后自身逻辑计数归零。不拦截解码器／密码算法／构造器／原型，不声称渲染或像素验收。

完整所选版本 Spine 支持、独立姿态／事件／像素参考、稳定且有权使用的导出素材来源、完整播放资格验收、共享图形／颜色变体、Android／iPhone、原生宿主和性能仍未完成。M1.2 仍为 10.3 ms，未达 8 ms 目标。资源接入在 issue #83 内推进 M2.1，下述播放增量在 issue #84 内推进 M2.2，保留既有十一个 M2–M4 工作包。

二进制接入须先具备单独受约束的解析边界，这是 M2.1 明确保留的未完成事项。

可选叶子包明确声明浏览器资源工程依赖，干净检出即可构建，不依赖以前残留的生成文件。

## 独立播放实例

可选根入口新增 `createSpineInstance(asset, scope, options?)`，只接受真实已就绪资源及同一 Engine 的开放 Scope。每个实例拥有私有 Core Skeleton 和 AnimationState，设置数据与页面租约仍由既有资源组共享。实例借用资源组生命周期：实例 Scope 关闭时销毁自身，资源组／加载器／Engine 关闭时先销毁关联实例，再释放设置数据和页面。关闭单个实例或资源组不影响其他资源组的实例。`loader.getStatus().liveInstances` 给出逻辑数量，每个加载器最多 128 个；它不是物理内存测量。

以下控制排队到下一次 `advance(tick)`：`setAnimation(track,name,{loop?,mixSeconds?})`、`addAnimation(track,name,{loop?,mixSeconds?,delaySeconds?})`、`clearTrack`、`setSkin`、`setTransform(x,y,scaleX=1,scaleY=1)`、`setRate` 和 `setPaused`。轨道为 0–15，每实例最多 256 条待处理命令及 128 个仍保留的 Core 轨道条目。命名皮肤独立选择，不暴露任意上游对象修改或组合皮肤构造。清除轨道遵循 Core 语义，不自动恢复设置姿态。混合时长为 0–3,600 秒，排队延迟为 0–86,400 秒，速度为 0–16，变换各分量须为 ±1,000,000 内的有限值。延迟零使用 Core 的前序条目／混合边界，不表示立即覆盖当前轨道。

时间显式推进。传入既有 GameClockTick 或同等自身数据属性记录：tickId 为严格递增的正安全整数，elapsedSeconds 为不下降的非负有限值，deltaSeconds 为非负有限值。不创建 RAF 或计时器。每次接受的推进消耗一个 tick；暂停或零速度不累积墙钟追赶时间。有效增量按命令顺序采用本次排队的速度／暂停值。默认最多八段，每段不超过 1/60 秒；maxSegments 可设为 1–120。过大增量在消耗命令或改变已提交状态前拒绝。应用须匹配 Engine 时钟上限，或显式分批追赶。适配器调用所选 Core 的物理更新，但本数值夹具不构成完整约束／物理资格验收。

`getSnapshot()` 返回冻结复制的骨骼、插槽附件名、轨道、事件、时间和状态。骨骼世界矩阵来自 Core 最终应用姿态，包含其约束结果，不猜测变换。坐标遵循 Spine 设置／世界约定；它们是数值观察结果，不是白鹭绘制命令、纹理或渲染权威。后续更新或销毁不会改变已取得的快照；不暴露 Core 对象或池化 TrackEntry。发布的名称与事件字符串须为经过验证的原始值；非有限数值或格式异常的事件载荷在发布前使实例进入故障，防止可变 JSON 字段通过共享设置数据泄漏。

事件保留 Core 队列的 start、interrupt、end、dispose、complete 和作者事件载荷顺序。maxEvents 每次推进默认 1,024，上限可设为 1–8,192。新数值快照提交后才调用监听器；监听器发出的命令延至下一次推进。销毁立即停止后续回调。监听器异常会完成其余符合条件的回调，再抛出 SPINE_INSTANCE_LISTENER_FAILED；保留已提交时间和姿态，不重放事件。事件时间保留 Core 数值表示，作者的十进制时间可能舍入至 Float32 精度。

无效输入和过大增量属于预校验拒绝。推进中的非预期语义错误、轨道条目超限、事件超限或非有限姿态会使该实例进入 faulted，抑制未发布事件并保留最后成功快照。可变 Core 状态未回滚；故障实例拒绝继续控制／推进，需销毁后重建，其他实例继续工作。这与提交后的监听器异常分开。适配器复制有界快照字段，不在每次更新克隆完整实例；输入属性描述处理不可重入推进。

资源组就绪后的示例：

```js
import {createSpineInstance} from '@egret/spine';
const instanceScope = engine.createScope();
const player = createSpineInstance(group.getSpine('e_skeleton'), instanceScope);
player.setAnimation(0, 'walk', {loop: true});
engine.clock.onTick(instanceScope, tick => { player.advance(tick); });
// Drive engine.advanceTime(sourceSeconds) from the existing application loop.
// Use clock.maxDeltaSeconds <= 8 / 60, or select a matching maxSegments.
instanceScope.dispose();
```

本 M2.2 增量交付独立语义播放，不含共享渲染接入。定位／重放历史及检查点、组合皮肤、完整独立约束／时间线参考集、所选版本完整支持和 M2.3 图形仍开放。上文运行库版本、许可和原始出处保持不变。原始数值夹具提供作者定义的位移、分层、切换和事件预期，不是经认证的 Editor 导出。

本增量验证：60 项针对性测试通过，其中新增 27 项播放用例，并包含严格 ES-only 公共消费者。实际默认桌面 Edge 156.0.4314.58、Playwright 1.62.1 在 369 个冻结源码文件上通过六组检查：真实传输／PNG、独立数值姿态、时间拒绝／暂停／混合／事件、故障隔离和清理。源码完整性和全部清理检查通过。最初失败预期与输入检查重入回归单独保留于[验证记录](https://github.com/cnedwin/Egret_rebuild/blob/main/verification/spine-content/verification.json)；这些检查不代表像素、手机、完整动画参考集或性能验收。

## 共享渲染显示

M2.3 通过 `createSpineDisplay(player, scope, {colorProfile: 'egret-shared-linear/1'})` 将真实播放器接入既有有序显示链路。每个播放器最多关联一个存活显示对象。返回的 `node` 支持原有位置、缩放、透明度、可见性和矩形裁剪，子节点由适配器拥有。将它放在其他显示对象之间即可保留场景顺序；不支持的子树拓扑修改会在下一次发布前拒绝。销毁节点或显示 Scope 只关闭显示对象，独立播放器仍可推进并重新关联显示。播放器或源资源组销毁时，先退役显示对象，再释放共享页面租约。不引入第二资源管理器、计时器、Canvas 覆盖层或 GPU 所有权链路。

`advance(tick)` 先提交成功的数值姿态，再准备并发布复制的绘制几何，最后交付回调。绘制属于独立提交域：转换、上限或发布失败保留旧画面，但已提交动画时间与事件仍然有效。该批事件仍会交付，随后 `advance` 通过 `SPINE_INSTANCE_RENDER_FAILED` 报告原因。语义实例保持运行或暂停状态，后续有效 tick 可以恢复绘制，不重放已经交付的事件。意外语义推进错误仍采用独立的整实例故障规则。有序页面／材质拓扑不变时复用不暴露资源的 Mesh2D 生产者绑定；拓扑变化时暂存脱离显示树的候选子树。既有帧捕获保留不可变几何与页面数据，因此在 Engine／Host 仍存活时，旧帧可在播放器／资源组退役后回放。这些是逻辑生命周期性质，不代表物理内存测量或资源替换／设备恢复验收。

Core 4.3.13 提供有序区域／网格和裁剪输出。白鹭只转换缓冲的实际使用范围，通过 SharedGeometry2D 身份校验工厂复制，翻转一次 Y 坐标，并绑定原页面租约。ARGB8 明暗颜色转换为复制的系数，不暴露 Core 指令或池。每显示对象默认及硬上限为 256 条指令、65,536 个顶点和 196,608 个索引；`maxCommands`、`maxVertices`、`maxIndices` 可将各项正上限调低。这些限制约束发布，不约束 Core 内部峰值分配。页面支持最近邻或线性采样，要求 min／mag 过滤相同且使用 clamp 寻址；PMA 页面、mip 过滤及其他采样组合仍拒绝。

颜色配置必须显式选择，不默认承诺与所有 Spine 渲染器一致。它保留 shared-frame/1：纹理经过既有规范页面转换，着色／合成使用线性工作值，输出采用既有 sRGB 转换。设 `p`、`a` 为规范采样的预乘 RGB 和透明度，`L` 为明色 RGB，`D` 为暗色 RGB，`f` 为明色透明度与显示透明度之积，则源 RGB 为 `S=f*(p*L+(a-p)*D)`，源透明度为 `A=f*a`。目标预乘 RGB 为 `B` 时，normal 为 `S+B*(1-A)`，additive 为 `S+B`，multiply 为 `S*B+B*(1-A)`，screen 为 `S+B*(1-S)`。normal／multiply／screen 透明度使用 source-over，additive 累加透明度；既有目标量化／截断和输出转换保持不变。分别映射到 normal／add-accumulate／multiply-factor／screen，无需修改着色器。旧 gamma 空间渲染器的一致性需要另行验证的配置，本次结果不证明该一致性。

`getStatus()` 返回显式配置、发布修订号、实际指令／顶点／索引数和销毁状态。渲染不驱动动画时间：隐藏显示仍按显式 tick 推进并发送事件。公共契约保持 DOM／Node-free，WebGPU 与 WebGL2 消费同一准入 Engine 帧；Canvas 不在本网格／共享配置范围。

```js
import {createSpineDisplay} from '@egret/spine';
const displayScope = engine.createScope();
const display = createSpineDisplay(player, displayScope, {
  colorProfile: 'egret-shared-linear/1',
});
engine.stage.addChild(display.node);
display.node.x = 120;
display.node.y = 200;
// Existing player.advance(tick) commits the pose, then drawing, then dispatches events.
engine.renderSharedFrame({width: 640, height: 360});
displayScope.dispose(); // The independent player remains available.
```

验证：95 项针对性公共行为／类型测试通过，其中新增 35 项渲染／绑定用例。默认桌面 Edge 156.0.4314.58、Playwright 1.62.1 在 WebGL2 和 WebGPU 上分别通过 16 个正向像素用例，并拒绝六个有意错误的页面／顺序／着色／混合／裁剪／过滤对照。冻结闭包含 551 个文件，包含宿主固定延迟模块依赖。原创用例覆盖多页顺序、区域、加权／非加权网格、多边形与矩形裁剪、负缩放、DPR 2、最近邻／线性采样、裁切／旋转区域、双色着色、四种混合、透明输出，以及退役后完整保留帧回放。数值位置容差为 1e-5，采样 RGBA 容差为两个编码值，均不是性能测试。最初严格浮点断言及 gamma 空间预期不匹配结果单独保留。复验命令为 `node tools/verify-spine-rendering.mjs --playwright <absolute-installed-playwright-1.62.1-package> --output <new-absolute-directory-outside-repository>`。

本次在 issue #85 内交付有界共享渲染接入。完整所选版本附件／约束／物理覆盖、嵌套／反向裁剪参考、授权稳定 Editor 导出、gamma 等价或 PMA／mip 配置、原生／手机资格及 M2.4 替换／恢复场景仍开放。M1.2 原性能失败保持 10.3 ms，目标为 8 ms。运行库原始许可与来源不变。

新增的 `Mesh2D.createBinding(lease, geometry)` 沿用既有捕获链路，返回不暴露资源的 DisplayObject 与独立生产者句柄。节点不具有 Mesh2D 身份，不能读取租约或取得内容写入器，通过 Mesh2D 原型方法也不行。句柄可交给同一 Engine 的真实 Scope 管理；节点具有永久私有清理所有者，不能被其他 Scope 接管。`prepare` 先验证内容，再产生可取消、一次性提交；被覆盖、资源已释放或目标已销毁的候选不能发布。Spine 在提交任何绑定前先准备全部绑定，并显式退役包括已脱离子树在内的全部句柄。原 Mesh2D 构造／内容 API 保持兼容，显示树遍历不能释放共享设置租约或造成部分网格更新。

旧子树在几何与数值姿态均提交后退役。取消监听器的清理回调可以观察新姿态、发出延后控制或销毁播放器，但不能恢复已经退役的显示对象。已有所有者的监听器清理错误沿用 Engine 诊断路径；意外向外抛出的提交后清理错误使用 `SPINE_INSTANCE_POSTCOMMIT_FAILED`，不回滚语义状态。适配器显式退役所跟踪的内部容器，包括已经脱离的容器。这些情况与发布前故障分别处理。

绑定退役分为两阶段：`beginDispose()` 清除捕获状态并终止节点，不调用清理回调，再返回幂等的监听器清理函数；`dispose()` 执行两个阶段。适配器必须完成每次已经开始的退役。Spine 先将所有活动及退役中的叶节点标记为终态，再允许清理回调递归销毁资源组，并持续跟踪退役记录直到清理结束。因此页面提供者释放资源时不会观察到仍然有效的受管绘制叶节点。

首次完整 PR 检查发现，增加生产者 API 后 Mesh2D 当前声明指纹尚未更新。修复仅在既有有限后继组中更新该文件的源码、生成 JavaScript 与声明身份，历史前驱字节和拒绝规则保持不变。严格编译器消费者也选择精确的新声明与源码，同时保留原诊断位置／错误码、完整闭包和历史观察。这是兼容门禁修复，不增加浏览器或产品验收结论。
