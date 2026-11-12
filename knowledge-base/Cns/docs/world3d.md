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

成群的动画角色可以一次绘制。`bakeAnimationTexture3D(root, mesh, clips, {fps})` 把每个动画片段采样到骨架上，按帧保存蒙皮网格每根骨骼的矩阵；烘焙结束后骨架恢复原状。`createSkinnedInstancedMesh3D(geometry, material, baked, capacity)` 随后不用骨架就能绘制蒙皮几何体的多个副本：每个实例像普通实例一样有自己的变换和颜色，另有 `setClipAt(index, clip, {time, speed, loop, fade})`。每帧调用一次 `crowd.update(deltaSeconds)`，它推进所有实例，写入实例所处的前后两帧及其混合比例，顶点阶段据此在烘焙表中查找；这张表在 WebGL2 上是浮点纹理，在 WebGPU 上是存储缓冲区。阴影使用同样的姿态。`isFinishedAt` 报告不循环的片段是否播完，`fade` 从切换时保持的姿态过渡到新片段。只烘焙骨骼变换：变形权重、片段混合树以及注视之类的逐实例骨骼修改仍需使用普通蒙皮网格。两帧之间的姿态按矩阵逐个混合，在默认每秒 30 帧时足够准确，低帧率下的快速旋转会有偏差。剔除时把全部实例当作一个物体，并按动画的活动范围放宽包围球。

## 动画

`createAnimationClip3D` 用轨道创建剪辑。轨道按名称指向节点，可驱动 `position`、`quaternion`、`scale` 或变形 `weights`，支持阶跃、线性和三次插值。`AnimationMixer3D` 为每个剪辑创建一个 `AnimationAction3D`。动作可循环、单次播放或往返，带权重和时间缩放，支持 `fadeIn`、`fadeOut` 和 `crossFadeTo`。同一属性上的并发动作按权重混合，四元数取最短路径。`restorePose()` 恢复绑定时记录的姿态。

## 拾取

`Raycaster3D` 与子树求交，返回按距离排序的命中结果，包含世界坐标点、面索引、插值 UV 和实例索引。它先检测包围球，遵循材质面向和层掩码，并可在每个网格的首个命中处停止。`pickable = false` 的网格不参与拾取；拖尾和 GPU 粒子发射器默认如此，因为它们绘制出来的形状并不是自身的几何体。`setFromCamera` 由归一化设备坐标构造射线，射线从近平面出发。

## 粒子

`ParticleEmitter3D` 在 CPU 上用平坦数组模拟粒子，并作为一个实例化的朝向相机批次绘制。选项包括发射率、寿命、速度、锥形散布、重力、阻力、随寿命变化的大小与颜色、点、球或盒形生成体积、世界或局部模拟空间，以及用于确定性序列的种子。`burst(count)` 立即发射。单次更新步长上限为 0.25 秒。

## glTF

`loadGltf3D` 读取 `.glb` 字节或已解析的 `.gltf` 对象，返回场景、相机、动画和所创建的资源，并提供统一的 `dispose()`。支持网格、金属度-粗糙度和无光照材质、纹理变换、节点层级、蒙皮、变形目标、动画、相机、精确光源，以及 `EXT_mesh_gpu_instancing` 节点（读入为 `InstancedMesh3D`）。图像解码和外部缓冲加载由调用方注入，读取器因此不依赖 DOM。读取器接受根节点彼此独立的场景。遮蔽贴图和自发光贴图可以使用第 0 套或第 1 套纹理坐标（烘焙光照通常放在第 1 套）；它们会设置 `texture.channel`，手动指定的遮蔽或自发光贴图同样可以使用这个属性。基础色、法线和金属度-粗糙度贴图使用第 0 套。共享场景根节点或其他纹理坐标集会触发明确的错误诊断。单个访问器解码上限为 128 MiB，合计上限为 256 MiB。各节点和图元生成的实例变换矩阵共享每个资产 64 MiB 的预算。Draco、meshopt 和 Basis 数据需要调用方提供解码器（见“压缩资源”）；未提供时，它们和其他必需扩展会以 `WORLD3D_GLTF_UNSUPPORTED` 拒绝。浏览器入口中的 `loadGltfFromUrl3D` 提供 fetch 和 `createImageBitmap`。

## 渲染器

两个渲染器都实现 `Renderer3D`：`render(scene, camera, target?)`、`setSize`、`resizeToDisplaySize`、`readRenderTargetPixels`、`toneMapping`、`exposure`、`shadowsEnabled`、`info` 和 `dispose()`。它们共用不依赖 DOM 的渲染列表、逐帧 uniform 块和阴影规划，因此绘制相同的通道：阴影图集、按材质和几何排序的不透明绘制、天空盒，然后是由远及近的混合绘制。

`createWebGL2Renderer3D(options)` 为同步创建，自行持有 WebGL2 上下文。它在上下文丢失并恢复后，根据 CPU 场景重建 GPU 状态。

`createWebGPURenderer3D(options)` 为异步创建。它申请设备，或借用 `options.device`。设备丢失通过 `onDeviceLost` 通知；需要创建新的渲染器才能继续。点拓扑绘制单像素点，渲染目标必须带深度。

输出经过色调映射（`none`、`reinhard` 或 `aces`）并编码为 sRGB。普通及预乘的源覆盖混合在 sRGB 渲染目标中存放按 Alpha 加权的线性 RGB，Alpha 保持线性。RGBA8 原始回读保留该编码。目标用作材质基础颜色贴图时，着色前会还原非预乘线性 RGB。`blending: 'premultiplied'` 接收普通的材质颜色和透明度，由着色器执行预乘。加法与乘法混合保留目标 Alpha。后续还要参与源覆盖合成的透明目标应使用普通或预乘的源覆盖混合。

