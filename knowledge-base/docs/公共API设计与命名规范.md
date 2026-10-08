# 公共 API 设计与命名规范

[English](公共API设计与命名规范.en.md) | 简体中文


## 0.12.0 显示与帧候选范围

后续工作包按[显示与帧合同](显示与帧执行合同.md)及[实现计划](显示与帧执行实现计划.md)推进：显示变换、继承可见性/透明度与本地矩形裁剪、Sprite 所属 Graphics 的矩形填充，以及不可变 CPU 帧捕获/提交。首个已实现执行适配器为独立 @egret/engine/web 入口的 Canvas，核心根入口保留无 DOM 边界。限定实现检查已通过：97/97核心行为测试、25项负类型诊断及真实桌面Canvas像素/指针交互。跨realm拒绝修正后有限独立审阅通过；远端发布另行记录。最终限定结果由[实现记录](显示与帧执行实现记录.md)和[验证](../evidence/display-frame-verification.json)承载。

具体接口及错误码以显示合同为准。x/y、scaleX/scaleY、rotation、alpha、visible、clipRect 与 Graphics 矩形子集不代表旧 scrollRect、Texture、TextField、TouchEvent 或完整显示 API 的兼容。frameId 是引擎内成功捕获序号，不是持久工程 ID 或资源代际。

本包不验收完整文本/纹理/动画/UI/3D 执行、GPU 或 Native 支持、目标设备性能、编辑器、Agent 服务或完整迁移。此前 headless、CPU 资源与第三方研究记录保留原版本、数量、hash 和范围，不转为新显示帧验收。

版本：0.1候选规范 · 知识库0.9.0 · 更新：2026年10月8日。

本规范让新工程保留白鹭的显示列表、舞台、事件与动画语言，同时采用模块化、显式实例和可验证生命周期。R016确认重新制定完整架构与规范的目标，D016承载候选设计；包名、方法和完整示例尚未稳定发布或完整验收；[首段核心记录](核心框架实现记录.md)列出已编译验证的子集。工程边界见[工程技术架构](工程技术架构与项目结构.md)，实现要求见[代码规范](代码规范与质量门禁.md)。

## 白鹭辨识度与命名表

保留熟悉且含义明确的领域词，不通过更换一批缩写表达现代化。历史八个选定文件及已有EUI静态证据的摘要见[命名研究](../evidence/egret-naming-contract-summary.json)；它不是所有旧版本行为兼容证明。

| 范围 | 候选命名与语义 |
| --- | --- |
| 显示列表 | `DisplayObject`、`DisplayObjectContainer`、`Stage`；保留`addChild`、`removeChild`、`getChildAt`、`setChildIndex`。 |
| 绘制与图像 | `Sprite`继续是拥有`graphics`的显示容器；`Bitmap`继续显示纹理。不能把Sprite改成仅贴图对象。 |
| 文本与动画 | `TextField`、`MovieClip`、`Tween`；保留播放、暂停、帧和时间线概念，计时归属Engine。 |
| GUI | 显式`/eui`入口，沿用EUI的组件、布局、Skin和数据列表词汇；新schema与旧EXML之间由迁移器映射。 |
| 3D | `/scene3d`入口，采用`Scene3D`、`Node3D`、`Camera3D`、`Mesh3D`、`Material`。3D节点不继承2D布局/像素尺寸；共享对象ID、资源和调度合同。 |
| 事件 | `Event`、`TouchEvent`、`EventDispatcher`，保留`TOUCH_BEGIN`、`TOUCH_END`、`TOUCH_TAP`等常用常量。新增鼠标/笔输入可通过明确的`PointerEvent`合同提供。 |
| 类与类型 | PascalCase：`Texture`、`AssetLease`、`EngineOptions`；不加接口`I`或类型`T`前缀。泛型局部参数可用`T`。 |
| 成员与函数 | camelCase：`scaleX`、`touchEnabled`、`createEngine`、`acquire`；布尔值用`is/has/can/should`或既有明确领域名。 |
| 常量与序列化 | 真正常量及历史事件常量使用UPPER_SNAKE_CASE；工程字段camelCase，版本字段和单位显式。稳定ID与用户可改的`name`分开。 |
| 文件与原生 | TS主类文件保留`DisplayObject.ts`风格，职责模块`frameScheduler.ts`，目录kebab-case；Rust crate以`egret-`开头，模块/函数遵循snake_case，类型PascalCase；C ABI使用`egret_`前缀。 |

