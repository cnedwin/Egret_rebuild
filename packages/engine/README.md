# @egret/engine

[English](README.en.md) | 简体中文

## 0.13.0 WebGPU矩形本地检查点 — 2026年10月9日

显式 `@egret/engine/webgpu` 入口同步执行不可变 `RenderFrame2D` 矩形命令。根入口保持无DOM；`@egret/engine/web`保持Canvas-only，实际请求不包含WebGPU或robust-predicates模块。无DOM准备层通过公共 `orient2d` 接入精确固定的基础依赖robust-predicates 3.0.3，适用Unlicense。复制、有界交点构造、打包、WGSL及宿主生命周期属于独立编写的第一方代码。见[完整0.6合同](../../knowledge-base/docs/WebGPU矩形执行合同.md)、[实施计划](../../knowledge-base/docs/WebGPU矩形实施计划.md)与[有限证据](../../knowledge-base/docs/WebGPU矩形实现证据.md)。

已接受的桌面构建记录177/177 CPU/mock/核心检查、28项预期负类型诊断及123个边界文件；独立真实WebGPU门禁记录42帧、1709项原始断言、84张截图、6808项合成断言、8项预期反例及0项意外错误。其中7项变异实际生产代码副本，1项仅为合成断言。实际结果与有限独立实现审阅由[验证](../../verification/webgpu-verification.json)与[审阅](../../verification/webgpu-review.json)绑定已接受的源码身份；文档整合没有重跑这些检查。

本experimental检查点记录于2026-10-08T21:23:54.294Z最终原生运行之前，核心/headless与桌面Canvas结果分别记录。随后仅注释入口重建的真实浏览器WebGPU运行在 `1aa0248a1ff6d8e54c42d631072223bb50483814`、2026-10-08T21:23:54.294Z以0退出并记录PASS：42帧、1709项原始断言、84张PNG截图、6808项合成断言、8项预期反例及0项意外错误。7项反例变异生产代码副本，1项为合成断言。233项源码/构建/工具/依赖清单身份在该运行前后相等，且与当前仅文档和元数据变更的后继版本一致。实际运行由验证作者执行；独立修正及原生绑定复审、最终语义凭据和发布仍待完成。浏览器WebGPU与Native App/SDK分别验收；截图合成不证明实体扫描输出、硬件加速、手机或性能。纹理/文字/UI/动画/3D、编辑器/Agent创作、CI、完整迁移与完整产品仍待实施或验收；R008/V006及V003保留既有义务。下文0.9–0.12历史记录保留原日期、身份与结果范围。


## 历史0.12.0显示与帧候选范围

后续工作包按[显示与帧合同](../../knowledge-base/docs/显示与帧执行合同.md)及[实现计划](../../knowledge-base/docs/显示与帧执行实现计划.md)推进：显示变换、继承可见性/透明度与本地矩形裁剪、Sprite 所属 Graphics 的矩形填充，以及不可变 CPU 帧捕获/提交。首个已实现执行适配器为独立 @egret/engine/web 入口的 Canvas，核心根入口保留无 DOM 边界。限定实现检查已通过：97/97核心行为测试、25项负类型诊断及真实桌面Canvas像素/指针交互。跨realm拒绝修正后有限独立审阅通过；远端发布另行记录。最终限定结果由[实现记录](../../knowledge-base/docs/显示与帧执行实现记录.md)和[验证](../../verification/display-frame-verification.json)承载。

captureFrame 仅提取快照，renderFrame 另向创建时固定的同步宿主端口提交；没有渲染端口时前者仍可用，后者拒绝。帧读取/执行期间禁止重入；关闭立即进入 closing，但清理等待帧调用退出。Canvas 的 DOM 类型与执行隔离在 web 子入口，根入口不重导出该适配器。

本包不验收完整文本/纹理/动画/UI/3D 执行、GPU 或 Native 支持、目标设备性能、编辑器、Agent 服务或完整迁移。此前 headless、CPU 资源与第三方研究记录保留原版本、数量、hash 和范围，不转为新显示帧验收。

experimental公共门面；内部依赖runtime与contracts，WebGPU准备另有精确外部robust-predicates 3.0.3依赖。输入为显式HostAdapter、可选正整数关闭deadline与诊断回调，输出为Engine及其Stage、Scope、assets服务和唯一关闭Promise。Engine管理逻辑生命周期与surface预留，宿主管理物理资源和安全归还事实。

createEngine在等待host.start前预留surface，启动失败也进入清理。关闭先等待当前帧调用退出，再处理Scope与Stage，再关闭CPU资产管理器、停止host并有界等待close。只有close成功才释放surface；超时或拒绝保持隔离，迟到成功可以释放预留。核心不销毁借用的surface/device，本切片没有强制释放或恢复入口。

Scope或Stage清理失败仍继续后续步骤；EgretError保留原cause与按顺序收集的cleanupErrors。根导出只包含已实现的切片能力，内部装配口不导出。

根目录验证为`node tools/verify.mjs`，联动样例为`node examples/headless.mjs`与`node examples/assets.mjs`。设计见[知识库](../../knowledge-base/README.md)，来源见[来源记录](../../source-origin.json)。包保留`private: true`以防止意外npm发布，第一方代码与本文采用[Apache-2.0](../../LICENSE)。

当前显示/帧公共API：DisplayObject的x/y、scaleX/scaleY、rotation、alpha、visible与clipRect；Sprite.graphics拥有矩形填充；Engine.captureFrame/renderFrame产生/提交不可变RenderFrame2D。独立`@egret/engine/web`导出createCanvasHost，根入口保持无DOM。接口为实验性质，完整文字/纹理/动画/UI/3D尚未实现。

## 公共WebGPU使用

`canvas`为HTMLCanvasElement。可选readback绑定下一次通过预检的帧；`renderFrame`同步返回undefined。`result.bytes`为调用者所有的预乘RGBA，不是浏览器合成结果。`whenIdle`仅截取已提交工作；只有`close`成功才证明安全归还，Engine包装保留原cause。见[示例](../../examples/webgpu/README.md)。

```ts
import { createEngine, Sprite } from '@egret/engine';
import { createWebGPUHost } from '@egret/engine/webgpu';

const host = createWebGPUHost({ canvas, enableReadback: true });
const engine = await createEngine({ host });
const rect = new Sprite();
rect.graphics.beginFill(0x00ff00).drawRect(4, 4, 16, 16);
engine.stage.addChild(rect);
const pixels = host.requestReadback();
engine.renderFrame({ width: 48, height: 40, clearColor: 0, clearAlpha: 0 });
const result = await pixels;
await engine.dispose();
```