## 压缩资源

纹理源可以是块压缩的多级链：`{width, height, format, levels}`，`format` 为 `bc1`、`bc3`、`bc7`、`etc2-rgb8`、`etc2-rgba8` 或 `astc-4x4`。数据按存储的样子上传，在显存中保持压缩。`renderer.supportsCompressedFormat(format)` 报告设备是否接受某种格式；桌面 GPU 通常提供 BC，移动 GPU 提供 ETC2 和 ASTC。

`parseKtx23D(bytes, options)` 读取 KTX2 容器。未压缩的 RGBA8 和上述块格式直接使用。包在 Zstandard 或 zlib 里的层级会先被解开。Basis Universal 数据以及读取器不认识的格式交给 `options.transcode`，由它返回适合当前设备的像素或压缩链。`loadTexture3D` 通过文件头识别 KTX2。

`EXT_meshopt_compression` 由引擎自行解码：`decodeMeshopt3D` 用 TypeScript 实现了顶点、三角形和索引序列三种编码，以及八面体、四元数和指数三种过滤器，这类文件不需要任何额外选项即可加载。如果提供了 `decodeMeshopt` 钩子，则改用钩子，例如在文件非常大时换成 WebAssembly 解码器。KTX2 读取器还会解开包在可读层级外面的 Zstandard 和 zlib 超级压缩（`decompressZstd3D` 和 `inflate3D` 也已导出，可另作他用）；不支持 Zstandard 字典。

`KHR_draco_mesh_compression` 和 Basis Universal 纹理（`KHR_texture_basisu`）仍然需要官方的 WebAssembly 解码器，引擎不附带它们。应用自行加载解码模块，再用适配函数包装：`decodeDraco: createDracoDecoder3D(dracoModule)`，`transcodeKtx2: createBasisTranscoder3D(basisModule, format => renderer.supportsCompressedFormat(format))`。Basis 适配函数会选择设备支持的最佳压缩格式，都不支持时退回普通 RGBA。文件要求 Draco 而没有提供钩子时，以 `WORLD3D_GLTF_UNSUPPORTED` 拒绝。两个适配函数按官方模块的公开接口编写，目前只用替身模块测试过，还没有在真实模块上运行。

表面扩展 `KHR_materials_transmission`、`KHR_materials_ior`、`KHR_materials_volume`、`KHR_materials_clearcoat` 和 `KHR_materials_sheen` 按各自的数值系数读取；这些扩展可能附带的纹理不会被使用。

## 资源与场景保存

`registerWorld3DAssets(engine.assets, options)` 注册 `GLTF_ASSET_3D`、`TEXTURE_ASSET_3D`、`CUBE_TEXTURE_ASSET_3D` 和 `SCENE_ASSET_3D` 的提供者。用 `engine.assets.acquire(createAssetRef(GLTF_ASSET_3D, url))` 获取。租约按引用计数：并发请求共用一次加载，取消会中止下载，最后一次释放会销毁该资源创建的全部面向 GPU 的对象。立方体纹理的 id 含有 `{face}`，依次替换为 `px`、`nx`、`py`、`ny`、`pz`、`nz`。

`serializeScene3D(root, options)` 把一棵子树写成可直接转为 JSON 的文档：变换、相机、灯光、网格、实例化网格、材质、几何体、骨架和细节层次组。共享的几何体和材质只保存一份。像素源或压缩源不超过 1 MiB 的纹理内嵌在文档里，并保留 UV 通道。其他纹理以 `options.textureKey` 返回的键保存，`deserializeScene3D(document, {resolveTexture})` 使用调用方解析出的纹理。粒子发射器和屏幕层按普通节点写出，并列在结果的 `skipped` 字段中。`userData` 只保留 JSON 值。`deserializeScene3D` 的结果拥有它创建的资源，通过 `dispose()` 释放。

## 后处理

`renderer.postProcess` 保存各项设置；`enabled` 为 true 之前不会执行任何处理。开启后，场景先以场景线性光绘制到半浮点目标，再由全屏处理链生成最终图像：双重滤波的泛光金字塔（`bloomThreshold`、`bloomKnee`、`bloomIntensity`、`bloomLevels`），带 `brightness`、`saturation`、`contrast` 和 `vignette` 的色调映射，以及可选的 FXAA。两个后端执行相同的处理，比较工具中的差异不超过一个 8 位色阶。

`postProcess.ssao` 根据场景深度加入屏幕空间环境光遮蔽，由 `ssaoRadius`（世界单位）、`ssaoIntensity` 和 `ssaoBias` 调节。`postProcess.outlineLayers` 为 `layers` 中带有这些位的每个对象描边，颜色和宽度（像素）由 `outlineColor`、`outlineThickness` 指定；描边会透过前景物体，并采用材质透明裁剪和自定义顶点位移前的基础轮廓。

`postProcess.dof` 模糊比 `dofFocus` 加减 `dofRange`（世界单位）更近或更远的部分，最大模糊半径为 `dofRadius` 像素。清晰的像素不向周围采样，因此对焦的物体在模糊背景前保持清晰的边缘。

