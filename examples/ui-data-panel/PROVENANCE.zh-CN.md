# 资产与实现来源

[English](PROVENANCE.md) | 简体中文

示例、字面夹具、线性测试参考和有限采集器为 AI 辅助独立编写的第一方 Apache-2.0 代码。采集器沿用仓库 `tools/verify-multi-pointer.mjs` 的有限导入读取、不可变快照/服务、固定 Playwright 1.62.1/默认 Edge 启动与清理模式。渲染复用现有共享 WebGPU/WebGL2 宿主，未将渲染器或生产布局算法复制为预期值。

示例直接复用以下原始文件，不复制、重新生成或变更授权：

| 文件 | 身份 | 权利与来源 |
| --- | --- | --- |
| `../canvas-text/assets/ahem.ttf` | 22572 字节；SHA256 `f0a92cd0cc45735591c9b5b1fa8aecd5194e8dc518895ca22af94a46c23550dc` | [既有来源](../canvas-text/assets/provenance.json)、[上游 COPYING](../canvas-text/assets/Ahem-COPYING.txt)、[上游 README](../canvas-text/assets/Ahem-README.txt)。保留原有条件；字体不改为 Apache-2.0。 |
| `../../tools/browser-png/assets/rgb-red-green.png` | 72 字节；SHA256 `917780f34b6e830eceb3a99e7c5794af705f16193ba8b2d415c86b24aa0cc78d` | [既有第一方字面像素来源](../../tools/browser-png/assets/provenance.json)，Apache-2.0。 |

运行时校验两项原始字节身份。应用专有的唯一 Ahem FontFace 必须完成加载、安装并被 X/空格精确选中；校验后的 2×1 位图由浏览器原生解码，再通过普通公开纹理租约使用。资产来源不等于浏览器、GPU、文字或设备验收。验证器在启动前快照中保留原始资产/法律字节，并记录实际原生字体和后端环境。
