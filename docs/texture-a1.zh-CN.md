# Texture A1：不可变CPU图像与带属性几何

A1交付CPU值、借用显示节点、保存帧与私有几何准备。生产Canvas/WebGPU仍在尺寸修改、绘制和队列操作前拒绝图像命令。A1没有采样渲染、浏览器认证或GPU生命周期认证。下列全部A2门槛均为UNRUN。

## 所有权与身份

ImageData2D从真实Uint8Array及已附着的固定ArrayBuffer复制精确4×宽×高字节；共享、可变长、已分离缓冲、代理及错误字节类型均被拒绝。描述符按width→height→pixels→format→colorSpace→alphaMode→origin先完整读取再判断语义。CPU格式为straight RGBA8、编码sRGB、左上原点、紧密4×宽行。copyImageData2DPixels返回独立新副本。冻结元数据不暴露可变像素、浏览器资源、处置或动态解析接口。初始化时假定正常realm原生对象。

品牌是模块私有身份；伪对象、代理和重复contracts模块创建的值无法通过认证。runtime、engine、host应使用同一兼容contracts身份。Texture工厂首先认证图像，再复制冻结整数、正尺寸、完全包含的源区域，省略时采用整图，-0归0。构造器私有；dispose终结包装器并仅丢弃图像引用，尺寸/区域仍可读；已保存图像仍持有像素。isTexture对已处置包装器仍为真，imageData报TEXTURE_DISPOSED。

Bitmap借用精确AssetLease<Texture>，不获取或释放租约；设置全部验证成功后才提交。清空/处置丢弃借用并把缓存自然尺寸归零，保持Engine归属，不释放调用方租约。释放使未来可见捕获失败，其他独立有效租约保留独立权益；最后释放触发提供者处置时共享Texture可能失效。租约/Texture死亡本身不改变缓存尺寸。已保存帧持有不可变值，不持有租约/包装器，可在释放、失效和Engine关闭后交给另一兼容CPU host；GC时机及全局内存不作保证。

后续 [Bitmap 区域契约](../knowledge-base/Cns/docs/bitmap-region-contract.md) 已实施 `Bitmap.sourceRect`：Texture 原视图仍不可变，每个借用者拥有自己的有效裁剪与匹配自然尺寸。[CPU 证据](../knowledge-base/Cns/docs/bitmap-region-evidence.md)与单独[纹理首四项采集](../knowledge-base/Cns/docs/texture-first-four-evidence.md)各自保留源码／用例范围，后者数值边界仍为 UNKNOWN。以下原 A1 描述与 A2 义务保留历史范围。

## 固定上限与错误顺序

冻结IMAGE_LIMITS_2D：源边4096、源像素1048576、表长度64、独立视图128、独立表字节16777216、独立投影字节16777216、scratch33554432、pending33554432。均用安全整数，无强制转换；含未引用条目的相同图像身份仅计一次字节，但重复表项仍占64容量。视图身份含图像与x/y/width/height。A1负责源/表/视图/投影上限，A2负责scratch/pending分配预留。不包括驱动开销和调用方保存帧；不是可配置选项，FrameOptions2D/EngineOptions不变。

描述符完整快照之后，图像工厂按精确顺序验证：width数值类型、有限正安全整数/范围；height同样；源边/像素上限及精确字节算术；format→colorSpace→alphaMode→origin字面量；像素原生Uint8Array类型；缓冲种类；resizable；attachment；原生视图offset/byte length；最后分配/复制。无强制转换或截断，-0尺寸因非正被拒绝。图像读取异常为保留cause的TypeError；类型、元数据、品牌错误为TypeError，尺寸/容量/字节长度为RangeError，原生分配异常直接传播。Texture先TEXTURE_IMAGE_INVALID，再完整区域字段读取及TEXTURE_REGION_INVALID（保留cause）；直接构造Texture而没有私有工厂token报TEXTURE_FACTORY_REQUIRED，接收者认证为TEXTURE_INVALID。Bitmap接收者先BITMAP_INVALID；构造顺序为BITMAP_LEASE_INVALID→ASSET_LEASE_RELEASED→BITMAP_TEXTURE_INVALID→TEXTURE_DISPOSED→ENGINE_CLOSED。Setter先接收者→OBJECT_DISPOSED→ENGINE_CLOSED，再undefined清空或租约品牌→ENGINE_MISMATCH→有效/值/存活。失败不更换原槽；dispose先丢借用再基类监听器清理，基类异常传播。