`postProcess.custom = createCustomPost3D({key, glsl, wgsl, uniforms})` 在遮蔽和泛光之后、色调映射之前加入一个应用自定义的处理。它的函数 `customPost(color, uv)` 可以调用 `sceneColor(uv)` 和 `sceneDepth(uv)`（到相机平面的距离，世界单位），足以实现深度雾、接触阴影和边缘效果。十六个浮点数在 GLSL 中为 `uPostCustom[0..3]`，在 WGSL 中为 `params.custom[0..3]`。后处理结合采样点的屏幕坐标和逆投影矩阵重建深度，当相机覆盖完整的后处理目标时，适用于偏心和斜切投影。需要自定义投影时，将完整的可逆矩阵赋给 `camera.customProjection`。UV 的行在 GLSL 中自下而上、在 WGSL 中自上而下，因此 V 方向的偏移在两个后端上指向相反。

开启后处理时，画布多重采样不生效，由 FXAA 代替。场景背景色会和场景一起做色调映射。`new RenderTarget3D(width, height, {format: 'rgba16f'})` 让应用为自己的处理使用同样的半浮点存储；这类目标跳过色调映射，也不能按字节回读。不支持浮点颜色缓冲的 WebGL2 设备退回 8 位存储。

## 2D 与 3D 同屏

`createScreenLayer3D(source, options)` 把一个纹理源铺满整个表面，作为场景的一部分绘制。覆盖层在场景之后混合；`order: 'underlay'` 的层最先绘制，被场景遮盖。开启 `autoUpdate` 时每帧重新上传源，因此 2D 舞台所绘制的画布可以成为 3D 内容上方的界面或下方的背景，最终只呈现一个表面。

## 动画状态机

`createAnimationStateMachine3D(mixer)` 用具名状态驱动混合器。一个状态播放单个剪辑，或由数值参数选择的多个剪辑 `blend`；参与混合的剪辑会缩放到同一周期，相位保持对齐。过渡指定来源状态（或 `*`）、目标状态、淡入淡出的 `duration`、参数 `conditions` 和可选的 `exitTime`。`set(name, value)` 写入数值或布尔值，`trigger(name)` 置起一个标志，由第一个匹配的过渡消耗。淡入淡出可以被打断：每个状态从它已达到的权重继续。`addEvent(state, normalizedTime, callback)` 在每一遍播放时触发，`onStateChange` 报告每次切换。每帧调用一次 `update(deltaSeconds)`，它会推进混合器。

## 物理

`createPhysicsWorld3D(options)` 创建一个面向玩法的小型刚体世界。形状有球、盒、胶囊和无限平面；刚体分为 `static`、`kinematic` 和 `dynamic`。`world.step(deltaSeconds)` 按固定步长推进，然后把每个刚体的位姿复制到它的 `node`。碰撞对由扫掠排序找出，由带热启动的冲量求解器处理，支持摩擦和弹性。静止的刚体进入休眠，直到有运动的物体碰到它。`layer` 和 `mask` 过滤碰撞，`isTrigger` 刚体只报告重叠而不产生推力，`onContactBegin` 和 `onContactEnd` 报告碰撞对。

关卡几何体以三角网格参与碰撞：`world.createBody({shape: {type: 'mesh', mesh: createMeshShape3D(levelRoot)}})`。`createMeshShape3D` 接受三角形几何体或对象子树。对象子树中，非实例化、无蒙皮的三角网格会按其基础几何体与当前世界变换合并。网格刚体是静态的，也可以是运动学的（用于移动平台），三角形只在正面是实心的。球、胶囊、角色控制器和射线与三角形精确碰撞；盒子通过它的八个角落在网格上。包围体层次结构让开销只与附近的三角形数量有关，三角形接缝处的接触经过过滤，物体可以平滑地越过接缝。

`world.raycast(origin, direction, maxDistance, mask)` 返回最近的实体刚体及命中点和法线，`world.overlapSphere(center, radius, mask)` 列出一个体积内的实体刚体。`createCharacterController3D(world, options)` 是运动学胶囊：`move(dx, dy, dz)` 沿障碍物滑动，并报告 `isGrounded`、`groundNormal` 和 `groundBody`。

`createCharacterMotor3D(world, options)` 在这个胶囊上构建会行走和跳跃的角色。在 `world.step()` 之后调用 `motor.update(deltaSeconds, wishX, wishZ, jump)`，传入玩家期望的水平速度。它处理重力和跳跃（`jumpSpeed`，走出平台边缘后还有一小段 `coyoteTime` 可以起跳）、地面与空中的加速（`acceleration`、`airControl`），能走上不高于 `stepHeight` 的台阶，下台阶和下坡时贴住地面，头顶碰到天花板时停止上升。脚下的运动学或动力学刚体会带着角色移动，包括绕旋转平台转动；`motor.carriedYaw` 是应加到角色朝向上的转角，离开移动平台时保留平台的速度。走向动力学刚体时会以角色自身的速度推动它，推力上限为 `pushForce`。平台要用速度来移动，不要直接改写位置，这样角色才能知道平台的运动。低台阶靠胶囊的圆形底部爬上去，速度会变慢；较长的楼梯用斜坡碰撞体走起来更顺。

`createFollowCamera3D(camera, target, {world, distance, height, yaw, pitch})` 让相机跟在物体后方；当有实体会挡住目标时相机立即拉近，障碍消失后在 `recovery` 秒内回到原距离。`moveDirection(forward, right)` 把摇杆或按键输入换算成相对于视角的世界方向。浏览器入口另外提供 `createFollowControls3D(camera, element, target, options)`：拖动环视，滚轮或双指调整距离，相机装置在 `controls.follow` 中。

