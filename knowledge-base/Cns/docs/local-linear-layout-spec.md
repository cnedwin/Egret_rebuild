# 本地线性布局规划器规格

[English](../../en/docs/local-linear-layout-spec.md) | 简体中文

工程预览 **0.55.0** 的可选规划器将调用方提供的尺寸转换为局部矩形位置。调用方负责选择成员及应用结果。精确行为在下文定义，已记录结果及边界见[证据记录](local-linear-layout-evidence.md)。

## 目的

调用方编写的 Button 菜单需要一致的局部矩形位置，再通过现有 Engine、Scope、资源、拾取、捕获和 Host API 应用并呈现结果。显式纯规划器提供这一有限工具。自动祖先布局及完整 UI 验收仍未完成。资源替换具有独立的异步发布及所有权契约。

## 约束与设计

自动场景树布局需要生命周期、失效传播和 bounds 策略。本规划器接受显式数字记录：调用方选择成员、调用规划器，再通过既有 display API 应用结果。规划器不拥有场景、资源、句柄或渲染时钟。

只有可选的已构建公共入口 `@egret/engine/layout` 导出运行时函数 `planLinearLayout` 及四个擦除接口。默认、web、runtime 入口及 SDK Host 协议保持既有契约。layout 运行时只从 `@egret/runtime` 导入真实 `EgretError`，不增加依赖、全局注册表或可变全局调用状态。函数不依赖 receiver。

```ts
interface LinearLayoutItem {
  readonly width: number;
  readonly height: number;
}
interface LinearLayoutOptions {
  readonly axis: 'horizontal' | 'vertical';
  readonly items: readonly LinearLayoutItem[];
  readonly gap?: number;
  readonly padding?: number;
  readonly crossAlign?: 'start' | 'center' | 'end';
}
interface LinearLayoutPlacement {
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
interface LinearLayoutPlan {
  readonly width: number;
  readonly height: number;
  readonly placements: readonly LinearLayoutPlacement[];
}
function planLinearLayout(options: LinearLayoutOptions): LinearLayoutPlan;
```

## 有序观察与校验

options 或 item record 是非 null 对象，排除数组和函数。接受继承属性、类实例及普通 Proxy record。未知字段不枚举、不读取。不使用 iterable 协议，也不做类型强制转换。

1. 校验 options record；读取一次 `axis`，只接受精确 horizontal/vertical 字符串。
2. 读取一次 `items`，要求 `Array.isArray(items)`。读取一次 `length`。观察值必须是 number、有限整数且位于 0..2^32−1，否则抛 `LAYOUT_OPTIONS_INVALID`。有效观察长度大于 4096 时，在读取任何可选字段或 item 之前抛 `LAYOUT_LIMIT`。Proxy 数组同样遵守这个已捕获上界。
3. 按 `gap`、`padding`、`crossAlign` 顺序各读并校验一次。只有 undefined 使用默认值：gap=0、padding=0、crossAlign=start。null 及其他无效标量均拒绝。
4. 从索引 0 到捕获长度−1，对槽位做一次普通 Get，校验 item record，再读取并校验一次 width，然后一次 height。每个尺寸、gap、padding 必须是有限且 >=0 的 number；所有 −0 规范为 +0。首个无效观察立即终止后续读取。

所有有序读取和标量校验都必须在**任何算术之前**完成，包括两次 padding 相加。因此，较晚的无效值或抛错 getter 优先于较早输入组合本来会产生的溢出。每次属性读取抛出的值都包装为新的真实 `EgretError('LAYOUT_OPTIONS_INVALID', {cause})`，完整保留原始抛出值，包括 undefined。分类操作本身抛错时，例如 Array.isArray 遇到撤销的 Proxy，也使用同样包装及 cause 规则。无效标量使用同一 code，不再读取后续字段。

## 快照与重入策略

这是有序数字快照，不是对用户对象的原子快照。捕获的 items 引用和长度固定。未来槽位替换、继承槽位变化或未来尺寸修改，在对应 Get 时可见；已经捕获的数字不再重读。同一 item 的 width getter 即便替换数组槽位，height 仍从已经捕获的 item 引用读取。hole 通过普通继承查找；最终未解析的 hole 得到 undefined 并失败。超过捕获长度的增长忽略；缩短可能使稍后的普通 Get 校验失败。

重入调用使用独立捕获数组、游标与结果，不发布或共享外层调用的部分状态。getter 的副作用属于调用方代码，不回滚。规划器不写输入、位置、场景树成员关系、可见性或句柄。

