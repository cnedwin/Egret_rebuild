# 旧游戏迁移到 Android 播放器

[English](../../en/docs/classic-game-android.md) | 简体中文

商业游戏移交时应分别给出原客户端清单、新引擎上的可编辑源码，以及交付版本实际运行的证据。保留只读原工程，直至完成与交付目录重建版本的对照。

| 步骤 | 需要保留什么 | 如何核对 |
| --- | --- | --- |
| 盘点 | 清单里的脚本顺序、各份 RES 清单、主题与外部渠道 | 查阅缺件和待接入列表，也要检查服务端配置在运行时指定的资源。 |
| 编译 | 原工程可信的 TypeScript 编译器、反射信息与命名空间顺序 | 记录编译器和源码摘要。在另一个空目录重建，逐脚本比较。诊断应指向原始文件及位置。 |
| 转换 | EXML 规则、动画标签、图集分片、二进制字节序和文字样式 | 用自制场景对照组件构造、一次操作、封包字节与动画像素。尚未支持的皮肤保留在迁移报告中。 |
| 原生运行 | 游戏作用域、脚本分组、受限资源读取、外部回调和存档命名空间 | 打开、取消并重进同一场景。在收包、编辑和播放期间切换前后台。登录和支付须在渠道测试环境另验。 |
| 交付 | 可编辑输入、原生 Activity、渠道库、工具版本及操作说明 | 在新目录打开交付包，修改游戏，检查类型，使用外部测试密钥生成签名 APK 和 AAB。 |

先按迁移指南执行 `inspect` 和 `compile-classic`。符合 Web 转换范围的游戏可以继续执行 `convert`，编辑结果，用 `rebuild` 重建，再用 `verify` 对照原版的一局玩法。生成的 `api-usage.json` 列出对 `egret`、`eui`、`RES` 和 `dragonBones` 的直接引用，按出现次数排序并标注生成脚本的位置。注册适配器后，可将其交给 `@egret/legacy/coverage` 的 `checkLegacyBindings(bindings, entries)`，定位缺少的名称和动态访问。传入可信的普通适配对象。检测到属性只能确认名称存在。别名、解构、实例方法及回调语义仍需玩法实测。业务脚本编译后，仍需接通所依赖的引擎和宿主能力。[Egret Migrate 命令](https://github.com/cnedwin/Egret_rebuild/tree/main/tools/egret-migrate)

可选的 `@egret/legacy` 提供旧版封包 API 和场景辅助模块。制作可携带工具包时添加 `--legacy` 即可使用这些导入。地图只请求视区内的地块，角色各部件共用游戏作用域；切换场景后才返回的资源要释放租约。转换器可将超大 MovieClip 图集分页，保留跨页帧的标签、偏移和透明像素。[兼容层参考](https://github.com/cnedwin/Egret_rebuild/tree/main/tools/egret-migrate/compat) · [Windows 像素实测](https://github.com/cnedwin/Egret_rebuild/blob/main/docs/evidence/migrate-paged-movie-edge.json)

通过 `services.host.call` 调用 Activity 中显式注册的操作。网络权限按允许访问的源配置。视图关闭后的迟到回调不能重新挂回旧游戏。用 `editText` 接收编辑确认或取消，`waitForBack` 接管弹窗返回，`music` 流式播放包内音频。Android 17 的 Fold7 在两次 WSS 连接中回显了含「起航」的 12 字节小端封包。实际听感、真人输入法选词及运营渠道回调需要各自的验收。[网络接入](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/android/network/README.zh-CN.md) · [真机网络记录](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-migrated-game-network.json) · [移动宿主记录](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-modular-scripts-and-mobile-services.json)

本地分发兼容包时，运行 `node tools/egret-migrate/pack.mjs --legacy --npm <npm-cli.js> --out <new-folder>`。生成的归档包含引擎许可和声明正本，可在空工程中直接安装 `.tgz`。调试时只需生成新的游戏资源版本，可以复用原生工程及其构建缓存。发布时从同一份可编辑输入重建，并记录工具包的确切摘要。签名密钥、服务地址及渠道配置由客户管理。[构建、更新与交接 Android 游戏](android-migration-build-kit.md)

### 按游戏实际调用选择适配器

将同一次编译生成的 `api-usage.json` 与 `sdk-surface.json` 对照。后者记录所提供 SDK 声明中的纯类型、内部接口和实例成员。项目自有扩展通过 `provideBindings` 接入，动态调用仍需单独核对。声明清单用于找到接口；实际交互用来核对行为。

建议从一个能改变游戏状态的界面入手。布局示例会打开双列表格、滚动并读取包内文字、二进制数据和小图。旧版 RES 的并发请求共用正在进行的读取，并遵守当前游戏的并发上限。调用 `RES.destroyRes(group, false)` 时，其他已加载组持有的资源继续可用；关闭游戏会清理排队的工作和迟到的回调。用同一份业务脚本在两个宿主上核对坐标、按钮操作、资源字节和关闭时的回收数量。[双列界面示例](https://github.com/cnedwin/Egret_rebuild/tree/main/runtime-sdk/examples/legacy-layout) · [旧版 HTTP、WebSocket 与渠道回调](https://github.com/cnedwin/Egret_rebuild/blob/main/tools/egret-migrate/compat/transport.zh-CN.md)

在 Fold7 上，界面正确显示两种颜色的中文标题。分别点击普通文字和链接，只产生一次 `open:gate` 事件。关闭界面后，3 份上传资源和 2 份文字栅格全部释放。布局、资源读取和网络分别采集。[桌面与手机实测结果](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/november-classic-gameplay.json)