Engine顺序保持open→busy→render的renderer-required→有序选项→open→遍历→open→frameId耗尽→构造/提交。捕获失败不消耗ID、不发FRAME_RENDER_FAILED；仅renderer失败被包装/诊断。遍历保持绘制顺序与抑制，几何先于权益，图像首次发出时按身份去重；容量失败FRAME_IMAGE_BUDGET。collectFrameContent认证真实Stage（FRAME_STAGE_INVALID），遍历前后检查Engine；仅runtime公开，engine不再导出。旧collectFrameCommands保留历史Stage/矩形语义，在有效图像将发出时先FRAME_IMAGE_UNSUPPORTED、后图像预算。

私有混合copier在纯矩形帧不读images。首图像读取安全整数表长度一次。长度大于64时先报budget，不分配数组、不读索引。接纳0..64长度后各索引读取一次、不用迭代器；含未引用条目在内全部认证后才计表字节/视图预算及处理几何。此超长表优先级明确替代原先认证先于容量检查的行为。图像顺序matrix→目标rect→alpha→clips→imageIndex→sourceRect；消除无覆盖前完整验证。已知getter由FrameInputReadError保留原cause，包括仅索引抛出的内部类sentinel。新表/图像clip的Array.isArray异常原点包装，旧header/矩形撤销代理仍原样抛出。语义为FrameCopyError invalid/budget/backing，原生分配不分类；先出现的header/绘制错误优先。

## 私有几何与CPU观察

engine相对私有接口为prepareImage2D(command,width,height,options)、normalizeImagePolygon(points,options)、packImageVertices2D(prepared,width,height,maxUploadBytes)，不是包根API。点含x/y/u/v；空输出仍保留imageIndex/sourceRect/alpha。裁剪视图局部UV为(0,0),(1,0),(1,1),(0,1)。共享角点、规范端点交叉、遍历和打包位置为狭窄第一方抽取，保持矩形{x,y}形状、算术、行列式顺序/预算及旧packer错误类。GeometryPreparationError为range/precision/budget；非零坐标2^-100..2^20，polygon上限1024。保留共线属性点；相邻同位置不同UV、非相邻重复位置及混合转向报precision，全共线为空。两种策略包装仅共享连续三点绕序收尾：定向调用顺序、混合符号拒绝、全共线为空及完整属性点反转保持相同。反转完整点及属性，不用逆矩阵、epsilon、UV钳制或1-t。

零alpha、奇异变换、空clip仍预验证全部clip。顶点/边预算每次调用独立；只有集成测试跨交替命令维护剩余帧预算，没有新增生产混合dispatcher。24个fan顶点通过，23失败；352个边测试通过，351失败。Quad为六顶点96字节，95失败。A1观察布局xNDC/yNDC/u/v，每顶点16字节，不是A2接受的pipeline。每fan共享角只转换一次，不跨命令合并。表示后零面积三角形跳过并计数，反向绕序失败；记录backing/UV位移但不设数值容忍阈值。Opacity保持元数据，仅未来评审renderer乘一次。

## A2停止门槛：全部UNRUN

先独立spike与评审计划，预注册nearest及编码sRGB source-over oracle，区分内部texel/量化/三角接缝/外部栅格边，先推导精度界再确认语料。需生产Canvas/WebGPU采样回读、黑白背景合成及浏览器/设备/版本。语料含alpha0/1/127/128/254/255、透明有色texel、奇数行宽、小数DPR、缩小、混合顺序；double-premultiply/wrong-transfer/UV-reversal/texture-sort对照必须失败。界限未解决阻止验收，不能为通过而放宽。

A2拥有crop/full-copy/premultiply scratch预留、固定pending上限、较低设备限制、host错误/close重入优先级及完整提交资源结算。release-before-fence、write后encode失败、close重入、loss/rejection/hang、cleanup抛出和exactly-once清理需分别mock/真实浏览器证据。Engine先处置CPU资产再stop/close；异步不读租约/Texture；不安全证明不能认证安全归还，timeout不是取消，借用device不销毁。未来nearest/clamp/single-mip rgba8unorm上传需floor((C*A+127)/255)、无自动sRGB转换、一次opacity；A1未实现。

## 来源与证据

