# 命名 SpriteSheet 不透明像素浏览器验证器

[English](README.md) | 简体中文

此第一方 Apache-2.0 验证器将公共 `createSpriteSheet` 与现有 Engine 时钟序列控制器组合。一个原创 CPU 图集和一个资源管理器签发的租约支持两个真实、由调用者持有的 Bitmap：动画角色与静态命名图标。选定的公共 Canvas／WebGPU Host 渲染真实捕获帧。不使用产品私有导入、复制的校验器、显式播放器、渲染器补丁或第三方素材。

原始源码候选记录把语法、浏览器执行及独立保存结果评审列为 **NOT_RUN**。这一历史截止点与后续尝试分开。下列数量定义完整性要求，不是实测结果；既有 sequence-playback 结果不替代此 SpriteSheet 夹具的验证。

## 调用与前置条件

使用已评审的实际 Windows x64 环境：已安装 Node24.19.0、TypeScript7.0.2、Playwright 与相邻 playwright-core1.62.1，以及正常 Microsoft Edge。真实工作区安装遵循[仓库指南](../../README.md)。独立所有者构建并评审当前源码，接受所有有限通道后提供准入记录。Collector 不执行安装、构建、下载、Git 或编译器。

在仓库根目录调用：

```text
node tools/spritesheet/collector.mjs --playwright "<absolute installed package directory>" --channel msedge --output "<absolute fresh outside-checkout directory>" --admission "<absolute independently accepted admission JSON>"
```

只接受这四个选项各一次。三个路径必须绝对；输出父目录存在，输出目录尚不存在，并位于仓库及 Playwright 输入之外。每次使用新输出。默认无头 `msedge` 不增加参数，不覆盖浏览器环境或持久用户目录。实际浏览器、系统和 adapter 事实仅属于本次运行；adapter 名称不能证明硬件加速或性能。

## 已保存构建准入

Collector 读取 `spritesheet-native-admission/1`，状态 `ROOT_FROZEN_REVIEWED_CURRENT_BUILD`，含实际 `repositoryRoot`、记录的40位 `sourceBase.head/tree`、运行时身份、完整 SDK 清单和保存的构建 actor；不执行新的 Git 来源检查。根相对条目保留正斜线逻辑路径，绝对权威／编译器条目保留原拼写。Plain pin 只有 `{path,bytes,sha256}`，字节数为非负安全整数，SHA256 为小写。不按 basename 配对或任意归一别名。

精确四个产品条目为 runtime 的 `src/spriteSheet.ts`、`src/Bitmap.ts`、`src/index.ts` 与 Engine 的 `src/index.ts`。完整源码包括四个 SDK 的 `src` 及 Engine `web/rendering`；产物包括四个 `dist` 的 JS／声明，不含 maps、buildinfo、实验输出。每个服务端选定第一方 JS、原 TS 对应源及声明均须属于该已保存构建。两个包声明的公共 Host 根及 Engine 根采用有界字面量 ESM 闭包、固定包／Engine 别名，没有通用解析器、求值或远程后备。

`build` 提供 `receiptPin/jobPin/inventoryPin/commandName/stdoutPin/stderrPin`。构建回执必须是字面量 JSON ARRAY；唯一指定 actor 为 exit0、timeoutfalse、args `["tools/build.mjs"]`，时间有效且有序，并匹配完整原始流。同名 job 命令声明当前仓库与 Collector 的精确 Node。exe／cwd 权威来自已保存 job 声明，原始回执未独立记录这些字段。ARRAY 中其他历史 actor 保留各自失败，不产生聚合构建／CPU 成功。

固定的 producer 使用 `spritesheet-sdk-build-inventory/1`，保留原状态 `CURRENT_SDK_INVENTORY_DATA_PENDING_INDEPENDENT_ACTUAL_REVIEW`、state 及 `originalActualReviewPin:null`。独立 `reviews.build` 必须实际接受为 `ACTUAL_GREEN_ACCEPTED`／open0，并以明确 `receiptPinPointer` 和 `inventoryPinPointer` 绑定已保存记录。接受 producer 字节不改写其生成截止点。Admission 与 producer 的五组原始身份数组须完全一致，嵌套构建回执／job／日志／runtime pins 也须相同。

`reviews.plan/product/build/cpu/types/policy/units/example/nativeSource` 均提供明确固定、已接受且 numeric open0 的 review。CPU、types、policy、units、example、build 要求实际 verdict。Product 使用明确 `sourcePinsPointer`；`nativeSource` 用同字段指向当前全部七个 `tools/spritesheet` 文件。缺失、未来、未完成或不匹配的评审在启动前拒绝；源码接受不能虚构实际通道结果。确切 schema1 计划记录的 kind 为 SPRITESHEET_SS1_FINITE_INDEPENDENT_IMPLEMENTATION_PLAN_SOURCE_REVIEW，结论放在 status PASS_SOURCE_PLAN，且没有 verdict 字段；此适配仅限 native-plan 角色。其它角色保持 verdict 检查。当前产品身份指针为 /reviewedPins；/reviewedFiles 包含名称，不是身份行。