刚体的 `node` 在刚体加入世界时被放到刚体的位置；除静态刚体外，之后每一步都跟随刚体。

`{type: 'convex', hull: createConvexHullShape3D(geometryOrPoints)}` 是用于可移动摆设的凸多面体；超过 64 个角点时只保留最外侧的那些。凸包与平面精确碰撞，与网格通过角点碰撞；与球、胶囊、盒子和其他凸包之间使用面平面和角点包含判断，当两条棱相交而任何一方都没有角点进入对方时，会在这两条棱之间生成一个接触点。

`world.createJoint(options)` 用世界空间的锚点连接两个刚体，或把一个刚体固定在世界中：`point`（球窝）、`hinge`（带 `axis`）、`fixed`（焊接）和 `distance`（刚性杆，或松弛时不受力的 `rope`）。被关节连接的两个刚体默认互不碰撞，除非设置 `collideConnected`。

铰链可以设置 `limits: [min, max]`（弧度，相对于创建时的姿态）和马达：`motorSpeed` 是马达要达到的转速，`maxMotorTorque` 是它可以使用的最大力矩；转速为零的马达相当于刹车。球窝关节可以设置 `coneLimit`，即两个刚体绕 `axis` 相互摆开的最大角度。`joint.angle` 返回当前角度，按 bodyA 相对于 bodyB 或世界的转动计算。限位和马达的数值可以随时修改。

刚体上的 `continuous: true` 用于子弹等体积小、速度快的物体：每一步中，它的位移会在路径上遇到的第一个表面处截断，因此不会穿过薄墙。路径沿刚体中心所在的直线探测，能发现正面撞上的物体，但发现不了只被侧面擦到的物体。

求解器不包含滑动关节和弹簧关节。未开启 `continuous` 时，体积小、速度快的刚体可能穿过薄的几何体；墙体厚度应大于刚体单步移动的距离。

## 曲线、轮廓与更多几何体

曲线（`LineCurve3D`、`QuadraticBezierCurve3D`、`CubicBezierCurve3D`、`CatmullRomCurve3D`、`CurvePath3D`）提供 `getPoint(t)`、匀速的 `getPointAt(u)`、切线、长度和无扭转的标架。`Path2D3D` 和 `Shape3D` 用 `moveTo`、`lineTo`、`quadraticCurveTo`、`bezierCurveTo` 和 `arc` 构造平面轮廓；形状可以带孔。

新增的构造函数：`createCircleGeometry3D`、`createRingGeometry3D`、`createTorusKnotGeometry3D`、`createTetrahedronGeometry3D`、`createOctahedronGeometry3D`、`createIcosahedronGeometry3D`、`createDodecahedronGeometry3D`、`createPolyhedronGeometry3D`、`createLatheGeometry3D`、`createTubeGeometry3D`、`createShapeGeometry3D` 和 `createExtrudeGeometry3D`（直线挤出或沿曲线挤出；端面和侧壁是两个材质组；不生成倒角）。工具函数：`createEdgesGeometry3D`、`createWireframeGeometry3D`、`mergeGeometries3D`、`mergeVertices3D`、`toNonIndexedGeometry3D` 和 `transformGeometry3D`。

## 风格化与自定义材质

`createToonMaterial3D({steps})` 把漫反射光量化成若干平坦的色阶。`createMatcapMaterial3D({matcap})` 按视图空间法线从一张球面图像取色，不需要灯光。标准材质通过 `clearcoat` 和 `clearcoatRoughness` 增加一层清漆，通过 `sheen`、`sheenColor` 和 `sheenRoughness` 增加布料的柔和边缘光，通过 `transmission` 实现可透视的玻璃（`createGlassMaterial3D`）。透射表面显示的是在它之前绘制的内容：渲染器在不透明物体和背景绘制完成后复制一次画面，表面读取这份副本，按自身颜色着色、按粗糙度模糊，同时保留自己的反射。`thickness`（世界单位）与 `ior` 一起让视线像穿过实心玻璃块那样发生偏折；厚度为零表示不偏折视线的薄片。`attenuationColor` 和 `attenuationDistance` 让着色随光在内部走过的距离加深。无论 `alphaMode` 是什么，透射材质都与透明物体一起绘制。只能看到一层：位于这种表面后方的其他透射物体和透明物体不会透出来；偏折只在入射面计算一次，所以玻璃球会放大后面的景物，而不是把它上下颠倒。

任何受光材质都可以设置 `lightMap` 和 `lightMapIntensity` 来使用烘焙光照，它会加到间接光上。贴图按自身的 `channel` 采样，通常设为 1，让烘焙使用第二套不重叠的 UV。

`material.shader = createCustomShader3D({key, glsl, wgsl, uniforms})` 为任意材质增加片元钩子。钩子是名为 `customFragment` 的函数，接收着色后的线性颜色与透明度、世界坐标、法线和 UV，返回新的颜色；可以使用 `discard`。有十六个浮点数可用，GLSL 中为 `uCustom[0..3]`，WGSL 中为 `material.custom[0..3]`；随时间变化的效果每帧写入 `shader.uniforms`。需要为要发布的每个后端提供源码；没有对应源码的后端按原样绘制材质。更换着色器后调用 `material.touch()`。

同一个对象还可以带顶点钩子 `glslVertex` 和 `wgslVertex`：名为 `customVertex` 的函数接收世界坐标、局部坐标、法线、UV 和顶点颜色，返回位移后的世界坐标。它在可见画面和每一张阴影图中都会执行，因此随风摆动的树叶和草，投下的阴影也会一起摆动。顶点钩子只能使用它的参数和自定义参数，因为绘制阴影时没有绑定相机数据。