私有成员不因历史`$`或下划线前缀获得公共承诺；`hashCode`等旧标识也不作为持久工程ID。首期不为同一个构造器增加Group/Container等多个新旧同义名。

## 导入与初始化

候选公共身份为`@egret/engine`、`@egret/project`、`@egret/cli`；npm scope和名称可用性仍待发布前核对。新代码默认命名导入，也可使用`import * as egret from "@egret/engine"`保留调用外观；这属于ESM模块对象，不创建全局变量。EUI可用`import * as eui from "@egret/engine/eui"`。

根入口导出基础2D和`createEngine`，`/web`、`/eui`、`/scene3d`、`/animation`、`/compat`各自显式。import不创建GPU、启动时钟、下载资源或注册全局插件。`createEngine({host, graphics, features})`异步启动并返回Engine；启动失败清理已取得的自有资源。一个页面可以建立多个实例，实例之间的舞台、时钟、事件和资源租约不依赖全局“当前引擎”。对象在Scope登记或首次挂载时绑定Engine；detach不解除绑定，跨Engine挂载、scope接管或绑定实例资源均报错。共享源资产在各实例分别acquire；不可变数学/样式值可共享。后端和宿主构造来自明确adapter，由入口装配。

公共类型默认不依赖完整DOM或Node声明；浏览器专有HTMLCanvasElement只出现在`/web`入口。`features`由显式导入的能力工厂构成，不以任意字符串触发所有模块自动注册。`/compat`只带运行兼容设施，不能带整个开发时旧工程转换器。

## 属性与查询

`x/y/scaleX/scaleY/alpha/rotation/visible/touchEnabled`保留易懂属性；频繁变更先进入CPU逻辑状态与脏队列，确定帧阶段再提取。设置属性不逐次跨语言或同步等待GPU。`getBounds`等查询读CPU已知状态；需要布局刷新的操作命名为显式`validateLayout`，不能在普通getter中隐藏整帧渲染。

显示树成员只读迭代或返回快照，不开放可直接修改的children数组。`addChild`保持单一父节点和明确顺序；重挂载不销毁对象。2D `width/height`表示未变换的逻辑布局尺寸，显式尺寸与内容自然尺寸规则按对象类型记录；变换后的包围盒通过`getBounds`查询。历史快照的尺寸行为不统一，不自动把所有旧width赋值改成scale；迁移按版本、子类、EUI布局模式建立对照。

2D坐标采用独立于设备像素密度的逻辑像素，原点左上、x向右、y向下；保留历史`rotation`的角度单位。3D默认右手系、Y向上、相机朝局部-Z，世界单位约定为米；`rotation`使用Quaternion，Euler辅助方法明确命名`setEulerRadians`，不混用2D角度。资产导入记录坐标、单位转换。游戏时钟和新动画持续时间默认秒，名字需要区分时用`durationSeconds`；旧Tween毫秒由兼容入口显式转换。

## 异步资源与所有权

候选`assets.acquire(ref, {signal})`返回`Promise<AssetLease<T>>`。`ref`是带稳定ID与资源类型的`AssetRef<T>`，可由工程manifest生成；类型由引用推断并在运行时核查，不能仅靠调用者填写泛型把任意ID变成纹理。租约提供只读`value`和幂等`release()`；每次获取有独立leaseId，共享下载/解码任务与单次使用权分开。

`signal`只取消尚未成功交付的本次获取。结果交付和取消串行裁决，先成为终态者生效；取消先发生，临时结果自行清理且不得交付。成功交付后解除本次等待的abort监听，租约由调用者的release或Scope管理。取消不会取消其他调用者仍需的共享任务。此处把“获取取消”和“已交付资源的使用期”分开，避免取消通知先令仍挂在树上的Bitmap资源失效。

Bitmap借用逻辑Texture，不隐式再取得租约；创建者保持租约直到所有借用者不再使用。租约release立即失效自己的使用权，物理GPU资源要等最后有效引用和在途使用完成后回收。设备重建只更换GPU投影，逻辑资源身份和玩法状态按合同保留。原始WebGPU/WebGL句柄属于进阶内部扩展，不成为Bitmap纹理接口。