第一方实现及从旧矩形几何/webgpuPass狭窄抽取；沿用robust-predicates定向依赖，无新增依赖或上游代码复制。未来接口一手参考：[GPUWeb](https://gpuweb.github.io/gpuweb/)、[WGSL](https://www.w3.org/TR/WGSL/)、[Canvas标准](https://html.spec.whatwg.org/multipage/canvas.html)。它们不证明A1实验结果。见[CPU证据](evidence/texture-a1.zh-CN.md)；独立审查与发布验证和CPU测试分别记录。

## 公共声明（精确TypeScript签名）

```ts
// @egret/contracts
declare const imageData2DBrand: unique symbol; // not exported
export interface ImageData2DInput {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array<ArrayBuffer>;
  readonly format?: "rgba8unorm";
  readonly colorSpace?: "srgb";
  readonly alphaMode?: "straight";
  readonly origin?: "top-left";
}
export interface ImageData2D {
  readonly [imageData2DBrand]: true;
  readonly width: number;
  readonly height: number;
  readonly bytesPerRow: number;
  readonly byteLength: number;
  readonly format: "rgba8unorm";
  readonly colorSpace: "srgb";
  readonly alphaMode: "straight";
  readonly origin: "top-left";
}
export declare function createImageData2D(input: ImageData2DInput): ImageData2D;
export declare function isImageData2D(value: unknown): value is ImageData2D;
export declare function copyImageData2DPixels(image: ImageData2D): Uint8Array<ArrayBuffer>;
export interface TextureRegion2D {
  readonly x: number; readonly y: number;
  readonly width: number; readonly height: number;
}
export declare const IMAGE_LIMITS_2D: Readonly<{
  maxSourceEdge: 4096; maxSourcePixels: 1048576;
  maxImagesPerFrame: 64; maxViewsPerFrame: 128;
  maxImageTableBytes: 16777216; maxProjectionBytes: 16777216;
  maxImageScratchBytes: 33554432; maxPendingTextureBytes: 33554432;
}>;
```

```ts
// @egret/runtime; existing same-package imports
import type { ImageData2D, TextureRegion2D, RenderCommand2D, RectangleCommand2D } from "@egret/contracts";
import type { AssetLease } from "./AssetLease.js";
import type { Stage } from "./Stage.js";
import { DisplayObject } from "./DisplayObject.js";
export declare class Texture {
  private readonly textureBrand: void;
  private constructor();
  get imageData(): ImageData2D;
  get sourceRect(): TextureRegion2D;
  get width(): number;
  get height(): number;
  get isDisposed(): boolean;
  dispose(): void;
}
export declare function createTexture(image: ImageData2D, sourceRect?: TextureRegion2D): Texture;
export declare function isTexture(value: unknown): value is Texture;
export declare class Bitmap extends DisplayObject {
  constructor(textureLease: AssetLease<Texture>);
  get textureLease(): AssetLease<Texture> | undefined;
  set textureLease(value: AssetLease<Texture> | undefined);
  get naturalWidth(): number;
  get naturalHeight(): number;
  override dispose(): void;
}
export interface CapturedContent2D {
  readonly commands: readonly RenderCommand2D[];
  readonly images?: readonly ImageData2D[];
}
export declare function collectFrameContent(stage: Stage): CapturedContent2D;
export declare function collectFrameCommands(stage: Stage): readonly RectangleCommand2D[];
```

```ts
// @egret/contracts RenderFrame2D replacement; existing coordinate types unchanged
import type { HostAdapter } from "./HostAdapter.js";
export interface Matrix2D {
  readonly a: number; readonly b: number; readonly c: number;
  readonly d: number; readonly tx: number; readonly ty: number;
}
export interface Rectangle2D {
  readonly x: number; readonly y: number;
  readonly width: number; readonly height: number;
}
export interface ClipRectangle2D {
  readonly matrix: Matrix2D; readonly rect: Rectangle2D;
}
export interface RectangleCommand2D {
  readonly kind: "rect"; readonly matrix: Matrix2D;
  readonly rect: Rectangle2D; readonly color: number;
  readonly alpha: number; readonly clips: readonly ClipRectangle2D[];
}
export interface ImageCommand2D {
  readonly kind: "image"; readonly matrix: Matrix2D;
  readonly rect: Rectangle2D; readonly alpha: number;
  readonly clips: readonly ClipRectangle2D[];
  readonly imageIndex: number; readonly sourceRect: TextureRegion2D;
}
export type RenderCommand2D = RectangleCommand2D | ImageCommand2D;
export interface FrameOptions2D {
  readonly width: number; readonly height: number;
  readonly clearColor?: number; readonly clearAlpha?: number;
}
export interface RenderFrame2D {
  readonly frameId: number; readonly width: number; readonly height: number;
  readonly clearColor: number; readonly clearAlpha: number;
  readonly commands: readonly RenderCommand2D[];
  readonly images?: readonly ImageData2D[];
}
export interface RenderHostAdapter extends HostAdapter {
  renderFrame(frame: RenderFrame2D): undefined;
}
```
