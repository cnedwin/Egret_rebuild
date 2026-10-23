# 从素材到动画

[English](README.md) | 简体中文

本示例使用原创 Apache-2.0 合成素材，构建红绿两帧图集及独立蓝色图像。元数据使用固定 Aseprite 1.3.18.6 格式配置，不构成真实导出器验证。

完成仓库标准依赖安装及构建后，在仓库根目录使用固定 Node 26.7.0 执行：

```text
node tools/content/author-example.mjs
```

每次运行会创建新的 `work/content-build-example/run-*` 目录并打印位置，保留旧运行。该目录包含源快照、四资源配方、新候选快照 `candidate.json`、实际构建回执 `receipt.json` 及浏览器配置 `browser-config.json`。缓存及输出保存在忽略的工作目录中。

可使用已安装的 Playwright 1.62.1、Microsoft Edge 和现有有限采集器复现浏览器检查：

```text
node tools/verify-content-build.mjs --playwright ABSOLUTE_PLAYWRIGHT_PACKAGE --output NEW_ABSOLUTE_DIRECTORY_OUTSIDE_REPOSITORY
```

采集器创建自己的运行目录，仅通过本地回环服务提供捕获的示例及声明依赖，记录完整画面像素和清理结果，结束后关闭页面及服务。标准示例服务目前不提供该生成内容示例；本检查不需要开放整个仓库目录。

生成配置同时固定 candidate.json 与清单的内容。页面先核对已提交候选快照的字节，再沿 e_generation 选择器检查目标、代次、资源引用和清单文件记录。仅加载该快照选中的清单，核对 SHA-256 与字节数后使用公共 contracts 接口接纳。本示例的有限校验器只针对该首次提交快照，并非通用项目解析器。四个主产物均通过 ManifestByteSource 读取；清单绑定、原生 PNG 资源提供器、图集和序列播放均使用现有公共 SDK。依赖序号 0 必须对应生成页面和图集。初始红色方块在 0.125 秒时变绿，蓝色方块保持不变。

有限浏览器采集入口 `window.contentBuildExample` 提供 `ready`、`advance(seconds)`、`readSnapshot()`、可重复调用的 `close()`。时间必须单调递增且不超过十秒。快照包括实际 Canvas 像素、资源计数、诊断及释放证据。源码和语法检查本身不代表真实浏览器验证通过；实际结果由独立采集记录。

## 显式 CLI

```text
node tools/build-content.mjs --root ABSOLUTE_PROJECT_OWNER --project project.json --recipe recipe.json --cache ABSOLUTE_CACHE_DIRECTORY --output ABSOLUTE_OUTPUT_DIRECTORY --snapshot-out candidate.json --receipt receipt.json --selector e_generation --transaction t_build
```

九个参数都必须且只能出现一次。目录必须已存在；项目、配方、候选快照、回执使用规范的 owner 相对路径；输出文件必须是新文件。配置读取限制为 4 MiB 并严格校验 UTF-8；配方仅接受标准 JSON，拒绝重复键、注释、尾逗号及超过 32 层的嵌套。即使命中缓存也核对源文件内容固定值。

CLI 在本地内存 ProjectStore 中提交，并以独占写方式输出**新候选快照**。这**不是磁盘当前项目的原子替换**，也没有独立的 current 指针。构建已就绪但未接纳时，按实际状态保存回执、非零退出，且不导出已接纳快照。已有源快照及输出文件不被覆盖。

测试或采集器可使用唯一可选参数 `--parent ABSOLUTE_EXISTING_DIRECTORY` 指定已有父目录。生成配置以自身 URL 为基准，因此本地服务可显式挂载该运行目录。
