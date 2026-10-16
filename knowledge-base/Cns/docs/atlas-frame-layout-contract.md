# 裁去透明边缘与旋转打包的图集帧

[English](../../en/docs/atlas-frame-layout-contract.md) | 简体中文 · [证据与限制](atlas-frame-layout-evidence.md)

Egret Engine 的标准化图集帧布局，在裁去透明边缘或将像素顺时针旋转 90 度打包后，仍保持精灵的逻辑画布稳定。图标与动画帧可以共用一张紧凑图集，并保留原始尺寸和放置位置。组合使用现有 Bitmap、SpriteSheet、SequenceClip 和 SequencePlayer/SequencePlayback API，无需增加动画时钟。

**0.59.0 工程预览候选**截至 2026-10-17 编写截止点已有 SDK 及有限桌面 Canvas/WebGPU 接受证据。[示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/trimmed-atlas-playback/README.zh-CN.md)演示公开 API；配套证据记录实际环境、对照和待完成的交付门禁。

## 显式启用 profile

两个现有工厂接受可选的原始字符串 profile：

```ts
createSpriteSheet(atlasLease, frames, profile?: 'trim-rotation-v1'): SpriteSheet;
createSequenceClip(input: unknown, profile?: 'trim-rotation-v1'): SequenceClip;

interface AtlasFrameLayout {
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly trimX: number;
  readonly trimY: number;
  readonly packedRotation: 0 | 90;
}
```

`AtlasFrameLayout` 是唯一新增的擦除类型，由 Engine 和 Runtime 根入口仅以类型导出。既有帧输入和 region 类型增加可选 `layout`；启用后的 sheet region 类型为 `TextureRegion2D & { readonly layout?: AtlasFrameLayout }`。不新增运行时导出、包入口、依赖、Engine 方法或 Host 协议字段。

省略 profile 或传入 `undefined` 保留现有矩形路径：不检查 `layout`、`rotated` 或 `trimmed`，region 仍恰好包含四个裁剪字段。只有精确的原始字符串 `'trim-rotation-v1'` 启用新语义，其它值不经类型转换即拒绝。这是程序化标准输入契约，不会自动解释 exporter 格式、JSON 文本、URL 或文件。

下例使用构建后的 `@egret/engine` 入口。`lease` 是已获取、由调用者拥有的完整 6×6 图集 Texture lease；`resources` 和 `animation` 是同一 `engine` 的真实 Scope。资源按 lease → sheet → Bitmap 顺序登记，动画清理应先于资源清理。

```ts
import { createSequenceClip, createSpriteSheet } from '@egret/engine';

const sheet = resources.use(createSpriteSheet(lease, [
  { name: 'A', x: 0, y: 0, width: 2, height: 3,
    layout: { sourceWidth: 4, sourceHeight: 5,
      trimX: 1, trimY: 1, packedRotation: 0 } },
  { name: 'B', x: 3, y: 0, width: 2, height: 3,
    layout: { sourceWidth: 4, sourceHeight: 5,
      trimX: 1, trimY: 2, packedRotation: 90 } },
], 'trim-rotation-v1'));
const actor = resources.use(sheet.createBitmap('A'));
engine.stage.addChild(actor);
const clip = createSequenceClip({
  atlasWidth: sheet.atlasWidth, atlasHeight: sheet.atlasHeight,
  frames: [
    { ...sheet.getRegion('A'), durationSeconds: 0.125 },
    { ...sheet.getRegion('B'), durationSeconds: 0.25 },
  ],
}, 'trim-rotation-v1');
engine.advanceTime(0); // Establish the absolute source-time baseline.
const playback = engine.createSequencePlayback(animation, actor, clip,
  { mode: 'loop' });
playback.start();
engine.advanceTime(0.125); // Select B; logical dimensions remain 4×5.
```