## 跨宿主取消协议

公开signal采用DOM-free的CancellationSignal最小只读协议：aborted、reason、addEventListener("abort", listener, {once?})与removeEventListener("abort", listener)，listener不依赖DOM Event类型。reason在取消前为undefined，取消后稳定；abort只发生一次，已经aborted时新监听不补发，各操作先检查aborted再登记并复查。Scope先置closing再通知，通知中新增监听不执行，已移除监听跳过；异常收集为诊断而不阻断后续取消或清理。纯核心实现此协议，浏览器adapter需以真实类型兼容检查接受标准AbortSignal，必要宿主提供同合同适配。首段已编译验证最小取消协议，浏览器与小游戏适配尚未验收；不把小游戏已有AbortController作为前提。

## Scope与关闭顺序

`engine.createScope()`建立局部所有权边界和跨宿主取消信号。`scope.use(value)`接管Disposable或AssetLease，返回原值；同一scope重复登记同一值去重，不允许另一个scope悄悄成为同一值的owner。重新挂载节点不转移scope归属；首期不提供跨scope所有权移交，保留原owner或在新scope重建。

Scope有open、closing、closed三个状态。`dispose()`先进入closing，再abort使等待和订阅停止，然后按登记逆序执行dispose/release，最终进入closed；它同步、幂等，逻辑清理不等待GPU。某项清理失败仍继续其他清理，通过Engine诊断通道报告聚合错误。use遇到closing/closed先核对归属：已登记在本scope的值只报告关闭错误，不提前清理，由已排定逆序负责；已归属其他owner的值拒绝且不销毁；尚无owner的新迟到值立即清理再报告关闭错误，清理异常作为关闭错误的关联诊断。这样await迟到仍有清理出口。

`removeChild`只移出树，不取消对象自己的任务或释放资源。`DisplayObject.dispose()`是显式终结：脱离父节点、清理监听和自身任务，之后不可重新使用；它不销毁借用的共享资产。`DisplayObjectContainer.dispose()`默认递归终结当前子树，若需要保留孩子，调用前先移出或重挂载它们。递归清理始终携带发起根节点的owner边界：有owner的根保留该scope边界，无owner的根只清理无owner节点；无owner中间容器不会改变边界。遇到其他owner的孩子，只脱离树并诊断，停止深入其子树。某孩子清理失败仍继续兄弟与根的终结；诊断监听自身抛错也不得打断关闭完成。对象及租约均幂等，Scope逆序清理的重复终结不会重复回收。

`engine.dispose()`第一次调用创建唯一关闭Promise，closing中的重入和后续重复调用返回同一结果，不重复提交或销毁；已失败结果也不自动触发重试。它异步关闭整次运行：拒绝新任务、关闭Scope、停止帧提交，等待有界的在途GPU/VM和平台清理。超时/清理失败使关闭Promise以保留诊断的EgretError拒绝，实例禁止复用；在途句柄按完成条件保留，不因超时提前回收，借用宿主的未完成事项交还owner协商。不能无限等待，也不自行destroy借用设备或surface。主失败与清理失败一起保留，EgretError提供cause和只读cleanupErrors。局部scope关闭不等于整个Engine退出。

## 事件合同

`node.on(eventType, handler, options)`返回幂等unsubscribe；options包含signal、capture、once和priority。事件描述符把稳定事件key与具体payload类型联系起来，保留TouchEvent常量外观。每次新on创建独立订阅，unsubscribe或取消只影响这一订阅；已取消signal不登记监听。旧API的重复注册及listener/thisObject/capture身份通过compat专项映射。

新显示树派发在整次派发开始时固定传播路径和所有节点/阶段的订阅候选，不在每阶段重新取列表。祖先捕获按根到父，目标先capture组后非capture组，再按父到根冒泡；priority为有限整数，默认0，各组按降序及同priority注册序号排列。新增监听只影响下次派发，轮到已移除订阅时跳过。once在调用前失效，避免重入重复；这个新规则与选定旧快照不同，必须保留兼容测试。stopPropagation保留当前节点其余监听（包括目标两组）但不再前往其他节点；stopImmediatePropagation停止当前节点余下监听并停止传播；preventDefault只阻止cancelable事件的默认动作。事件描述符bubbles/cancelable默认false，bubbles只控制祖先冒泡，显示树的祖先捕获仍执行；普通服务事件没有显示树传播路径。输入描述符单列两种标志。同一正在派发的Event对象禁止再次派发，嵌套派发须使用新的事件对象。

