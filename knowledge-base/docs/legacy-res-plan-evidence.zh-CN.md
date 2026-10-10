# 旧版 RES 规划器 CPU 验证证据

[English](legacy-res-plan-evidence.en.md) · [契约](legacy-res-plan-contract.zh-CN.md)

当前 `packages/project/src/legacy-res-plan.ts` 通过编译，并在 `tests/legacy-res-plan.test.mjs` 中取得 **14/14 组专项测试通过**，没有失败或跳过。保存的固定 Node.js 运行时记录显示退出码为零、直接进程关闭、两个输出流结束，选定源码和测试身份保持一致。独立源码审查也未发现问题；该审查没有执行测试，与实际运行证据分别记录。

专项测试覆盖首次出现顺序的文件去重、别名和类型保留、资源与分组顺序及重复引用、已识别的空清单、新鲜深度冻结结果、基础类型输入拒绝、严格 JSON 与路径优先级、嵌套前缀、Unicode 与碰撞规则、不支持的模式与格式、未解析键、警告顺序和末尾无效路径。向 `JSON.parse` 注入同步故障的用例检查 `incomplete` 且无计划的结果，并在用例后恢复解析器。这些测试处理文本与声明，不处理真实资源文件。

规划器保留分析报告及其诊断。`planned` 表示已为准入子集生成完整转换意图，不表示迁移成功或内容认证。报告中的文件存在性、解码、执行、迁移仍为 `unverified`。

## 组合源码整仓验证

所选已验证组合源码通过 `tools/verify.mjs`：编译、覆盖282个source/build/declaration文件的边界检查、类型检查以及 **901/901项测试**。失败、取消、跳过、todo均为零。保存的supervision记录显示退出码为零、stdout/stderr完整结束、所拥有Job到达active-zero并关闭、所选源码身份稳定。这是所选源码／运行时调用的证据，不是普遍操作系统血缘或资源保证。

此前默认整仓尝试得到 **900/901通过、1项失败**。Host测试的默认Node24.19 worker参数guard在十三个directdriver启动前失败，此历史保留。guard修正后，默认Host专项十三项全部通过，随后上述fullsuccessor通过；此前成功的isolation-none Host专项属于另一启动方式，不能替代本次修复验证。

## 源码身份

| 对象 | 字节数 | SHA-256 |
| --- | ---: | --- |
| 规划器源码 | 3,782 | `b1149868f617583ae74860405fbe468e70b32b51940e308741962891eed789a7` |
| 专项测试 | 12,345 | `d1e8d5247396f624b718aeaf4cd7715ac70c91341f47c1cd84e9dd60dbbdef6e` |

[本地精简证据索引](../evidence/legacy-res-plan-cpu-evidence.json) 已整理实际源码／运行投影；GitHub 发布仍待完成。

## 待验证项

内部规划器尚未由 project 包入口集中导出。规划器及其专项映射测试不执行真实旧资源的复制／解码；整仓回归通过不建立完整旧游戏转换、运行时等价性或平台交付结论。原生像素、设备／性能验证仍未运行／未验证；字体与DragonBones仍未验证。白鹭自主实现将旧版声明兼容限定为明确语义，以便后续分别验证执行结果。
