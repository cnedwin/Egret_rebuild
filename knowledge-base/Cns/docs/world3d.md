# World3D 场景图与渲染器

[English](../../en/docs/world3d.md) | 简体中文

## 目的与范围

World3D 是白鹭的可选保留式 3D 场景图。应用构建由相机、灯光和网格组成的树，可在帧间自由修改，再交给渲染器绘制。它与不可变的[可编辑 3D 场景](authored-scene3d.md)互补：后者继续用于与有序 2D 内容共用一个宿主的有界 3D 背景。

模块提供三个显式入口。默认 Engine、Canvas 和共享 2D 入口不会加载其中任何内容。

| 入口 | 内容 |
| --- | --- |
| `@egret/engine/world3d` | 不依赖 DOM 的核心：数学、场景图、几何、材质、纹理、灯光、相机、动画、拾取、粒子、辅助对象和 glTF 读取器 |
| `@egret/engine/webgl2/world3d` | WebGL2 渲染器、轨道控制器、浏览器加载器、Engine 时钟绑定和精简宿主 |
| `@egret/engine/webgpu/world3d` | WebGPU 渲染器，以及相同的控制器、加载器、绑定和宿主 |

设计参考了 Three.js 公开文档中的概念：带惰性世界矩阵的可变场景图、按最少状态切换排序的逐帧渲染列表、按需编译的材质变体，以及混合动画动作的混合器。实现为第一方独立编写，未复制或改写 Three.js 源码。命名遵循白鹭惯例：工厂函数、`3D` 后缀、明确的所有权与销毁。

## 约定

- 右手坐标系，+Y 向上。相机和灯光沿自身 -Z 轴朝向。矩阵为列主序 `Float32Array(16)`。
- 角度使用弧度；透视视场角例外，为垂直方向、单位为度。
- 颜色为线性 RGB。工厂函数也接受 `0xRRGGBB` 形式的 sRGB 数值并自动转换。渲染器在输出时编码为 sRGB。
- 纹理坐标 V = 0 对应存储的第一行。内置基础几何体的 V 轴向上，因此 `loadTexture3D` 默认翻转行；glTF 纹理不翻转。
- 错误为带稳定 `code` 的 `World3DError`，例如 `WORLD3D_INPUT_INVALID`、`WORLD3D_BUDGET`、`WORLD3D_DISPOSED`、`WORLD3D_GLTF_INVALID`、`WORLD3D_GLTF_UNSUPPORTED` 和 `WORLD3D_CONTEXT_UNAVAILABLE`。

## 场景图

`Object3D` 用类型化数组保存位置、单位四元数和缩放，提供 `setPosition`、`setRotation`、`setQuaternion`、`setScale`、`rotateOnAxis`、`lookAt` 和 `setMatrix`。直接写入数组后需要调用 `markTransformDirty()`。局部和世界矩阵只对脏节点及其后代重新计算，静态子树每帧没有开销。

层级沿用熟悉的白鹭名称 `addChild`、`addChildAt`、`removeChild`、`removeChildren`、`getChildAt` 和 `numChildren`。节点只有一个父节点，加入其他父节点即为移动。成环、把场景作为子节点以及超过 256 层的深度会被拒绝。`clone()` 复制子树，几何和材质按引用共享。

`Scene3D` 是根节点，包含背景（颜色、立方体纹理或无）、用于基于图像照明的可选环境立方体，以及可选的线性或指数雾。

## 几何、材质与纹理

`Geometry3D` 保存具名的 `Attribute3D` 数组（`position`、`normal`、`tangent`、`uv`、`uv1`、`color`、`joints`、`weights`）、可选索引、材质分组和变形目标。拓扑支持三角形、线段、线带和点。索引会对照顶点数校验。包围盒和包围球带缓存，并保守地包含变形目标。`computeNormals()` 和 `computeTangents()` 可补齐缺失数据。

基础几何体工厂包括立方体、平面、球、圆柱、圆锥、圆环、胶囊和四边形。辅助函数可创建网格线、坐标轴和包围盒边线几何。

