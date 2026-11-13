# Spine 资源 RESET 替换槽

[English](../../en/docs/spine-reset-slot.md) | 中文

本次有限 M2.4 增量以明确的 **reset** 策略，用新资源版本替换一个 Spine 显示对象。加载、语义准备与取消期间保留活跃玩家和显示；CPU 发布使用现有真实候选子树事务。GPU 暂存、提交与完成仍由应用分别操作。第二种请求 [`requestPreserving`](#保留播放) 在替换时保留播放。本功能不代表 M2.4 完整验收或恢复。

## 公开流程

可选构建入口 `@egret/spine` 新增 `createSpineResetSlot` 及六个仅类型名称：`SpineResetInitial`、`SpineResetRequest`、`SpineResetState`、`SpineResetActive`、`SpineResetTicket`、`SpineResetSlot`。默认 Engine 导入及无 DOM/Node 的依赖方向保持不变。

~~~js
const slot = createSpineResetSlot(engine, owner, target, {
  version: 'first', instance: oldPlayer, display: oldDisplay,
});
const request = slot.request({
  policy: 'reset', version: 'second', loader: nextLoader,
  assetId: 'e_character', animation: 'walk', skins: ['default'], plays: 2,
  onEvent: event => consumeGameplayEvent(event),
});
await request.ready; // 仅 CPU 资源与重置姿态就绪，不代表上传就绪
const frame = request.capture({width: 640, height: 360});
const upload = host.stageSharedFrame(frame);
try {
  await upload.ready;
  request.commit(); // CPU 发布；自有前代在此退休
  const submitted = upload.submit();
  await submitted.completed;
} catch (error) {
  upload.dispose();
  request.dispose(); // 提交后无操作，不能回滚已发出的绘制
  throw error;
}
// 后续真实 Engine tick 由应用明确传入。
slot.getActive().instance.advance(tick);
~~~

target 必须是真实、同一 Engine、已连接 Stage、由 Scope 直接拥有的普通容器，且初始真实 display.node 是其唯一子节点。初始显示和玩家必须匹配且存活。共同位置、裁剪与透明度应设在 target 上；重置不复制旧显示节点变换或播放控制。每个目标最多一个槽。外部拓扑改变会拒绝后续使用。底层候选子树准入仍有最终效力，包括托管 UI、重叠及所有权限制。

请求必须包含字面值策略 `reset`、长度 1–128 的应用版本标签、真实同 Engine loader、长度 1–512 的资源 ID 及长度 1–1024 的精确动画名。根入口 loader 与真实浏览器 loader 均可使用，结构仿造对象会被拒绝。标签仅用于显示，不标识缓存条目、不授予资源所有权，也不替代 Host 代次；资源由真实 loader/asset 身份决定。

本固定范围从轨道零启动指定动画。可选 `skins` 包含 1–32 个互不重复的精确名称；省略时选择隐式默认设置。`loop` 与 `plays` 沿用现有播放准入；plays 为 1–1024，不能与 loop 同时提供，零时长动画仅接受一次。未知名称在加载后、活跃发布前拒绝。不保留其他控制、轨道历史、队列、速率、暂停或 seek 状态。新玩家采用普通默认分段/事件上限。选项使用自有数据描述符；畸形输入或重入准入不会替代已接受的有效请求。

## 时间、事件与最终窗口

私有全新实例初始化在零时刻应用指定皮肤和动画，求值重置姿态并消费 Core 初始游标。不提供伪造 GameClockTick，也不安装时钟订阅。准备零时刻的 start、创作事件及 complete 均被抑制，后续不会重放。零时长单次候选已消费完成通知；正时长有限播放的初始完成次数为零。后续首次显式 advance 接受调用者更高的 tick ID 并正常消费该 tick 的 delta；不消费旧玩家时间，也不虚构追赶 delta。现有普通实例的播放和事件行为不变。

`ready` 表示候选组、语义姿态与离线显示已就绪。慢速加载期间旧目标可以继续推进。`capture` 调用 `Engine.prepareDisplaySubtree` 与 `Engine.capturePreparedDisplaySharedFrame` 开始有限最终窗口，返回真实不可变共享帧，每个请求最多成功一次。候选准备不会发出游戏回调。捕获后旧目标内容/动画或被记录的祖先变化会使 CPU 提交失效；无关兄弟内容仍可继续。应用决定这段短窗口内针对目标的时钟策略，不会自动暂停全局时钟。

捕获失败会关闭候选；过期提交保留旧活跃内容，请求在显式销毁前维持 prepared。取消并重新请求可获得新快照。已捕获帧在取消或退休后仍是普通快照；槽不承诺较晚的兄弟实时姿态与较早的捕获帧一致。

## 所有权与取消

槽借用 target、初始玩家/显示/组、传入 Scope 及所有传入 loader，永不销毁这些借用对象。每个接受的候选获得新的 Engine Scope，持有其新加载组、实例、显示和 CPU ticket。每槽最多一个当前待提交候选。新接受的意图取消上一候选；无效准入保留上一候选。迟到异步结果只能清理自己的候选，不能覆盖最新意图。共享请求仍受现有 loader 组数、实例数、资源来源和 AssetManager 容量约束；没有第二套管理器或调度器。

CPU 提交成功后，先把新活跃引用和 ticket 状态发布为 committed，再调用清理。槽自有前代 Scope 自动关闭；初始借用前代仍存活，由调用者决定退休。其他共享消费者保留自己的组租约。现有不可变帧/页及 Host 保留机制支持自有退休后的旧帧重放，不积累公开退休代队列。

普通 provider 或监听器清理失败沿用 Engine 清理诊断，不回滚 committed 活跃状态。诊断观察者可销毁槽；发布/清理期间重入替换准入会被拒绝。意外逃逸的提交后清理异常报告 `SPINE_RESET_POSTCOMMIT_FAILED`，ticket 仍保持 committed；不得重试该 CPU 提交或重放游戏事件。异步提交前清理失败保留原始 cause，并结束 readiness，不遗留被忽略的拒绝 Promise。

Ticket 状态包括 loading、ready、prepared、committed、cancelled、failed。销毁幂等，只取消未提交请求，不取消独立 Host upload。槽/owner 关闭时取消待定需求并退休当前自有内容；初始借用内容仍由调用者拥有。单独关闭借用 loader/group 仍保留其原有的实例退休权限。

## 保留播放

`slot.requestPreserving({version, loader, assetId, onEvent?})` 替换资源，并保留播放器正在做的事。票据与 `request` 的相同：`ready`、一次 `capture`、`commit`、`dispose`。本页关于加载、最终窗口、所有权、取消和 Host 的全部内容照常适用，不同的只是候选的起点。

**保留什么。**每条轨道上正在播放的动画、它仍在混合退出的动画，以及其后排队的动画，各自的位置、循环或剩余播放次数、延迟和混合时长。进行中的混合从当前位置继续：已经进行到哪里、每个被混合的旋转朝哪个方向转，以及某个条目针对后续条目所保持的内容；以及选中的皮肤、速率、暂停、`setTransform` 设置的位置，和播放器最后接受的 tick。新播放器的快照具有旧播放器的轨道、皮肤、速率、状态、tick 和已播放时间。其 revision 为旧值加一，events 为空。

**新资源必须匹配什么。**每个被保留的动画（包括只是正在混合退出的动画）必须以相同名称存在，长度相同，并在相同时间有相同名称的事件。每个选中的皮肤必须以其名称存在。除此之外不做比较：骨骼、插槽、附件、动作本身、事件携带的值，以及所有未在播放或排队的动画都可以不同。无法延续播放的资源会让请求以 `SPINE_RESET_PRESERVE_ANIMATION` 或 `SPINE_RESET_PRESERVE_SKIN` 失败，活跃播放器保持不变。

**何时取得播放状态。**在最终窗口，即 `capture` 时。候选加载期间播放器可以继续推进，也可以改变播放内容；候选从捕获时播放器所处的位置接续。资源会对照播放状态判断两次：加载完成时判断一次，让没有希望的请求尽早失败；`capture` 时再判断一次，以这一次为准。`capture` 失败会关闭候选，与 reset 相同。

**何时无法保留。**只能在两次推进之间。播放器有尚未应用的命令，或处于故障状态时，请求在被接受之前以 `SPINE_RESET_PRESERVE_STATE` 被拒绝；已接受的请求如果在 `capture` 时遇到这种状态，也以该错误失败。被拒绝的请求不会取代等待中的请求。下一次推进之后再次请求即可。

**事件。**旧播放器已经送达的内容不会再次送达：已在播放的动画的开始、位置之前的事件、已完成的循环都不会。新播放器的第一次推进从保留的位置继续，把之后的内容送给请求里的监听器。事件携带新资源为它编写的值。除非应用继续推进旧播放器，其监听器不再收到任何内容。

**不保留的内容。**物理约束从重置姿态开始。已经结束的动画留在骨骼或插槽上的值不保留：新播放器的姿态由正在播放和正在混合的动画决定。条目的混合表由运行时针对新骨架重建，但条目被要求保持的那些“保持”会被保留。

保留后的播放器对照它所替换的播放器进行检查。`packages/spine/test/preserve.test.mjs` 用相同的 tick 和命令同时推进两者，原播放器使用旧资源，副本使用新资源，并要求每个 tick 的轨道和事件都相等：在事件和循环结束点附近的 28 个位置分别替换后，以及在 16 次各 260 步、双向反复替换的随机运行中，均是如此，其中包含进行中的混合。使用相同资源时，骨骼和插槽姿态也必须与原播放器相同。对于混合，这一点逐 tick 检查：七种混合（单个混合、打断另一个混合的混合、同时三个、绕远路的旋转、带队列的两条轨道、最旧条目消失后仍被保持的内容、混合到空），每种在从第一个 tick 到结束之后的九个时刻分别替换，每次替换后比较 50 个 tick，途中再开始一个新的混合；另有一个混合在 40 个 tick 的每一个上都被替换，每个副本都由前一个副本产生。向这条路径的构建产物写入二十个错误，发现十九个，剩下的一个丢掉的是姿态应用会重新算出的值。[`examples/spine-reset`](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/spine-reset/README.zh-CN.md) 的页面里有这个操作；其 `verify-preserve.mjs` 于 2026-11-14 在软件渲染的无头 Chromium 153 上通过 WebGL2 的九项检查，其中包括：新版本画在保留了时间的身体所在的位置，而不是从头开始时所在的位置。**这条路径尚未在 WebGPU、硬件 GPU 和手机上运行**：该机器的软件 WebGPU 适配器在这个示例启动时即丢失设备，与本次改动无关。

## Host 边界与验证

只有真实 Host upload ticket 能证明其上传就绪和真实设备代次。CPU ready 和 CPU commit 都不呈现像素。原生 submit 可能在发出绘制后抛错，因此不保证任意提交失败均能回滚。应用销毁未使用的 upload，并区分上传就绪、CPU 提交、submit 和完成。有界的[应用恢复流程](spine-recovery-integration.md)现已协调真实 Host 丢失与替换意图，不重置活动 CPU 玩家。CPU 槽本身不拥有设备恢复或跨域原子性。多槽原子替换及 M2.4 完整验收仍 OPEN。未处于混合中的播放已可[保留状态替换](#保留播放)。

[普通双版本例子](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/spine-reset/README.zh-CN.md)使用原创程序化几何及原生传输/PNG 解码。2026-11-04 的 22 个新增公开行为案例覆盖生命周期、精确名称拒绝、最新意图、旧姿态/事件保留、共享兄弟、过期快照、静默零时刻/有限播放初始化和清理重入。五个无抑制严格 ES-only 类型拒绝在每次全新正向基线后记录精确诊断位置/代码。默认有界面 Edge 156.0.4314.58、Playwright 1.62.1、Node 26.7.0 的 WebGPU 与 WebGL2 均通过：每图五个字面量像素点、每通道允许一个码值误差，以及取消/失败/过期、CPU/Host 分别发布、自有退休、保留帧重放、错误版本拒绝和完整逻辑清理。实际数量与工件身份见例子的便携摘要。

早期浏览器失败被保留：默认标题外边距使画布出现小数起点，截图高度为 49 而非 48；明确整数排版后修复。初版过期演示持有 upload 时等待 Host idle，触发真实十秒过期；现改为只推进 CPU、观察过期拒绝、销毁 upload 后再呈现。这些是保留的失败观察，不计为通过。

源码、集中执行、实际浏览器证据、独立审查、完整保护 CI 和 main 交付分别记录。稳定授权 Editor 导出、完整物理/约束/事件资格、原生/手机验收和 M1.2 性能仍 OPEN；M1.2 的 10.3 ms 对 8 ms 目标保持不变。适配器、检查、文档和几何素材均为 AI 辅助独立编写，采用 Apache-2.0；已有单独许可 Core 4.3.13 及原始许可证不变。

## 应用恢复接入

[普通恢复流程](spine-recovery-integration.md) 现把此 CPU-only slot 与既有真实 Host generation 票据协调起来，增加有界应用恢复；不扩展 slot，也不承诺跨领域回滚，完整 M2.4 仍 OPEN。
