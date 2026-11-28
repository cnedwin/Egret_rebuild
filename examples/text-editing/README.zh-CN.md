# 托管 UI 中的原生编辑

[English](README.md) | 简体中文

完成 pnpm setup:dev 后运行 node examples/text-editing/serve.mjs，打开输出的本机地址。服务器从现有随附 Noto 资源构建不可变字体清单，原字节／许可不变；页面链接可选择 WebGL2 或 WebGPU。

激活名字或简介后，真实 input／textarea 覆盖在共享渲染 UI 上。Enter 完成名字编辑，在简介中插入换行；Tab／Shift+Tab 沿用既有行焦点顺序。取消丢弃临时组合输入，保留普通编辑已经提交的文本。宽度、密度、滚动与配对字体替换复用 UI、段落、Scope 和资源所有权；匹配的呈现发布后，原生元素才交还给只读段落，不包含新触摸实现。

[SDK 契约](../../knowledge-base/Cns/docs/native-text-editing.md) 说明接入顺序：准备／提交 UI，sync 原生定位，通过 onChange／onInvalidate 调度已有捕获路径。默认随附字体覆盖选定拉丁／阿拉伯／中日韩文本，不包含全部 Emoji。缺字导致发布失败时保留原生文本，应补充合格字体或显式修改源文本；原生与只读引擎可能采用不同换行。

使用已安装 Playwright 1.62.1 和默认 Edge 运行 node examples/text-editing/verify-browser.mjs <playwright-root> <工程外全新输出目录>，一次完成有限的 WebGL2／WebGPU 批次并保存实际源码身份、截图和结果，保留原始失败。[已记录汇总](verification-summary.json)。受控组合输入／粘贴事件不能代替实体输入法／系统剪贴板证据；真实 IME、手机、无障碍、其他宿主与性能仍为独立要求。页面诊断仅包含本地示例数据，产品宿主不应持久记录个人输入文本。

默认预览按场景 CSS 宽度显示，启动 DPR 上限为 3。添加 preset=verification 保留 800×480、比例／密度 1 的固定夹具。真实宽度改变时结束编辑，仅替换独立 Scope 的界面；键盘引起的纯高度变化保持原生会话。宽度切换保留模型、字体及可见稳定行锚点；实际 DPR 改变后重新打开预览。采集器显式选择固定档，并另查响应式行为。见 [Android 原生输入观察与限制](../../knowledge-base/Cns/docs/android-native-text-editing.md)，上述更广泛资格仍保持未完成。

## 弹出层与模态层流程

在现有网址后添加 layers=1，启用资料详情、草稿重命名与返回列表。保存修改原名，取消保留原值。继续复用相同 UI、字体缓存和输入通道。覆盖层逻辑焦点不会强制弹出原生键盘，需要显式激活对话框字段。默认与固定验收配置保持独立。见[层级契约](../../knowledge-base/Cns/docs/ui-layers.md)与[有界摘要](layer-verification-summary.json)。

当前 Android 补充验证包含实际三星软键盘组合输入、系统旋转和前后台切换。重建视图先结束组合输入再保存模型，程序化回退焦点保持原生键盘关闭；这些有限观察不能代表全部输入法与设备资格。

## 在五万行目录中编辑

运行 `node examples/text-editing/serve.mjs`，在输出的网址末尾加上 `catalog=1`。目录从中部打开，点击姓名或说明即可编辑。**Reading theme** 增大字号和行高，**Replace fonts** 切换随示例附带的 Noto 西文与中日韩字体。输入框、行命中区域和辅助功能节点都跟随列表已提交的布局。

完成仓库环境准备后，在根目录运行以下命令，输出位置选择检出目录之外的新目录。

```sh
node examples/text-editing/verify-catalog.mjs <playwright-root> <new-output-directory>
```

Windows Edge 158 的 WebGL2 和 WebGPU 得到了相同的几何结果。切换主题后，单行行框从 48 增至 62 个逻辑单位；单独切换字体后，同一段文字从三行变成四行，行框从 154 增至 200。两个后端都保留了 `note-24999` 行内偏移 7 的滚动锚点和选区。测试将原生输入框和 ARIA 节点的屏幕范围逐项对照已提交的行框，暂缓真实字体请求以验证取消和 HTTP 失败，在下载期间触发受控组合输入，并在另一笔请求未完成时关闭示例。输出包括 JSON 观察值及每个后端的截图。采样时可见行数为 5–8，驻留行外壳最多 11 个。本次覆盖几何和资源归属，未采样单次编辑的 CPU 开销及帧时。受控组合事件验证事件顺序，真人输入法与辅助技术另行记录。[实测摘要](catalog-verification-summary.json)
