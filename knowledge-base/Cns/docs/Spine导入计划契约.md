# Spine 导入计划契约

简体中文 | [English](../../en/docs/spine-import-plan-contract.md)

工程预览 0.34.0，SP1-A。可选 `@egret/project/spine` 入口为稳定版 4.3 JSON、现代图集文本和显式页面资源绑定提供同步、不可变的导入计划。接纳表示通过有限规划 profile；动画语义、图像数据、播放、渲染、运行库兼容性和许可资格需要分别验证。完整 Spine 支持仍对应需求 R020 和交付 V020。

## 公共使用

```ts
import {createSpineImportPlan} from '@egret/project/spine';

const provenance = {
  origin: 'Original programmatic fixture',
  license: 'Apache-2.0',
  notice: 'Egret community fixture',
};
const result = createSpineImportPlan({
  skeleton: {
    id: 'skeleton:original',
    text: '{"skeleton":{"spine":"4.3.13"}}',
    provenance,
  },
  atlas: {
    id: 'atlas:original',
    text: 'page.png\nsize: 1,1\n',
    provenance,
  },
  pages: [{pageName: 'page.png', assetId: 'page:original', provenance}],
});
if (result.ok) {
  // 声明的资源 ID 仍是普通数据；计划不加载图像。
  console.log(result.value.pages[0]?.assetId);
} else {
  console.log(result.diagnostics[0]);
}
```

两个运行时导出是 `createSpineImportPlan` 和冻结的 `SPINE_IMPORT_LIMITS`；十一种导出类型描述输入、来源声明、计划、诊断和文本位置。既有 `@egret/project` 根入口保留六个运行时值及既有类型。此入口复用 jsonc-parser 3.3.1 语法基础，不新增运行库依赖、宿主全局、网络访问、资源查找或回调。

输入是具有精确、可枚举自有数据属性的 Object/null 原型记录，以及稠密普通数组。getter、symbol、未知字段和不支持的原型会被拒绝，不调用 getter。反射异常转为固定输入诊断；任意 proxy trap 的副作用不在保证范围内。输出拥有并冻结自己的记录和数组，不保留调用者可变对象、不修改工程、不分配 Scope，也无需释放。

## 版本、图集与依赖

稳定 `4.3.<patch>` 头信息可以接纳并原样保留；预发布、格式错误和其他系列有不同拒绝。接纳头信息不证明兼容未来全部补丁。计划记录研究候选 `@esotericsoftware/spine-core`、源码标签 `spine-ts-4.3.13` 及提交 `b7beb2ccbbce667a12c02f44d070644f59b04968`，此规划切片中的发行物验证明确为 `not_run`。

图集页面要求 `size`，区域要求现代 `bounds`。旋转限于 false/0 或 true/90。完整十进制整数 token 必须有限且安全，通过各成员范围后，再检查打包尺寸和原始尺寸的容纳关系。旧 `xy/size/offset/orig` 区域格式及全局头字段不属于此首阶段白鹭规划 profile。这是工程接纳选择；上游完整格式范围更广。

首个页面名称前的已知页面字段（`size`、`format`、`filter`、`repeat` 或 `pma`）属于不支持的全局页头；未知字段属于孤立字段语法错误。两者使用原始行的位置及空 atlas pointer。

页面路径采用白鹭可移植路径规则，保留原始名称，拒绝 NFC/大小写可移植键冲突。区域身份为精确的 `(name,index)` 对。每个页面要求一个逐字匹配的绑定，不允许多余绑定。资源 ID 可以共享，必须是去除空白后非空的合法字符串，保存未裁剪的原始写法。它们是声明，不是真实 AssetRef 或路径；不会隐式解析 URL 或文件系统。

计划保留声明的 format、filter、repeat 和 PMA。Linear/mipmap 采样、重复纹理、其他格式、PMA、混合与暗色 tint、约束、序列和显式附件类型会作为兼容性关注项展示。骨骼、插槽、皮肤、动画名称及选定特征标记只构成清单。成功始终保留 `featureInventory: 'partial'`、`animationSemantics: 'not_run'`、`rendering: 'not_run'` 和 `licenseEntitlement: 'unverified'`。未知或自定义元数据不会提升这些状态。

## 预算、诊断与顺序

`SPINE_IMPORT_LIMITS` 精确公开 28 项固定上限。主要限制为骨骼文本 8 MiB、图集文本 1 MiB、深度 32、JSON 值节点 262144、属性 131072、图集页面 64、区域总数 8192。尺寸、坐标和偏移分别有最高 16384 的限制；元组转换不会截断或舍入不安全整数。这些是接纳预算，不是设备能力或性能结果。预算重叠可能使某项上限的成功见证无法到达。

致命阶段依次为元数据/来源声明、原始 Unicode/字节、完整迭代 scanner 词法/深度预检、严格 visitor 语法/解码 key/分配、规划 schema/版本、图集、绑定。后续深度错误可能先于更早但在 visitor 阶段才发现的重复键。契约不承诺全局最早字符优先。失败只返回一个致命诊断，不包含部分计划或此前警告。

诊断包含 `source: 'input' | 'skeleton' | 'atlas'`、转义且有界的 JSON pointer、固定英文消息，以及可选文本位置。input 没有主要文本 span。offset/length 对应原始 UTF-16 文本；行列从 1 开始，CRLF 为一个换行。解码 key 的 Unicode 无效时，使用已接纳的父 pointer 和原始 key token。缺失字段使用所属对象或页面名称位置，重复 token 保留较早的 relatedSpan。消费者应按输出场景转义文本和来源 ID。

成功警告按 profile、清单、来源声明顺序排列，每类最多一个。声明的 SHA-256 字符串会保留，但不计算或核验。origin/license/notice 声明不能证明作者身份、分发权利或 Spine Editor 资格。运行库集成必须独立保留适用的上游条款；白鹭自研代码的 Apache-2.0 不替代这些条款。

## 来源与验证

格式研究参考[官方图集格式](https://esotericsoftware.com/spine-atlas-format)、固定版本 [TextureAtlas 源码](https://github.com/EsotericSoftware/spine-runtimes/blob/b7beb2ccbbce667a12c02f44d070644f59b04968/spine-ts/spine-core/src/TextureAtlas.ts)及 [SkeletonJson 源码](https://github.com/EsotericSoftware/spine-runtimes/blob/b7beb2ccbbce667a12c02f44d070644f59b04968/spine-ts/spine-core/src/SkeletonJson.ts)。白鹭独立定义计划、所有权、预算、严格接纳和诊断。夹具是原创程序化 Apache-2.0 数据，不是获得许可的 Editor 导出。

实际源码、行为、类型、反例和交付结果见[证据说明](Spine导入计划证据.md)与[验证记录](../../evidence/spine-import-plan-verification.json)。源码研究和拟议测试预期不替代实际结果。官方运行库的动画/渲染集成属于独立工作，不以此规划工具作为额外前置条件。
