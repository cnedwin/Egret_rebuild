# 九宫格几何 NS1：实验性契约

[English](../../en/docs/nine-slice-geometry-ns1-contract.md) | 简体中文

原始规格截止点：2026-10-12，**SOURCE_ONLY · NOT_RUN**。本文定义一个实验性 CPU 几何工厂，为复杂 2D 界面中的固定边框面板服务，范围属于 R002/R004。实现、严格类型检查和渲染器验收需要单独记录的证据。完整 UI/EUI、布局及完整 Spine 支持不在本契约范围内；R020/V020 保持 **OPEN**。

## 公共接口与所有权

拟议的命名导出通过标准 `@egret/runtime` 与 `@egret/engine` 根入口提供，使用相同的值与类型绑定，不增加包入口或子路径。

```ts
export interface NineSliceInsets2D {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}
export interface NineSliceGeometry2DOptions {
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly targetWidth: number;
  readonly targetHeight: number;
  readonly insets: NineSliceInsets2D;
}
export function createNineSliceGeometry2D(
  options: NineSliceGeometry2DOptions
): TexturedGeometry2D;
```

工厂将标准几何的所有权交给既有 `createTexturedGeometry2D` 建立。结果是具有真实品牌身份的 `TexturedGeometry2D`：冻结的记录，以及冻结的 `readonly number[]` 坐标、UV、光照颜色和索引数组。公共数组是普通数值数组，不是可写的类型化数组视图。每次调用返回新的自有几何，不保留或修改选项及边距记录。结构相似的对象不能提供其品牌身份。

这是不依赖 DOM/Node 的工厂。它不读取 Engine、Texture、资源管理器或 GPU，不获取资源、不创建额外所有者，也不提供销毁方法。保存的几何继续是不可变 CPU 值；其身份不授予资源访问权或 GPU 生命周期保证。`Mesh2D` 借用既有资源管理器签发的 `AssetLease<Texture>`。通过 `setContent(lease, geometry)` 替换内容不会转移或释放该租约。

## 尺寸与有序准入

调用方必须使 `sourceWidth`/`sourceHeight` 与所借用 Texture **未旋转**的 `sourceRect.width`/`sourceRect.height` 一致。源尺寸、目标尺寸和边距采用相对应的坐标单位。工厂不能检查或强制这种裁剪区域的一致性。本契约拉伸中心与边缘区域，保留角部尺寸；不提供平铺、修剪、旋转、`scale9Grid` 修改或自动布局失效处理。

选项和边距必须是非空、非数组对象。工厂依次读取 `sourceWidth`、`sourceHeight`、`targetWidth`、`targetHeight`、`insets`，每项一次。准入边距对象后，再依次读取 `left`、`top`、`right`、`bottom`，每项一次。允许继承属性和访问器，不枚举未知键。属性读取失败会抛出以原始错误为 `cause` 的 `TypeError`，并停止后续读取。每次调用的局部暂存隔离重入；准入和错误处理的内建函数在回调前捕获。

所有读取成功后，先按该字段顺序完成八个原始 number 类型检查，再进行任何数值范围检查。类型错误抛出 `TypeError`；有限性、范围或派生几何错误抛出 `RangeError`。因此，较后字段的错误类型优先于较早字段的数值越界。不做类型转换，不提供默认值、不钳制数值，也不返回部分结果。

所有尺寸必须有限且大于零。边距必须有限且非负；允许小数，并将带符号的零归一化。`left + right` 和 `top + bottom` 必须有限，严格小于对应源尺寸，且不超过对应目标尺寸。源中心必须具有正面积。目标小于边距之和时拒绝创建，不压缩角部以适应目标。

## 精度与有意退化

语义由实际计算的 Float64 几何定义，不等同于精确实数运算，也不承诺所有有限输入都能逐像素准确渲染。分配前拒绝非有限或顺序错误的分割线/UV、重合的源中心 UV，以及任何正边距因舍入或下溢而失去目标边缘跨度或归一化源跨度的情况。正目标中心在计算后仍须保持正跨度。这些意外塌缩抛出 `RangeError`。

