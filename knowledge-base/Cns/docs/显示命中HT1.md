# 自定义矩形显示命中：HT1

[English](../../en/docs/display-hit-test-ht1.md) | 简体中文 · [坐标查询](显示坐标查询契约.md) · [显示树扩展性](显示树扩展性.md)

工程预览 **0.29.0** 为既有显示树新增显式逻辑命中查询。应用指定局部矩形，通过真实 Engine 所有的 Stage 查询最上层合格对象。独立实现的 CPU 切片、专项行为、严格类型和有限边界对照已取得下述结果。完整当前验证与六项受影响既有桌面渲染回归通过。仅有私有计划的浏览器命中补充、独立双语语义审阅、必要 Git 推送钩子与交付仍为 **PENDING**。工作区包保持 private `0.0.0`，协议固定值保持 `1.0`。 这些核验及待交付表述保留原始 0.29.0 截止点，不是对后续命中组合的新评估。

## 公共 API 与示例

| 接口 | 契约 |
| --- | --- |
| `DisplayObject.touchEnabled` | 原始布尔值，默认 `false`；只启用该对象自身指定区域。 |
| `DisplayObject.hitArea` | `Rectangle2D \| undefined`，默认 `undefined`；赋值成功后保存新的自有、冻结局部矩形。 |
| `DisplayObjectContainer.touchChildren` | 原始布尔值，默认 `true`；控制下探，不隐式重新指定目标。 |
| `Stage.hitTest(globalX, globalY, options?)` | 必填有限原始数值逻辑坐标；返回借用的 `DisplayObject \| undefined`。 |
| `HitTestOptions` | 既有 `@egret/engine` 和 `@egret/runtime` 根入口的仅类型导出；`readonly maxNodes?: number`。 |

不新增值导出、包子入口、依赖、隐式全局 Stage 或输入路由器。以下 TypeScript 函数使用既有公共工厂、Scope 所有权与 Sprite 构造函数，应用提供已准入 HostAdapter。命中查询不需要绘制内容或提交渲染。

```ts
import { createEngine, Sprite } from '@egret/engine';
import type { HostAdapter, HitTestOptions } from '@egret/engine';

async function selectsButton(host: HostAdapter): Promise<boolean> {
  const engine = await createEngine({ host });
  const screen = engine.createScope();
  try {
    const button = screen.use(new Sprite());
    button.x = 20;
    button.y = 30;
    button.touchEnabled = true;
    button.hitArea = { x: 0, y: 0, width: 80, height: 40 };
    engine.stage.addChild(button);
    const options: HitTestOptions = { maxNodes: 4096 };
    return engine.stage.hitTest(25, 35, options) === button;
  } finally {
    try { screen.dispose(); }
    finally { await engine.dispose(); }
  }
}
```

查询返回身份不增加所有权或保留义务。对象分离或释放后，先前结果不会成为保留的输入目标。应用若需分发既有类型化 Event，应单独决定该动作；`hitTest` 本身不发送事件，不推进帧、时钟或动画。

## 两轮检查与选择顺序

调用方输入准入后，查询先对**完整当前 Stage 树**进行结构准入，包含 Stage 以及隐藏、禁用、奇异、被裁剪排除和 `touchChildren=false` 压制的后代。默认 `maxNodes` 为 **4096**；显式值须为 **1 至 65536** 的整数。Stage 计为一个节点。在读取下一个索引子节点前检查预算，不提前建立兄弟节点快照。按递增子索引确定结构错误顺序。任何数值计算或结果前，检查真实身份、唯一出现、私有父链接、存活状态和同一 Engine 归属。

第二轮迭代在访问子节点前建立每个合格祖先的已存储世界变换与局部裁剪。后方兄弟子树优先于前方子树，容器子节点优先于自身区域；Stage 变换参与计算。保留首个胜出身份，但返回前仍完成**所有其他合格数值分支**。因此，有效最上层命中不能掩盖另一活动兄弟分支的算术范围失败。

`visible=false` 压制分支数值工作。祖先裁剪拒绝、奇异祖先或 `touchChildren=false` 压制后代数值工作，被压制后代仍已在第一轮计费。`touchEnabled=false` 只压制自身候选，自身区域未命中不压制子节点。Alpha，包括零，不影响选择。Stage **永不**作为目标返回，即使其继承的启用标志与区域已赋值；没有 Stage 后备目标。