## 点光源阴影、环境与视口

可以有一个点光源投射阴影（`createPointLight3D({castShadow: true})`）。它通过四面体的四个面绘制四张阴影图，用普通透视阴影图覆盖所有方向，过滤方式与其他灯光相同。它占用整张图集，在没有平行光或聚光灯投射阴影时生效。

`parseRgbe3D(bytes)` 解码 Radiance `.hdr` 文件，`createCubeTextureFromEquirect3D(image, {size, exposure, maxValue})` 把全景图转换为立方体纹理，用于 `scene.background` 和 `scene.environment`。立方体各面在曝光和高光压缩后以 8 位保存。`captureCubeTexture3D(renderer, scene, position, options)` 把某一点周围的场景烘焙成立方体纹理，用于局部反射；它需要回读像素，适合在加载时使用。

`renderer.viewport = [x, y, width, height]`（0 到 1，原点在左下角）把绘制限制在输出的一部分，`renderer.autoClear = false` 保留之前的视图已绘制的内容。两者配合，在一帧内多次调用 `render()` 即可实现分屏、小地图和画中画。

`scene.clippingPlanes` 保存最多四个世界空间平面，格式为 `[nx, ny, nz, d]`；位于负侧的片元不绘制，可用于剖面和水面反射。`scene.overrideMaterial` 让所有网格都用同一个材质绘制。

## 合批与宽线

`createBatchedMesh3D(material)` 把共用一个材质的多个不同几何体合并成一次绘制。`addGeometry(geometry, matrix)` 返回一个 id；之后可以用 `setMatrixAt`、`setVisibleAt`、`setColorAt` 和 `deleteGeometry` 修改单个条目。合并后的缓冲只在有改动时重建，适合很少移动的摆设。

`createFatLine3D(points, {width, screenSpace, closed, color})` 把折线绘制成始终朝向相机的带状网格，拐角处做斜接。宽度以世界单位计；开启 `screenSpace` 并把 `resolutionHeight` 设为输出高度后，以像素计。

## 导航与寻路

`createNavMesh3D(source, {slopeLimit})` 从关卡几何体构建导航网格：可以传入几何体、一个物体（其下的网格按世界变换合并），或原始的 `{positions, indices}`。比坡度上限更陡的面和朝下的面会被剔除；共用一条边的三角形互为邻居，互不相连的楼层属于不同的区域。

`navMesh.findPath(start, end, {agentRadius, followSurface})` 返回最短可行走路线的点列表、路线长度，以及 `complete`：终点无法到达时为 `false`，此时路径停在能到达的最近位置。搜索在三角形上进行，路线再沿所穿过的边被拉直，并去掉可以直线走过的拐点。`agentRadius` 让路线与拐角保持一个半径的距离，并排除角色挤不过去的缺口；`followSurface` 在每次跨越三角形的位置加一个点，让路径贴着坡面。`setCost(triangle, cost)` 提高某块地面的通行代价，`setEnabled(triangle, false)` 把它关闭，例如一扇门。

`findNearest(point, maxDistance)` 把点吸附到网格上，`raycast(from, x, z)` 返回直线行走在碰到边界之前能走多远，`moveAlong(from, x, z)` 在三角形之间移动并沿边界滑动，`isReachable` 判断两处能否经由开放的三角形互相到达，`randomPoint()` 按面积均匀地取一个位置。`createDebugGeometry()` 返回由边组成的线几何体。

`createNavCrowd3D(navMesh)` 负责移动一群角色：`crowd.addAgent({position, radius, speed, node})`、`agent.setTarget(point)`，并在每帧调用 `crowd.update(deltaSeconds)`。每个角色沿自己的路径行走，快要重叠时会被推开，不会离开网格，并通过 `arrived` 报告是否到达；在人群中，当目标位置已被占据、角色无法再靠近时，它会停下并视为已到达。

`findGridPath3D(width, height, cost, start, end)` 是用于瓦片地图的网格 A*，可选择是否允许斜向移动，斜向移动不会从被阻挡的拐角之间穿过。

导航网格按传入的三角形原样使用：不做体素化，也不向内收缩，因此可行走的三角形本身应当与墙保持距离，或者在寻路时传入 `agentRadius`。角色之间只靠简单的互相推开来避让，不预测碰撞；也没有跳跃、梯子这类网格外连接。

## 地形与水面

`createHeightField3D({columns, rows, width, depth, heights | sample})` 在以原点为中心的规则网格上保存高度；`createHeightFieldFromPixels3D(pixels, {width, depth, minHeight, maxHeight, encoding})` 从已解码的图像读取高度，可取红色通道的 8 位，或红、绿两个通道合成的 16 位。`heightAt(x, z)` 沿用绘制和碰撞所用的每格两个三角形，`normalAt` 给出平滑法线，`raycast(origin, direction, limit)` 以半格步长让射线走到地表。写入 `heights` 之后调用 `refresh()`。

`createTerrain3D(field, material, {chunkCells, levels, lodDistance, skirtDepth, uvScale, colorAt})` 把高度场绘制成一组分块网格。每帧绘制前，各分块按到相机的距离选择细节层级：`lodDistance` 以内用完整细节，距离每翻一倍，每边采样数减半。不同层级的相邻分块靠边缘下垂的裙边遮住缝隙；法线始终取自完整细节的高度场，层级切换时光照不会跳变。`colorAt(height, slope, x, z, out)` 为每个采样写入顶点颜色，配合开启 `vertexColors` 的材质做出沙地、草地、岩石和积雪的分带；`lodBias` 整体偏移层级，`chunkLevels` 和 `triangleCount` 报告当前绘制的内容。修改高度场后，分块在下一帧重建。