handler抛错向当前调用者传播，finally恢复派发内部状态；Engine外层调度器记录并终止当前失败步骤，不把未执行监听记为成功。同步handler不得返回未处理Promise；耗时异步工作进入显式任务，结果在规定阶段提交。新公共事件对象不在回调后隐藏回收到对象池；需要延迟使用时payload保持稳定，传播控制仅在派发期间有效。资源通知、生命周期和普通服务事件默认不冒泡。

输入、动画玩法事件与GPU设备epoch分别编号；设备丢失不得重放已消费的玩法事件。公开同步事件和内部跨线程可靠事件流是不同合同，内部队列的ACK/去重不改变同步捕获冒泡含义。

## 拟议调用外观

下例展示包含尚未实现 Bitmap/TouchEvent 等能力的完整候选合同，尚无已发布包或该完整示例的编译结果；首段子集见[核心框架实现记录](核心框架实现记录.md)，后续 CPU 资产服务由[资源合同](资源核心合同.md)与[实现记录](资源核心实现记录.md)单独限定。`host`与`assets.logo`由宿主adapter和生成的工程引用提供。

```ts
import { Bitmap, EgretError, TouchEvent, createEngine } from "@egret/engine";

const engine = await createEngine({ host });
const screen = engine.createScope();

try {
  const texture = screen.use(await engine.assets.acquire(assets.logo, {
    signal: screen.signal,
  }));
  const logo = screen.use(new Bitmap(texture.value));
  logo.x = 120;
  logo.y = 80;
  engine.stage.addChild(logo);

  logo.on(TouchEvent.TOUCH_TAP, () => {
    logo.alpha = 0.8;
  }, { signal: screen.signal });
} catch (error) {
  screen.dispose();
  try {
    await engine.dispose();
  } catch (cleanupError) {
    throw new EgretError("SETUP_FAILED", {
      cause: error,
      cleanupErrors: [cleanupError],
    });
  }
  throw error;
}

// 关闭界面时：先解绑/取消，再销毁logo，最后释放纹理租约。
screen.dispose();
// 宿主或作品退出时：等待整次运行关闭。
await engine.dispose();
```

这里没有隐式全局stage、资源单例或每个UI对象背后的独立GPUDevice。真实教学样例应等待界面任务结束后才关闭；上述末段仅展示清理顺序。

## 兼容与版本

新默认使用`on`、typed AssetRef、Scope、ESM和Engine服务。旧`addEventListener(type, listener, thisObject, ...)`、`RES`静态入口、namespace/全局脚本、EXML、旧Tween计时及内部字段访问由迁移器识别；已支持的旧行为在`/compat`保留必要适配。事件remove不能每次bind生成新函数，handler/thisObject/capture身份必须稳定。RES本轮没有逐方法核查，不能承诺所有旧资源调用已有一对一新方法。

兼容分别核查公共类型、模块/打包解析、外部行为及工程/资源/桥接格式。稳定接口的语义变化也算破坏性变更，发布迁移规则与弃用信息；experimental明确标注，不成为永久默认示例。初期三个公共包可以锁步发布，projectSchema、resourceFormat、bridgeProtocol和toolProtocol各自独立版本与兼容范围。

R008/V006的完整迁移、持续编辑、目标发布和更新仍是首个完整发布目标；保留名字或通过类型检查都不能替代它。规范验收覆盖多个Engine隔离、尺寸/排序、once重入、取消竞态、Scope迟到、租约共享、颜色/坐标与旧工程对照，见[工程结构门槛](工程技术架构与项目结构.md)。

语言机制参考：[TypeScript模块与类型导出](https://www.typescriptlang.org/docs/handbook/modules/reference.html)。ESM机制支持这套入口设计，不证明实际发行包已经按需裁剪。
