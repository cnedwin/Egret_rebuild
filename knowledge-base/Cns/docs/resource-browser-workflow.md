# 资源浏览器验证流程

[English](../../en/docs/resource-browser-workflow.md) | 中文

本 M0 流程用于准备、复核和运行现有资源采集器，不改变引擎功能或像素判定基准。使用 Windows x64、Node 26.7.0、仓库固定编译器、已安装的 Edge 及 Playwright/core 1.62.1。先完成环境安装和构建。Playwright 包须预先安装在独立工具目录，以下命令不下载软件。PNG 准入使用 setup 建立的当前精确 hoisted 依赖 owner；旧隔离布局需要重新完成当前安装。

## 选择采集范围

| 资源类型 | 完整运行范围 | 准备内容 |
| --- | --- | --- |
| prepared-groups | Canvas 与 WebGPU scene-textured，各含普通、old-A-outer、old-B-trim：六项 | 原配置生成器与完整源码快照 |
| atlas | Canvas 与 WebGPU textured-2D，各含普通、rotation-sign、trim-y-constant、atlas-import-v1：八项 | 独立健康/故障副本、真实编译记录和快照；导入器另存实际公开规划器调用 |
| png | BIP1 Canvas/WebGPU PNG 解码、组合、保存帧回放及两个错误基准反例 | 原始源码/实际执行证据、完整模块图和准入记录 |

这三类资源验证补充已有八个浏览器套件，全部列定案例通过后才能判定该类型完成。下述五种附加固定场景套件保留独立 schema 与证据，不能由 BIP1 代为验收。旧纹理/序列帧/SpriteSheet 采集器继续保留原验收义务。

## 准备与复核

先创建仓库之外的父目录，每次尝试选择一个尚不存在的子目录，不复用失败或未完成的输出目录。

~~~text
node tools/browser-resources.mjs prepare --suite prepared-groups --playwright <已安装-Playwright-包的绝对路径> --output <新的绝对运行目录>
node tools/browser-resources.mjs prepare --suite atlas --playwright <已安装-Playwright-包的绝对路径> --output <新的绝对运行目录>
~~~

准备步骤输出 manifest 路径、原始 SHA-256 和案例数，标记 reviewed=false、browserRun=false。图集准备会编译独立副本，需要创建副本内包目录连接的权限，不修改开发工作区。目录连接被拒绝或编译失败属于准备失败，不属于渲染失败；保留日志，在获得授权的新目录中重试。

运行前须复核完整 manifest、各原始配置/快照、有限判定基准、源码所有者与依赖范围。图集还须核对真实健康/故障构建记录，以及导入器输入、规划结果和调用记录。摘要只标识字节，生成摘要不等于完成源码评审。单独记录评审者身份及范围，区分 AI 评审与真人批准，不直接把未经评审的摘要传入运行步骤。

~~~text
node tools/browser-resources.mjs run --manifest <已复核-manifest.json-的绝对路径> --sha256 <已复核原始摘要>
~~~

入口先检查完整组，再于每个子进程启动前重验该案例已评审的原始字节，并在写入整组完成结果前重验所有案例；每次读取还会核对实际返回字节的长度和摘要。原采集器在启动浏览器前重新计算完整快照或准入。源码、导入、配置、构建输入或运行时身份变化后，须重新准备和评审。每项案例保留标准输出、错误输出、进程结果和原生采集文件；只有整类案例通过才写入最终 result.json。进程正常退出但缺少预期原生记录不能通过。原有严格像素判定、指定反例与资源退出检查均保留。

## PNG 证据输入

PNG 准备由维护者协助完成。新贡献者可在 PR 中请求证据准备与评审，不应编造评审记录或手工修改历史账本。只有所需证据齐全后才使用以下命令：

~~~text
node tools/browser-resources.mjs prepare --suite png --playwright <已安装-Playwright-包的绝对路径> --output <新的绝对运行目录> --evidence <原始证据.json-的绝对路径> --evidence-sha256 <已复核证据摘要>
~~~

输入包含 schemaVersion=1、sourceFilesRoot、graphInputs、reviewPins、proofBindings 和 runtime。sourceFilesRoot 与 graphInputs.repositoryRoot 指向当前工作区。graphInputs 列出精确采集角色/路由、编码素材身份和固定步骤身份。runtime 指定并校验实际 Node 可执行文件、已安装 Playwright 入口、Edge 可执行文件及声明的包清单。路径按原采集器要求使用绝对路径或完整所有者相对路径，禁止仅比较文件名或规范化字节摘要。

