# 独立批次状态实验

[English](README.en.md) | 简体中文

在本目录运行 `node run.mjs`，结果写入知识库 `evidence/batch-state-probe-results.json`。逐像素全量参考读取各命令状态，独立批次消费者实际读取batch header的texture/pipeline/clip，二者不共用合成函数。

故意只按纹理分批的初版真实运行为8项中5通过/3失败，暴露裁剪与混合模式漏分界以及无效输入未拒绝；失败源码在 `history/red/`，失败结果在 `evidence/batch-state-probe-red-results.json`（从知识库根目录计）。当前实现按有限状态建立相邻边界，几何容量满时分批，保持输入顺序。

参考覆盖矩形、单texel、straight/additive alpha；随机采用xorshift高位映射避免简单最低位相关模式。本模型不包含任意遮罩、滤镜、stencil、完整材质、GPU计时或性能对照。实际图形实验另见[第二轮验证记录](../../docs/第二轮验证记录.md)，不能将本模型通过等同完整引擎合批正确。

独立审计还发现稀疏color数组绕过Array.every校验，新增反例先7通过/1失败，改成dense own-index检查后8通过。中间8通过版与7/1反例源码分别在 `history/pre-audit/`、`history/audit-red/`；相应结果为 `evidence/batch-state-probe-pre-audit-results.json` 与 `evidence/batch-state-probe-audit-red-results.json`（从知识库根目录计）。
