# Spine 资源 RESET 替换槽

[English](../../en/docs/spine-reset-slot.md) | 中文

本次有限 M2.4 增量以明确的 **reset** 策略，用新资源版本替换一个 Spine 显示对象。加载、语义准备与取消期间保留活跃玩家和显示；CPU 发布使用现有真实候选子树事务。GPU 暂存、提交与完成仍由应用分别操作。本功能不代表 M2.4 完整验收、保留状态的替换或恢复。

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

## Host 边界与验证

只有真实 Host upload ticket 能证明其上传就绪和真实设备代次。CPU ready 和 CPU commit 都不呈现像素。原生 submit 可能在发出绘制后抛错，因此不保证任意提交失败均能回滚。应用销毁未使用的 upload，并区分上传就绪、CPU 提交、submit 和完成。有界的[应用恢复流程](spine-recovery-integration.md)现已协调真实 Host 丢失与替换意图，不重置活动 CPU 玩家。CPU 槽本身不拥有设备恢复或跨域原子性。多槽原子替换、跨版本保状态替换及 M2.4 完整验收仍 OPEN。

[普通双版本例子](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/spine-reset/README.zh-CN.md)使用原创程序化几何及原生传输/PNG 解码。2026-11-04 的 22 个新增公开行为案例覆盖生命周期、精确名称拒绝、最新意图、旧姿态/事件保留、共享兄弟、过期快照、静默零时刻/有限播放初始化和清理重入。五个无抑制严格 ES-only 类型拒绝在每次全新正向基线后记录精确诊断位置/代码。默认有界面 Edge 156.0.4314.58、Playwright 1.62.1、Node 26.7.0 的 WebGPU 与 WebGL2 均通过：每图五个字面量像素点、每通道允许一个码值误差，以及取消/失败/过期、CPU/Host 分别发布、自有退休、保留帧重放、错误版本拒绝和完整逻辑清理。实际数量与工件身份见例子的便携摘要。

早期浏览器失败被保留：默认标题外边距使画布出现小数起点，截图高度为 49 而非 48；明确整数排版后修复。初版过期演示持有 upload 时等待 Host idle，触发真实十秒过期；现改为只推进 CPU、观察过期拒绝、销毁 upload 后再呈现。这些是保留的失败观察，不计为通过。

源码、集中执行、实际浏览器证据、独立审查、完整保护 CI 和 main 交付分别记录。稳定授权 Editor 导出、完整物理/约束/事件资格、原生/手机验收和 M1.2 性能仍 OPEN；M1.2 的 10.3 ms 对 8 ms 目标保持不变。适配器、检查、文档和几何素材均为 AI 辅助独立编写，采用 Apache-2.0；已有单独许可 Core 4.3.13 及原始许可证不变。

## 应用恢复接入

[普通恢复流程](spine-recovery-integration.md) 现把此 CPU-only slot 与既有真实 Host generation 票据协调起来，增加有界应用恢复；不扩展 slot，也不承诺跨领域回滚，完整 M2.4 仍 OPEN。
