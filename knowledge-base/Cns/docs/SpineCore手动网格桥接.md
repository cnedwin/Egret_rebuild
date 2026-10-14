# Spine Core 手动网格桥接

[English](../../en/docs/spine-core-manual-bridge.md) | 简体中文

工程预览 **0.47.0** · **S101 / V052**。F2-C 是可选的开发实验，将白鹭自有资源与显示树连接到外部提供的官方 Spine Core **4.3.13** 运行时。它把此前准入的 [F2-B 源规格](Spine线性动画源规格契约.md)从源规划推进到有限的手动姿态采样。[验证与待完成工作](SpineCore手动网格桥接证据.md)单独说明实际验收截止点。完整 Spine **R020/V020** 与旧工程迁移 **R008/V006 保持 OPEN**。

## 入口与公开 API

独立构建后，使用 `knowledge-base/experiments/spine-f2-core/dist/index.js`。该实验与默认 Engine、Runtime、Project 入口分离；默认入口不增加 Spine Core 导出或依赖。完整公开命名空间只有一个运行时值 `createF2CoreResources` 和四个擦除类型：`F2CoreCreateOptions`、`F2CoreResources`、`F2CoreInstanceState`、`F2CoreInstance`。

```ts
createF2CoreResources(
  engine: Engine,
  resourceScope: Scope,
  options: F2CoreCreateOptions,
): Promise<F2CoreResources>;

interface F2CoreCreateOptions {
  readonly input: SpineImportInput;
  readonly pageRef: AssetRef<Texture>;
}

interface F2CoreResources {
  readonly isDisposed: boolean;
  createInstance(instanceScope: Scope, animationName: string): F2CoreInstance;
  dispose(): void;
}

type F2CoreInstanceState = 'live' | 'failed' | 'disposed';

interface F2CoreInstance {
  readonly display: DisplayObjectContainer | undefined;
  readonly state: F2CoreInstanceState;
  readonly sampleTimeSeconds: number;
  sampleAt(seconds: number): void;
  dispose(): void;
}
```

工厂接收原始公开 `SpineImportInput`，创建新的、已检查的 F2-B 结果，并保留自有源文本。调用者构造的 plan 不授予准入。`options` 必须恰好具有 `input` 与 `pageRef` 两个普通自有数据描述符，不调用 getter。描述符操作可能触发 Proxy 回调，因此每次操作后，即使操作抛错，也重新读取真实资源 Scope；Scope 关闭优先于附属输入观察。

页面引用的 asset ID 必须与准入的图集页精确一致。真实的 `engine.createAssetGroup(resourceScope, [pageRef], { concurrency: 1 })` 取得一个真实整图 Texture 租约。检查 Engine／Scope 归属、页尺寸、完整裁剪、退役状态与公开 ImageData2D 规格。像素必须为 RGBA8、sRGB、straight alpha、左上原点，逻辑字节数精确为 `width × height × 4`。结构仿造对象不能授予 Texture 或租约权限。仅描述尺寸的 Core 纹理包装器不拥有图片或 GPU 纹理。

## 手动采样与显示所有权

每份资源最多允许 **两个驻留实例**，失败实例在显式释放前仍计入上限。实例 Scope 必须属于同一个真实 Engine。`animationName` 必须与准入源名称精确匹配。构造后公开一个由真实 Scope 管理的 DisplayObjectContainer，其中有一个真实 Mesh2D，初始采样时间为零。把返回的根节点挂到 Engine Stage，使用正常根节点变换；渲染不会推进时间。

`sampleAt(seconds)` 为同步的绝对时间采样：只接受 **[0, 源时长]** 内的原始有限数值，继承源时长上限为 **60 秒**。支持前进、重复及后退采样。不订阅 Clock，不引入 timer、RAF 循环、动画混合或 AnimationState 接口；应用显式管理调度。