`field.createShape()` 把完整细节的三角形作为 `mesh` 碰撞形状返回，用于静态刚体，于是球、胶囊、盒子、凸包、角色控制器和物理射线面对的是同一片地面。盒子和凸包与网格的碰撞同时得到加强：一步之内角已经穿过表面，或者网格的棱脊从两个角之间顶入，现在都会产生接触。

`createWater3D({width, depth, segments, color, amplitude, wavelength, speed, direction, steepness, rippleStrength, clarity, thickness, reflectionSize})` 是一块水平水面：四组叠加的波浪移动顶点和着色法线，另有随距离减弱的细小涟漪。水下的景物通过与玻璃相同的折射被弯折后看到；天空的反射来自场景的环境贴图。每帧调用 `water.update(deltaSeconds)`；在主画面之前调用 `water.renderReflection(renderer, scene, camera)`，可得到场景的真实镜像。`water.heightAt(x, z)` 在 CPU 上计算同一组波浪，供漂浮物使用。`createWaterMaterial3D` 只返回材质，可用于自己的几何体。

水面背后的镜子是 `PlanarReflection3D`，可用于任何平面：`reflection.render(renderer, scene, camera, [nx, ny, nz, d], hidden)` 摆放镜像相机，用倾斜的近平面裁掉平面背后的一切，并绘制到 `reflection.target`；把 `reflection.texture` 赋给标准材质的 `reflectionMap` 即可。镜像按像素自身的屏幕位置读取，按表面法线乘以 `reflectionDistortion` 偏移，按观察角度加权，并取代环境贴图的反射。自定义着色器现在还可以带法线钩子 `glslNormal` 和 `wgslNormal`，在光照计算前替换着色法线。

地形使用顶点颜色和一张平铺的 `map` 着色，没有内置按权重图混合多种地表纹理。细节层级按分块选择并用裙边遮缝，不做边对边的缝合；也没有从磁盘流式加载，整个高度场都在内存中。水面只有一个水平镜面，因此旋转过的水面网格或远高于默认值的波浪反射并不精确；没有按水深变化的岸边过渡、泡沫和焦散，也没有处理相机位于水下的情况。镜像需要把场景连同阴影再绘制一次。

## 特效

`createTrail3D({target, lifetime, points, width, endWidth, color, endColor, opacity, endOpacity, map})` 是跟在运动物体后面的拖尾：目标移动时记录世界坐标，记录点随时间消失，每次绘制前重新构建并朝向相机，向尾部逐渐变窄、变淡。把它直接加入场景而不是挂在目标之下，并且每帧调用 `update(deltaSeconds)`；`push(x, y, z)` 可以手动送入点，瞬移之后用 `clear()` 清空。

`createDecal3D(mesh, material, {position, normal, width, height, depth, rotation})` 把一张纹理贴到已有的几何体上。目标网格落在贴花盒子内的三角形被取出、按盒子裁剪，作为一个贴合表面的新网格返回，纹理坐标在盒子范围内从 0 到 1；它被加为目标的子节点，因此随目标移动，并像普通网格一样接受光照和阴影。`createDecalGeometry3D` 只返回几何体。背向贴花的面会被略去，盒子没有碰到表面时返回 `undefined`。贴花按静止形状裁剪：不会跟随蒙皮变形，也不会跟随地形分块切换细节层级。

`createGpuParticles3D({count, lifetime, speed, direction, spread, gravity, drag, startSize, endScale, rotation, spin, startColor, endColor, startOpacity, endOpacity, fadeIn, fadeOut, shape, loop, duration, map, blending, softness})` 在顶点阶段计算粒子运动。每个粒子的起点、出生时间、速度、寿命、大小和旋转只写入一次；每帧只有时间在变，由 `update(deltaSeconds)` 设置。循环发射器是一股在时间 0 就已稳定运行的粒子流；`loop: false` 是一次爆发，可用 `isFinished` 查询结束、用 `restart()` 重放。大约一百万个粒子以内都是一次绘制，CPU 每帧不做任何逐粒子工作。代价是运动必须符合公式：在发射器空间内的发射、重力和阻力，并随发射器节点移动。需要碰撞、受吸引，或在发射器移动后留在世界中的粒子仍应使用 `ParticleEmitter3D`。粒子不排序，因此宜用叠加混合，或柔和、低不透明度的贴图。

`material.softness` 让混合材质在接近其后方实体几何的那段距离内逐渐淡出，而不是留下一条生硬的交线：软粒子、薄雾、光锥都用得上。两种粒子发射器都接受这个参数。只要有可见的混合材质需要它，渲染器就先把不透明场景的深度绘制到与输出同样大小的纹理中，代价是对不透明物体多做一遍仅深度的绘制。

`createAtmosphere3D({fogColor, fogDensity, fogHeight, fogFalloff, shaftIntensity, shaftLength})` 来自后端入口，把高度雾和光束做成一个后处理钩子：把 `atmosphere.post` 赋给 `renderer.postProcess.custom`，并且每帧调用 `atmosphere.update(camera, sunDirection)`。雾随距离变浓、随高度按指数变薄，沿每条视线以闭式积分求得。光束从每个像素朝太阳在屏幕上的位置走 24 步，累计途中有多少开阔天空，于是挡在太阳前面的物体会在光晕中切出暗条；太阳离开画面时光束随之淡出。这是屏幕空间的近似：雾不受阴影影响，也不按各个光源分别照亮，密度没有噪声和局部体积，光束只在太阳位于屏幕内或附近时存在。它占用唯一的自定义后处理槽位。平面镜像在绘制时不做后处理，主画面的后处理随后会作用于它。

