# 2D 碰撞与简单物理

[English](../../en/docs/physics-2d.md) | 简体中文

`@egret/engine/physics2d` 是一个小型 2D 刚体世界：圆、矩形和凸多边形会下落、弹起、滑动并静止下来，按质量互相推开，在开始接触和结束接触时发出通知，还可以查询某个点、某个矩形内或某条射线上有什么。角色可以用 `moveAndSlide` 移动，碰到墙会沿墙滑动而不会穿过去；瓦片地图的实心格子会合并成少量静态矩形。它没有自己的时钟：游戏每帧调用一次 `step(seconds)`，世界按这段时间能容纳的固定步数推进。它是可选入口：不导入它的游戏不会加载其中任何代码。

**验证了什么，没有验证什么。** 世界在 Node 中验证，[示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/physics-2d/README.zh-CN.md)在无头 Chromium 和软件 WebGL2 中验证，并从画布读取颜色。没有运行硬件 GPU 或手机，也没有测量帧率。见[实际运行了什么](#实际运行了什么)。

## 用法

```js
import { createPhysicsWorld } from '@egret/engine/physics2d';

const world = scope.use(createPhysicsWorld({ gravity: { x: 0, y: 600 } }));
world.addTileColliders({ columns: 32, rows: 18, tileWidth: 16, tileHeight: 16, solid: (column, row) => map.solidAt(column, row) });
const stone = world.addBody({ shape: { kind: 'circle', radius: 8 }, x: 200, y: 40, restitution: 0.4, display: stoneView });
const hero = world.addBody({ kind: 'kinematic', shape: { kind: 'box', width: 16, height: 16 }, x: 60, y: 200, display: heroView });
const pond = world.addBody({ kind: 'static', shape: { kind: 'box', width: 90, height: 30 }, x: 120, y: 240, sensor: true });
world.onContact(contact => { if (contact.sensor) splash(contact.type); });

function frame(seconds) {
  world.moveAndSlide(hero, input.x * 140 * seconds, input.y * 140 * seconds);
  world.step(seconds);
  engine.renderSharedFrame(frameOptions);
}
```

| 世界选项 | 含义 | 默认值 |
| --- | --- | --- |
| `gravity` | 作用于动态刚体的加速度，单位/秒² | `{ x: 0, y: 0 }` |
| `fixedStep`、`maxSteps` | 一步的秒数，最大 1；一次 `step` 最多走的步数，最大 120——超出的剩余时间直接丢弃 | 1/60、8 |
| `iterations` | 每步对接触速度求解的轮数，1 到 64：越多，堆叠越快稳定 | 8 |
| `bounceThreshold` | 相遇速度（单位/秒）低于它时不反弹，使静止的东西保持静止 | 重力在一步内产生的速度的两倍，至少为 1 |
| `cellSize`、`maxBodies` | 用于寻找可能相交的刚体对的网格单元大小；刚体数量上限，最大 65,536 | 64、4,096 |

| 刚体选项 | 含义 | 默认值 |
| --- | --- | --- |
| `kind` | `dynamic`（受重力、力和接触影响）、`kinematic`（只按自身速度移动，会推开动态刚体）或 `static` | `dynamic` |
| `shape` | `{ kind: 'circle', radius }`、`{ kind: 'box', width, height }` 或 `{ kind: 'polygon', points }`——围绕刚体位置的凸多边形，3 到 64 个顶点，顺时针逆时针均可 | — |
| `x`、`y`、`angle`、`vx`、`vy` | 位置（圆或矩形的中心）、旋转角度（度）、速度 | 0 |
| `density` | 质量等于面积乘以密度 | 1 |
| `restitution`、`friction` | 0 到 1：接触后弹回的程度，取两者中较大的；0 及以上：摩擦，两者合成为 `sqrt(a × b)` | 0、0.3 |
| `gravityScale`、`layer`、`mask` | 受重力影响的倍数；两个刚体只有在各自的层都在对方的掩码中时才会接触 | 1、1、全部 |
| `sensor`、`display`、`data` | 传感器只接收接触通知，不推任何东西；添加刚体时以及每步之后同步到刚体位置和角度的显示对象；游戏自己的任意数据 | false |

刚体上可读写 `x`、`y`、`angle`、`vx`、`vy`、`restitution`、`friction`、`gravityScale`、`layer` 和 `mask`，并有 `applyImpulse(x, y)`、`applyForce(x, y)`（作用于下一步）、`bounds()`、`mass`、`state` 和 `data`。世界有 `addBody`、`removeBody`（该刚体的接触会结束并发出通知）、`addTileColliders(grid)`（实心格子先横向、再向下合并，返回静态矩形）、`step(seconds)`（返回实际走的步数）、`onContact(listener)`（返回一个取消监听的函数）、`queryPoint(x, y, mask?)`、`queryRect(rect, mask?)`、`raycast(from, to, mask?)`（线段上遇到的第一个实体刚体，以及交点、法线和比例；传感器不参与，起点在刚体内部的射线不算碰到它）、`moveAndSlide(body, dx, dy)`（先横向再纵向，每进入一个静态或运动学刚体就被推回，按不超过刚体一半大小分段移动，并返回滑过的法线）、`snapshot()` 和 `dispose()`。接触在每步之后按两个刚体的 id 顺序通知开始和结束；边缘相贴也算接触，所以并排的两个矩形处于接触状态。

刚体不会自己旋转：接触只沿法线推，没有角速度，所以被撞到角的箱子会滑走而不会翻倒。要转动刚体，直接设置它的 `angle`。刚体对先用网格筛选，再用分离轴判断；体积小、速度快的刚体可能在一步内穿过很薄的墙，所以要让每步的位移小于最薄的墙，或者用 `moveAndSlide` 移动它。

## 错误

| 代码 | 触发时机 |
| --- | --- |
| `PHYSICS_OPTIONS_INVALID` | 某个选项或参数不合法 |
| `PHYSICS_BODY_LIMIT` | 世界中已有 `maxBodies` 个刚体 |
| `PHYSICS_BODY_INVALID` | 刚体不属于这个世界，或已被移除 |
| `PHYSICS_LISTENER_FAILED` | 某个接触监听器抛出异常；其他监听器会先收到通知，第一个异常作为原因 |
| `PHYSICS_CLOSED` | 世界已被释放 |

## 实际运行了什么

| 内容 | 环境 | 结果 |
| --- | --- | --- |
| 选项、不均匀更新下的固定步长、下落与静止、弹跳以及低于阈值后静止、不同质量间的动量、斜坡上的摩擦、旋转的形状与多边形、射线在边缘和端点处的结果、接触的开始与结束及其顺序、层与掩码、传感器、运动学刚体、沿墙滑动、网格碰撞体合并、显示对象跟随刚体、堆叠稳定、抛出异常的监听器、释放、严格模式 TypeScript 使用方及五种被拒绝的误用，以及导出 | Node，[`tests/physics-2d.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/physics-2d.test.mjs) | 23 个用例 |
| 逐一改动两个构建产物模块中的每个比较、布尔、逻辑和算术运算符 | Node | 改动 452 处，捕获 397 处；其余改动不产生可观察的差异——两边相等时边界取哪一侧、让已收敛的循环多跑一轮、重复的检查 |
| 示例：由网格生成的大厅、射线、按键移动的弟子会停在墙边并沿平台滑动、停在平台上的石头、沿斜坡滑下的石头、在池塘中弹跳并点亮池塘的石头、点击和按钮投下的石头稳定下来且互不穿透、实时键盘输入、手机配置下的点按 | 无头 Chromium 153，软件 WebGL2 | 7 个场景 |
| 硬件 GPU、真实手机、每帧数千个刚体的开销 | — | 未运行 |

## 不在本次范围内

- 刚体自行旋转（角速度、力矩、转动惯量）；关节和弹簧；快速刚体的连续碰撞检测；凹形状（只能拆成多个刚体）；`moveAndSlide` 中的斜坡和单向平台。
