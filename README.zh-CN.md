# 新白鹭 Egret Rebuild

[English](README.md) | 简体中文

新白鹭是面向全球开发者的开源重建工程，为主要依靠 AI 制作游戏的创作者构建新的游戏引擎与创作流程。首期产品方向涵盖复杂 UI 的 2D 游戏与轻量 3D 游戏；渲染与运行时、可持续编辑的工程、Agent 协作工具与旧白鹭工程迁移共同构成这一方向。

仓库当前包含实验性核心与工程知识库，当前工程预览为 0.19.0。完整引擎、生产宿主、编辑器、Agent 服务、目标设备性能与完整旧工程迁移仍待实施或验收。工作区包保持 private、版本 0.0.0，协议固定值保持 1.0。

欢迎世界各地的开发者参与核心实现、可复现反例与修复、文档与翻译、接口提案，以及自有或获授权的游戏与迁移样本。请先阅读[贡献指南](CONTRIBUTING.zh-CN.md)、[工程知识库](knowledge-base/Cns/README.md)与[来源记录](source-origin.json)。第一方代码与文档采用 [Apache-2.0](LICENSE)，第三方依赖与资产保留各自声明和归属。

最新已确认的 GitHub 交付检查点为 PR2 的 [`fd4ad89`](https://github.com/cnedwin/Egret_rebuild/commit/fd4ad89)。这只确认该检查点已交付远端，不代表 npm 发行或完整产品验收。下列工程记录保留原编写检查点的范围与状态，包括更早的 HOLD_HTTP_403 交付尝试；这些早期尝试不代表最新已确认的 PR2 交付状态。

## 当前本地工程增量：0.19.0

阅读已实施的[Bitmap 区域契约](knowledge-base/Cns/docs/bitmap-region-contract.md)和[CPU 证据](knowledge-base/Cns/docs/bitmap-region-evidence.md)、[纹理首四项采集](knowledge-base/Cns/docs/texture-first-four-evidence.md)，以及[可复现的 B1 浏览器验证器](knowledge-base/Cns/docs/b1-browser-verifier.md)。Bitmap 专项检查通过 113/113。公开 B1 命令记录 7 帧正例、5 项反例、11 次绘制和 8214 项字面量比较；有界保存产物的独立复核已接受。纹理采集完整性已接受，数值边界为 UNKNOWN，完整 A2 未完成。

本证据整理不包含后继完整 prepush，推送前必须另行通过新检查。可见 Bitmap 序列播放、设备／性能／完整迁移门禁仍开放。这是本地工程标签，不是发行版本，包 0.0.0／协议 1.0 不变；此前记录保留各自日期、身份和范围。

## 历史本地工程预览：0.18.0

新增单个具名旧 MovieClip 的有界 CPU 转换，保留图集裁剪、显示偏移和作者持续段时间；28/28 专项测试通过，输出已由真实序列帧工厂重新准入。阅读[契约](knowledge-base/Cns/docs/legacy-movieclip-contract.md)、[证据](knowledge-base/Cns/docs/legacy-movieclip-evidence.md)和[精简记录](knowledge-base/evidence/legacy-movieclip-focused.json)。API 保持内部使用，图片读取、解码和播放仍未验证。

0.17.0 及更早结果保留为各自源码身份下的历史证据。此次增量的默认模式、全仓回归和完整 prepush 未运行；当前浏览器／设备像素、性能及完整 R008/V006 迁移仍待验收。0.18.0 是本地工程标签，包 0.0.0／协议 1.0 不变；GitHub 交付继续保持 HOLD_HTTP_403。

## 历史本地工程预览：0.17.0

本预览新增自有 CPU 场景快照、固定网格辅助函数、有界 B1 宿主源码／模拟整合、CPU 序列帧采样与纯 RES 转换意图。阅读[CPU 场景](knowledge-base/Cns/docs/3d-cpu-scene-contract.md)、[网格](knowledge-base/Cns/docs/3d-webgpu-mesh-contract.md)、[宿主](knowledge-base/Cns/docs/b1-host-contract.md)、[序列帧](knowledge-base/Cns/docs/sequence-clip-contract.md)及[RES 意图](knowledge-base/Cns/docs/legacy-res-plan-contract.md)与配对证据。这些接口保持内部使用；公开入口与包 0.0.0／协议 1.0 不变。

已记录默认宿主验证通过 13/13 项，CPU 序列帧采样通过 25/25，RES 意图规划通过 14/14。所选整仓运行通过 901/901 项测试、编译、282 个边界文件及类型门禁；901 项包含宿主回归。源码绑定、仅格式后继及保留的早期失败见[配对宿主证据](knowledge-base/Cns/docs/b1-host-evidence.md)。此次文档采用未重跑产品检查。

GitHub 交付因已记录的 403 响应保持 HOLD；当前文档最终审阅与完整 prepush 仍待完成。此前 0.13.0–0.16.0 检查点保留身份及结果。Native SDK、当前浏览器／设备像素、性能、字体、DragonBones、完整 R008/V006 迁移、V003／编辑器及完整产品验收仍未验证或保持开放。

## 历史本地工程预览：0.16.0

当前增量覆盖已接受的有界图片源码／模拟逻辑、CPU 纹理参考公式、CPU 3D 数学／几何／打包，以及旧 RES 声明分析。阅读[核心进展](knowledge-base/Cns/docs/core-progress.md)、[3D CPU 基础](knowledge-base/Cns/docs/3d-foundation.md)和[旧 RES 声明](knowledge-base/Cns/docs/legacy-res-declarations.md)，查看契约、准确历史证据与开放任务。标签为工程预览；包 0.0.0 与协议 1.0 不变。最终独立公开审查、prepush 及本预览的 GitHub 交付仍待完成。

此前 0.13.0／0.14.0／0.15.0 章节是各自有源码身份和结果的历史检查点，其矩形／浏览器观察不能验证当前图片或 3D 的 native 像素。Task 5a 仅提供 CPU 公式／边界；A2 Task 5b／Task 6、P0–P7、设备／文字／动画／Native、V003 和完整 R008／V006 迁移保持开放或 UNRUN。


## 历史 0.14.0 工程事务核心工程预览

本地0.14.0工程预览候选包含私有0.0.0 headless `@egret/project`包，支持不可变创作快照、原子编辑/重试和通过规范历史恢复保留目标。见[包API](packages/project/README.zh-CN.md)、[完整合同](knowledge-base/Cns/docs/工程事务核心合同.md)及[有限实现和内存证据](knowledge-base/Cns/docs/工程事务核心实现证据.md)。协议固定值仍为1.0，历史0.13 WebGPU/知识库身份不变。本段文档编写检查点的最终独立预览审阅与公开交付待完成，后续审阅和交付证据另行记录；V003/编辑器和完整R008/V006迁移未接受。

## 历史0.13.0 WebGPU矩形本地检查点 — 2026年10月9日

显式 `@egret/engine/webgpu` 入口同步执行不可变 `RenderFrame2D` 矩形命令。根入口保持无DOM；`@egret/engine/web`保持Canvas-only，实际请求不包含WebGPU或robust-predicates模块。无DOM准备层通过公共 `orient2d` 接入精确固定的基础依赖robust-predicates 3.0.3，适用Unlicense。复制、有界交点构造、打包、WGSL及宿主生命周期属于独立编写的第一方代码。见[完整0.6合同](knowledge-base/Cns/docs/WebGPU矩形执行合同.md)、[实施计划](knowledge-base/Cns/docs/WebGPU矩形实施计划.md)与[有限证据](knowledge-base/Cns/docs/WebGPU矩形实现证据.md)。

已接受的桌面构建记录177/177 CPU/mock/核心检查、28项预期负类型诊断及123个边界文件；独立真实WebGPU门禁记录42帧、1709项原始断言、84张截图、6808项合成断言、8项预期反例及0项意外错误。其中7项变异实际生产代码副本，1项仅为合成断言。实际结果与有限独立实现审阅由[验证](verification/webgpu-verification.json)与[审阅](verification/webgpu-review.json)绑定已接受的源码身份；文档整合没有重跑这些检查。

本experimental检查点记录于2026-10-08T21:23:54.294Z最终原生运行之前，核心/headless与桌面Canvas结果分别记录。随后仅注释入口重建的真实浏览器WebGPU运行在 `1aa0248a1ff6d8e54c42d631072223bb50483814`、2026-10-08T21:23:54.294Z以0退出并记录PASS：42帧、1709项原始断言、84张PNG截图、6808项合成断言、8项预期反例及0项意外错误。7项反例变异生产代码副本，1项为合成断言。233项源码/构建/工具/依赖清单身份在该运行前后相等，且与当时仅文档和元数据变更的后继版本一致。实际运行由验证作者执行；独立修正及原生绑定复审、最终语义凭据和发布仍待完成。浏览器WebGPU与Native App/SDK分别验收；截图合成不证明实体扫描输出、硬件加速、手机或性能。纹理/文字/UI/动画/3D、编辑器/Agent创作、CI、完整迁移与完整产品仍待实施或验收；R008/V006及V003保留既有义务。下文0.9–0.12历史记录保留原日期、身份与结果范围。


## 历史0.12.0显示与帧候选范围

后续工作包按[显示与帧合同](knowledge-base/Cns/docs/显示与帧执行合同.md)及[实现计划](knowledge-base/Cns/docs/显示与帧执行实现计划.md)推进：显示变换、继承可见性/透明度与本地矩形裁剪、Sprite 所属 Graphics 的矩形填充，以及不可变 CPU 帧捕获/提交。首个已实现执行适配器为独立 @egret/engine/web 入口的 Canvas，核心根入口保留无 DOM 边界。限定实现检查已通过：97/97核心行为测试、25项负类型诊断及真实桌面Canvas像素/指针交互。跨realm拒绝修正后有限独立审阅通过；远端发布另行记录。最终限定结果由[实现记录](knowledge-base/Cns/docs/显示与帧执行实现记录.md)和[验证](verification/display-frame-verification.json)承载。

本包不验收完整文本/纹理/动画/UI/3D 执行、GPU 或 Native 支持、目标设备性能、编辑器、Agent 服务或完整迁移。此前 headless、CPU 资源与第三方研究记录保留原版本、数量、hash 和范围，不转为新显示帧验收。

新白鹭面向主要依靠 AI 制作游戏的新创作者，首期目标是复杂 2D UI 与轻量 3D。渲染与运行时、可持续编辑的工程、Agent 协作工具和完整旧工程迁移共同构成产品方向。代码、双语文档、测试与可公开验证记录从开发阶段持续维护。

此前0.12.0为限定显示帧本地候选，公开仓库目标是 [cnedwin/Egret_rebuild](https://github.com/cnedwin/Egret_rebuild)。本预览的远端提交状态另行记录，没有已发布 npm 包。第一方代码与文档采用仓库原有 [Apache-2.0](LICENSE)，第三方保留各自声明；包继续保持 `private: true`，接口为 experimental。

## 已实现的核心

| 包 | 当前职责 | 依赖 |
| --- | --- | --- |
| `@egret/project` | 不可变创作快照、原子编辑/重试及通过规范历史恢复保留目标 | contracts；私有jsonc-parser 3.3.1 scanner/visitor适配器 |
| `@egret/contracts` | 取消、同步清理、诊断与 headless 宿主端口 | 无 |
| `@egret/runtime` | Scope、显示树、类型化同步事件、CPU 资源引用/共享获取/独立租约 | contracts |
| `@egret/engine` | 实例与资产服务装配、surface 预留、启动和有界关闭 | contracts、runtime；WebGPU准备显式依赖robust-predicates 3.0.3 |

公共入口为 `@egret/engine`。核心不依赖 DOM/Node 全局，导入不启动宿主。新的 `engine.assets` 把等待取消与已交付租约的使用期分开：一个调用取消不会影响其他等待者，代际失效只切换后续获取，旧租约在释放或管理器关闭前仍可使用。Scope 和 Engine 负责退出期间的清理。见[资源合同](knowledge-base/Cns/docs/资源核心合同.md)与[实现记录](knowledge-base/Cns/docs/资源核心实现记录.md)。

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

每次推送执行[双语与公开检查](knowledge-base/Cns/docs/双语文档与推送前检查.md)，同步中文/英文阅读版本、登记状态与关键代码英文注释。新增核心按自有合同独立编写，历史源码/规格 hash 和当前修订身份分别保留，见[来源记录](source-origin.json)。

[知识库](knowledge-base/Cns/README.md) · [全部双语文档](DOCUMENTATION.zh-CN.md) · [贡献指南](CONTRIBUTING.zh-CN.md) · [鸣谢](ACKNOWLEDGEMENTS.zh-CN.md) · [发行说明](PUBLICATION.zh-CN.md)

当前显示/帧公共API：DisplayObject的x/y、scaleX/scaleY、rotation、alpha、visible与clipRect；Sprite.graphics拥有矩形填充；Engine.captureFrame/renderFrame产生/提交不可变RenderFrame2D。独立`@egret/engine/web`导出createCanvasHost，根入口保持无DOM。接口为实验性质，完整文字/纹理/动画/UI/3D尚未实现。

该历史检查点的本地工程预览标签为0.14.0；私有实验包版本仍为0.0.0，工程/历史/工具协议固定值仍为1.0。保留的WebGPU检查点及其知识库身份属于历史0.13.0记录。

## 公共WebGPU使用

`canvas`为HTMLCanvasElement。可选readback绑定下一次通过预检的帧；`renderFrame`同步返回undefined。`result.bytes`为调用者所有的预乘RGBA，不是浏览器合成结果。`whenIdle`仅截取已提交工作；只有`close`成功才证明安全归还，Engine包装保留原cause。见[示例](examples/webgpu/README.zh-CN.md)。

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

## CPU 纹理预览（本地 0.15.0）

新增不可变 ImageData2D、Texture、借用资源租约的 Bitmap、可保存的混合帧，以及保留 UV 属性的裁剪和顶点准备。阅读 [API 与所有权](docs/texture-a1.zh-CN.md) 和 [CPU 验证证据](docs/evidence/texture-a1.zh-CN.md)。这是对 0.14 工程核心的增量实验；生产 Canvas/WebGPU 图像采样、浏览器精度与 GPU 资源结算仍等待独立 A2 验证。源码与文档整理不代表 GitHub 已交付，历史记录及完整产品验收目标继续保留。
