# 托管 UI 中的原生编辑

[English](README.md) | 简体中文

完成 pnpm setup:dev 后运行 node examples/text-editing/serve.mjs，打开输出的本机地址。服务器从现有随附 Noto 资源构建不可变字体清单，原字节／许可不变；页面链接可选择 WebGL2 或 WebGPU。

激活名字或简介后，真实 input／textarea 覆盖在共享渲染 UI 上。Enter 完成名字编辑，在简介中插入换行；Tab／Shift+Tab 沿用既有行焦点顺序。取消丢弃临时组合输入，保留普通编辑已经提交的文本。宽度、密度、滚动与配对字体替换复用 UI、段落、Scope 和资源所有权；匹配的呈现发布后，原生元素才交还给只读段落，不包含新触摸实现。

[SDK 契约](../../knowledge-base/Cns/docs/native-text-editing.md) 说明接入顺序：准备／提交 UI，sync 原生定位，通过 onChange／onInvalidate 调度已有捕获路径。默认随附字体覆盖选定拉丁／阿拉伯／中日韩文本，不包含全部 Emoji。缺字导致发布失败时保留原生文本，应补充合格字体或显式修改源文本；原生与只读引擎可能采用不同换行。

使用已安装 Playwright 1.62.1 和默认 Edge 运行 node examples/text-editing/verify-browser.mjs <playwright-root> <工程外全新输出目录>，一次完成有限的 WebGL2／WebGPU 批次并保存实际源码身份、截图和结果，保留原始失败。[已记录汇总](verification-summary.json)。受控组合输入／粘贴事件不能代替实体输入法／系统剪贴板证据；真实 IME、手机、无障碍、其他宿主与性能仍为独立要求。页面诊断仅包含本地示例数据，产品宿主不应持久记录个人输入文本。
