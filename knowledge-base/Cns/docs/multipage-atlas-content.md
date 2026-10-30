# 多页图集内容管线

[English](../../en/docs/multipage-atlas-content.md) | 简体中文

M2.1 在既有内容构建和资源加载器中增加第一方 `egret.atlas-pages` 1.0.0 配置。一个图集资源包含多个具名页面，每页使用现有 SpriteSheet。这是有界的源格式，不提供自动纹理打包或通用导出器适配。

## 源文件与构建产物

配方使用导入器 `{id: 'egret.atlas-pages', version: '1.0.0'}`、产物格式 `egret.atlas-pages/1`、空设置，以及一至十六个有序且互异的 PNG 资源依赖。手工编写的 JSON 源结构如下：

```json
{"format":"egret.atlas-pages-source/1","pages":[{"name":"characters","frames":[{"name":"idle","x":0,"y":0,"width":2,"height":2,"layout":{"sourceWidth":2,"sourceHeight":2,"trimX":0,"trimY":0,"packedRotation":0}}]}]}
```

源页面顺序与依赖顺序严格对应。每页包含逻辑页名和帧；生产器从已验证的 PNG 依赖取得页面尺寸。规范产物还保存每页的 `pageDependency` 序号、宽和高。内在产物不嵌入物理路径或所属项目、资源、文件 ID。重复 JSON 属性、未知字段、非法名字或帧布局会被拒绝。运行时只接受规范产物，包括属性顺序和数字写法，不接受任意解析后等价的 JSON。

名字是区分大小写的逻辑字符串，长度一至 128 个 UTF-16 单位，必须由有效 Unicode 标量组成且不含 ASCII 控制字符，不作为文件系统路径使用。页名在一个图集中唯一，帧名在一页内唯一；不同页面可以各自包含 `idle`。

限制为十六页、每页 1,024 帧、总计 8,192 帧、每页帧名 32,768 个单位（沿用 SpriteSheet 限制）、名字总计 262,144 个单位。PNG 保留既有上限：单维不超过 4,096，每页不超过 1,048,576 像素。Node 生产器限制源元数据和规范产物各不超过 4 MiB；浏览器元数据传输保留 4 MiB 字节限制，核心另限制传入字符串不超过 4,194,304 个 UTF-16 单位。每次构建的源文件／产物／扫描行预算，以及每组 128 个资源的闭包限制分别生效。

每帧使用打包矩形和既有裁剪／旋转布局。`packedRotation` 仅为 0 或 90，沿用现有打包顺时针旋转约定；90 度矩形的逻辑裁剪宽高交换。裁剪偏移和逻辑矩形必须落在声明的未裁剪源尺寸内，源尺寸上限为 65,535。本配置不增加渲染器、UV 算法或另一套 SpriteSheet。

## 运行时与所有权

```js
const group = loader.load(dataScope, ['e_pages']);
await group.ready;
const pageNames = group.getAtlasPages('e_pages');
const page = group.getAtlasPage('e_pages', pageNames[0]);
const bitmap = displayScope.use(page.createBitmap('idle'));
engine.stage.addChild(bitmap);
```

两个方法都位于现有 `ContentGroup`，返回的页名数组冻结并保留顺序。读取要求资源已选择、整组就绪且仍存活。`getAtlas(id)` 继续只读取单页图集，`getAtlasPage(id, pageName)` 只读取本多页配置；原有图像、图集和序列帧 API 含义不变。现有 Aseprite 单页准入不变，本次不增加跨页序列帧。

加载器从既有 ManifestAssetGroup 借用真实图像租约，为每页创建 SpriteSheet。同一加载器中的重叠资源组共享 AssetManager 纹理值，同时拥有独立租约。资源组不公开半成品页面；加载或页面组装失败时，先撤销全部已创建的图集，再释放底层租约。资源组、Scope、加载器或 Engine 释放会取消待定需求，迟到结果不能重新打开资源组。

返回的图集和图像租约均为借用，应用不能单独释放或转交其他 Scope 管理。先释放应用的显示／播放消费者，再释放数据组。浏览器继续使用 `createManifestContentLoader`，通过等待 `close()` 取得源与 PNG 提供器结束的结果。新核心不依赖 DOM、Node、PNG 解码或项目构建代码。

## 构建与版本替换

管线复用既有源验证、依赖键、不可变缓存块、就绪代次发布和 ProjectStore 采纳。一个 PNG 改变时，该页输出与多页元数据构建键失效，其他未变图像仍可命中缓存；旧代次产物保持完整。仅颜色变化时图集元数据字节可能相同，但依赖构建键仍变化。不建立第二套资源管理器或热更新事务。

准备新清单的加载器／资源组时保留当前显示和旧数据；候选整组就绪后，由应用切换消费者，再按先消费者、后数据的顺序退役旧代次。失败或取消的候选不会使旧资源组失效。契约不自动改绑已创建 Bitmap，也不承诺保留播放位置。

## 示例、验证与来源

完成 `pnpm setup:dev` 后运行 `node examples/atlas-pages/author.mjs`，再运行 `pnpm example:browser`。用输出的生成配置打开 `/examples/atlas-pages/index.html?config=/work/atlas-pages/run-XXXXXX/browser-config.json`。[示例说明](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/atlas-pages/README.zh-CN.md)提供后端选择和释放方式。

原创两页夹具展示红、绿、旋转／裁剪的蓝黄及青色帧，七个字面像素参考独立于渲染器编写。[验证记录](https://github.com/cnedwin/Egret_rebuild/blob/main/verification/atlas-pages/verification.json)分别记录已构建公共 API 的行为／类型测试、真实 Edge WebGL2/WebGPU 像素，以及受控 HTTP 失败／取消。源和提供器计数归零只证明逻辑工作结束，不证明实体 GPU 内存释放。M1.2 性能仍保留先前 10.3 ms 对 8 ms 的未达标记录。

核心、生产器、格式与夹具为独立实现，采用 Apache-2.0 并有 AI 辅助，复用第一方内容构建、SpriteSheet 和源选择代码。PNG 使用既有固定版本 pngjs 7.0.0；jsonc-parser 3.3.1 提供严格 JSON 语法树和重复属性检查，原有来源与许可声明不变。本项不代表 Aseprite 多页导出、Spine 许可／语义、独立生产素材、手机或性能验收，也不代表全部 M2.1 完成。
