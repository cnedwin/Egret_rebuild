# 纹理场景宿主契约

面向拟议 **0.39.0** 的实验性开发预览。验收和发布仍待完成。本文说明预期的开发者契约，不记录已执行的 CPU/GPU 结果或发布结果。

使用一个显式 WebGPU 宿主，在同一画布先绘制不透明 RGB 3D 场景，再绘制由 Engine 捕获的纹理 2D 覆盖层。当前场景路径支持彩色网格几何和已捕获的变换；完整角色渲染、纹理材质、光照和透明场景排序仍在本预览范围之外。

## API 与初始化

浏览器入口为 `@egret/engine/webgpu/scene3d`，既有 `createSceneWebGPUHost` 继续保留。新增公开契约如下：

```ts
interface TexturedSceneWebGPUHost extends TexturedWebGPUHost, SceneWebGPUHost {
  renderSceneTexturedFrame(
    scene: SceneFrame3D,
    overlay: TexturedRenderFrame2D,
  ): undefined;
}
function createTexturedSceneWebGPUHost(
  options: TexturedWebGPUHostOptions,
): TexturedSceneWebGPUHost;
```

`TexturedWebGPUHostOptions` 使用既有规范类型，并从该入口重新导出。必须设置 `canvas`；`device` 可选择获取设备或借用 `GPUDevice`。既有 `pixelRatio`、`enableReadback`、`onDiagnostic` 和有界准备、上传、读回选项保持原义。纹理选项还包括 `maxSourceTriangles`、`maxFrameGeometryBytes`、`maxPendingGeometryBytes` 和 `maxTupleComparisons`。不新增组合模式选项或独立场景预算选项。无效选项和不可用硬件仍显式报错；该入口不引入自动降级。

使用 `createEngineForProfile({ host }, TEXTURED_FRAME_PROFILE_2D)` 初始化。既有普通、场景、纹理和 Canvas 工厂保留原契约。继承的方法仍可使用，但 `renderSceneFrame` 依然以 `WEBGPU_FRAME_PROFILE_UNSUPPORTED` 拒绝已登记的纹理覆盖层；此组合应调用 `renderSceneTexturedFrame`。导入默认 Engine 入口不会启动 WebGPU。

## 一次捕获与一次组合提交

以下示例假定应用已拥有浏览器 `canvas`，通过真实工厂创建场景和一个简单显示树覆盖层。它是用法示例源码，不是已执行结果。

```ts
import { createEngineForProfile, TEXTURED_FRAME_PROFILE_2D, Sprite } from '@egret/engine';
import { createMatrix4, createMeshGeometry3D, createSceneFrame3D } from '@egret/engine/scene3d';
import { createTexturedSceneWebGPUHost } from '@egret/engine/webgpu/scene3d';

const host = createTexturedSceneWebGPUHost({ canvas, enableReadback: true });
const engine = await createEngineForProfile({ host }, TEXTURED_FRAME_PROFILE_2D);
try {
  const scope = engine.createScope();
  const ui = scope.use(new Sprite());
  ui.graphics.beginFill(0x00ff00).drawRect(8, 8, 12, 10).endFill();
  engine.stage.addChild(ui);
  const geometry = createMeshGeometry3D({
    positions: [-0.5, -0.5, -2, 0.5, -0.5, -2, 0, 0.5, -2],
    colors: [1, 0, 0, 0, 1, 0, 0, 0, 1], indices: [0, 1, 2],
  });
  const scene = createSceneFrame3D({
    projection: { kind: 'orthographic', left: -1, right: 1, bottom: -1, top: 1, near: 1, far: 3 },
    draws: [{ geometry, modelView: createMatrix4([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]) }],
  });
  const overlay = engine.captureTexturedFrame({
    width: 64, height: 48, clearColor: 0x101010, clearAlpha: 1,
  });
  const pixels = host.requestReadback().then(value => ({ value }), error => ({ error }));
  host.renderSceneTexturedFrame(scene, overlay);
  const result = await pixels;
  if ('error' in result) throw result.error;
  console.log(result.value.frameId === overlay.frameId, result.value.serial);
  await host.whenIdle();
} finally {
  await engine.dispose();
}
```

这里应捕获帧，而不是调用 `engine.renderTexturedFrame`，因为后者会单独提交一帧纹理内容。应立即处理读回拒绝，并在组合调用前请求读回。应用需通过自身错误策略保留、报告渲染错误和清理错误。

## 真实帧与输出

`scene` 必须来自公开场景工厂；`overlay` 必须是在相同已加载 SDK 身份图中由 Engine 完成捕获并登记的原帧。形状副本、代理和伪造帧均被拒绝。该方法不负责捕获 UI、获取资源、栅格化文字或重新计算场景 MVP。

尺寸、清屏颜色和 `frameId` 来自 `overlay`。必须**显式设置 `clearAlpha: 1`**；捕获默认值为 `0`。宿主使用已捕获的列主序场景变换和反向深度，再按既有左上角逻辑坐标、显示树画家顺序绘制覆盖层。逻辑尺寸与宿主配置的 `pixelRatio` 决定后备缓冲尺寸。

