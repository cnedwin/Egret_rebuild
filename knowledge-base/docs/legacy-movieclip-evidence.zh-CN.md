# 旧版 MovieClip CPU 转换证据

[English](legacy-movieclip-evidence.en.md) · [契约](legacy-movieclip-contract.zh-CN.md) · [精简记录](../evidence/legacy-movieclip-focused.json)

转换器是首方内部 CPU 组件。实际编译和焦点测试证明这里描述的有限契约，不证明图片/播放器流水线或完整迁移。

## 对象与实际测试

| 对象 | 字节数 | SHA-256 |
| --- | ---: | --- |
| packages/project/src/legacy-movieclip-plan.ts | 17420 | a6cd539126753989fb0f79cdfa0bf674d83d62e8c713ad173c3aca0e8d4117bb |
| tests/legacy-movieclip-plan.test.mjs | 27671 | 59a695124ce26d051eb4d2d165b7285f2825c1345bcf13cfb3038cd36b717933 |

固定环境使用 Node v24.19.0 和已安装的 TypeScript 7.0.2 编译器链。焦点参数为 `--test --test-isolation=none --test-reporter=tap tests/legacy-movieclip-plan.test.mjs`。

| 阶段 | 既有编译退出 | 焦点退出 | 测试组 | 通过 | 失败 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 可编译的缺失行为入口（RED） | 0 | 1 | 28 | 0 | 28 |
| 严格实现（GREEN） | 0 | 0 | 28 | 28 | 0 |

每阶段编译和焦点各运行一次，没有重试或改变固定测试。两次焦点均无跳过、取消、待办。RED 的 28 个测试体都到达转换器产物，因刻意未实现的行为失败，属于真实行为失败，而非缺失模块/准备失败；各测试体后续表格断言与故障注入分支在 RED 中并非全部到达。GREEN 成功执行这些组；两阶段均不证明穷尽分支覆盖。

GREEN 检查包含手算裁剪、偏移、逻辑跨度；真实序列帧工厂重新准入与采样；缺省及小数帧率；不同的 0.3/0.30000000000000004 时间边界；正非正规数保留及溢出拒绝；原始类型、Unicode、严格 JSON；单次解析、外部故障处理和恢复；可移植路径；类似原型名称的自有属性与 JSON 指针转义；无效优先于不支持；所选范围；作者帧、逻辑帧、字典预算边界；每次新建冻结输出。当前逻辑帧预算下没有微小增量被舍入吞没分支的准入测试例。测试耗时不是设备性能跑分。

直接观察的进程均关闭，标准输出和标准错误都结束，无超时、流超限、观察器或启动错误。调用前后记录绑定源码、测试、观察器和七份运行时/编译器输入；焦点涉及的五份产物身份未变。这是有限直接进程和源码记录证据，不声称完整导入图、操作系统进程关系或全部编译器后代退出。

独立规格/质量审阅状态为 `SPEC_QUALITY_REVIEW_COMPLETE_NO_ACTIONABLE_P1_P2`，在源码和已记录焦点范围内未发现问题。该审阅没有重跑产品；源码审阅与实际焦点观察保留为不同证据类型。

## 来源与鸣谢

已读参考快照的包清单声明 **Egret 5.4.1**。下列有限身份固定历史声明观察依据；清单声明不证明所有文件等同官方版本标签，也不证明这是最新版本：

| 参考 | 字节数 | SHA-256 |
| --- | ---: | --- |
| MovieClipDataFactory.ts | 6034 | 0145d604476b633d115c5ded167cc8227a301f98b0b58d1ab4ab4358fe7b2b3c |
| MovieClipData.ts | 9149 | 82a778d66ec2da8327f4947b3bfd0cb758b49c36085f0863ab6bb4b06db9c41c |
| 包清单 | 16207 | fb434c743952d6fa389733a44c56bc691dde11eb7782e8d21d3d0f87ede99431 |

公开参考链接为 [MovieClipDataFactory](https://raw.githubusercontent.com/egret-labs/egret-core/master/src/extension/game/display/MovieClipDataFactory.ts) 和 [MovieClipData](https://raw.githubusercontent.com/egret-labs/egret-core/master/src/extension/game/display/MovieClipData.ts)。它们指向可变 master，未建立远端提交身份，也未证明与选定快照逐字节一致。参考源码版权归 Egret Technology 及贡献者，已读文件保留原有三条件 BSD 风格头；重新分发这些参考源码时应同时保留适用的原版权和许可声明。

该来源研究确认具名 mc/全局 res 访问、duration 覆盖所声明数量的逻辑帧，以及显示偏移与图集裁剪值分离。FrameLabel、播放器时钟和事件派发语义不在有限源码研究范围内。当前转换器使用自主严格数值与作者持续段时间契约，以及独立编写的测试夹具。

## 剩余验证

本对象的默认工作进程模式和全仓回归仍未运行。图集读取/解码、真实导出格式/工程覆盖、渲染偏移、标签/事件/空白帧播放、原生像素、设备性能和完整迁移均未验证。其他渲染器证据不能认证本转换器的图片/播放链路。API 仍为内部入口，CPU 焦点通过后验收字段仍为 unverified。