对于准入的官方版本，每次采样从 setup pose 开始，以 setup 混合参数、不循环地应用具名动画，使用 `Physics.none` 更新世界变换，再请求 Core 渲染器的二维命令。白鹭独立检查该命令并复制成公开、自有的 `TexturedGeometry2D`，不重新实现 Core 的姿态或 deform 算法。桥接保留 `Skeleton.yDown === false` 前提，不修改全局设置；复制位置时只做一次 Y 轴反转。

准入命令必须为单页、normal blend、next 为 null、白色 light color、零 dark color，且不超过 **4096 顶点／12288 索引**。实际使用的原生数组必须具有精确类型和长度；检查有限位置、标准化 UV、计数与索引范围。只有完整复制成功，才替换 Mesh 内容。不向公开几何保留 Core 命令、池化存储或 Core 对象。后续采样不会改变此前捕获的几何和 Engine 帧。

根节点子结构、mesh 身份及其内容／租约绑定由桥接拥有。调用者修改这些内容时以 `DISPLAY_MUTATED` 拒绝；这是功能性所有权检查，不是进程或对抗性隔离。采样保护在可能触发回调的显示检查之前取得；嵌套采样以 `F2C_SAMPLE_REENTRANT` 拒绝，所有路径都会释放保护。

## 失败与退役

在调用 Core 前遇到非法输入，实例保持 live，保留上次已提交的几何与时间。接触 Core 后出现意外失败，实例转为 `failed`，保留上次已提交帧并拒绝后续采样。失败实例在释放前仍占两个驻留名额之一。Scope／资源退役使实例变为 `disposed`，清除对外显示引用；重复释放无操作。

退役在回调前公布终态，依次退役实例、释放 atlas／wrapper，再释放真实资源组。资源 Scope 注册位于资源组之后，使逆序 Scope 清理先退役 facade。页面释放权限保留在 Engine 资源管理器及 provider。构造回滚不会公开半初始化 facade。原始发起原因与有序附属清理错误分别保留，清理不会覆盖原始失败。

## 使用与复现

先用固定工具构建普通仓库与保留的 F2 实验。提供现有官方 Core 4.3.13 安装，其字节必须与记录精确一致；仅在该可选实验中配置解析。运行器不安装软件、不创建别名。取得与使用上游软件须遵循适用许可证。

```text
node knowledge-base/experiments/spine-f2-core/run.mjs --help
node knowledge-base/experiments/spine-f2-core/run.mjs --spine-core <existing-official-package-directory> --output <fresh-directory-outside-repository>
```

help 说明命令接口，不启动编译、类型、姿态或浏览器工作。普通运行器记录源／工具／SDK 身份、独立编译、实际未抑制类型诊断、真实 F2C00 前提、公开命名空间与十个 CPU 用例 ID。前提失败时执行零项主用例。可选资源、回调、故障及浏览器观察器具有独立记录与计数，不计入主用例十项。

在已提供真实 Engine、资源／实例 Scope、原始输入及已注册页面引用后，应用调用顺序示意为：

```ts
const resources = await createF2CoreResources(engine, resourceScope, {
  input,
  pageRef,
});
const instance = resources.createInstance(instanceScope, 'bend');
const display = instance.display;
if (display === undefined) throw new Error('Instance was retired');
engine.stage.addChild(display);
instance.sampleAt(0.5);
// Capture or render explicitly through the selected Egret host.
instance.dispose();
resources.dispose();
```

`bend` 与 `0.5` 指原始一秒夹具，不适用于所有准入输入。应用关闭时还须按各自契约关闭 Engine 与异步 provider。

### 可选浏览器采集

修订原生采集器具有独立输入资格与验收阶段，源码接口为：

```text
node knowledge-base/experiments/spine-f2-core/native/verify.mjs --admission <absolute-reviewed-input-json> --output <fresh-absolute-directory-outside-repository>
```