整个过程由一个表面所有者管理，包含两遍渲染和一次队列提交：场景遍清屏并使用深度；UI 遍加载同一颜色目标，不挂载深度；读回发生在两遍之后。空内容也保留此顺序和深度预留。UI 始终位于场景之上。同步返回值严格为 `undefined`，不证明 GPU 已完成；完成与失败应使用 `whenIdle()` 和既有失败、诊断契约判断。读回 `frameId` 等于 `overlay.frameId`；即使复用捕获帧，宿主共享的 `serial` 仍递增。

## 联合预算，各有含义

整帧存储准入发生在场景、覆盖层有效载荷打包和 GPU 修改之前。缓冲上传共享 `U = S + M + U2`；纹理像素不计入这一缓冲上传计数。

| 分项 | 准入与未退役计费 |
| --- | --- |
| 组合缓冲上传 `U` | `maxUploadBytes`；未退役总量受 `maxPendingUploadBytes` 限制 |
| 场景几何 `S` 与 uniform 存储 `M` | `S <= 4194304`；`M = 64n <= 4096`；未退役上限分别为 `8388608` 和 `8192` |
| 场景深度 `D` | `D = 4WH <= 16777216`；未退役上限 `33554432`，空场景也计费 |
| 纹理源几何 `G` | `maxFrameGeometryBytes`，硬上限 `16777216`；`maxPendingGeometryBytes`，硬上限 `33554432` |
| 投影纹理像素 `T` | 单帧上限 `16777216`；未退役上限 `33554432`，与 `U` 分开 |
| 被选中的读回 `R` | `rowPitch = 256 * ceil(4W / 256)`；`R = rowPitch * H + 4WH`；`maxReadbackBytes` 同时约束所选读回和未退役读回存储 |

`W`、`H` 是通过准入的后备缓冲尺寸，`n` 是场景绘制数量。既有场景元数据、准备工作量、硬件和未退役帧数量限制也继续适用。这些分项属于同一条未退役记录，不是进程或 GPU 总内存测量。`getStatus()`、`getTexturedStatus()` 和 `getSceneStatus()` 分别暴露同一所有者的既有分项。较早的场景硬件准入仍优先于后续覆盖层、联合检查。

## 拒绝与关闭

宿主状态优先于重入和输入认证：new/starting 对应 `WEBGPU_NOT_STARTED`，stopped 对应 `WEBGPU_STOPPED`，closing/closed 对应 `WEBGPU_CLOSED`，failed 对应 `WEBGPU_FAILED`。仅 active 状态继续；已有执行占用时返回 `WEBGPU_REENTRANT`。先认证场景身份，再认证覆盖层身份。无法归类的当前准备异常映射为携带原始原因的 `WEBGPU_FRAME_INVALID`；并发状态变化优先于该异常。

正常准入拒绝不改变序号、计费、画布或 GPU，已请求的读回 ticket 保持未绑定，可供后续准入帧使用。停止、关闭或终止性失败仍可取消它。提交工作进入已提交状态后，已经尝试的写入和同步编码失败按既有所有者规则等待 fence 并清理；序号、计费不会回滚成“从未尝试”。

一个 Engine 保留该画布。捕获帧不新增 Engine/Scope 归属限制：显示对象、资源的所有权在捕获时执行约束，真实完成值在生产它的 Scope 关闭后仍可使用。Scope 清理先触发取消，再按获取的反序释放。Engine 销毁会立即拒绝新捕获，随后先关闭 Scopes、Stage 和资源，再停止、关闭宿主；清理回调仍可在该宿主处于 active 时提交此前快照。

`close()` 同步改变状态，复用同一个关闭 Promise，取消未绑定 ticket，并等待启动、当前 CPU 工作和已接受 GPU 工作。未完成 fence 在退役前持续计费。终止清理即使不安全，也可能释放账面计费：**计数归零不证明安全关闭或安全归还表面、设备所有权**。不安全关闭以 `WEBGPU_CLOSE_UNSAFE` 拒绝，并保留失败原因。借用设备继续属于调用者，宿主不会销毁它。

## 后续范围与出处

本契约为 Egret 原创工程文档；第三方依赖及其许可证继续分别记录。它不声明性能、实体设备、原生运行时或完整产品验收。完整 UI、资源与动画、更广的 3D 与平台宿主、工具能力、AI 工具和迁移 `R008/V006` 仍是独立工作。FullSpine `R020/V020` 继续保持 **OPEN**。

<!-- CHOST-ACTUAL-BROWSER-SUCCESSOR -->
**实际浏览器后继：**默认无头 Edge **155.0.4283.45** 完成 **2** 幅真实捕获帧。全部 **24** 个固定像素（每幅 **12** 个）与精确 RGBA 预期一致；每份 **16384** 字节的归一化缓冲保存在共享记录中。将首幅覆盖预期用于第二幅缓冲，在 **(34, 32)** 拒绝了变化后的 UI 顺序，未增加渲染帧。Host 安全关闭、资源／Scope／租约／Engine 清理、应用销毁设备以及浏览器协作式关闭均通过。此处仅验收有限合成能力；操作系统进程退出、实体硬件、手机、性能、完整 3D 和完整 Spine 仍需独立验收。完整 prepush 与 GitHub 交付在本后继截止点仍为 PENDING。