## 文字

`createTextGeometry3D(text, font, {size, depth, align, letterSpacing, lineHeight, curveSegments})` 把字符串变成位于 XY 平面的网格几何体，第一行的基线在 y = 0。设置 `depth` 时它是一个挤出体，带正反面和侧面两个材质分组；`depth: 0` 时是平面文字。`createTextShapes3D` 只返回轮廓，`font.measureText` 返回宽度。

字体来自 `parseTrueTypeFont3D(bytes)`，它直接读取 `.ttf` 文件（也支持带 TrueType 轮廓的 OpenType 文件，以及 `.ttc` 字体集中的第一个字体）；或者来自 `parseTypefaceFont3D(json)`，读取 Web 3D 库常用的 typeface JSON 格式。字形在首次使用时才解码，因此大型的中日韩字体只为用到的文字付出开销。带 PostScript（CFF）轮廓的字体会被拒绝。字符从左到右逐个排列，不做字距调整和字形整形，因此阿拉伯文、天城文等需要连写或重排字母的文字无法正确排版。挤出体的边缘是锐利的，不生成倒角。

## 变换操纵器

浏览器入口的 `createTransformControls3D(camera, element)` 提供用指针移动、旋转和缩放物体的手柄。把 `controls.gizmo` 加入场景，调用 `attach(object)`，并在每帧调用一次 `controls.update()`。`mode` 为 `'translate'`、`'rotate'` 或 `'scale'`；`space` 为 `'world'` 或 `'local'`；操纵器上的 `translationSnap`、`rotationSnap` 和 `scaleSnap` 设置步进值。手柄在屏幕上保持固定大小，并绘制在场景之上。

在同一个元素上，变换控制要先于轨道或飞行控制创建：这样按在手柄上的操作不会传给它们。`gizmo.onDraggingChanged` 报告拖动的开始和结束，供自行暂停相机控制的应用使用；`gizmo.onChange` 报告每一次改动。

操纵器本身，即核心入口的 `createTransformGizmo3D(camera)`，不接收输入事件。它通过 `hover`、`beginDrag`、`drag`、`endDrag` 和 `cancelDrag` 由世界空间的射线驱动，因此也可以用手柄控制器或测试来操作。

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
| `MeshToonMaterial`、`MeshMatcapMaterial`、`MeshPhysicalMaterial` 的清漆、光泽、透射、`ior`、`thickness` 与衰减、`lightMap` | `createToonMaterial3D`、`createMatcapMaterial3D`、`material.clearcoat`、`material.sheen`、`createGlassMaterial3D` 配合 `material.ior` 和 `material.thickness`、`material.lightMap` |
| `ShaderMaterial`、`onBeforeCompile`、`customDepthMaterial` | 把 `createCustomShader3D` 的结果赋给 `material.shader`；其中的顶点钩子同时作用于阴影 |
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
| `EffectComposer`、`UnrealBloomPass`、`OutputPass`、`FXAAShader`、`SSAOPass`、`OutlinePass`、`BokehPass`、`ShaderPass`、`DepthTexture` | `renderer.postProcess`，配合 `ssao`、`outlineLayers`、`dof` 和 `custom`（`sceneDepth`） |
| `BatchedMesh`、`Line2` | `createBatchedMesh3D`、`createFatLine3D` |
| `TextGeometry`、`FontLoader`、`TTFLoader` | `createTextGeometry3D`、`parseTypefaceFont3D`、`parseTrueTypeFont3D` |
| three-pathfinding、recast-navigation 等寻路扩展 | `createNavMesh3D`、`navMesh.findPath`、`createNavCrowd3D`、`findGridPath3D` |
| `TransformControls` | `createTransformControls3D`、`createTransformGizmo3D` |
| `renderer.clippingPlanes`、`scene.overrideMaterial` | `scene.clippingPlanes`、`scene.overrideMaterial` |
| `CubeCamera`、`PMREMGenerator.fromEquirectangular` | `captureCubeTexture3D`、`createCubeTextureFromEquirect3D` |
| `OrbitControls`、`PointerLockControls`、`FlyControls` | `createOrbitControls3D`、`createFlyControls3D` |
| `AudioListener`、`PositionalAudio` | `createAudioListener3D`、`createPositionalAudio3D` |
| `BoxHelper`、`ArrowHelper`、`CameraHelper`、各种灯光辅助器、`SkeletonHelper`、`GridHelper`、`AxesHelper` | 对应的 `create...Helper3D` 函数 |
| 扩展库中的角色控制器和第三人称相机 | `createCharacterMotor3D`、`createFollowCamera3D`、`createFollowControls3D` |
| cannon-es、Rapier 等物理扩展，三角网格与凸包碰撞体，约束 | `createPhysicsWorld3D`、`createCharacterController3D`、`createMeshShape3D`、`createConvexHullShape3D`、`world.createJoint` |

需要注意的差异：用工厂函数代替构造函数；颜色是线性 RGB 数组或十六进制数；向量和四元数是类型化数组，通过 `setPosition`、`setRotation`、`setScale` 和 `lookAt` 修改；资源用 `dispose()` 释放；错误是带 `code` 的 `World3DError`。

## 与 Engine 的整合