`Material3D` 是带 `shading` 模型的单一类：无光照、Lambert、Blinn-Phong 或金属度-粗糙度标准材质。它包含基础色与不透明度、基础色贴图、法线、金属度-粗糙度、遮蔽和自发光贴图，以及面向、Alpha 模式（不透明、遮罩、混合）、混合方式、深度测试与写入、顶点色、平直着色、线框和多边形偏移。标量和颜色修改在下一帧生效。增加贴图或改变 Alpha 模式等会影响着色器特性的修改，需要调用 `touch()`。

`Texture3D` 封装自有 RGBA8 像素或不透明的宿主图像，带环绕、过滤、多级渐远、色彩空间、各向异性和 UV 变换。`CubeTexture3D` 接受六个面。`RenderTarget3D` 是离屏颜色目标，其 `texture` 可用作材质贴图。`createGradientCubeTexture3D` 生成程序化天空。

几何、材质、纹理和渲染目标都是带 `version` 和终结性 `dispose()` 的资源。渲染器依据版本刷新 GPU 副本，并在资源销毁时退役这些副本。核心从不引用后端。

## 灯光与阴影

环境光和半球光提供间接光。平行光、点光源和聚光灯为精确光源。一帧最多使用四个平行光、八个点光源和四个聚光灯；超出的灯光按遍历顺序忽略。

平行光和聚光灯可以投射阴影。最多四个阴影灯光共用一张深度图集，各占四分之一，并用 3x3 比较核过滤。`light.shadow` 设置体积、偏移、法线偏移和过滤半径。网格通过 `castShadow` 和 `receiveShadow` 选择参与。平行光把 `shadow.cascades` 设为 2 到 4 时，阴影按到相机的距离分级。每一级占用图集的一格，覆盖视野中的一段，最远到 `shadow.cascadeDistance`；`shadow.cascadeLambda` 让分割距离在均匀（0）与对数（1）之间变化。各级的体积是对齐到整纹素的包围球，相机移动或转动时阴影边缘保持稳定，相邻两级在接缝处混合。每个场景只有一个灯光分级，它的各级计入图集的四格。

## 网格、实例化、蒙皮与变形

`Mesh3D` 把几何与一个材质或按分组的多个材质组合。`InstancedMesh3D` 用逐实例矩阵和可选的 RGB 或 RGBA 颜色多次绘制同一几何。`Sprite3D` 是始终朝向相机的四边形。

蒙皮使用 `Bone3D` 节点和带逆绑定矩阵的 `Skeleton3D`；每个顶点的四个影响在 GPU 上混合。变形目标保存位置和可选的法线增量；一次绘制混合权重最大的八个目标。

`Lod3D` 按相机距离显示其中一个子节点。

## 动画

`createAnimationClip3D` 用轨道创建剪辑。轨道按名称指向节点，可驱动 `position`、`quaternion`、`scale` 或变形 `weights`，支持阶跃、线性和三次插值。`AnimationMixer3D` 为每个剪辑创建一个 `AnimationAction3D`。动作可循环、单次播放或往返，带权重和时间缩放，支持 `fadeIn`、`fadeOut` 和 `crossFadeTo`。同一属性上的并发动作按权重混合，四元数取最短路径。`restorePose()` 恢复绑定时记录的姿态。

## 拾取

`Raycaster3D` 与子树求交，返回按距离排序的命中结果，包含世界坐标点、面索引、插值 UV 和实例索引。它先检测包围球，遵循材质面向和层掩码，并可在每个网格的首个命中处停止。`setFromCamera` 由归一化设备坐标构造射线，射线从近平面出发。

## 粒子

`ParticleEmitter3D` 在 CPU 上用平坦数组模拟粒子，并作为一个实例化的朝向相机批次绘制。选项包括发射率、寿命、速度、锥形散布、重力、阻力、随寿命变化的大小与颜色、点、球或盒形生成体积、世界或局部模拟空间，以及用于确定性序列的种子。`burst(count)` 立即发射。单次更新步长上限为 0.25 秒。

## glTF

