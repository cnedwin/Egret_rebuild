# 鸣谢

[English](ACKNOWLEDGEMENTS.md) | 简体中文

白鹭的工程工作受益于开放标准、开发工具及公开的技术研究。以下署名说明相关材料的实际作用；相应许可证和通知随原文件保留。

## 第一方工作与 AI 辅助

白鹭的显示、资源、动画、输入和 UI 模块按自身 API 与生命周期契约开发，各组件和示例共用既有第一方几何与所有权系统，并配有原创程序化测试材料。

AI 工具辅助代码、测试与双语文档，贡献者负责复核结果。实现来源与验证登记于 [source-origin.json](source-origin.json)及对应技术记录，各版本的来源和审阅记录保留原适用范围。

## 0.16.0 声明与 3D 参考来源

Microsoft Corporation 的 [jsonc-parser](https://github.com/microsoft/node-jsonc-parser/tree/v3.3.1) 3.3.1 以 MIT 提供公共根 createScanner／visit，供既有私有工程适配器与声明分析使用。已有 MIT 声明和依赖固定值继续适用。RES profile／报告／fixture 与 CPU 3D 契约／实现独立编写。创始人提供的历史 RES 声明语义用于兼容性研究；准确版本／模块闭合仍未验证，不分发历史私有源码。见[声明范围](knowledge-base/Cns/docs/legacy-res-declarations.md)。

选定的 [GPUWeb 草案](https://github.com/gpuweb/gpuweb/blob/25a5dc4537074c9b3844dd95891f5cfd193f4407/spec/index.bs)固定在 commit 25a5dc4537074c9b3844dd95891f5cfd193f4407，为九个选定 3D 设计语义区间提供依据。这份固定阅读及选定 TypeScript 声明不产生最新最终标准、GPU 宿主、像素或性能验收。无 depth UI 和选定 pass 后 readback 是白鹭架构选择，不是 WebGPU 的普遍要求。见[3D 基础](knowledge-base/Cns/docs/3d-foundation.md)。已有研究／依赖鸣谢及历史限制继续适用。

感谢公开源码、标准、文档和维护经验的项目与社区。鸣谢按实际角色记录，不表示合作或上游背书。

## 当前开发工具

- [TypeScript](https://github.com/microsoft/TypeScript) 7.0.2及本机原生编译器：编译与类型检查工具，原型记录的适用声明为Apache-2.0。
- [pnpm](https://pnpm.io/workspaces) 11.25.0：包管理与workspace工具，原型记录为MIT。
- [Node.js](https://nodejs.org/api/) 24.19.0：开发、测试和headless示例宿主，保留其MIT及上游第三方声明范围。

工具通过依赖安装取得，本地候选不包含node_modules。contracts/runtime没有第三方运行时依赖；engine的WebGPU准备层现在显式依赖robust-predicates 3.0.3，版本与声明位置见[source-origin.json](source-origin.json)。

## 研究与标准

知识库记录了Cocos、LayaAir、Godot、Three.js、Babylon.js、PlayCanvas、PixiJS、DragonBonesJS及其他项目的机制与产品研究，并保留HarfBuzz、FreeType、Unicode、WebGPU、WGSL、WebGL、glTF与MCP等资料的已读范围。固定版本、官方链接及待研究状态见[知识库鸣谢](knowledge-base/Cns/ACKNOWLEDGEMENTS.md)。

Three.js r186研究链实际运行WebGLRenderer、GLTFLoader、AnimationMixer与SkeletonUtils，固定commit为`9b4a2ac29c63ccb43fd51c5661f2f873ac2c39b8`。它使用Cesium (2017)的Rigged Simple资产，归属与CC-BY-4.0声明随研究文件保留。该链属于知识库中的第三方研究对照，未进入三个核心包的运行时依赖，也不计为白鹭自主渲染内核。完整说明见[第三方声明](knowledge-base/Cns/experiments/asset-reference-probe/THIRD_PARTY_NOTICES.md)。

第一方代码与文档采用仓库既有[Apache-2.0](LICENSE)，第三方文件、资产与工具各自适用的声明继续保留。

## WebGPU基础依赖与标准

Vladimir Agafonkin的[robust-predicates](https://github.com/mourner/robust-predicates/tree/v3.0.3) 3.0.3通过公共 `orient2d` 提供已表示binary64坐标的方向判断；它保持明确归属的外部依赖并适用[Unlicense](third-party/robust-predicates-3.0.3.LICENSE)，其源码未移植入第一方模块。精确40820字节npm产物、SRI、已安装manifest/类型/许可及6模块73171字节安装ESM图分别记录，与浏览器实际请求区分；这些数字不是实际传输或tree-shaken包体。

GPUWeb的canvas配置/current texture、queue、buffer及device错误API资料和W3C WGSL文献，为独立编写的pass与生命周期合同提供依据。读取日期、实际URL、完整规范获取限制及此前类型/latest抓取失败保留于[来源证据](knowledge-base/evidence/webgpu-source-evidence.json)。真实浏览器门禁另列；鸣谢不表示上游背书或手机/性能/Native SDK验收。

## 可选 Spine Core 接入

Esoteric Software 的 [Spine Runtimes](https://github.com/EsotericSoftware/spine-runtimes/tree/b7beb2ccbbce667a12c02f44d070644f59b04968)提供 `@egret/spine` 单独许可的 `@esotericsoftware/spine-core` 4.3.13 依赖，保留[包内原始声明](third-party/spine-core-4.3.13.LICENSE)及[附带条件的许可路径／参考边界](knowledge-base/Cns/docs/spine-content-ingress.md)。白鹭独立实现资产所有权、配置准入和公共 API，不将上游运行库实现或官方美术复制到第一方源码；上游运行库不属于 Apache-2.0。