`touchChildren=false` 时，容器只能通过自身启用且宽高为正的区域返回自身，不把子节点较大的区域投射到容器上。`touchChildren=true` 时，只要相关祖先裁剪允许，后代可在容器自身区域外被选中。

## 坐标、裁剪与精确秩

组合使用已存储 binary64 世界矩阵，要求各分量有限。通过既有坐标逆算机制在矩阵平移处测试精确秩，不使用 epsilon 或舍入行列式。奇异祖先压制整个分支，即使舍入后的后代组合可能重新获得满秩。本次不改变既有坐标逆算算法，也不证明保守像素覆盖。

只为活动非空裁剪，或启用、非 Stage 且宽高为正的自身区域逆算请求点。无区域或禁用的祖先不执行无关的请求点逆算。各祖先裁剪在该裁剪所有者局部坐标中测试，包括 Stage 裁剪；不以联合区域或世界 AABB 代替。

每个非空区域和裁剪采用半开测试 `x <= localX < x + width`、`y <= localY < y + height`：局部左／上边包含，右／下边排除，反射变换也沿用这一规则。零面积对象不选择任何目标。既有裁剪准入允许有限维度的端点溢出，**活动**的此类裁剪以 `HIT_TEST_ARITHMETIC_RANGE` 失败，优先于零尺寸压制；隐藏或其他被压制的裁剪不计算这些端点。

## 自有状态、重入与错误

`hitArea` 接受 `undefined` 或非空、非数组对象。普通继承或代理的 `x`、`y`、`width`、`height` 属性**按此顺序各读取一次**，不枚举、不检查原型。全部读取成功后，在语义验证前再次检查节点生命周期和绑定 Engine。分量须为有限原始数值，宽高非负，右／下端点有限，即使某个尺寸为零也适用。成功准入保留 signed zero，并提交一个新的冻结字面对象，不冻结或保留调用方对象。

来源 getter 可以完成重入赋值、分离或关闭，已完成效果继续有效。失败的外层赋值不提交替换，也不回滚这些效果。来源形状／读取异常，包括撤销 Proxy 检查、应用 EgretError 和抛出 `undefined`，都包装为对应输入／区域错误，并保留精确原始 `cause`。后续生命周期检查不能替代抛出的来源读取异常；读取成功时，释放或 Engine 关闭优先于返回维度或预算的语义错误。

新状态 getter 鉴别真实节点／容器身份，可在释放后返回已存储值，沿用既有视觉 getter 行为。Setter 要求节点存活、绑定 Engine 开放，标志只接受原始布尔值。私有节点终结状态与 Engine 归属提供权威。查询不读取可重写 Scope 状态 getter，不调用重写的显示 getter、`getBounds`、`globalToLocal` 或可用性钩子。正常 Scope 释放会终结自身节点；本切片不增加新的 Scope 生命周期接口。

| 代码 | 含义 |
| --- | --- |
| `HIT_TEST_RECEIVER_INVALID` | 缺少所需真实 Stage、节点或容器接收者。 |
| `HIT_TEST_INPUT_INVALID` | 必填坐标、options 形状／读取或 `maxNodes` 无效。 |
| `HIT_TEST_AREA_INVALID` | 区域形状／读取、分量、宽高或端点无效。 |
| `HIT_TEST_VALUE_INVALID` | 交互标志不是原始布尔值。 |
| `HIT_TEST_TREE_LIMIT` | 含接收者的整树计数超过已准入预算。 |
| `HIT_TEST_ARITHMETIC_RANGE` | 已计算矩阵、活动裁剪端点或请求点逆算超出范围。 |

既有 `OBJECT_DISPOSED`、`ENGINE_CLOSED`、`DISPLAY_TREE_INVARIANT` 与 `ENGINE_MISMATCH` 继续适用。奇异矩阵压制对应分支，不抛出命中特有奇异错误。已知内部坐标范围错误映射为命中范围代码时保留 cause；意外失败不通过宽泛捕获转换为未命中。

