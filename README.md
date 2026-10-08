# 新白鹭 Egret Rebuild

[English](README.en.md) | 简体中文


## 0.12.0 显示与帧候选范围

后续工作包按[显示与帧合同](knowledge-base/docs/显示与帧执行合同.md)及[实现计划](knowledge-base/docs/显示与帧执行实现计划.md)推进：显示变换、继承可见性/透明度与本地矩形裁剪、Sprite 所属 Graphics 的矩形填充，以及不可变 CPU 帧捕获/提交。首个已实现执行适配器为独立 @egret/engine/web 入口的 Canvas，核心根入口保留无 DOM 边界。限定实现检查已通过：97/97核心行为测试、25项负类型诊断及真实桌面Canvas像素/指针交互。跨realm拒绝修正后有限独立审阅通过；远端发布另行记录。最终限定结果由[实现记录](knowledge-base/docs/显示与帧执行实现记录.md)和[验证](verification/display-frame-verification.json)承载。

本包不验收完整文本/纹理/动画/UI/3D 执行、GPU 或 Native 支持、目标设备性能、编辑器、Agent 服务或完整迁移。此前 headless、CPU 资源与第三方研究记录保留原版本、数量、hash 和范围，不转为新显示帧验收。

新白鹭面向主要依靠 AI 制作游戏的新创作者，首期目标是复杂 2D UI 与轻量 3D。渲染与运行时、可持续编辑的工程、Agent 协作工具和完整旧工程迁移共同构成产品方向。代码、双语文档、测试与可公开验证记录从开发阶段持续维护。

当前为限定实现的 0.12.0 显示帧本地候选，公开仓库目标是 [cnedwin/Egret_rebuild](https://github.com/cnedwin/Egret_rebuild)。本预览的远端提交状态另行记录，没有已发布 npm 包。第一方代码与文档采用仓库原有 [Apache-2.0](LICENSE)，第三方保留各自声明；包继续保持 `private: true`，接口为 experimental。

## 已实现的核心

| 包 | 当前职责 | 依赖 |
| --- | --- | --- |
| `@egret/contracts` | 取消、同步清理、诊断与 headless 宿主端口 | 无 |
| `@egret/runtime` | Scope、显示树、类型化同步事件、CPU 资源引用/共享获取/独立租约 | contracts |
| `@egret/engine` | 实例与资产服务装配、surface 预留、启动和有界关闭 | contracts、runtime |

公共入口为 `@egret/engine`。核心不依赖 DOM/Node 全局，导入不启动宿主。新的 `engine.assets` 把等待取消与已交付租约的使用期分开：一个调用取消不会影响其他等待者，代际失效只切换后续获取，旧租约在释放或管理器关闭前仍可使用。Scope 和 Engine 负责退出期间的清理。见[资源合同](knowledge-base/docs/资源核心合同.md)与[实现记录](knowledge-base/docs/资源核心实现记录.md)。

这段服务管理 provider 返回的 CPU 值，网络与解码由相应 provider 提供。GPU 上传/在途回收、GPU 渲染后端、字体/动画/3D 产品执行链、真实小游戏/Native、迁移器、编辑器和 Agent 服务尚未完成。研究中的第三方图形链与自有产品代码分别登记。

## 运行与验证

固定工具：Node.js 24.19.0、pnpm 11.25.0、TypeScript 7.0.2。从根目录执行：

```text
pnpm install --frozen-lockfile --ignore-scripts
node tools/verify.mjs
node examples/headless.mjs
node examples/assets.mjs
node tools/prepush.mjs
```

历史 CPU 资源切片验收见[资源核心验证](verification/asset-core-verification.json)；此前 [44 项 headless 检查](verification/headless-verification.json)与[双语修订记录](verification/bilingual-publication-verification.json)保留其历史版本和范围。当前验证不代表 GPU、设备性能、CI 或完整产品验收。

每次推送执行[双语与公开检查](knowledge-base/docs/双语文档与推送前检查.md)，同步中文/英文阅读版本、登记状态与关键代码英文注释。新增核心按自有合同独立编写，历史源码/规格 hash 和当前修订身份分别保留，见[来源记录](source-origin.json)。

[知识库](knowledge-base/README.md) · [全部双语文档](DOCUMENTATION.md) · [贡献指南](CONTRIBUTING.md) · [鸣谢](ACKNOWLEDGEMENTS.md) · [发行说明](PUBLICATION.md)

当前显示/帧公共API：DisplayObject的x/y、scaleX/scaleY、rotation、alpha、visible与clipRect；Sprite.graphics拥有矩形填充；Engine.captureFrame/renderFrame产生/提交不可变RenderFrame2D。独立`@egret/engine/web`导出createCanvasHost，根入口保持无DOM。接口为实验性质，完整文字/纹理/动画/UI/3D尚未实现。

本发行预览与知识库版本为0.12.0；私有实验包版本继续保持0.0.0。