`loadGltf3D` 读取 `.glb` 字节或已解析的 `.gltf` 对象，返回场景、相机、动画和所创建的资源，并提供统一的 `dispose()`。支持网格、金属度-粗糙度和无光照材质、纹理变换、节点层级、蒙皮、变形目标、动画、相机、精确光源，以及 `EXT_mesh_gpu_instancing` 节点（读入为 `InstancedMesh3D`）。图像解码和外部缓冲加载由调用方注入，读取器因此不依赖 DOM。当前读取器接受根节点彼此独立的场景与第 0 套纹理坐标。共享场景根节点或其他纹理坐标集会触发明确的错误诊断。单个访问器解码上限为 128 MiB，合计上限为 256 MiB。Draco、meshopt 和 Basis 数据需要调用方提供解码器（见“压缩资源”）；未提供时，它们和其他必需扩展会以 `WORLD3D_GLTF_UNSUPPORTED` 拒绝。浏览器入口中的 `loadGltfFromUrl3D` 提供 fetch 和 `createImageBitmap`。

## 渲染器

两个渲染器都实现 `Renderer3D`：`render(scene, camera, target?)`、`setSize`、`resizeToDisplaySize`、`readRenderTargetPixels`、`toneMapping`、`exposure`、`shadowsEnabled`、`info` 和 `dispose()`。它们共用不依赖 DOM 的渲染列表、逐帧 uniform 块和阴影规划，因此绘制相同的通道：阴影图集、按材质和几何排序的不透明绘制、天空盒，然后是由远及近的混合绘制。

`createWebGL2Renderer3D(options)` 为同步创建，自行持有 WebGL2 上下文。它在上下文丢失并恢复后，根据 CPU 场景重建 GPU 状态。

`createWebGPURenderer3D(options)` 为异步创建。它申请设备，或借用 `options.device`。设备丢失通过 `onDeviceLost` 通知；需要创建新的渲染器才能继续。点拓扑绘制单像素点，渲染目标必须带深度。

输出经过色调映射（`none`、`reinhard` 或 `aces`）并编码为 sRGB。普通及预乘的源覆盖混合在 sRGB 渲染目标中存放按 Alpha 加权的线性 RGB，Alpha 保持线性。RGBA8 原始回读保留该编码。目标用作材质基础颜色贴图时，着色前会还原非预乘线性 RGB。`blending: 'premultiplied'` 接收普通的材质颜色和透明度，由着色器执行预乘。加法与乘法混合保留目标 Alpha。后续还要参与源覆盖合成的透明目标应使用普通或预乘的源覆盖混合。

## 压缩资源

纹理源可以是块压缩的多级链：`{width, height, format, levels}`，`format` 为 `bc1`、`bc3`、`bc7`、`etc2-rgb8`、`etc2-rgba8` 或 `astc-4x4`。数据按存储的样子上传，在显存中保持压缩。`renderer.supportsCompressedFormat(format)` 报告设备是否接受某种格式；桌面 GPU 通常提供 BC，移动 GPU 提供 ETC2 和 ASTC。

`parseKtx23D(bytes, options)` 读取 KTX2 容器。未压缩的 RGBA8 和上述块格式直接使用。Basis Universal 和带超级压缩的数据交给 `options.transcode`，由它返回适合当前设备的像素或压缩链。`loadTexture3D` 通过文件头识别 KTX2。

提供对应钩子后，glTF 读取器接受 `KHR_texture_basisu`、`EXT_meshopt_compression` 和 `KHR_draco_mesh_compression`：`transcodeKtx2`、`decodeMeshopt`、`decodeDraco`。引擎不内置解码器；应用可以通过钩子接入官方 WebAssembly 解码器，引擎本身不依赖它们。文件要求的扩展缺少钩子时，以 `WORLD3D_GLTF_UNSUPPORTED` 拒绝。

## 资源与场景保存

`registerWorld3DAssets(engine.assets, options)` 注册 `GLTF_ASSET_3D`、`TEXTURE_ASSET_3D`、`CUBE_TEXTURE_ASSET_3D` 和 `SCENE_ASSET_3D` 的提供者。用 `engine.assets.acquire(createAssetRef(GLTF_ASSET_3D, url))` 获取。租约按引用计数：并发请求共用一次加载，取消会中止下载，最后一次释放会销毁该资源创建的全部面向 GPU 的对象。立方体纹理的 id 含有 `{face}`，依次替换为 `px`、`nx`、`py`、`ny`、`pz`、`nz`。

