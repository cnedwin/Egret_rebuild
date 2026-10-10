# Bitmap 区域契约

[English](../../en/docs/bitmap-region-contract.md) · [API 与命名](公共API设计与命名规范.md) · [CPU 序列帧契约](sequence-clip-contract.md)

`Bitmap.sourceRect` 已支持一个 Bitmap 在借用同一图集租约时切换裁剪。首方实现通过构建、**113/113 项专项 CPU 检查**及选定类型检查；独立源码和保存 CPU 证据审阅未发现可行动的 P1/P2 问题。见[有限证据](bitmap-region-evidence.md)。本证据整理不包含后继完整 prepush，推送前必须另行通过新检查；本检查点的原生可见序列验证仍为 **UNRUN**，本契约不声称已有可运行的动画播放器。

## 坐标、复位与所有权

已实施成员使用既有 `TextureRegion2D` 类型：

```ts
get sourceRect(): TextureRegion2D | undefined;
set sourceRect(value: TextureRegion2D | undefined);
```

getter 返回有效区域的冻结、只读元数据，坐标是 `ImageData2D` 的绝对坐标。区域必须同时落在真实图像和 Texture 原始 `sourceRect` 内；受限 Texture 不能暴露其视图以外的像素。原视图为 `(10,20,8,6)` 时，`(12,21,2,3)` 有效，`(2,1,2,3)` 不是相对坐标简写。选区不修改 Texture。局部目标几何始于 `(0,0)`，`naturalWidth`／`naturalHeight` 等于所选宽／高；图集 x/y 不变成显示偏移。

| 操作 | 要求的结果 |
| --- | --- |
| 构造或成功赋值 `textureLease`，包括赋同一租约 | 选择 Texture 的完整原视图。 |
| 已绑定存活租约／Texture 时写 `sourceRect = undefined` | 复位到原视图。 |
| 空槽位写 `sourceRect = undefined` | receiver、节点、Engine 与修改保护检查后不做改变。 |
| 空槽位写区域 | 读取区域字段前报 `BITMAP_TEXTURE_REQUIRED`。 |
| 清空 `textureLease` 或释放 Bitmap | `sourceRect` 为 `undefined`，自然尺寸为零；不保留待用裁剪。 |
| 租约替换或区域验证失败 | 保留原租约、裁剪、尺寸和 Engine 归属；外部副作用保留自身效果。 |

Bitmap 借用准确的 `AssetLease<Texture>`，不隐式取得或释放租约；release 由调用者拥有。清空或释放 Bitmap 只移除借用，保留已建立的 Engine 归属。两个借用者可选不同裁剪；独立取得的租约保有独立使用权。资产失效通知不撤销仍活跃的旧租约。

未释放且仍绑定的 Bitmap，在租约 release、Texture 释放或 Engine 关闭后，缓存区域和自然尺寸仍可读；读元数据不授予实时图像使用权。已绑定区域的任何修改，包括复位，都要求准确的存活租约／Texture 及开放的 Engine。节点和 Engine 仍开放时，租约 release 后仍允许清空租约。

## 原子修改与错误优先级

两 setter 共用每个 Bitmap 的一个私有修改保护。初始检查顺序为：真实 receiver（`BITMAP_INVALID`）、节点存活（`OBJECT_DISPOSED`）、Engine 开放（`ENGINE_CLOSED`）、重入（`BITMAP_MUTATION_REENTRANT`）。已绑定区域赋值在读取外部字段前检查准确租约使用权及存活 Texture。

非 null 对象按 `x`、`y`、`width`、`height` 顺序各读取一次；允许已知继承字段，忽略未知字段，不迭代或强制转换。四次成功读取须全部完成后才解释数字。值必须是原始安全整数：x/y 非负，宽／高为正，范围相加安全且满足绝对包含；坐标负零归为正零。形状、数字和包含错误使用 `BITMAP_REGION_INVALID`。getter 抛错使用同一错误码并保留准确原始 `cause`，包括 `undefined` 或错误形状对象；不按错误外观字段分类 cause。分配失败原样向外抛出，不提交。

读取全部成功后，setter 在验证快照数字**之前**重验节点、Engine、未变化槽位和准确的存活租约／Texture；裁剪与尺寸无回调地一起提交。因此，getter 引发节点释放时报 `OBJECT_DISPOSED`，Engine 关闭报 `ENGINE_CLOSED`，租约 release 与 Texture 释放保留 `ASSET_LEASE_RELEASED`／`TEXTURE_DISPOSED`。这些读取后故障优先于无效快照数字。getter 本身抛出时，其包装读取错误优先于读取后检查。

嵌套区域或租约修改失败且不改槽位；getter 捕获重入错误后，有效外层更新可继续。仍允许释放：先清借用，再清理监听器，外层 setter 不能恢复槽位。保护在 `finally` 中解除。此事务不撤销外部释放、release 或无关显示修改。

## 捕获、保存帧与有限预算

捕获使用私有认证状态，不以可被子类覆盖的公开 getter 为权威；在继承 alpha 抑制和使用权检查前验证缓存选区几何，保留既有绘制、抑制及旧节点错误优先级。每次可见捕获重新解析准确租约，命令和视图预算使用所选裁剪。保存命令复制／冻结裁剪，保留不可变图像值，不保留实时 Bitmap 槽位、租约或 Texture 包装器。后续输入修改、选区切换、release、资产失效或关闭不能改写保存帧；在兼容宿主重放与认证原生输出是独立工作。

既有 `IMAGE_LIMITS_2D` 不变：图像边长上限 4096、像素上限 1,048,576，每帧最多 64 个图像身份、128 个不同视图，图像表和投影各 16,777,216 字节，scratch 和 pending texture 工作各 33,554,432 字节。视图由图像身份加绝对 `(x,y,width,height)` 定义，同次捕获的相同视图去重；新捕获启用新账本。这些上限不约束调用者保留的保存帧、垃圾回收时机或整个进程／驱动内存。

## 显式序列时间与后续工作

内部 CPU 序列采样器仍不进入包入口。有限 CPU 用法使用一个完整图像的图集 Texture、一个取得的租约和一个 Bitmap；片段尺寸来自真实图像。有界调用者提供已过秒数及固定自有 options，采样区域后通过 Bitmap 本征 setter 赋值，再捕获或渲染。采样与赋值是两项操作，不是涵盖任意 options getter 的事务。每帧无需新建 Texture、取得或释放资产、使资产失效。Engine 没有时钟或 `onFrame` API；`HostAdapter.setTimeout` 是可取消计时，不是帧循环。不新增公开播放器或调度器。

6×2 图集的区域 `(0,0,2,2)`、`(2,0,1,2)`、`(3,0,3,1)`，持续 `0.125/0.25/0.125` 秒，在 `0/0.125/0.375` 秒选出 `2×2/1×2/3×1` 尺寸；`0.5` 秒时，`once` 保留末区域，`loop` 选择首区域。纯片段声明本身不授予图像权威。相对 subatlas 序列绑定、尺寸协调以及对已绑定 Texture 预验全部帧，都需要后续契约。

显示偏移与裁剪的组合应用、标签／事件、空白或裁边／旋转帧、加载／解码、骨骼／DragonBones、完整迁移、编辑器、Native SDK、设备与性能仍开放；R008/V006 与 V003 义务保留。此成员是已导出的 Bitmap 的公开 API 增量，私有捕获读取器和序列函数继续内部使用。包 0.0.0、协议 1.0 与既有许可／致谢义务保持各自范围；原生可见序列证据和发布仍是独立的待完成步骤。