`sheet.createBitmap` 每次返回新的调用者拥有的 Bitmap，应立即纳入 Scope。已裁剪的 Bitmap 可以作为 SequencePlayer 目标，条件是其 lease 的 Texture view 为完整图像，且 clip 的图集尺寸与图像相符。完整性要求针对 Texture view，而非 Bitmap 当前裁剪。

## 输入与元数据所有权

显式 profile 下，每帧都必须拥有完整 `layout` record 及全部五个 own 字段。缺少 layout、null、数组、函数或缺少字段均无效，不提供逐帧默认值。`sourceWidth`、`sourceHeight` 是正安全整数；`trimX`、`trimY` 是非负安全整数；`packedRotation` 是原始 number `0` 或 `90`。负零归一为零。不接受字符串、旋转别名、镜像或其它角度。

packed `x/y/width/height` 保留原有规则：坐标为非负安全整数，尺寸为正安全整数，求和安全且裁剪位于图集内。rotation 0 的可见解包尺寸为 `(width, height)`，rotation 90 为 `(height, width)`。`trimX + visibleWidth` 与 `trimY + visibleHeight` 都必须为安全整数并位于逻辑原始尺寸内。拒绝空帧和负 trim。

既有限制保留：1–1024 帧；sheet 名称长度为 1–128 个 UTF-16 码元，总计最多 32768 个码元，拒绝精确重复的名称。序列时长为正有限 binary64 秒，累计端点在舍入后仍须有限且严格递增。layout 不改变时间规则或这些限制。

工厂复制并冻结 region 及其五标量 layout，不保留调用者对象图。额外未知字段不读取也不保留。`getRegion` 与 `sample.region` 使用相同的拥有形状，因此将 sheet region 展开为启用后的序列帧可保留 layout。sheet 或资源退役后元数据仍可读取；这不会复活资源，也不证明物理内存行为。

## 逻辑边界与 packed 绘制

示例两帧均有 `naturalWidth === 4`、`naturalHeight === 5`，逻辑 `getBounds()` 为 `(0, 0, 4, 5)`，包含透明边缘。image command 的 `rect` 仍为 `(0, 0, 2, 3)`，`sourceRect` 仍是原 packed 图集裁剪。本契约不会分配逻辑尺寸的像素画布。边界或可见像素不会生成输入区域；鼠标输入仍须显式编写 `hitArea`。

设 `M` 为现有 display matrix，已包含 parent 变换和 anchor 偏移。packed-local 放置矩阵 `S` 按 `[a,b,c,d,tx,ty]` 表示：

| 打包方式 | 局部放置 S |
| --- | --- |
| 0 | `[1, 0, 0, 1, trimX, trimY]` |
| 顺时针 90 | `[0, -1, 1, 0, trimX, trimY + packed.width]` |

`captureFrame` 和 `captureTexturedFrame` 都生成 image matrix `M * S`，要求合成系数及 packed 四角为有限值。`packed.width` 是 packed crop 宽度，并非 `sourceWidth`。parent clip、场景子级遍历、坐标转换和 anchor 几何仍使用 `M`；图像放置修正不会改变其坐标系。现有 Canvas 与 textured WebGPU Host 消费不变的 command 结构，真实像素须分别取得后端证据。

## 应用帧与替换绑定

普通 `Bitmap.sourceRect` setter 忽略额外 layout 字段，并清除已存 layout。赋值 `textureLease` 也清除 layout，包括重设精确同一 lease。通过 `sheet.createBitmap` 或 `SequencePlayer.applyAt` 应用帧，可恢复完整的拥有 layout。启用后的应用先准备，再同时提交 crop、逻辑尺寸和 layout；只有应用成功后 `lastSample` 才改变。失败不会发布部分帧或替换旧 sample，但不会回滚外部 dispose 的副作用。