`serializeScene3D(root, options)` 把一棵子树写成可直接转为 JSON 的文档：变换、相机、灯光、网格、实例化网格、材质、几何体、骨架和细节层次组。共享的几何体和材质只保存一份。像素源或压缩源不超过 1 MiB 的纹理内嵌在文档里；其余纹理按 `options.textureKey` 返回的键保存，再由 `deserializeScene3D(document, {resolveTexture})` 解析。粒子发射器和屏幕层按普通节点写出，并列在结果的 `skipped` 字段中。`userData` 只保留 JSON 值。`deserializeScene3D` 的结果拥有它创建的资源，通过 `dispose()` 释放。

## 后处理

`renderer.postProcess` 保存各项设置；`enabled` 为 true 之前不会执行任何处理。开启后，场景先以场景线性光绘制到半浮点目标，再由全屏处理链生成最终图像：双重滤波的泛光金字塔（`bloomThreshold`、`bloomKnee`、`bloomIntensity`、`bloomLevels`），带 `brightness`、`saturation`、`contrast` 和 `vignette` 的色调映射，以及可选的 FXAA。两个后端执行相同的处理，比较工具中的差异不超过一个 8 位色阶。

开启后处理时，画布多重采样不生效，由 FXAA 代替。场景背景色会和场景一起做色调映射。`new RenderTarget3D(width, height, {format: 'rgba16f'})` 让应用为自己的处理使用同样的半浮点存储；这类目标跳过色调映射，也不能按字节回读。不支持浮点颜色缓冲的 WebGL2 设备退回 8 位存储。

## 2D 与 3D 同屏

`createScreenLayer3D(source, options)` 把一个纹理源铺满整个表面，作为场景的一部分绘制。覆盖层在场景之后混合；`order: 'underlay'` 的层最先绘制，被场景遮盖。开启 `autoUpdate` 时每帧重新上传源，因此 2D 舞台所绘制的画布可以成为 3D 内容上方的界面或下方的背景，最终只呈现一个表面。

## 动画状态机

`createAnimationStateMachine3D(mixer)` 用具名状态驱动混合器。一个状态播放单个剪辑，或由数值参数选择的多个剪辑 `blend`；参与混合的剪辑会缩放到同一周期，相位保持对齐。过渡指定来源状态（或 `*`）、目标状态、淡入淡出的 `duration`、参数 `conditions` 和可选的 `exitTime`。`set(name, value)` 写入数值或布尔值，`trigger(name)` 置起一个标志，由第一个匹配的过渡消耗。淡入淡出可以被打断：每个状态从它已达到的权重继续。`addEvent(state, normalizedTime, callback)` 在每一遍播放时触发，`onStateChange` 报告每次切换。每帧调用一次 `update(deltaSeconds)`，它会推进混合器。

## 物理

`createPhysicsWorld3D(options)` 创建一个面向玩法的小型刚体世界。形状有球、盒、胶囊和无限平面；刚体分为 `static`、`kinematic` 和 `dynamic`。`world.step(deltaSeconds)` 按固定步长推进，然后把每个刚体的位姿复制到它的 `node`。碰撞对由扫掠排序找出，由带热启动的冲量求解器处理，支持摩擦和弹性。静止的刚体进入休眠，直到有运动的物体碰到它。`layer` 和 `mask` 过滤碰撞，`isTrigger` 刚体只报告重叠而不产生推力，`onContactBegin` 和 `onContactEnd` 报告碰撞对。

`world.raycast(origin, direction, maxDistance, mask)` 返回最近的实体刚体及命中点和法线，`world.overlapSphere(center, radius, mask)` 列出一个体积内的实体刚体。`createCharacterController3D(world, options)` 是运动学胶囊：`move(dx, dy, dz)` 沿障碍物滑动，并报告 `isGrounded`、`groundNormal` 和 `groundBody`。

求解器不包含关节、连续碰撞检测，也不支持凸包和三角网格形状。体积小、速度快的刚体可能穿过薄的几何体；墙体厚度应大于刚体单步移动的距离。

## 曲线、轮廓与更多几何体

曲线（`LineCurve3D`、`QuadraticBezierCurve3D`、`CubicBezierCurve3D`、`CatmullRomCurve3D`、`CurvePath3D`）提供 `getPoint(t)`、匀速的 `getPointAt(u)`、切线、长度和无扭转的标架。`Path2D3D` 和 `Shape3D` 用 `moveTo`、`lineTo`、`quadraticCurveTo`、`bezierCurveTo` 和 `arc` 构造平面轮廓；形状可以带孔。