采集必须先取得独立审阅的原始输入绑定，之后才能开放有限 loopback 服务或启动浏览器。绑定记录恰好具有 `schemaVersion: 1`、`kind: 'F2C_NATIVE_EXACT_INPUT_BINDING_RECORD'`、`status: 'ORIGINAL_INPUTS_BOUND_FOR_INDEPENDENT_REVIEW'` 与 `inputs`。十三个 `inputs` 键为 `repositoryRoot`、`repositoryPins`、`sdkRoot`、`sdkPins`、`readerProjection`、`reviewPins`、`runtimePins`、`nodeExecutable`、`playwrightEntry`、`edgeExecutable`、`playwrightCorePackage`、`playwrightCoreBundle`、`evidencePins`。每份完整值与数组顺序必须和 admission 一致；仓库路径保留完整 owner 相对大小写，SDK／编译输出／原始证据字节精确绑定。

admission 另外携带精确 `inputBindingPin` 与 `inputBindingReviewPin`。独立绑定评审恰好具有 `schemaVersion`、`kind`、`verdict`、`openFindings`、`findings`、`bindingRecordPin`、`checkedInputKeys`、`currentInputsMatch`、`reviewedEvidencePins`；必须报告 `PASS_EXACT_F2C_NATIVE_INPUT_BINDING_ONLY`、零项未解决发现、空 findings 数组、精确绑定 pin、全部十三个排序输入键、`currentInputsMatch: true` 及精确原始证据列表。非空发现、缺失／额外键或替换记录均被拒绝。评审说明可单独保留，不能加入封闭 schema。

证据 pin 恰好为 `{ role, pin }`，三个角色 `nativeSource`、`coreActual`、`controlsActual` 全部存在；允许 3..512 项，不允许重复的角色／完整路径组合。这绑定已接受源码及真实此前执行，不能以草拟结果替代。实际已安装的 Playwright 1.62.1／playwright-core 1.62.1 软件包、导出的 core bundle 及所选默认 `msedge` 可执行文件同样绑定。在普通 headless 启动前后核对 channel 解析，不增加 flags 或替换可执行文件。

冻结浏览器夹具使用真实原始 PNG provider、Engine、资源／实例 Scope、公开桥接及显式纹理 WebGPU 宿主，目标为 64 × 48、DPR 1，观察字面像素、运动／重复及旧帧所有权。解码 PNG 页面为 straight-alpha ImageData2D，GPU 源读回为 premultiplied；不透明字面夹具不验收其他 alpha 模式或半透明精度。模块服务使用封闭、有限依赖图，仅包括精确记录的 jsonc-parser 无扩展名路径。Canvas 纹理网格拒绝独立记录。此处说明修订采集器的源码契约；实际输入／浏览器接受以[证据截止点](SpineCore手动网格桥接证据.md)为准，不由接口存在推定。未记录 adapter 信息，不授予 GPU 身份或性能资格。

## 规格、来源及后续工作

F2-B 的全部源限制仍具有权威：单页、单一 default skin、静态非加权 mesh／region、仅平移的 setup 及线性 translate／deform 时间线。桥接会拒绝不兼容的官方运行时结构或命令。加权／链接网格、attachment 切换、约束、physics、事件、tint／dark color、打包／旋转、曲线、动画混合及完整导出版本兼容性均未在此验收。有限数值 oracle 不是所有准入规格的通用误差界。

白鹭适配器、资源／显示所有权逻辑、对照与程序生成的原始夹具／oracle 是第一方 **Apache-2.0** 工程。外部 `@esotericsoftware/spine-core` **4.3.13** 依赖适用 [Spine Runtimes License](https://github.com/EsotericSoftware/spine-runtimes/blob/b7beb2ccbbce667a12c02f44d070644f59b04968/LICENSE)。[官方源码](https://github.com/EsotericSoftware/spine-runtimes/tree/b7beb2ccbbce667a12c02f44d070644f59b04968/spine-ts/spine-core)、[运行时许可说明](https://esotericsoftware.com/spine-runtimes-license)与 [Editor 许可证](https://esotericsoftware.com/spine-editor-license)说明适用上游条款。许可资格为 **unknown**，分发资格 **unverified**。本仓库不打包 Core SDK、上游动画资产或用户提供的历史工程。研究鸣谢不授予其他产物的再分发权限。

真实设备性能、字体、移动／Native SDK、平台宿主、完整 UI 组合与完整 Spine 仍是独立工程工作。
