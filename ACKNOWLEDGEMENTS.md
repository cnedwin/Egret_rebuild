# 鸣谢

[English](ACKNOWLEDGEMENTS.en.md) | 简体中文

感谢公开源码、标准、文档和维护经验的项目与社区。鸣谢按实际角色记录，不表示合作或上游背书。

## 当前开发工具

- [TypeScript](https://github.com/microsoft/TypeScript) 7.0.2及本机原生编译器：编译与类型检查工具，原型记录的适用声明为Apache-2.0。
- [pnpm](https://pnpm.io/workspaces) 11.25.0：包管理与workspace工具，原型记录为MIT。
- [Node.js](https://nodejs.org/api/) 24.19.0：开发、测试和headless示例宿主，保留其MIT及上游第三方声明范围。

工具通过依赖安装取得，本地候选不包含node_modules。contracts/runtime没有第三方运行时依赖；engine的WebGPU准备层现在显式依赖robust-predicates 3.0.3，版本与声明位置见[source-origin.json](source-origin.json)。

## 研究与标准

知识库记录了Cocos、LayaAir、Godot、Three.js、Babylon.js、PlayCanvas、PixiJS、DragonBonesJS及其他项目的机制与产品研究，并保留HarfBuzz、FreeType、Unicode、WebGPU、WGSL、WebGL、glTF与MCP等资料的已读范围。固定版本、官方链接及待研究状态见[知识库鸣谢](knowledge-base/ACKNOWLEDGEMENTS.md)。

Three.js r186研究链实际运行WebGLRenderer、GLTFLoader、AnimationMixer与SkeletonUtils，固定commit为`9b4a2ac29c63ccb43fd51c5661f2f873ac2c39b8`。它使用Cesium (2017)的Rigged Simple资产，归属与CC-BY-4.0声明随研究文件保留。该链属于知识库中的第三方研究对照，未进入三个核心包的运行时依赖，也不计为白鹭自主渲染内核。完整说明见[第三方声明](knowledge-base/experiments/asset-reference-probe/THIRD_PARTY_NOTICES.md)。

第一方代码与文档采用仓库既有[Apache-2.0](LICENSE)，第三方文件、资产与工具各自适用的声明继续保留。

## WebGPU基础依赖与标准

Vladimir Agafonkin的[robust-predicates](https://github.com/mourner/robust-predicates/tree/v3.0.3) 3.0.3通过公共 `orient2d` 提供已表示binary64坐标的方向判断；它保持明确归属的外部依赖并适用[Unlicense](third-party/robust-predicates-3.0.3.LICENSE)，其源码未移植入第一方模块。精确40820字节npm产物、SRI、已安装manifest/类型/许可及6模块73171字节安装ESM图分别记录，与浏览器实际请求区分；这些数字不是实际传输或tree-shaken包体。

GPUWeb的canvas配置/current texture、queue、buffer及device错误API资料和W3C WGSL文献，为独立编写的pass与生命周期合同提供依据。读取日期、实际URL、完整规范获取限制及此前类型/latest抓取失败保留于[来源证据](knowledge-base/evidence/webgpu-source-evidence.json)。真实浏览器门禁另列；鸣谢不表示上游背书或手机/性能/Native SDK验收。