新增的构造函数：`createCircleGeometry3D`、`createRingGeometry3D`、`createTorusKnotGeometry3D`、`createTetrahedronGeometry3D`、`createOctahedronGeometry3D`、`createIcosahedronGeometry3D`、`createDodecahedronGeometry3D`、`createPolyhedronGeometry3D`、`createLatheGeometry3D`、`createTubeGeometry3D`、`createShapeGeometry3D` 和 `createExtrudeGeometry3D`（直线挤出或沿曲线挤出；端面和侧壁是两个材质组；不生成倒角）。工具函数：`createEdgesGeometry3D`、`createWireframeGeometry3D`、`mergeGeometries3D`、`mergeVertices3D`、`toNonIndexedGeometry3D` 和 `transformGeometry3D`。

## 风格化与自定义材质

`createToonMaterial3D({steps})` 把漫反射光量化成若干平坦的色阶。`createMatcapMaterial3D({matcap})` 按视图空间法线从一张球面图像取色，不需要灯光。标准材质通过 `clearcoat` 和 `clearcoatRoughness` 增加一层清漆。

`material.shader = createCustomShader3D({key, glsl, wgsl, uniforms})` 为任意材质增加片元钩子。钩子是名为 `customFragment` 的函数，接收着色后的线性颜色与透明度、世界坐标、法线和 UV，返回新的颜色；可以使用 `discard`。有十六个浮点数可用，GLSL 中为 `uCustom[0..3]`，WGSL 中为 `material.custom[0..3]`；随时间变化的效果每帧写入 `shader.uniforms`。需要为要发布的每个后端提供源码；没有对应源码的后端按原样绘制材质。更换着色器后调用 `material.touch()`。

## 点光源阴影、环境与视口

可以有一个点光源投射阴影（`createPointLight3D({castShadow: true})`）。它通过四面体的四个面绘制四张阴影图，用普通透视阴影图覆盖所有方向，过滤方式与其他灯光相同。它占用整张图集，在没有平行光或聚光灯投射阴影时生效。

`parseRgbe3D(bytes)` 解码 Radiance `.hdr` 文件，`createCubeTextureFromEquirect3D(image, {size, exposure, maxValue})` 把全景图转换为立方体纹理，用于 `scene.background` 和 `scene.environment`。立方体各面在曝光和高光压缩后以 8 位保存。`captureCubeTexture3D(renderer, scene, position, options)` 把某一点周围的场景烘焙成立方体纹理，用于局部反射；它需要回读像素，适合在加载时使用。

`renderer.viewport = [x, y, width, height]`（0 到 1，原点在左下角）把绘制限制在输出的一部分，`renderer.autoClear = false` 保留之前的视图已绘制的内容。两者配合，在一帧内多次调用 `render()` 即可实现分屏、小地图和画中画。

## 辅助器、第一人称控制与声音

`createBoxHelper3D`、`createArrowHelper3D`、`createCameraHelper3D`、`createLightHelper3D` 和 `createSkeletonHelper3D` 是跟随目标的线条节点；目标移动后调用 `update()`。`computeObjectBounds3D(object)` 返回一棵子树的世界包围盒。

`createFlyControls3D(camera, element, options)` 通过指针锁定或拖动来转动视角，用键盘移动，可以飞行，也可以在水平面上行走。`createAudioListener3D()` 和 `createPositionalAudio3D(listener, options)` 把 Web Audio 声源放进场景，支持距离衰减和锥形指向；每帧调用 `listener.update()`，并在用户手势中调用 `listener.resume()`。

## 从 Three.js 迁移

