# 新白鹭 Egret Rebuild

[English](README.en.md) | 简体中文

## 0.13.0 WebGPU矩形本地检查点 — 2026年10月9日

显式 `@egret/engine/webgpu` 入口同步执行不可变 `RenderFrame2D` 矩形命令。根入口保持无DOM；`@egret/engine/web`保持Canvas-only，实际请求不包含WebGPU或robust-predicates模块。无DOM准备层通过公共 `orient2d` 接入精确固定的基础依赖robust-predicates 3.0.3，适用Unlicense。复制、有界交点构造、打包、WGSL及宿主生命周期属于独立编写的第一方代码。见[完整0.6合同](knowledge-base/docs/WebGPU矩形执行合同.md)、[实施计划](knowledge-base/docs/WebGPU矩形实施计划.md)与[有限证据](knowledge-base/docs/WebGPU矩形实现证据.md)。

已接受的桌面构建记录177/177 CPU/mock/核心检查、28项预期负类型诊断及123个边界文件；独立真实WebGPU门禁记录42帧、1709项原始断言、84张截图、6808项合成断言、8项预期反例及0项意外错误。其中7项变异实际生产代码副本，1项仅为合成断言。实际结果与有限独立实现审阅由[验证](verification/webgpu-verification.json)与[审阅](verification/webgpu-review.json)绑定已接受的源码身份；文档整合没有重跑这些检查。

本experimental检查点记录于2026-10-08T21:23:54.294Z最终原生运行之前，核心/headless与桌面Canvas结果分别记录。随后仅注释入口重建的真实浏览器WebGPU运行在 `1aa0248a1ff6d8e54c42d631072223bb50483814`、2026-10-08T21:23:54.294Z以0退出并记录PASS：42帧、1709项原始断言、84张PNG截图、6808项合成断言、8项预期反例及0项意外错误。7项反例变异生产代码副本，1项为合成断言。233项源码/构建/工具/依赖清单身份在该运行前后相等，且与当前仅文档和元数据变更的后继版本一致。实际运行由验证作者执行；独立修正及原生绑定复审、最终语义凭据和发布仍待完成。浏览器WebGPU与Native App/SDK分别验收；截图合成不证明实体扫描输出、硬件加速、手机或性能。纹理/文字/UI/动画/3D、编辑器/Agent创作、CI、完整迁移与完整产品仍待实施或验收；R008/V006及V003保留既有义务。下文0.9–0.12历史记录保留原日期、身份与结果范围。


## 历史0.12.0显示与帧候选范围

后续工作包按[显示与帧合同](knowledge-base/docs/显示与帧执行合同.md)及[实现计划](knowledge-base/docs/显示与帧执行实现计划.md)推进：显示变换、继承可见性/透明度与本地矩形裁剪、Sprite 所属 Graphics 的矩形填充，以及不可变 CPU 帧捕获/提交。首个已实现执行适配器为独立 @egret/engine/web 入口的 Canvas，核心根入口保留无 DOM 边界。限定实现检查已通过：97/97核心行为测试、25项负类型诊断及真实桌面Canvas像素/指针交互。跨realm拒绝修正后有限独立审阅通过；远端发布另行记录。最终限定结果由[实现记录](knowledge-base/docs/显示与帧执行实现记录.md)和[验证](verification/display-frame-verification.json)承载。

本包不验收完整文本/纹理/动画/UI/3D 执行、GPU 或 Native 支持、目标设备性能、编辑器、Agent 服务或完整迁移。此前 headless、CPU 资源与第三方研究记录保留原版本、数量、hash 和范围，不转为新显示帧验收。

新白鹭面向主要依靠 AI 制作游戏的新创作者，首期目标是复杂 2D UI 与轻量 3D。渲染与运行时、可持续编辑的工程、Agent 协作工具和完整旧工程迁移共同构成产品方向。代码、双语文档、测试与可公开验证记录从开发阶段持续维护。

此前0.12.0为限定显示帧本地候选，公开仓库目标是 [cnedwin/Egret_rebuild](https://github.com/cnedwin/Egret_rebuild)。本预览的远端提交状态另行记录，没有已发布 npm 包。第一方代码与文档采用仓库原有 [Apache-2.0](LICENSE)，第三方保留各自声明；包继续保持 `private: true`，接口为 experimental。

## 已实现的核心

| 包 | 当前职责 | 依赖 |
| --- | --- | --- |
| `@egret/contracts` | 取消、同步清理、诊断与 headless 宿主端口 | 无 |
| `@egret/runtime` | Scope、显示树、类型化同步事件、CPU 资源引用/共享获取/独立租约 | contracts |
| `@egret/engine` | 实例与资产服务装配、surface 预留、启动和有界关闭 | contracts、runtime；WebGPU准备显式依赖robust-predicates 3.0.3 |

公共入口为 `@egret/engine`。核心不依赖 DOM/Node 全局，导入不启动宿主。新的 `engine.assets` 把等待取消与已交付租约的使用期分开：一个调用取消不会影响其他等待者，代际失效只切换后续获取，旧租约在释放或管理器关闭前仍可使用。Scope 和 Engine 负责退出期间的清理。见[资源合同](knowledge-base/docs/资源核心合同.md)与[实现记录](knowledge-base/docs/资源核心实现记录.md)。

这段服务管理 provider 返回的 CPU 值，网络与解码由相应 provider 提供。GPU纹理上传/在途回收、完整GPU渲染后端、字体/动画/3D产品执行链、真实小游戏/Native、迁移器、编辑器和 Agent 服务尚未完成。研究中的第三方图形链与自有产品代码分别登记。

## 运行与验证

固定工具：Node.js 24.19.0、pnpm 11.25.0、TypeScript 7.0.2。从根目录执行：

```text
pnpm install --frozen-lockfile --ignore-scripts
node tools/verify.mjs
node examples/headless.mjs
node examples/assets.mjs
node tools/prepush.mjs
```

历史 CPU 资源切片验收见[资源核心验证](verification/asset-core-verification.json)；此前 [44 项 headless 检查](verification/headless-verification.json)与[双语修订记录](verification/bilingual-publication-verification.json)保留其历史版本和范围。历史CPU资源验证不代表GPU、设备性能、CI或完整产品验收。

每次推送执行[双语与公开检查](knowledge-base/docs/双语文档与推送前检查.md)，同步中文/英文阅读版本、登记状态与关键代码英文注释。新增核心按自有合同独立编写，历史源码/规格 hash 和当前修订身份分别保留，见[来源记录](source-origin.json)。

[知识库](knowledge-base/README.md) · [全部双语文档](DOCUMENTATION.md) · [贡献指南](CONTRIBUTING.md) · [鸣谢](ACKNOWLEDGEMENTS.md) · [发行说明](PUBLICATION.md)

当前显示/帧公共API：DisplayObject的x/y、scaleX/scaleY、rotation、alpha、visible与clipRect；Sprite.graphics拥有矩形填充；Engine.captureFrame/renderFrame产生/提交不可变RenderFrame2D。独立`@egret/engine/web`导出createCanvasHost，根入口保持无DOM。接口为实验性质，完整文字/纹理/动画/UI/3D尚未实现。

本地检查点与知识库目标版本为0.13.0；私有实验包版本继续保持0.0.0。

## 公共WebGPU使用

`canvas`为HTMLCanvasElement。可选readback绑定下一次通过预检的帧；`renderFrame`同步返回undefined。`result.bytes`为调用者所有的预乘RGBA，不是浏览器合成结果。`whenIdle`仅截取已提交工作；只有`close`成功才证明安全归还，Engine包装保留原cause。见[示例](examples/webgpu/README.md)。

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