World3D 画布与 2D 舞台表面相互独立。`createWorld3DHost(canvas)` 为只有 3D 画布的应用返回宿主。`startWorld3DLoop(engine)` 每个显示帧推进一次显式 Engine 时钟，并在间隔超过时钟步长上限后重新设定锚点。

`createWorld3DView(engine, scope, options)` 在 Scope 下订阅 Engine 时钟。每次 tick 按需调整绘制缓冲大小，调用 `onUpdate`，推进混合器、控制器和粒子发射器，然后渲染。关闭 Scope 即结束视图。渲染器、场景和控制器仍归创建者所有；用 `scope.use(...)` 登记后可随 Scope 一并退役。

需要在 3D 场景上方显示 2D 界面时，可以把透明的共享 2D 宿主画布叠放在 World3D 画布之上，也可以把 2D 画布作为屏幕层绘制（见“2D 与 3D 同屏”）。把单个 2D 显示对象按深度穿插在 3D 对象之间，仍由可编辑场景路径负责。

`createOrbitControls3D(camera, element, options)` 基于 Pointer Events 提供环绕、平移和缩放，包括双指平移与捏合、阻尼和可选的自动旋转。

## 示例与检查

[World3D 示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/world3d/README.zh-CN.md)在任一后端上展示灯光、阴影、实例化、蒙皮、变形、粒子、渲染目标、拾取和轨道控制。

无浏览器测试 `tests/world3d-core.test.mjs`、`tests/world3d-animation-picking.test.mjs`、`tests/world3d-gltf.test.mjs`、`tests/world3d-renderer-lifetime.test.mjs`、`tests/world3d-extended.test.mjs`、`tests/world3d-decoders.test.mjs`、`tests/world3d-navigation.test.mjs`、`tests/world3d-terrain.test.mjs`、`tests/world3d-crowd.test.mjs`、`tests/world3d-effects.test.mjs` 和 `tests/world3d-parity.test.mjs` 通过公共入口覆盖不依赖 DOM 的核心、资源提供者、状态机和物理。

`tools/verify-world3d.mjs --playwright <installed-playwright-module> --output <new-directory> [--channel msedge]` 把二十四个固定场景分别用两个后端绘制到渲染目标并比较图像。较新的场景覆盖级联阴影、后处理、压缩纹理、屏幕层、从保存的文档还原的场景、风格化与自定义材质、点光源阴影、带描边与裁剪的屏幕空间遮蔽，顶点钩子及其阴影，光泽、玻璃、光照贴图、合批与宽线，景深，透过玻璃的折射，文字与变换操纵器，带反射水面、细节层级混合的地形，处于不同片段、带阴影的实例化蒙皮角色，带拖尾和软 GPU 粒子的贴花，以及带光束的高度雾。开发期间全部二十四个场景在使用软件渲染的无头 Chromium 中运行。桌面复审在 NVIDIA RTX 5090 Laptop GPU 上用 Edge 157 执行了前十六个场景，未使用强制渲染后端的启动参数。两个后端的可见示例均开启抗锯齿并正常呈现，释放后停止推进帧。

`tools/bench-world3d.mjs --playwright <installed-playwright-module>` 在两个后端上测量固定负载下 `render()` 的 CPU 时间，用作发现性能回退的基线，而不是绝对评分。负载包括静止与运动的网格、阴影、实例化、多光源、每个网格一次绘制的蒙皮与一次绘制 2000 个烘焙实例的蒙皮、合批、覆盖在场景上的玻璃以及后处理链；另外还测量一次物理步进的耗时，场景为静止的箱子堆、三角网格上的球体和关节链。不测量 GPU 执行时间。

## 待完成事项

- 桌面复审强制触发 WebGL2 上下文丢失并恢复了目标像素，也强制触发 WebGPU 设备丢失，确认收到通知并拒绝后续操作。更广泛的设备与恢复场景仍待验证。
- 一台运行 Chrome 157 的 Android 真机已呈现两个后端，响应了自动触发的阴影开关，并在释放后停止更新帧。本次复审还在同类真机的 WebGL2 和 WebGPU 上检查了屏幕空间效果、顶点位移与阴影，以及斜切投影深度。
- 更广泛的移动端与设备恢复覆盖、视口和反射探针专项检查、性能测量，以及第一人称控制和空间音频的真人验证仍待完成。
- 最新的四个比较场景（光泽、玻璃与光照贴图；景深；折射；文字与变换操纵器）以及关节、凸包、连续碰撞和变换控制目前只在软件渲染和无头测试中运行过，仍需在真实 GPU 上验证并由真人操作检查。
- 拖尾、贴花、GPU 粒子、柔化淡出和大气钩子目前只在无头测试、软件渲染下的两个比较场景以及软件渲染下 WebGL2 的地形示例中运行过，在真实硬件上的观感和开销尚未评估。
- 烘焙蒙皮实例目前只在无头测试、软件渲染下的比较场景与基准测试，以及软件渲染下 WebGL2 的地形示例中运行过。
- 地形、水面和平面镜像目前只在无头测试、软件渲染下的比较场景以及软件渲染下 WebGL2 的地形示例中运行过，仍需在真实 GPU 上、通过 WebGPU 画布呈现并由真人操作检查。
- 尚未实现：不依赖官方模块的 Draco 与 Basis Universal 解码，浮点精度的环境预过滤，多于一层的折射，带倒角的挤出体，文字整形与 CFF 字体，滑动关节与弹簧关节，以及针对旋转或宽大刚体的连续碰撞。