| Three.js | World3D |
| --- | --- |
| `Scene`、`Object3D`、`Group`、`Mesh`、`InstancedMesh`、`SkinnedMesh`、`LOD`、`Sprite` | `Scene3D`、`Object3D`、`Mesh3D`、`InstancedMesh3D`、`Mesh3D.bind(skeleton)`、`Lod3D`、`createSprite3D` |
| `PerspectiveCamera`、`OrthographicCamera` | `createPerspectiveCamera3D`、`createOrthographicCamera3D` |
| `BufferGeometry`、`BufferAttribute` | `Geometry3D`、`Attribute3D`、`createGeometry3D` |
| `BoxGeometry` 到 `TorusKnotGeometry`、`ExtrudeGeometry`、`LatheGeometry`、`TubeGeometry`、`ShapeGeometry`、`EdgesGeometry` | `createBoxGeometry3D` 到 `createTorusKnotGeometry3D`、`createExtrudeGeometry3D`、`createLatheGeometry3D`、`createTubeGeometry3D`、`createShapeGeometry3D`、`createEdgesGeometry3D` |
| `BufferGeometryUtils.mergeGeometries`、`mergeVertices` | `mergeGeometries3D`、`mergeVertices3D` |
| `Curve`、`CatmullRomCurve3`、`Shape`、`Path` | `Curve3D`、`CatmullRomCurve3D`、`Shape3D`、`Path2D3D` |
| `MeshBasicMaterial`、`MeshLambertMaterial`、`MeshPhongMaterial`、`MeshStandardMaterial` | `createUnlitMaterial3D`、`createLambertMaterial3D`、`createPhongMaterial3D`、`createStandardMaterial3D` |
| `MeshToonMaterial`、`MeshMatcapMaterial`、`MeshPhysicalMaterial.clearcoat` | `createToonMaterial3D`、`createMatcapMaterial3D`、`material.clearcoat` |
| `ShaderMaterial`、`onBeforeCompile` | 把 `createCustomShader3D` 的结果赋给 `material.shader` |
| `LineBasicMaterial`、`PointsMaterial`、`SpriteMaterial` | `createLineMaterial3D`、`createSpriteMaterial3D`，配合 `lines` 或 `points` 几何体 |
| `Texture`、`DataTexture`、`CanvasTexture`、`CompressedTexture`、`CubeTexture`、`WebGLRenderTarget` | `Texture3D`（像素、图像、画布或压缩链）、`CubeTexture3D`、`RenderTarget3D` |
| `AmbientLight`、`HemisphereLight`、`DirectionalLight`、`PointLight`、`SpotLight` | `createAmbientLight3D`、`createHemisphereLight3D`、`createDirectionalLight3D`、`createPointLight3D`、`createSpotLight3D` |
| `light.shadow`、`CSM` | `light.shadow`、`light.shadow.cascades` |
| `Fog`、`FogExp2`、`scene.background`、`scene.environment` | `scene.fog`、`scene.background`、`scene.environment` |
| `AnimationMixer`、`AnimationClip`、`AnimationAction` | `AnimationMixer3D`、`AnimationClip3D`、`AnimationAction3D`，另有 `AnimationStateMachine3D` |
| `Raycaster` | `Raycaster3D` |
| `GLTFLoader`、`KTX2Loader`、`DRACOLoader`、`MeshoptDecoder`、`RGBELoader`、`TextureLoader` | 带解码钩子的 `loadGltfFromUrl3D`、`parseKtx23D`、`parseRgbe3D`、`loadTexture3D` |
| `LoadingManager`、`Cache` | 在 Engine 的 `AssetManager` 上调用 `registerWorld3DAssets` |
| `ObjectLoader`、`toJSON` | `deserializeScene3D`、`serializeScene3D` |
| `WebGLRenderer`、`WebGPURenderer`、`setViewport`、`autoClear` | `createWebGL2Renderer3D`、`createWebGPURenderer3D`、`renderer.viewport`、`renderer.autoClear` |
| `EffectComposer`、`UnrealBloomPass`、`OutputPass`、`FXAAShader` | `renderer.postProcess` |
| `CubeCamera`、`PMREMGenerator.fromEquirectangular` | `captureCubeTexture3D`、`createCubeTextureFromEquirect3D` |
| `OrbitControls`、`PointerLockControls`、`FlyControls` | `createOrbitControls3D`、`createFlyControls3D` |
| `AudioListener`、`PositionalAudio` | `createAudioListener3D`、`createPositionalAudio3D` |
| `BoxHelper`、`ArrowHelper`、`CameraHelper`、各种灯光辅助器、`SkeletonHelper`、`GridHelper`、`AxesHelper` | 对应的 `create...Helper3D` 函数 |
| cannon-es、Rapier 等物理扩展 | `createPhysicsWorld3D`、`createCharacterController3D` |