## 精确 binary64 计算与结果

所有捕获成功后，按以下顺序使用 JavaScript binary64，不重排结合、不补偿求和、不取整、不使用 epsilon 修正：

1. 主轴 cursor 初始为 padding。按 item 顺序记录主轴位置，然后 cursor=cursor+mainSize；仅当还有下一个 item 时再 cursor=cursor+gap。最后 mainExtent=cursor+padding。
2. 从 maxCross=+0 开始，按捕获顺序扫描交叉轴尺寸，只在 crossSize>maxCross 时替换。crossExtent=(maxCross+padding)+padding，明确为两次加法。
3. 按 item 顺序确定交叉轴位置：start=padding；center=padding+((maxCross−crossSize)/2)；end=padding+(maxCross−crossSize)。减、除、加保持该括号关系。horizontal 将主/交叉轴映射为 x/y 和 width/height；vertical 映射为 y/x 和 height/width。

每个算术中间结果都检查有限性，首个非有限值抛真实 `EgretError('LAYOUT_OVERFLOW')`，不发布部分结果。空输入仍计算 padding 的两次相加并返回空 placements；零 item 也可能因 padding 过大溢出。

返回全新普通冻结 plan、全新冻结 placements 数组及每个 item 的全新冻结 row，顺序与输入一致。plan 精确键为 width,height,placements；row 精确键为 index,x,y,width,height。结果不保留输入或 item 别名。所有输出零均为 +0；重复空调用同样返回不同 envelope/数组。

字面示例：
- horizontal center，[(8,6),(4,2)]，gap2、padding1：范围 (16,8)；row (index,x,y,width,height) 为 (0,1,1,8,6)、(1,11,3,4,2)。
- 同样输入、gap、padding，vertical end：范围 (10,12)；row 为 (0,1,1,8,6)、(1,5,9,4,2)。
- 空输入、padding3：范围 (6,6)，无 row。单个 (2,4)、padding2：范围 (6,8)，row (0,2,2,2,4)。
- horizontal 宽度 [1e16,1,1]，gap/padding 为零：按规定左结合加法，主轴范围为 1e16；不得重排为 10000000000000002。

## 使用

构建 SDK 后，从已构建公共入口导入：

```ts
import {planLinearLayout} from '@egret/engine/layout';

const plan = planLinearLayout({
  axis: 'horizontal',
  items: [{width: 8, height: 6}, {width: 4, height: 2}],
  gap: 2,
  padding: 1,
  crossAlign: 'center',
});
// plan.width === 16; plan.height === 8
// plan.placements[1] is {index: 1, x: 11, y: 3, width: 4, height: 2}.
```

调用方编写尺寸、过滤排除项，在成员或方向变化后重算，并把 placement 应用于目标局部坐标系。placement 是矩形原点；非零 pivot 需要调用方显式补偿。不提供文字测量、bounds 发现、自动可见性过滤、场景树遍历或事务式场景提交。

原创 `examples/linear-layout` 应用使用两个既有 Button，间距 2、内边距 2、交叉轴起点对齐。应用完成规划后才写场景坐标，因此拒绝 `gap: -1` 时，由调用方的操作顺序保留上一个有效计划及场景。重放保存的横向帧会提交原捕获帧，实时布局仍可保留纵向、过滤或重排状态。

## 验收与边界

公共 fixtures 使用已构建包入口，检查字面布局、数量边界、有序读取和精确 cause、快照修改、重入、新鲜冻结结果及 binary64 括号顺序。组合检查使用真实 Engine、Scope、资源、输入和 Button 对象及受控端口；这些检查不证明真实浏览器行为。

真实 Canvas/WebGPU 验收需要单独冻结的全量字面 RGBA schedule、真实主鼠标路由、保存/实时呈现、所有者退役及 Engine 关闭。每次 WebGPU 呈现都必须在提交前创建并等待真实 readback，包括辅助启动帧。全新的 Canvas 错误期望对照必须独立失败，主验收 credit 为零。schedule 在实际执行之前仍是源材料；计划次数不是观察结果。

本增量不证明自动 EUI 布局、flex/约束/自动尺寸、文字/字体/IME、虚拟列表、滚动/focus/键盘/touch、完整 Spine、迁移、高级 3D、手机性能、Native SDK 或通用 host 验收。当前完成及待完成项见[证据记录](local-linear-layout-evidence.md)。
