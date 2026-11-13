# Spine 实例的跳转

[English](../../en/docs/spine-seek.md) | 简体中文

`instance.seek` 把 Spine 实例的播放移到另一个已用时间，可以向后也可以向前。它属于 M2.2，[#84](https://github.com/cnedwin/Egret_rebuild/issues/84)，遵循 [M2 计划](m2-spine-content-plan.md)的分阶段操作契约。

## 公开流程

```js
const ticket = instance.seek({ elapsedSeconds: 1.5 });
function slice() {
  if (!ticket.step()) return later(slice);   // 由你自己安排；不会自动运行
  ticket.commit();
}
slice();
```

`seek` 规划这次移动并返回一张票据。`step()` 完成一片有上限的工作，跳转就绪时返回 true。`commit()` 替换实例的播放并返回新的快照。在此之前实例不受影响：它的快照、显示和事件都属于它现有的播放。`cancel()` 丢弃已准备的播放。

`elapsedSeconds` 是实例在 `SpineInstanceSnapshot.elapsedSeconds` 中累计的动画时间：它接受的每个增量经过速率和暂停之后的总和。

## 播放如何重建

实例保存每次被接受的推进所应用的内容：先是命令，然后是它增加的时间。跳转会在设置姿态和时间零处另建一个私有播放，并把这些步骤重新应用一遍，使用同样的不超过 1/60 秒的分段。不从当前姿态复制任何东西，所以轨道、混合、排队的条目、有限播放、皮肤、变换、速率和暂停都与如实运行的结果相同。

重放哪些步骤，决定了跳转停在哪个时刻：

- 在目标之前已经结束的每一步都完整重放。在某一步的结尾，结果与那次推进发布的内容逐值相等。
- 目标落在某一步之内时，应用这一步的命令，并只推进到目标为止。
- 恰好从目标开始的那一步不被采用。它的命令是在该时刻发布之后才应用的。
- 多个步骤结束在同一时刻时（例如暂停期间的若干次推进），跳转停在其中最后一步所在的位置。
- 当前时间之后没有历史。跳转按普通推进允许的最大步长（`maxSegments` 个六十分之一秒，默认 8）推进，不带命令。

因此，直接创建的实例的时间零就是它的设置姿态：它最初的命令是由第一次推进应用的。由[重置槽](spine-reset-slot.md)创建的实例在时间零就应用了动画，跳回时回到那个状态。

与某一步结尾只差舍入误差的目标，视为那个结尾。相同增量的求和结果可能在最后几位上不同，不能让舍入误差决定下一批命令是否被应用。

## 事件

跳转默认不派发任何事件，向后和向前都一样。

`events: 'replay'` 让向前的跳转给出当前时间之后直到目标为止的事件，顺序与运行时排队的顺序一致。事件在准备跳转时收集，只有跳转成功之后才派发：出现在 `commit()` 返回的快照中，并经过 `onEvent`。超过上限会使整次跳转以 `SPINE_INSTANCE_SEEK_EVENT_LIMIT` 失败，不会派发其中任何一部分。事件从不倒放：带 `'replay'` 的向后跳转会被拒绝。

## 上限

上限在创建实例时确定，写在选项的 `seek` 下。它们是工作量和内存的上限，不是性能测量结果。

| 选项 | 默认 | 最大 | 含义 |
| --- | ---: | ---: | --- |
| `maxSegments` | 3600 | 36000 | 一次跳转总共可以重放的分段数。超出的规划在准备任何内容之前就以 `SPINE_INSTANCE_SEEK_LIMIT` 拒绝。 |
| `sliceSegments` | 120 | 3600 | 一次 `step()` 重放的分段数。一片在会超出上限的那一步之前结束，但至少完成一步。 |
| `maxEvents` | 1024 | 8192 | 一次向前跳转可以重放的事件数。 |
| `historyAdvances` | 3600 | 36000 | 作为历史保存的推进次数。 |
| `historyCommands` | 1024 | 8192 | 作为历史保存的命令数。 |

历史超出任一上限后会被永久丢弃。播放继续进行，之后的每次跳转都以 `SPINE_INSTANCE_SEEK_HISTORY` 拒绝。目前没有可用来重建较晚时刻的检查点。通过 `requestPreserving` 接续另一个实例播放的实例不是从设置姿态开始的，同样没有历史。

## 提交之后

- `elapsedSeconds` 等于目标，`revision` 加一。`tickId` 和时钟时间不变：下一次推进仍然需要更晚的 tick。
- 历史就是被重放的那份规划。向后跳转的目标之后的内容不再是该实例的过去。
- 已发出但尚未应用的命令继续等待，由下一次推进应用。
- 已挂接的显示会绘制新的姿态。绘制失败或监听器失败的报告方式与推进相同，此时播放已经提交。

同一时间只准备一次跳转：第二次以 `SPINE_INSTANCE_SEEK_ACTIVE` 拒绝。实例的一次推进会取消进行中的跳转，因为跳转是针对推进之前的播放规划的。释放实例也会取消它。

## 恢复出错的实例

推进中途的失败会使实例进入 faulted 状态，并拒绝继续推进。它的历史只包含成功的推进，所以跳转到它最后发布的时间可以重建那份播放，提交之后故障被清除：

```js
const last = instance.getSnapshot();          // state: 'faulted'
const ticket = instance.seek({ elapsedSeconds: last.elapsedSeconds });
while (!ticket.step()) {}
ticket.commit();                              // state: 'running'
```

失败的那次推进所带的命令已经丢失；如果仍然需要，请重新发出。

## 拒绝

| 代码 | 情形 |
| --- | --- |
| `SPINE_INSTANCE_SEEK_INVALID` | 目标不是大于等于零的有限时间，或 `events` 不是两个取值之一 |
| `SPINE_INSTANCE_SEEK_BACKWARD_EVENTS` | `events: 'replay'` 而目标早于当前时间 |
| `SPINE_INSTANCE_SEEK_ACTIVE` | 已有一次跳转在进行 |
| `SPINE_INSTANCE_SEEK_HISTORY` | 历史已被丢弃，或者从未始于设置姿态 |
| `SPINE_INSTANCE_SEEK_LIMIT` | 规划需要的分段数或步数超出上限 |
| `SPINE_INSTANCE_SEEK_EVENT_LIMIT` | 向前跳转经过的事件多于可重放的数量 |
| `SPINE_INSTANCE_SEEK_NOT_READY` | 在 `step()` 返回 true 之前调用 `commit()` |
| `SPINE_INSTANCE_SEEK_FAILED` | 重放或发布失败，附带原因。实例保持原样。 |
| `SPINE_INSTANCE_SEEK_COMMITTED`、`_CANCELLED` | 票据结束之后又被使用 |

## 已检查的内容

[`packages/spine/test/seek.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/packages/spine/test/seek.test.mjs) 在原创的数值夹具上有 20 项用例。两份脚本（一份是混合命令，一份是有限播放和队列）中，跳转到每一步结尾的结果都与直接运行逐值相等。十二份随机脚本中的每次跳转，以及跳转之后继续运行的结果也是如此。其余用例覆盖步内目标、带事件和不带事件的向前跳转、分片、两种预算、历史上限、取消、待应用命令、故障恢复、重置槽，以及随提交更新的显示。

向构建产物逐个写入了四十二个错误，测试发现了三十八个。其余的有两个只是释放无人能访问的对象，一个只在舍入恰好重合时才有差别，最后一个就是下面的开放项目。

## 尚未完成

- 没有任何夹具带有物理约束。重置步骤按它原本使用的物理重置方式重放，而没有测试能把它与普通的姿态更新区分开。带物理的内容需要授权的夹具。
- 没有使用官方或授权的 Spine 导出文件。夹具都是原创的数值内容。
- 长时间运行的实例默认在 3600 次推进之后丢失历史。能让它在最近一段时间内跳转的检查点尚未实现。
- 跳转尚未接入序列控制或编辑器时间线。