需要注意的差异：用工厂函数代替构造函数；颜色是线性 RGB 数组或十六进制数；向量和四元数是类型化数组，通过 `setPosition`、`setRotation`、`setScale` 和 `lookAt` 修改；资源用 `dispose()` 释放；错误是带 `code` 的 `World3DError`。

## 与 Engine 的整合

World3D 画布与 2D 舞台表面相互独立。`createWorld3DHost(canvas)` 为只有 3D 画布的应用返回宿主。`startWorld3DLoop(engine)` 每个显示帧推进一次显式 Engine 时钟，并在间隔超过时钟步长上限后重新设定锚点。

`createWorld3DView(engine, scope, options)` 在 Scope 下订阅 Engine 时钟。每次 tick 按需调整绘制缓冲大小，调用 `onUpdate`，推进混合器、控制器和粒子发射器，然后渲染。关闭 Scope 即结束视图。渲染器、场景和控制器仍归创建者所有；用 `scope.use(...)` 登记后可随 Scope 一并退役。

需要在 3D 场景上方显示 2D 界面时，可以把透明的共享 2D 宿主画布叠放在 World3D 画布之上，也可以把 2D 画布作为屏幕层绘制（见“2D 与 3D 同屏”）。把单个 2D 显示对象按深度穿插在 3D 对象之间，仍由可编辑场景路径负责。

`createOrbitControls3D(camera, element, options)` 基于 Pointer Events 提供环绕、平移和缩放，包括双指平移与捏合、阻尼和可选的自动旋转。

## 示例与检查

[World3D 示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/world3d/README.zh-CN.md)在任一后端上展示灯光、阴影、实例化、蒙皮、变形、粒子、渲染目标、拾取和轨道控制。

无浏览器测试 `tests/world3d-core.test.mjs`、`tests/world3d-animation-picking.test.mjs`、`tests/world3d-gltf.test.mjs`、`tests/world3d-renderer-lifetime.test.mjs`、`tests/world3d-extended.test.mjs` 和 `tests/world3d-parity.test.mjs` 通过公共入口覆盖不依赖 DOM 的核心、资源提供者、状态机和物理。

`tools/verify-world3d.mjs --playwright <installed-playwright-module> --output <new-directory> [--channel msedge]` 把十四个固定场景分别用两个后端绘制到渲染目标并比较图像。较新的七个场景覆盖级联阴影、后处理、压缩纹理、屏幕层、从保存的文档还原的场景、风格化与自定义材质，以及点光源阴影。开发期间全部十四个场景在使用软件渲染的无头 Chromium 中运行。桌面复审在 NVIDIA RTX 5090 Laptop GPU 上用 Edge 157 执行了前七个场景，未使用强制渲染后端的启动参数。两个后端的可见示例均开启抗锯齿并正常呈现，释放后停止推进帧。

`tools/bench-world3d.mjs --playwright <installed-playwright-module>` 在两个后端上测量固定负载下 `render()` 的 CPU 时间，用作发现性能回退的基线，而不是绝对评分。

## 待完成事项

- 桌面复审强制触发 WebGL2 上下文丢失并恢复了目标像素，也强制触发 WebGPU 设备丢失，确认收到通知并拒绝后续操作。更广泛的设备与恢复场景仍待验证。
- 一台运行 Chrome 157 的 Android 真机已呈现两个后端，响应了自动触发的阴影开关，并在释放后停止更新帧。性能、真人手势与更广泛的移动设备矩阵仍待验证。
- 级联阴影与点光源阴影、后处理、压缩纹理、屏幕层、卡通、Matcap、清漆与自定义着色器、视口和探针目前只在软件渲染下运行过，两个后端的结果一致；它们以及较新的七个比较场景和基准测试仍需在桌面与移动端的真实 GPU 上验证。第一人称控制和空间音频尚未经过真人操作验证。
- 尚未实现：内置的 Basis、meshopt 或 Draco 解码器，浮点精度的环境预过滤，透射与光泽层，裁剪平面，环境光遮蔽与景深处理，变换操纵器，文字几何体，物理关节与网格碰撞体。