零边距允许有意的零宽边框区域。目标尺寸等于其计算所得边距之和时，允许有意的零宽中心：内部两条分割线恰好在起始边距处重合。这些情况保留固定几何拓扑，包括退化三角形；不允许零目标尺寸。不以钳制方式修补精度问题。标准几何创建过程中的原生分配/复制故障原样抛出。GPU Float32 精度、剔除和渲染器预算需要另行验收。

## 标准拓扑与尺寸调整

四条横向分割线为 `X = [0, left, targetWidth - right, targetWidth]`；若 `targetWidth === left + right`，使用 `X[2] = left`。纵向分割线遵循相同规则。归一化源分割线为 `U = [0, left / sourceWidth, (sourceWidth - right) / sourceWidth, 1]`，以及对应的 `V` 值。

顶点按行排列：顶点 `4*j+i` 将 `(X[i], Y[j])` 与 `(U[i], V[j])` 配对。暂存使用 Float64 坐标/UV/光照值及 Uint16 索引。每个光照分量为 `1`。每个起始顶点为 `k` 的单元生成 `[k, k+1, k+4, k+1, k+5, k+4]`。自有结果具有 **16 个顶点、54 个索引和 18 个三角形**，包括有意退化的部分；这些是结构数量，不是绘制调用或性能声明。

对于 **8×8** 的源区域，四个边距均为 **2**：

| 几何 | 目标尺寸 | X 分割线 | Y 分割线 | U/V 分割线 |
|---|---|---|---|---|
| A | 16×12 | 0, 2, 14, 16 | 0, 2, 10, 12 | 0, 0.25, 0.75, 1 |
| 调整后的 B | 12×16 | 0, 2, 10, 12 | 0, 2, 14, 16 | 0, 0.25, 0.75, 1 |

调整尺寸时创建 B，并用同一租约替换 Mesh 内容。A、其数组及此前已完成的捕获帧保留原有值。工厂不自动更新显示对象。

## 接入示意与验证边界

常规纹理链路使用 `createEngineForProfile({ host }, TEXTURED_FRAME_PROFILE_2D)`、Engine 创建的 Scope、已注册的 Texture 提供器，以及 `engine.assets.acquire(createAssetRef(...))` 签发的真实租约。Scope 负责租约/Mesh 的清理，Mesh 负责借用。调用方必须提供来自同一 Engine 的存活 Mesh 与租约，并使用相匹配的完整 8×8 裁剪区域。

以下是**部分 API 示意，未经执行**。参数代表上述既有对象；它仅展示几何替换，不包含渲染器、资源初始化或捕获帧证据。

```ts
import { createNineSliceGeometry2D } from '@egret/engine';
import type { AssetLease, Mesh2D, Texture } from '@egret/engine';

function resizePanel(mesh: Mesh2D, textureLease: AssetLease<Texture>): void {
  const source = {
    sourceWidth: 8, sourceHeight: 8,
    insets: { left: 2, top: 2, right: 2, bottom: 2 },
  };
  const a = createNineSliceGeometry2D({ ...source, targetWidth: 16, targetHeight: 12 });
  mesh.setContent(textureLease, a);
  const b = createNineSliceGeometry2D({ ...source, targetWidth: 12, targetHeight: 16 });
  mesh.setContent(textureLease, b);
}
```

契约评审不建立 CPU/类型/GPU PASS、已交付 API 或跨设备行为。实际实现与独立验证需要单独记录，包括真实不可变捕获帧、完整回读缓冲、资源清理和环境边界。本规格不推出手机、原生 SDK、竞品性能比较或完整 UI/Spine 结论。

相关既有契约：[自有纹理几何与 Mesh2D](自有纹理几何与Mesh2D契约.md)、[Scope 所有权](Scope私有所有权.md)。NS1 是基于这些第一方公共契约独立编写的扩展。