player 借用目标最初的精确 lease。即使两个 lease 指向同一 Texture，换成不同 lease 也使旧 player 以 `SEQ_BINDING_CHANGED` 拒绝；清空绑定同样如此。重设精确同一 lease 后，下次应用仍可恢复帧。slot 和 ticket 提交建立不带旧 layout 的新绑定。精确的绑定状态版本防止中间的帧应用或换走再换回满足过时的已准备绑定。这些规则不提供动画资源原子 retarget 事务。

sheet、player 和 Bitmap 借用资源生命周期：调用者或 AssetGroup 拥有 lease 与 Texture 清理责任。dispose sheet/player 不会释放该 lease，也不 dispose 调用者的 Bitmap 或 Texture。Scope 可按现有逆序清理规则拥有所创建对象。layout 仅含标量，不传递资源所有权。

`once`、`loop`、pause 和 resume 复用现有时钟与 sampler。精确帧边界选择下一帧；once 在总时长处保留末帧，loop 则回绕。暂停后的 resume 立即重新应用持有的 elapsed time 并复查精确绑定，不产生额外 clock tick。capture、渲染和保存帧 replay 不推进时间。不增加 controller seek、rate 或帧事件 API。

## 贡献者验证与失败

profile 验证在 sheet lease/完整图集准入之后、所有帧读取之前；clip 则在 input object 准入之后、own 字段捕获之前。启用后的 sheet 路径逐 record 暂存 `name/x/y/width/height`，再暂存 `layout` 和 `sourceWidth/sourceHeight/trimX/trimY/packedRotation`；整表暂存完成后再做语义检查。缺失或无效的 layout shape 先暂存，因此后续源读取抛错可以优先于前帧的 layout 错误。保留原数组 hole/non-record 的即时拒绝点。每次成功的调用者可控 sheet 操作之后，都在源读取 catch 之外复查资源存活。

clip 逐帧捕获 `x/y/width/height/durationSeconds`，再按相同 layout 次序捕获其字段，并在读取下一帧前验证本帧。因此前帧无效会阻止后续源读取。这两种调度有意保留差异。

| 拒绝家族 | 含义 |
| --- | --- |
| `SPRITE_SHEET_INPUT_INVALID` / `SEQ_INPUT_INVALID` | 无效 profile、layout record 形状或缺少 layout own 字段 |
| `SPRITE_SHEET_REGION_INVALID` / `SEQ_REGION_INVALID` | 无效标量、旋转、安全求和或逻辑/packed 范围 |
| `SPRITE_SHEET_READ_FAILED` / `SEQ_READ_FAILED` | 调用者可控源操作抛错；保留包括 `undefined` 在内的精确 cause |
| 既有 sheet/player/resource/clock 家族 | 保持既有身份、生命周期、限制、时间及应用权威 |

不新增公开错误类保证。不支持的旋转属于 region 错误，启用后缺少 layout 属于 input 错误。成功 getter 若终结 sheet 资源，则产生既有生命周期拒绝，而非源读取错误。既有可信 Bitmap 操作失败保留 primary cause，并单独保留清理错误。

## 范围

本契约通过现有 runtime 支持标准化单页 trim 和顺时针 90 度打包。exporter adapter 须先独立验证所选格式及不支持的 metadata，再生成此形状。exporter 导入、多页、pivot/nine-slice 导入、动画资源原子替换、完整 Spine R020/V020 和旧项目迁移 R008/V006 保持 OPEN。已有 nine-slice API 不等于支持图集 metadata 导入。

不可变保存帧的所有权包括拥有像素与完整放置矩阵；distinct-Host replay 须有独立真实浏览器证据。这不保证 device-loss、通用恢复、物理内存、GPU 退役、移动端或性能；这些接受领域保持 OPEN。第一方实现与文档使用既有仓库 runtime；[来源记录](https://github.com/cnedwin/Egret_rebuild/blob/main/source-origin.json)和[致谢](https://github.com/cnedwin/Egret_rebuild/blob/main/ACKNOWLEDGEMENTS.md)保留适用出处与声明。