查询优先级为真实 Stage、根生命周期、Engine 开放、必填原始坐标、options 准入与一次预算读取、成功读取后的生命周期复核、数值预算、完整结构、合格算术、最终生命周期复核，再返回借用结果。已释放 Stage 优先于 Engine 关闭或输入无效。抛出的 options getter 产生输入包装／cause；成功但关闭 Engine 的 getter 在无效预算语义前产生 `ENGINE_CLOSED`。不新增诊断观察者回调。

## 已记录证据与待完成门禁

未改变的前序公共 Engine 入口在真实准备后以 `TypeError: engine.stage.hitTest is not a function` 造成 **1/1** 项基线测试失败，清理已记录。保存的源码审阅批准七个产品候选及有限三个文件的策略整合进入受控采用，没有阻断源码问题。这些是源码检查，与后续执行独立。

实际已采用源码构建通过。HT1／显示树／扩展性／坐标合并运行通过 **98/98**，包含 **32** 项 HT1 案例；生产边界扫描通过 **426 文件**。完整严格类型运行通过既有检查及 **16** 条精确普通、**8** 条精确导入诊断，每条绑定原文件、行和代码；仅类型 options 仍不出现在 web／text／WebGPU 入口和私有深路径。这些诊断是预期拒绝，不是运行时失败。

独立边界策略运行通过 **221/221**，包含一个新的惰性合成正例、**14** 个指定变异及保留检查。每个变异先要求完整合成基线通过，再验证自身指定拒绝。这是有限检查器策略证据，不是 Engine／树／命中执行或一般解析器／安全证明。行为、策略及类型范围重叠，**不合计**。

独立审阅补充了使用字面坐标的 Stage 裁剪与奇异祖先回归。初始夹具算术断言修正为区分舍入零行列式与独立证明的精确行列式 `1`（系数单位 `2^-53`），产品代码未改变。审阅截止点的已编写数量、此前缺失入口失败与实际通过记录分别保留。共享[验证记录](../../evidence/display-hit-test-ht1-verification.json)绑定选中输入及保存结果。

| 门禁 | 当前状态 |
| --- | --- |
| 有限产品及整合源码审阅 | 批准受控采用与执行，各截止点无阻断源码问题。 |
| 实际构建、98 项合并 CPU 运行、426 文件边界与严格类型 | **PASS**，限于所述范围。 |
| 独立 221 项合成边界策略运行 | **PASS**，仅策略范围。 |
| 手动调用的完整当前验证 | **PASS**：核心 2,333/2,333、公开检查 59/59；构建、严格类型、边界、headless 与知识库检查通过。本地化：138 对文档、6 个登记册视图、148 个关键文件、0 问题。知识库：157 条记录、241 个 Markdown 文件、1,981 个链接、944 个引用、0 问题。 |
| 六项受影响既有桌面渲染回归 | Canvas、WebGPU、B1、纹理 WebGPU、SequencePlayer 与可选 Canvas 文字均为 **PASS**。默认 headless Edge 154.0.4258.62；Canvas 文字采集返回 `PASS_WC1_CANVAS_SUBSET`，共六个 context。单独的 freeze 命令是准备步骤，不是第七项浏览器门禁。 |
| 浏览器指针 → 逻辑目标 → 类型化 Event → 渲染帧补充 | **PENDING**；仅有私有计划，本截止点未实施或运行。 |
| 独立双语语义审阅、必要 Git 推送钩子与交付 | **PENDING**；已完成的手动验证与实际观察 Git 推送钩子分开记录。 |

## 范围与来源

HT1 提供自行指定矩形的逻辑命中。DOM 指针到逻辑坐标转换、事件路由、手势、无障碍、自动布局／内容边界、alpha／像素／纹理／TextField 覆盖及历史 TouchEvent 兼容需要单独设计与验收。本 CPU 增量不证明浏览器命中／手机行为、性能、完整 UI、Spine、3D 输入或完整迁移。

实现、夹具与文档是 AI 辅助的独立第一方白鹭工程，采用 **Apache-2.0**。实现组合既有第一方矩阵、树与生命周期契约；不新增依赖或外部资产。此前渲染／字体记录及其法律声明、失败和源码截止点保留原范围。
