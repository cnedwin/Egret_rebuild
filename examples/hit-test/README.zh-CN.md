# 显示拾取示例

[English](README.md) | 简体中文

工程预览 **0.30.0** 将既有 Stage 查询、类型化事件与 CanvasHost 组合成自定义矩形小型应用。

## 从仓库根目录运行

使用仓库固定工具：Node.js 24.19.0、pnpm 11.25.0 与 TypeScript 7.0.2。

```text
pnpm install --frozen-lockfile --ignore-scripts
node tools/build.mjs
node tools/serve-canvas.mjs
```

保留打印出的本机回环地址和端口，将路径改为 `/examples/hit-test/index.html`。既有服务器打印的是较早 Canvas 示例路径；用 Ctrl+C 停止。页面通过 import map 导入已构建 SDK；包保持 private `0.0.0`、协议 `1.0`。

使用鼠标左键点击。上层可见性演示重叠目标；绿色可见性与绿色交互分别演示渲染及输入压制。底部相邻矩形共享半开边界，小反馈方块显示被选角色颜色。未命中保留已准入负载，反馈帧保持不变。

## 组合与清理

[scene.mjs](scene.mjs) 管理含 Stage 的九个节点、五个自定义角色及八个 Scope 类型化监听者。目标／祖先监听者记录标量路径；`dispatchEvent` 返回后，场景代码清除并重绘一个反馈矩形，再渲染一次。监听函数自身不绘制反馈。

[application.mjs](application.mjs) 从固定 640×400 CSS 画布将有限 CSS 坐标转换成 320×200 逻辑坐标，接收主鼠标左键输入。它管理六组具体回调及一个共享 Close Promise。关闭先禁止回调、尝试每组监听移除，再等待获取完成，清理 Scope／Engine 并将借用画布归零／移除。延迟获取的 Engine 或首次渲染中的关闭均不能发布 Ready。

[main.mjs](main.mjs) 仅导出标量 `readSnapshot()` 观察及共享 `close()`；模块求值不等待用户关闭。这些是示例端口，不是新增 SDK 导出。

## 已记录检查

工程预览 0.30.0 的历史验证记录：

已采用公共入口的无界面检查通过 **12/12**。新桌面后继在默认 Edge **154.0.4258.62** 中通过 **PASS_DESKTOP_HT1_CANVAS_SUBSET**：十个基线记录与五项指定对照覆盖真实鼠标输入、类型化路径、Canvas 像素及独立的六组原生监听账本。纯准入检查单独通过 **32/32**，不同范围数量不合计。 完整本地验证通过：构建、类型夹具及包边界；核心 **2377/2377** 与结构化公开检查 **63/63**。本地化检查覆盖 **140** 对文档、**6** 个注册表视图及 **154** 个关键源文件。知识库验证检查 **159** 条记录、**243** 份 Markdown、**1997** 个链接及 **955** 个引用，问题数为 **0**；无界面生命周期关闭后待处理计时器为 **0**。以上是不同范围，不合并为测试总数。 最终独立双语语义审阅、必要 Git 推送钩子及交付仍为 **PENDING**。

```text
node --test tests/hit-test-scene.test.mjs
```

六个隔离上下文保存 30 个产物，其中包括 **目标 424 + 参考 424 字节原始 RGBA**。基线 Close 移除全部六组原生回调，未移除数量为零；omit-retirement 对照故意保留六组并被检测。收集器关闭每个上下文并恢复观察器。各上下文错误均为零，且各保留恰好两条 Canvas 读回提示。首次原生结果继续保留为 **INCOMPLETE**，原记录未重写。V3 仅将精确已知读回提示分类为建议，不改变 CanvasHost 属性、SDK、案例动作或像素判据；其他警告／错误仍会拒绝验收。

12 项检查涵盖字面拾取／路径、稳定反馈指令数、半开边界、CSS 准入、真实 Node EventTarget 回调组移除、共享关闭、延迟 Engine 所有权、抛出 `undefined`、CanvasHost 启动失败及首次渲染关闭重入。Node EventTarget 证据不证明原生 DOM 移除或原生像素。本准备截止点的最终独立双语语义审阅、实际 Git 推送钩子与交付仍为 **PENDING**。

范围与保留失败见[知识库记录](../../knowledge-base/Cns/docs/显示拾取示例.md)。第一方示例采用 Apache-2.0，不新增依赖或外部资产。