BIP1（`--suite png`）的 reviewPins 必须包含以下十一个角色：

| 源码评审 | 实际证据评审 |
| --- | --- |
| plan、productSource、observerSource、collectorSource | missingEntryRed、cpu、build、strictTypes、policy、observerUnits、fixtures |

每个角色指向原始文件、字节数与 SHA-256。proofBindings 通过明确 JSON 指针将已接受身份映射到当前模块图，包含原所有者指针或候选所有者清单指针。准备器生成模块图和准入文件，再调用原准入验证器；不创建任何 PASS_SOURCE 或 PASS_ACTUAL 结论。缺失、过期或未接受证据会在浏览器启动前阻断准备。

构建评审必须绑定当前工作区、真实成功执行的标准构建，以及 image/BrowserTextureProvider 的四个当前 JS/声明身份。旧缺失入口红测保留历史身份。原源码、素材或测试证据只有在完整原始字节和所有者核对后才能保留；新执行命令与变化的文件需单独记录。复制旧构建评审不能证明当前构建资格。

## 五种附加固定场景

使用相同的 PNG 证据命令，将 `--suite png` 替换为下表中的精确套件名。每份准备清单包含一个完整配置，不能只选其中的个别步骤。这些场景复用 PNG 采集基础设施，但不执行 PNG 图片解码。

| 套件 | 主案例后端数 / 原始回读数 | 附加检查 |
| --- | --- | --- |
| nine-slice-bitmap | WebGPU：1 / 3 | 两项 Canvas 拒绝测试，不声明 Canvas 正向渲染通过 |
| display-container-remove-children | Canvas + WebGPU：2 / 6 | 移除子节点并回放移除前的保存帧 |
| display-container-child-index | Canvas + WebGPU：2 / 6 | 查询、重排并回放保存帧 |
| display-container-add-child-at | Canvas + WebGPU：2 / 10 | 独立 Canvas 错误索引反例：额外两次原始回读 |
| display-anchor-offsets | Canvas + WebGPU：2 / 10 | 独立 Canvas 错误锚点反例：额外两次原始回读 |

五种配置均保留原有 24 × 24 固定 RGBA 比较，通道容差为零。主回读数包含保存帧回放；反例回读不计入主案例。包装入口在原采集断言之外检查配置身份、完整计数、上下文退出及反例清理。九宫格的 Canvas 拒绝测试不会被记为 Canvas 渲染成功。

每种配置要求恰好八个原始角色：源码评审 `plan、productSource、collectorSource`，实际证据评审 `missingEntryRed、cpu、build、strictTypes、policy`。graphInputs.profile 须等于所选套件，绑定该配置自己的夹具、判定基准、步骤、当前产品源码及实际 JS/声明构建产物。全部实际证据评审必须注明当前工作区。新评审可核验固定的历史缺失入口红测证据，但须明确保留其原执行所有者与日期，并说明没有重新执行该红测。修改旧评审的所有者或生成 PASS 标签不构成核验。当前构建、行为、类型和策略执行须各自保留命令、结果与原始身份。

首次贡献时，与维护者确定受影响配置，提供提交、环境和可复现改动，请求八角色证据准备及独立源码评审，不手工编写批准结论。准备后先复核输出清单与原证据，再将摘要传给 `run`。角色缺失、借用其他配置证据、步骤不完整或原始输入变化都会在原生启动前停止。每次失败保留独立输出目录。

## 排障与验收

- 摘要错误、路径不规范、输出复用、案例缺失或输入变化：修正输入，在新目录重新准备；不编辑已评审 manifest 来强行通过。
- 准备失败：检查保留的 prepare/snapshot 进程与错误日志，不直接手工运行采集器绕过准入。
- 浏览器不可用、缺少 WebGPU 或原生清理失败：保留未完成/失败结果，记录实际环境，不把能力缺失标记为通过。
- 完整推送 hooks 和受保护合并 CI 仍强制执行。标准结构/无界面门禁不启动这些浏览器，受影响资源类型的证据须另附到 PR。

桌面结果不证明真人上手、外部 fork 批准、手机/小游戏行为、完整 Spine、通用中文字体性能、功耗/性能预算或独立操作系统进程退出。这些义务继续保留在 M0 记录与公开工作项中。