精确20配置条目保留根 manifests／lock／workspace／strict configs、build／project-format 工具和 schema、四 SDK 包 manifests／configs、Engine rendering／web configs，以及两个逻辑 TypeScript 包／启动器文件。七个 compiler-owner 条目保留已绑定外部 Node、四个 TypeScript 包／启动器文件和原生 Windows 包／可执行文件。固定 pnpm7.0.2 逻辑／物理关系只接受这些已知所有者，不把原物理条目转换为虚构逻辑身份。

启动前及完整退役后记录四个编译器目录关系与六个指定文件，要求相同端点、字节和 hash。四个已保存工作区别名须在前后指向当前仓库自有包与原包 pin。保存原始 owner 观察、完整选定输入身份及稳定比较。缺失、变化、读取失败或未观察均为 `INCOMPLETE`，即使旧物理文件 hash 仍相同。它们是来源／构建回读，不是签名、安全认证或系统进程退役证明。

## 原创字面量矩阵

图集6×2、48字节、straight-sRGB rgba8unorm：上行红／红／绿／蓝／蓝／蓝，下行红／红／绿／透明／透明／透明。四个精确名字是 `red`、`green`、`blue`、`__proto__`。红2×2角色位于 `(1,1)`；静态3×1蓝图标位于 `(4,1)` 并后绘制。输出8×4／DPR1、clearColor0／clearAlpha0。修改调用者输入不能改变冻结的 canonical 名称／区域。两个 Bitmap 借用同一原租约并属于资源 Scope。

Clip 时长为 `.125/.25/.125`，真实时钟 maxDelta`.5`，`advanceTime(0)` 只建立源基准、不产生 tick。资源、播放和 observer Scopes 分开。

| 行 | 字面量公共操作 | 角色／控制器 |
| --- | --- | --- |
| N1 | 初次捕获；保留原帧 | 红／idle once，source0 |
| N2 | 启动 once；绝对 source`.125` | 绿／running |
| N3 | 退役 Sheet；绝对 source`.375` | 蓝／running；canonical 元数据保留 |
| N4 | 绝对 source`.5` | 蓝／completed once；释放目标 claim |
| N5 | 同一角色创建并启动 loop，不推进时钟 | 红／running loop0 |
| N6 | pause；绝对 source`1` | 保持红／paused loop0 |
| N7 | resume 发布保持的红样本、不产生 tick；绝对 source`1.125` | 绿／running loop`.125` |
| N8 | 绝对 source`1.5` | 红／loop 边界`.5` |
| N9 | 关闭存活调用者及原 Engine；另一 Host／device 重放原 N1 | 原红及静态蓝；不重新捕获 |

每个 backend 要求六次显式 tick、八次新捕获与一次重放。Canvas＋WebGPU 要求18次提交、576pixels／2304channels、容差0。[独立 oracle](oracle.mjs) 固定三个完整128通道字面量，包含静态图标及所有透明外部通道。检查两个命令的几何、image／frame／clip 元数据、frame IDs1–8／重放1、Host serials、clock／sample 前缀、同租约所有权及终止清理。每份原始128字节缓冲先保存，再比较 oracle；预期不依赖观察到的输出像素。

播放 Scope 关闭后，两个调用者 Bitmap、Texture／精确租约与冻结 Sheet 元数据保持有效。调用者退役随后释放租约、清空两个 Bitmap、关闭全部 Scope／clock／Engine，provider dispose 一次。原图像和缓存样本保持不变。N9 在无资产的独立 Host 上使用精确原帧；WebGPU 还须独立应用持有 device。

## 关闭、结果及边界

渲染前取得 readback ticket，并在等待前注册 idle。先结清 acquisitions 与原 tickets，再退役 Host。只有安全 Host close 及待处理工作归零后，才能销毁应用持有 device，并等待 destroyed device loss。超时、不安全或尚未解决的迟到 owner 隔离并输出 `INCOMPLETE`；仅零计数不足。必须记录 fixture／context／browser／loopback 关闭及完整稳定身份。只把 [console-policy](console-policy.mjs) 中精确继承的 Canvas advisory 记录为非性能证据，其他 warning／error 均致命。

继承预算为每操作20秒、收集240秒、退役280秒、硬截止295秒，以及外部 owner 至多300秒 watchdog，并保留有限事件／模块／输入／输出预算。独立评审的外部 Windows Job owner 另存原始流／EOF、进程 assignment、active-zero／Job closure 与退役事实；Collector 关闭不能独自证明系统进程退役。

只有完整实际尝试才能输出 `PASS_SPRITESHEET_OPAQUE_SUBSET`／exit0、`FAIL_SPRITESHEET_OPAQUE_SUBSET`／exit1 或 `INCOMPLETE`／exit2。原始提交数包含重放。本环境不证明 alpha 校准、插值、物理 OOM／GC、硬件 scanout、手机／浏览器矩阵、吞吐、授权权益、完整 Spine R020／V020 或迁移 R008／V006。
