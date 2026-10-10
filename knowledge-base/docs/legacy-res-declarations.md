# 旧 RES 资源声明分析

[English](legacy-res-declarations.en.md) | 简体中文

0.16.0 新增内部资源声明分析器，采用 reportVersion 0.1 和 profile legacy-res-comma-declarations-0.1。它为旧工程迁移提供有界、可审查的声明盘点前置能力。它尚未通过包根 facade 公开，不代表导入旧工程即可运行，也不升级 R008／V006 完整迁移验收。

## 输入与报告契约

输入 text 和 resourceRoot 必须是原始 string，不会对调用者对象执行字符串转换。text 使用严格 JSON：拒绝注释、尾逗号、重复 decoded key、无效 Unicode 和额外尾部内容。资源根必须为非空 portable path；声明中要求 resources 和 groups 数组及对应字符串字段。

每次返回新鲜、自有且深度冻结的报告，包括资源、组、诊断及 acceptance；不暴露调用者图或 parser 记录。status 为 recognized、unsupported、invalid 或 incomplete。recognized 只表示已知声明结构，unsupported 表示超出当前结构 profile，invalid 表示无效输入／预算，incomplete 表示内部失败且构造失败报告仍可行。它不保证任意 OOM／被污染内建函数的恢复。

| 边界 | 上限 |
| --- | ---: |
| text 的 UTF-16 早期长度与 UTF-8 字节 | 各 1048576 |
| JSON 嵌套深度 | 16 |
| decoded key／string 的 UTF-8 字节 | 4096 |
| resourceRoot 的早期字符／UTF-8 字节 | 各 4096 |
| portable path 的 UTF-8 字节 | 1024 |
| resources／groups | 4096／1024 |
| 全部组声明引用 | 16384 |
| warning | 256 |

超额报告不会截断成一个看似完整的盘点。数量和字符串预算是逻辑准入；依赖 parser 的已有分配与宿主内存不是这些数字的等价物。

## 保留声明语义

group.keys 按字面逗号分割。空字符串产生零引用；其他输入保留空项、空格、重复项和顺序，不 trim。例如 a,, b,a 得到 a、空项、 b、a；引用按原始名称解析。完整历史资源管理器的运行时去重／加载语义不由此推断。

资源名称和组名称的准确重复被拒绝。路径按保留的原始拼写构造；NFC／大小写碰撞别名被拒绝。当前已知类型为 image 和 json；其他类型、subkeys、scale9grid、远程／特殊 URL 和未解决引用报告为 unsupported。未知 schema 字段保守报告 unsupported，避免把未理解字段静默转换成正确。

报告的 fileExistence、decoding、execution、migration 四项始终为 unverified；声明识别不检查文件存在性、内容 digest、资源加载、图像解码、运行时等价或历史游戏可运行性。

## 来源与有限证据

严格解析复用既有 [jsonc-parser 3.3.1](https://github.com/microsoft/node-jsonc-parser/tree/v3.3.1) 公共根 createScanner／visit API，适用其 MIT 许可。声明 profile、报告组织与测试 fixture 按自有契约独立编写。创始人提供的历史 RES 声明语义用于兼容性研究；准确历史版本及模块闭合仍未验证。公开材料保留这项来源背景，不分发历史私有源码或工程包。

接受的准确三文件范围记录 20 项专项及 772 项完整检查通过，三个有限独立审查未发现问题；这些是自建声明 fixture 的源码测试，不是旧游戏迁移。历史源码和测试身份见[声明验证摘要](../evidence/legacy-res-declarations-verification.json)。本次文档整理未重跑这些检查，最终公开审查／推送门禁仍待完成。

## 完整迁移仍需完成

R008／V006 继续要求版本／模块／依赖盘点、新工程构建、确定转换与 Agent 修复／回滚、旧新行为／视觉／动画／资源对照、目标宿主性能、人工介入与 AI 成本记录，以及转换后继续编辑／撤销／真实发布与更新闭环。该声明分析器提供前置证据；Agent、编辑器、动画和完整转换器各有后续实现与验收。

[核心进展](core-progress.md) · [旧工程迁移目标](旧工程迁移.md) · [鸣谢](../ACKNOWLEDGEMENTS.md)
