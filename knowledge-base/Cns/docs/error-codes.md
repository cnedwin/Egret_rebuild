# 错误码

[English](../../en/docs/error-codes.md) | 简体中文

本 SDK 抛出的每个错误都是带 `code` 的 `EgretError`。本页列出每个错误码及其含义。它由 `node tools/error-codes.mjs` 根据源码生成；当本页与源码不一致时 `tests/error-codes.test.mjs` 会失败。

## 怎样读一个错误

| 部分 | 内容 |
| --- | --- |
| `error.code` | 大写的错误码。它是稳定的：程序用它来比较 |
| `error.message` | 错误码加一句说明，默认是英文。先调用 `@egret/engine` 的 `setErrorLanguage('zh')`，之后创建的错误就带本页的中文说明。它是给人看的，措辞可能调整 |
| `error.cause` | 导致这个错误的原因（如果有）：`FRAME_RENDER_FAILED` 背后 Host 自己的错误，或应用回调抛出的内容 |
| `error.cleanupErrors` | 出错后清理时又出现的问题（如果有） |

错误码由"哪个部分"和"出了什么问题"组成。开头表示部分，结尾表示发生了什么：`..._OPTIONS_INVALID` 表示选项无效，`..._CLOSED` 和 `..._DISPOSED` 表示在结束之后还在使用，`..._REENTRANT` 表示在自己的回调里又调用了自己，`..._LIMIT` 和 `..._BUDGET` 表示超出了上限，`..._FAILED` 表示失败，原因在 `cause` 中。

游戏最常遇到的错误码有专门写的说明，其中包含该怎么做。其余说明由部分和结尾拼成；结尾不属于常见种类的错误码则逐个写了说明。`describeErrorCode(code, 'en' | 'zh')` 把某个错误码的说明交给程序。

表中各行是源码里完整写出的错误码。有些部分在运行时用自己的前缀加一个短名拼出错误码，所以可能抛出本页没有列出的错误码；它的 message 仍然带有按同样规则生成的说明。

## 游戏最先遇到的错误码

| 错误码 | 含义 |
| --- | --- |
| `FRAME_RENDER_FAILED` | Host 拒绝或未能绘制这一帧。原因在 cause 中：以 _BACKPRESSURE 结尾的错误码表示 Host 还在处理之前的帧，使用 @egret/engine/web/loop 的帧循环可以避免。 |
| `WEBGL2_BACKPRESSURE` | WebGL2 Host持有的未完成帧已达上限。请稍后再绘制下一帧。 |
| `WEBGPU_BACKPRESSURE` | WebGPU Host持有的未完成帧已达上限。请稍后再绘制下一帧。 |
| `CLOCK_DELTA_LIMIT` | 交给 engine.advanceTime 的时间与上一次相差超过了时钟一步允许的长度。请分成更小的步，@egret/engine/web/loop 的帧循环在标签页被隐藏后就是这样做的。 |
| `OBJECT_DISPOSED` | 对象已销毁，不能再修改或添加。请新建一个，或者在它的作用域销毁后不再使用它。 |
| `SCOPE_CLOSED` | 作用域已销毁，它拥有的一切也随之销毁。请新建一个作用域。 |
| `ENGINE_CLOSED` | Engine 已关闭。用它创建的任何东西都不能再使用。 |
| `ENGINE_MISMATCH` | 对象属于另一个 Engine。显示树、作用域及其资源都只属于一个 Engine。 |
| `DISPLAY_VALUE_INVALID` | 交给显示对象的值无效：位置、缩放和旋转是有限数字，alpha 在 0 到 1 之间，visible 是布尔值。 |
| `FRAME_TRANSFORM_INVALID` | 某个显示对象被放到了角点不是有限数字的位置。请检查它及其父级的 x、y、缩放和旋转。 |
| `FRAME_BUDGET_EXCEEDED` | 舞台上的内容超出了一帧的上限：65,536 个节点或命令、256 种材质、4,096 个不同的几何体或 65,536 个网格三角形。半径 40 的圆是 32 个三角形。 |
| `FRAME_IMAGE_BUDGET` | 这一帧使用的图片超出上限：64 页、4,096 个区域或 64 MiB 的不同像素。请把图片合并到更少的图集中。 |
| `GRAPHICS_FILL_REQUIRED` | 形状需要填充或线条。请在绘制前调用 beginFill 或 lineStyle。 |
| `GRAPHICS_VALUE_INVALID` | 交给 graphics 的值无效：坐标是有限数字，尺寸不能为负，颜色在 0 到 0xffffff 之间，alpha 在 0 到 1 之间。 |
| `ASSET_PROVIDER_MISSING` | 没有为这种资源类型注册提供者。请在获取之前用 engine.assets.register 注册。 |
| `ASSET_LOAD_FAILED` | 提供者加载资源失败。它抛出的内容在 cause 中。 |
| `BITMAP_TEXTURE_REQUIRED` | Bitmap 要用 engine.assets.acquire 得到的纹理租约创建。 |
| `ASYNC_EVENT_HANDLER` | 事件监听器返回了 Promise。监听器要在派发返回之前执行完；异步工作请直接启动，不要把它返回。 |
| `VIDEO_PLAY_REFUSED` | 浏览器拒绝播放视频，通常是因为视频有声音而页面还没有被点击过。请静音播放，或在点击后播放。 |
| `WEBGL2_CONTEXT_LOST` | 浏览器收回了 WebGL2 上下文。浏览器归还后 Host 会恢复；在此之前帧会被拒绝。 |
| `WEBGPU_DEVICE_LOST` | 浏览器收回了 WebGPU 设备。开启恢复时 Host 会恢复；在此之前帧会被拒绝。 |
| `WEBGPU_UNAVAILABLE` | 浏览器没有 WebGPU。请改用 WebGL2 Host。 |

## 全部错误码，按部分排列

### ANIMATION

| 错误码 | 含义 |
| --- | --- |
| `ANIMATION_ALREADY_STARTED` | 动画协调器已经开始过了。 |
| `ANIMATION_APPLY_FAILED` | 动画协调器的 `apply` 失败了。原因在 cause 中。 |
| `ANIMATION_BINDING_INVALID` | 交给动画协调器的 `binding` 无效。 |
| `ANIMATION_CALLBACK_FAILED` | 应用交给动画协调器的回调抛出了异常。抛出的内容在 cause 中。 |
| `ANIMATION_CALLBACK_RETURN_INVALID` | 交给动画协调器的 `callback return` 无效。 |
| `ANIMATION_CLEANUP_FAILED` | 清理动画协调器时失败。各个原因在 cleanupErrors 中。 |
| `ANIMATION_COMMANDS_PENDING` | 动画协调器的 `commands` 尚未完成。 |
| `ANIMATION_COMMANDS_REPLACED` | 这一拍交给动画的命令在执行之前被后来的命令取代了。 |
| `ANIMATION_COMMAND_INVALID` | 交给动画协调器的 `command` 无效。 |
| `ANIMATION_COMMAND_LIMIT` | 超出了动画协调器的 `command` 上限。 |
| `ANIMATION_CONTROLLER_INVALID` | 交给动画协调器的 `controller` 无效。 |
| `ANIMATION_CONTROLLER_LIMIT` | 超出了动画协调器的 `controller` 上限。 |
| `ANIMATION_COORDINATOR_CLOSED` | 动画协调器的 `coordinator` 已关闭，不再接受任何操作。 |
| `ANIMATION_ENGINE_INVALID` | 交给动画协调器的 `engine` 无效。 |
| `ANIMATION_EVENT_LIMIT` | 超出了动画协调器的 `event` 上限。 |
| `ANIMATION_EVENT_SEQUENCE_LIMIT` | 超出了动画协调器的 `event sequence` 上限。 |
| `ANIMATION_INVALID` | 交给动画协调器的内容无效。 |
| `ANIMATION_LIMIT` | 超出了动画协调器的一项上限。 |
| `ANIMATION_NOT_STARTED` | 动画协调器还没有开始。 |
| `ANIMATION_OPTIONS_INVALID` | 交给动画协调器的选项无效：缺少某一项、类型不对或超出范围。 |
| `ANIMATION_PRECISION_LIMIT` | 超出了动画协调器的 `precision` 上限。 |
| `ANIMATION_RATE_INVALID` | 交给动画协调器的 `rate` 无效。 |
| `ANIMATION_RATE_ZERO` | 给动画的速率是 0。速率只能大于或小于零：要让动画停住，请暂停它。 |
| `ANIMATION_REENTRANT` | 在动画协调器自己的回调里又调用了它。 |
| `ANIMATION_SCOPE_INVALID` | 交给动画协调器的作用域不是这个 Engine 的一个打开的作用域。 |
| `ANIMATION_SEEK_BACKWARDS` | 交给动画协调器的 `seek` 早于上一次。 |
| `ANIMATION_SEEK_INVALID` | 交给动画协调器的 `seek` 无效。 |
| `ANIMATION_TARGET_BUSY` | 动画协调器的 `target` 还在处理之前的请求。 |
| `ANIMATION_TERMINAL` | 动画协调器已经结束，不能再使用。 |
| `ANIMATION_TERMINAL_COMMAND` | 向已经结束的动画发出了命令。 |
| `ANIMATION_TICK_INVALID` | 交给动画协调器的 `tick` 无效。 |
| `ANIMATION_TIME_LIMIT` | 超出了动画协调器的 `time` 上限。 |

### ASSET

| 错误码 | 含义 |
| --- | --- |
| `ASSET_ACQUIRE_CANCELLED` | 对资源的请求被取消了：由它的信号取消，或者因为它的作用域被销毁。 |
| `ASSET_ACQUIRE_FAILED` | 资源管理器的 `acquire` 失败了。原因在 cause 中。 |
| `ASSET_CLEANUP_FAILED` | 清理资源管理器时失败。各个原因在 cleanupErrors 中。 |
| `ASSET_DISPOSED` | 资源管理器已销毁，不再接受任何操作。 |
| `ASSET_ID_EXHAUSTED` | 资源管理器的 `id` 计数器用尽了。请新建一个。 |
| `ASSET_LOAD_FAILED` | 提供者加载资源失败。它抛出的内容在 cause 中。 |
| `ASSET_NO_DEMAND` | 资源的加载被停止了，因为所有请求它的地方都已放弃。 |
| `ASSET_REF_INVALID` | 交给资源管理器的 `ref` 无效。 |
| `ASSET_SIGNAL_FAILED` | 资源管理器的 `signal` 失败了。原因在 cause 中。 |
| `ASSET_TYPE_INVALID` | 交给资源管理器的 `type` 无效。 |
| `ASSET_TYPE_MISMATCH` | 交给资源管理器的 `type` 不匹配。 |
| `ASSET_VALUE_INVALID` | 交给资源管理器的 `value` 无效。 |

### ASSET_BUNDLE

| 错误码 | 含义 |
| --- | --- |
| `ASSET_BUNDLE_CHECK_FAILED` | 资源包的 `check` 失败了。原因在 cause 中。 |
| `ASSET_BUNDLE_ENTRY_MISSING` | 缺少资源包需要的 `entry`。 |
| `ASSET_BUNDLE_FETCH_FAILED` | 资源包的 `fetch` 失败了。原因在 cause 中。 |
| `ASSET_BUNDLE_FORMAT_INVALID` | 交给资源包的 `format` 无效。 |
| `ASSET_BUNDLE_INVALID` | 交给资源包的内容无效。 |
| `ASSET_BUNDLE_RANGE_INVALID` | 交给资源包的 `range` 无效。 |

### ASSET_GROUP

| 错误码 | 含义 |
| --- | --- |
| `ASSET_GROUP_ACQUIRE_FAILED` | 资源组的 `acquire` 失败了。原因在 cause 中。 |
| `ASSET_GROUP_CLEANUP_FAILED` | 清理资源组时失败。各个原因在 cleanupErrors 中。 |
| `ASSET_GROUP_DISPOSED` | 资源组已销毁，不再接受任何操作。 |
| `ASSET_GROUP_INVALID` | 交给资源组的内容无效。 |
| `ASSET_GROUP_MEMBER_INVALID` | 交给资源组的 `member` 无效。 |
| `ASSET_GROUP_OPTIONS_INVALID` | 交给资源组的选项无效：缺少某一项、类型不对或超出范围。 |
| `ASSET_GROUP_REENTRANT` | 在资源组自己的回调里又调用了它。 |
| `ASSET_GROUP_REFS_INVALID` | 交给资源组的 `refs` 无效。 |
| `ASSET_GROUP_SCOPE_INVALID` | 交给资源组的作用域不是这个 Engine 的一个打开的作用域。 |

### ASSET_LEASE

| 错误码 | 含义 |
| --- | --- |
| `ASSET_LEASE_FACTORY_REQUIRED` | 资源租约要用它的工厂函数创建，不能用 new。 |
| `ASSET_LEASE_RELEASED` | 租约已释放，它的资源可能已不存在。请重新获取该资源。 |

### ASSET_MANAGER

| 错误码 | 含义 |
| --- | --- |
| `ASSET_MANAGER_CLOSED` | 资源管理器已关闭，不再接受任何操作。 |
| `ASSET_MANAGER_FACTORY_REQUIRED` | 资源管理器要用它的工厂函数创建，不能用 new。 |

### ASSET_PROVIDER

| 错误码 | 含义 |
| --- | --- |
| `ASSET_PROVIDER_INVALID` | 交给资源提供者的内容无效。 |
| `ASSET_PROVIDER_MISSING` | 没有为这种资源类型注册提供者。请在获取之前用 engine.assets.register 注册。 |
| `ASSET_PROVIDER_REGISTERED` | 这种资源类型已经注册过提供者。 |

### AUDIO

| 错误码 | 含义 |
| --- | --- |
| `AUDIO_BACKEND_FAILED` | 音频混音器的 `backend` 失败了。原因在 cause 中。 |
| `AUDIO_BUDGET` | 超出了音频混音器的一项上限。 |
| `AUDIO_BUS_UNKNOWN` | 音频混音器中没有这样的 `bus`。 |
| `AUDIO_BYTES_INVALID` | 交给音频混音器的 `bytes` 无效。 |
| `AUDIO_CLEANUP_FAILED` | 清理音频混音器时失败。各个原因在 cleanupErrors 中。 |
| `AUDIO_CLOSED` | 音频混音器已关闭，不再接受任何操作。 |
| `AUDIO_DECODE_FAILED` | 音频混音器的 `decode` 失败了。原因在 cause 中。 |
| `AUDIO_HOST_UNAVAILABLE` | 页面没有 Web Audio，或者在页面被点击之前不允许启动。 |
| `AUDIO_LISTENER_FAILED` | 应用交给音频混音器的监听器抛出了异常。抛出的内容在 cause 中。 |
| `AUDIO_OPTIONS_INVALID` | 交给音频混音器的选项无效：缺少某一项、类型不对或超出范围。 |
| `AUDIO_PLAY_OPTIONS` | 交给音频混音器的选项无效。 |
| `AUDIO_REASON_INVALID` | 交给音频混音器的 `reason` 无效。 |
| `AUDIO_REASON_LIMIT` | 超出了音频混音器的 `reason` 上限。 |
| `AUDIO_SOUND_INVALID` | 交给音频混音器的 `sound` 无效。 |
| `AUDIO_SOUND_LIMIT` | 超出了音频混音器的 `sound` 上限。 |
| `AUDIO_SOUND_RELEASED` | 音频混音器的 `sound` 已释放，不能再使用。 |
| `AUDIO_STREAM_FAILED` | 音频混音器的 `stream` 失败了。原因在 cause 中。 |
| `AUDIO_STREAM_UNSUPPORTED` | 音频混音器不支持 `stream`。 |
| `AUDIO_URL_INVALID` | 交给音频混音器的 `url` 无效。 |

### AUDIO_CUES

| 错误码 | 含义 |
| --- | --- |
| `AUDIO_CUES_INVALID` | 交给音效提示的内容无效。 |

### AUDIO_WAV

| 错误码 | 含义 |
| --- | --- |
| `AUDIO_WAV_INVALID` | 交给WAV 编码的内容无效。 |

### BITMAP

| 错误码 | 含义 |
| --- | --- |
| `BITMAP_INVALID` | 交给位图的内容无效。 |
| `BITMAP_LEASE_INVALID` | 交给位图的 `lease` 无效。 |
| `BITMAP_MUTATION_REENTRANT` | 在位图的 `mutation` 自己的回调里又调用了它。 |
| `BITMAP_REGION_INVALID` | 交给位图的 `region` 无效。 |
| `BITMAP_TEXTURE_INVALID` | 交给位图的 `texture` 无效。 |
| `BITMAP_TEXTURE_REQUIRED` | Bitmap 要用 engine.assets.acquire 得到的纹理租约创建。 |

### BITMAP_BINDING

| 错误码 | 含义 |
| --- | --- |
| `BITMAP_BINDING_DISPOSED` | 位图绑定已销毁，不再接受任何操作。 |
| `BITMAP_BINDING_INVALID` | 交给位图绑定的内容无效。 |
| `BITMAP_BINDING_MEMBERS_INVALID` | 交给位图绑定的 `members` 无效。 |
| `BITMAP_BINDING_REENTRANT` | 在位图绑定自己的回调里又调用了它。 |
| `BITMAP_BINDING_SCOPE_INVALID` | 交给位图绑定的作用域不是这个 Engine 的一个打开的作用域。 |
| `BITMAP_BINDING_STATE_INVALID` | 交给位图绑定的 `state` 无效。 |
| `BITMAP_BINDING_TARGETS_INVALID` | 交给位图绑定的 `targets` 无效。 |

### BITMAP_BUTTON

| 错误码 | 含义 |
| --- | --- |
| `BITMAP_BUTTON_CLEANUP_FAILED` | 清理位图按钮时失败。各个原因在 cleanupErrors 中。 |
| `BITMAP_BUTTON_DISPOSED` | 位图按钮已销毁，不再接受任何操作。 |
| `BITMAP_BUTTON_INPUT_CLOSED` | 位图按钮的 `input` 已关闭，不再接受任何操作。 |
| `BITMAP_BUTTON_INVALID` | 交给位图按钮的内容无效。 |
| `BITMAP_BUTTON_OPTIONS_INVALID` | 交给位图按钮的选项无效：缺少某一项、类型不对或超出范围。 |
| `BITMAP_BUTTON_SETUP_FAILED` | 建立位图按钮时失败。原因在 cause 中。 |
| `BITMAP_BUTTON_SKIN_INVALID` | 交给位图按钮的 `skin` 无效。 |

### BITMAP_FONT

| 错误码 | 含义 |
| --- | --- |
| `BITMAP_FONT_INVALID` | 交给位图字体的内容无效。 |

### BITMAP_RESOURCE

| 错误码 | 含义 |
| --- | --- |
| `BITMAP_RESOURCE_BINDING_CHANGED` | 请求进行期间位图资源槽的 `binding` 发生了变化。 |
| `BITMAP_RESOURCE_CANCELLED` | 位图资源槽被取消了。 |
| `BITMAP_RESOURCE_CLEANUP_FAILED` | 清理位图资源槽时失败。各个原因在 cleanupErrors 中。 |
| `BITMAP_RESOURCE_DISPOSED` | 位图资源槽已销毁，不再接受任何操作。 |
| `BITMAP_RESOURCE_INVALID` | 交给位图资源槽的内容无效。 |
| `BITMAP_RESOURCE_LEASE_INVALID` | 交给位图资源槽的 `lease` 无效。 |
| `BITMAP_RESOURCE_LIMIT` | 超出了位图资源槽的一项上限。 |
| `BITMAP_RESOURCE_PREPARED_INVALID` | 交给位图资源槽的 `prepared` 无效。 |
| `BITMAP_RESOURCE_REPLACE_FAILED` | 位图资源槽的 `replace` 失败了。原因在 cause 中。 |
| `BITMAP_RESOURCE_SCOPE_INVALID` | 交给位图资源槽的作用域不是这个 Engine 的一个打开的作用域。 |
| `BITMAP_RESOURCE_SUPERSEDED` | 位图资源槽的这次请求被更新的请求取代了。 |
| `BITMAP_RESOURCE_TARGET_BUSY` | 位图资源槽的 `target` 还在处理之前的请求。 |
| `BITMAP_RESOURCE_TARGET_INVALID` | 交给位图资源槽的 `target` 无效。 |
| `BITMAP_RESOURCE_TEXTURE_REQUIRED` | 位图资源槽需要 `texture`。 |

### BITMAP_TEXT

| 错误码 | 含义 |
| --- | --- |
| `BITMAP_TEXT_CLEANUP_FAILED` | 清理位图文本时失败。各个原因在 cleanupErrors 中。 |
| `BITMAP_TEXT_CLOSED` | 位图文本已关闭，不再接受任何操作。 |
| `BITMAP_TEXT_OPTIONS_INVALID` | 交给位图文本的选项无效：缺少某一项、类型不对或超出范围。 |
| `BITMAP_TEXT_TOO_LONG` | 交给位图文本的内容太长。 |

### BOUNDS

| 错误码 | 含义 |
| --- | --- |
| `BOUNDS_ARITHMETIC_RANGE` | `arithmetic` 超出了边界查询的范围。 |
| `BOUNDS_CONTENT_LIMIT` | 超出了边界查询的 `content` 上限。 |
| `BOUNDS_INPUT_INVALID` | 交给边界查询的 `input` 无效。 |
| `BOUNDS_RECEIVER_INVALID` | 交给边界查询的 `receiver` 无效。 |
| `BOUNDS_TREE_LIMIT` | 超出了边界查询的 `tree` 上限。 |

### BROWSER_GAME

| 错误码 | 含义 |
| --- | --- |
| `BROWSER_GAME_IMAGE_FAILED` | createBrowserGame 的 `image` 失败了。原因在 cause 中。 |
| `BROWSER_GAME_OPTIONS_INVALID` | 交给createBrowserGame 的选项无效：缺少某一项、类型不对或超出范围。 |

### BROWSER_IMAGE

| 错误码 | 含义 |
| --- | --- |
| `BROWSER_IMAGE_BYTES_INVALID` | 交给浏览器图片读取的 `bytes` 无效。 |
| `BROWSER_IMAGE_DECODE_FAILED` | 浏览器图片读取的 `decode` 失败了。原因在 cause 中。 |
| `BROWSER_IMAGE_FORMAT_UNKNOWN` | 浏览器图片读取中没有这样的 `format`。 |
| `BROWSER_IMAGE_PROVIDER_INVALID` | 交给浏览器图片读取的 `provider` 无效。 |
| `BROWSER_IMAGE_SIZE_INVALID` | 交给浏览器图片读取的 `size` 无效。 |
| `BROWSER_IMAGE_UNAVAILABLE` | 浏览器图片读取在这里不可用。 |

### BROWSER_STATS

| 错误码 | 含义 |
| --- | --- |
| `BROWSER_STATS_OPTIONS_INVALID` | 交给调试面板的选项无效：缺少某一项、类型不对或超出范围。 |

### BROWSER_TEXT_EDITOR

| 错误码 | 含义 |
| --- | --- |
| `BROWSER_TEXT_EDITOR_ACTIVATION_CANCELLED` | 浏览器文本编辑器的 `activation` 被取消了。 |
| `BROWSER_TEXT_EDITOR_BUSY` | 浏览器文本编辑器还在处理之前的请求。 |
| `BROWSER_TEXT_EDITOR_CLOSED` | 浏览器文本编辑器已关闭，不再接受任何操作。 |
| `BROWSER_TEXT_EDITOR_COMPOSING` | 浏览器文本编辑器正在用输入法组字。请等它结束。 |
| `BROWSER_TEXT_EDITOR_ELEMENT_DETACHED` | 浏览器文本编辑器的元素已经不在页面中。 |
| `BROWSER_TEXT_EDITOR_FOCUS` | 浏览器文本编辑器无法取得或保持焦点。 |
| `BROWSER_TEXT_EDITOR_FONT_GENERATION` | 交给浏览器文本编辑器的字体不是它期望的那一代。 |
| `BROWSER_TEXT_EDITOR_INACTIVE` | 浏览器文本编辑器当前未激活。 |
| `BROWSER_TEXT_EDITOR_OPTIONS` | 交给浏览器文本编辑器的选项无效。 |
| `BROWSER_TEXT_EDITOR_PLACEMENT_UNSUPPORTED` | 浏览器文本编辑器不支持 `placement`。 |
| `BROWSER_TEXT_EDITOR_PRESENTATION_PENDING` | 浏览器文本编辑器的 `presentation` 尚未完成。 |
| `BROWSER_TEXT_EDITOR_REENTRANT` | 在浏览器文本编辑器自己的回调里又调用了它。 |
| `BROWSER_TEXT_EDITOR_SURFACE` | 交给浏览器文本编辑器的画布不是它能使用的画布。 |
| `BROWSER_TEXT_EDITOR_TARGET` | 交给浏览器文本编辑器的目标无效。 |
| `BROWSER_TEXT_EDITOR_UNSUPPORTED` | 浏览器文本编辑器不支持这种用法。 |

### BROWSER_TEXT_INPUT

| 错误码 | 含义 |
| --- | --- |
| `BROWSER_TEXT_INPUT_DISPOSED` | 浏览器文本输入已销毁，不再接受任何操作。 |
| `BROWSER_TEXT_INPUT_IDLE` | 浏览器文本输入当前没有进行中的请求。 |
| `BROWSER_TEXT_INPUT_OPTIONS` | 交给浏览器文本输入的选项无效。 |
| `BROWSER_TEXT_INPUT_REENTRANT` | 在浏览器文本输入自己的回调里又调用了它。 |
| `BROWSER_TEXT_INPUT_REQUEST` | 交给浏览器文本输入的请求无效。 |
| `BROWSER_TEXT_INPUT_SURFACE` | 交给浏览器文本输入的画布不是它能使用的画布。 |

### CAMERA

| 错误码 | 含义 |
| --- | --- |
| `CAMERA_CLEANUP_FAILED` | 清理相机时失败。各个原因在 cleanupErrors 中。 |
| `CAMERA_CLOSED` | 相机已关闭，不再接受任何操作。 |
| `CAMERA_LAYER_INVALID` | 交给相机的 `layer` 无效。 |
| `CAMERA_OPTIONS_INVALID` | 交给相机的选项无效：缺少某一项、类型不对或超出范围。 |
| `CAMERA_TARGET_INVALID` | 交给相机的 `target` 无效。 |

### CLOCK

| 错误码 | 含义 |
| --- | --- |
| `CLOCK_CALLBACK_FAILED` | 应用交给游戏时钟的回调抛出了异常。抛出的内容在 cause 中。 |
| `CLOCK_CALLBACK_LIMIT` | 超出了游戏时钟的 `callback` 上限。 |
| `CLOCK_CALLBACK_RETURN_INVALID` | 交给游戏时钟的 `callback return` 无效。 |
| `CLOCK_DELTA_LIMIT` | 交给 engine.advanceTime 的时间与上一次相差超过了时钟一步允许的长度。请分成更小的步，@egret/engine/web/loop 的帧循环在标签页被隐藏后就是这样做的。 |
| `CLOCK_HANDLER_INVALID` | 交给游戏时钟的 `handler` 无效。 |
| `CLOCK_INVALID` | 交给游戏时钟的内容无效。 |
| `CLOCK_OPTIONS_INVALID` | 交给游戏时钟的选项无效：缺少某一项、类型不对或超出范围。 |
| `CLOCK_REENTRANT` | 在时钟的 tick 回调里或捕获帧的过程中调用了 engine.advanceTime。 |
| `CLOCK_SCOPE_INVALID` | 交给游戏时钟的作用域不是这个 Engine 的一个打开的作用域。 |
| `CLOCK_SOURCE_BACKWARDS` | 交给 engine.advanceTime 的时间早于上一次。它接受的秒数不能倒退。 |
| `CLOCK_SOURCE_INVALID` | 交给 engine.advanceTime 的时间不是大于等于零的有限秒数。 |
| `CLOCK_SUBSCRIPTION_ID_EXHAUSTED` | 游戏时钟的 `subscription id` 计数器用尽了。请新建一个。 |
| `CLOCK_SUBSCRIPTION_INVALID` | 交给游戏时钟的 `subscription` 无效。 |
| `CLOCK_TICK_ID_EXHAUSTED` | 游戏时钟的 `tick id` 计数器用尽了。请新建一个。 |
| `CLOCK_TIME_RANGE` | `time` 超出了游戏时钟的范围。 |

### CONTENT

| 错误码 | 含义 |
| --- | --- |
| `CONTENT_ENGINE_INVALID` | 交给内容加载的 `engine` 无效。 |
| `CONTENT_MANIFEST_INVALID` | 交给内容加载的 `manifest` 无效。 |
| `CONTENT_METADATA_LIMIT` | 超出了内容加载的 `metadata` 上限。 |
| `CONTENT_PROVIDERS_INVALID` | 交给内容加载的 `providers` 无效。 |
| `CONTENT_RESOURCE_INVALID` | 交给内容加载的 `resource` 无效。 |
| `CONTENT_ROOTS_INVALID` | 交给内容加载的 `roots` 无效。 |
| `CONTENT_SCOPE_INVALID` | 交给内容加载的作用域不是这个 Engine 的一个打开的作用域。 |

### CONTENT_GROUP

| 错误码 | 含义 |
| --- | --- |
| `CONTENT_GROUP_DISPOSED` | 内容组已销毁，不再接受任何操作。 |
| `CONTENT_GROUP_INVALID` | 交给内容组的内容无效。 |
| `CONTENT_GROUP_LIMIT` | 超出了内容组的一项上限。 |
| `CONTENT_GROUP_NOT_READY` | 内容组还没有就绪。 |

### CONTENT_LOADER

| 错误码 | 含义 |
| --- | --- |
| `CONTENT_LOADER_DISPOSED` | 内容加载器已销毁，不再接受任何操作。 |
| `CONTENT_LOADER_INVALID` | 交给内容加载器的内容无效。 |

### COORDINATE

| 错误码 | 含义 |
| --- | --- |
| `COORDINATE_ARITHMETIC_RANGE` | `arithmetic` 超出了坐标查询的范围。 |
| `COORDINATE_INPUT_INVALID` | 交给坐标查询的 `input` 无效。 |
| `COORDINATE_RECEIVER_INVALID` | 交给坐标查询的 `receiver` 无效。 |
| `COORDINATE_TRANSFORM_SINGULAR` | 路径上某个显示对象的缩放为零，所以舞台上的点没有对应的本地点。 |
| `COORDINATE_TREE_LIMIT` | 超出了坐标查询的 `tree` 上限。 |

### DISPLAY

| 错误码 | 含义 |
| --- | --- |
| `DISPLAY_ACTIVE` | 显示对象仍在活动中。 |
| `DISPLAY_CHILD_CLEANUP_FAILED` | 清理显示对象时失败。各个原因在 cleanupErrors 中。 |
| `DISPLAY_CYCLE` | 容器不能添加到它自己或它的后代中。 |
| `DISPLAY_SIZE_UNAVAILABLE` | 该对象没有画任何内容，所以没有可以缩放到指定大小的宽或高。请先绘制，或者直接设置 scaleX 和 scaleY。 |
| `DISPLAY_VALUE_INVALID` | 交给显示对象的值无效：位置、缩放和旋转是有限数字，alpha 在 0 到 1 之间，visible 是布尔值。 |

### DISPLAY_EFFECT

| 错误码 | 含义 |
| --- | --- |
| `DISPLAY_EFFECT_INVALID` | 交给渲染效果的内容无效。 |
| `DISPLAY_EFFECT_MASK_INVALID` | 交给渲染效果的 `mask` 无效。 |
| `DISPLAY_EFFECT_MASK_UNSUPPORTED` | 渲染效果不支持 `mask`。 |

### DISPLAY_SUBTREE

| 错误码 | 含义 |
| --- | --- |
| `DISPLAY_SUBTREE_LIMIT` | 超出了预备的显示子树的一项上限。 |
| `DISPLAY_SUBTREE_NODE_INVALID` | 交给预备的显示子树的 `node` 无效。 |
| `DISPLAY_SUBTREE_OVERLAP` | 两个预备的显示子树共用了同一个节点。 |
| `DISPLAY_SUBTREE_OWNER_CLOSED` | 预备的显示子树的 `owner` 已关闭，不再接受任何操作。 |
| `DISPLAY_SUBTREE_OWNER_INVALID` | 交给预备的显示子树的 `owner` 无效。 |
| `DISPLAY_SUBTREE_REENTRANT` | 在预备的显示子树自己的回调里又调用了它。 |
| `DISPLAY_SUBTREE_RETIRED` | 预备的显示子树已经退役，不能再使用。 |
| `DISPLAY_SUBTREE_ROOT_INVALID` | 交给预备的显示子树的 `root` 无效。 |
| `DISPLAY_SUBTREE_SCOPE_INVALID` | 交给预备的显示子树的作用域不是这个 Engine 的一个打开的作用域。 |
| `DISPLAY_SUBTREE_STALE` | 交给预备的显示子树的内容已被更新的版本取代。 |
| `DISPLAY_SUBTREE_TARGET_DETACHED` | 预备的显示子树的目标已经不在舞台上。 |
| `DISPLAY_SUBTREE_TICKET_INVALID` | 交给预备的显示子树的 `ticket` 无效。 |

### DISPLAY_TREE

| 错误码 | 含义 |
| --- | --- |
| `DISPLAY_TREE_CLEANUP_FAILED` | 清理显示树时失败。各个原因在 cleanupErrors 中。 |
| `DISPLAY_TREE_INVARIANT` | 显示树在遍历过程中发生了变化，或者某个节点被到达了两次。不要在捕获或查询的过程中修改显示树。 |

### ENGINE

| 错误码 | 含义 |
| --- | --- |
| `ENGINE_ASSETS_CLEANUP_FAILED` | 清理Engine时失败。各个原因在 cleanupErrors 中。 |
| `ENGINE_CLOSED` | Engine 已关闭。用它创建的任何东西都不能再使用。 |
| `ENGINE_CLOSE_FAILED` | Engine的 `close` 失败了。原因在 cause 中。 |
| `ENGINE_CLOSE_TIMEOUT` | Engine的 `close` 耗时过长。 |
| `ENGINE_FACTORY_REQUIRED` | Engine要用它的工厂函数创建，不能用 new。 |
| `ENGINE_MISMATCH` | 对象属于另一个 Engine。显示树、作用域及其资源都只属于一个 Engine。 |
| `ENGINE_RENDER_PROFILE_UNSUPPORTED` | Engine不支持 `render profile`。 |
| `ENGINE_SCOPE_CLEANUP_FAILED` | 清理Engine时失败。各个原因在 cleanupErrors 中。 |
| `ENGINE_STAGE_CLEANUP_FAILED` | 清理Engine时失败。各个原因在 cleanupErrors 中。 |
| `ENGINE_START_FAILED` | Engine的 `start` 失败了。原因在 cause 中。 |

### EVENT

| 错误码 | 含义 |
| --- | --- |
| `EVENT_ACTIVE` | 事件仍在活动中。 |
| `EVENT_LIMIT` | 超出了事件的一项上限。 |
| `EVENT_LISTENER_CLEANUP_FAILED` | 清理事件时失败。各个原因在 cleanupErrors 中。 |
| `EVENT_SUBSCRIPTION_FAILED` | 事件的 `subscription` 失败了。原因在 cause 中。 |

### FONT_CONTENT

| 错误码 | 含义 |
| --- | --- |
| `FONT_CONTENT_ASSET` | 交给字体内容的资源无效。 |
| `FONT_CONTENT_BYTES` | 交给字体内容的字节无效。 |
| `FONT_CONTENT_CANCELLED` | 字体内容被取消了。 |
| `FONT_CONTENT_CLOSED` | 字体内容已关闭，不再接受任何操作。 |
| `FONT_CONTENT_FLAVOR` | 交给字体内容的字体格式无效。 |
| `FONT_CONTENT_GROUP` | 交给字体内容的组无效。 |
| `FONT_CONTENT_INPUT` | 交给字体内容的输入无效。 |
| `FONT_CONTENT_LIMIT` | 超出了字体内容的一项上限。 |
| `FONT_CONTENT_LOADER` | 交给字体内容的加载器无效。 |
| `FONT_CONTENT_NOT_READY` | 字体内容还没有就绪。 |
| `FONT_CONTENT_PROFILE` | 交给字体内容的规格无效。 |
| `FONT_CONTENT_PROVIDER` | 交给字体内容的提供者无效。 |
| `FONT_CONTENT_REF` | 交给字体内容的引用无效。 |
| `FONT_CONTENT_ROOTS` | 交给字体内容的根列表无效。 |
| `FONT_CONTENT_SCOPE` | 交给字体内容的作用域无效。 |

### FRAME

| 错误码 | 含义 |
| --- | --- |
| `FRAME_BUDGET_EXCEEDED` | 舞台上的内容超出了一帧的上限：65,536 个节点或命令、256 种材质、4,096 个不同的几何体或 65,536 个网格三角形。半径 40 的圆是 32 个三角形。 |
| `FRAME_ID_EXHAUSTED` | 帧的 `id` 计数器用尽了。请新建一个。 |
| `FRAME_IMAGE_BUDGET` | 这一帧使用的图片超出上限：64 页、4,096 个区域或 64 MiB 的不同像素。请把图片合并到更少的图集中。 |
| `FRAME_PROFILE_METADATA_UNSUPPORTED` | 帧不支持 `profile metadata`。 |
| `FRAME_REENTRANT` | 在捕获一帧的过程中又请求了一帧。请在帧循环中绘制，不要在捕获的回调里绘制。 |
| `FRAME_RENDER_FAILED` | Host 拒绝或未能绘制这一帧。原因在 cause 中：以 _BACKPRESSURE 结尾的错误码表示 Host 还在处理之前的帧，使用 @egret/engine/web/loop 的帧循环可以避免。 |
| `FRAME_STAGE_INVALID` | 帧是从 Engine 的舞台捕获的，而这不是一个舞台。 |
| `FRAME_TRANSFORM_INVALID` | 某个显示对象被放到了角点不是有限数字的位置。请检查它及其父级的 x、y、缩放和旋转。 |

### FRAME_LOOP

| 错误码 | 含义 |
| --- | --- |
| `FRAME_LOOP_CLOSED` | 帧循环已销毁。请新建一个。 |
| `FRAME_LOOP_OPTIONS_INVALID` | 交给帧循环的选项无效：缺少某一项、类型不对或超出范围。 |

### GAMEPAD

| 错误码 | 含义 |
| --- | --- |
| `GAMEPAD_AXIS_UNKNOWN` | 手柄输入中没有这样的 `axis`。 |
| `GAMEPAD_BUTTON_UNKNOWN` | 手柄输入中没有这样的 `button`。 |
| `GAMEPAD_CLOSED` | 手柄输入已关闭，不再接受任何操作。 |
| `GAMEPAD_HOST_UNAVAILABLE` | 手柄输入的 `host` 在这里不可用。 |
| `GAMEPAD_LISTENER_FAILED` | 应用交给手柄输入的监听器抛出了异常。抛出的内容在 cause 中。 |
| `GAMEPAD_OPTIONS_INVALID` | 交给手柄输入的选项无效：缺少某一项、类型不对或超出范围。 |
| `GAMEPAD_REENTRANT` | 在手柄输入自己的回调里又调用了它。 |
| `GAMEPAD_SAMPLE` | 交给手柄输入的不是手柄采样。 |
| `GAMEPAD_STICK_UNKNOWN` | 手柄输入中没有这样的 `stick`。 |

### GRAPHICS

| 错误码 | 含义 |
| --- | --- |
| `GRAPHICS_BUDGET` | 绘图超出了一个 sprite 的上限：一条路径 8,192 个点、一条线 16,384 段虚线、一次带孔或自相交的填充 16,384 个三角形、16 个网格，或把图片重复到超过自身 8,192 个像素之外。sprite 之前画的内容保留。请把其余部分画到另一个 sprite 中。 |
| `GRAPHICS_FILL_REQUIRED` | 形状需要填充或线条。请在绘制前调用 beginFill 或 lineStyle。 |
| `GRAPHICS_VALUE_INVALID` | 交给 graphics 的值无效：坐标是有限数字，尺寸不能为负，颜色在 0 到 0xffffff 之间，alpha 在 0 到 1 之间。 |

### HIT_TEST

| 错误码 | 含义 |
| --- | --- |
| `HIT_TEST_AREA_INVALID` | 交给命中测试的 `area` 无效。 |
| `HIT_TEST_ARITHMETIC_RANGE` | `arithmetic` 超出了命中测试的范围。 |
| `HIT_TEST_INPUT_INVALID` | 交给命中测试的 `input` 无效。 |
| `HIT_TEST_RECEIVER_INVALID` | 交给命中测试的 `receiver` 无效。 |
| `HIT_TEST_TREE_LIMIT` | 超出了命中测试的 `tree` 上限。 |
| `HIT_TEST_VALUE_INVALID` | 交给命中测试的 `value` 无效。 |

### HOVER_INPUT

| 错误码 | 含义 |
| --- | --- |
| `HOVER_INPUT_CALLBACK_FAILED` | 应用交给悬停输入的回调抛出了异常。抛出的内容在 cause 中。 |
| `HOVER_INPUT_CAPACITY` | 悬停输入已经装满。 |
| `HOVER_INPUT_CLEANUP_FAILED` | 清理悬停输入时失败。各个原因在 cleanupErrors 中。 |
| `HOVER_INPUT_EVENT_INVALID` | 交给悬停输入的 `event` 无效。 |
| `HOVER_INPUT_EXHAUSTED` | 悬停输入的一个计数器用尽了。请新建一个。 |
| `HOVER_INPUT_OPTIONS_INVALID` | 交给悬停输入的选项无效：缺少某一项、类型不对或超出范围。 |
| `HOVER_INPUT_REASON` | 交给悬停输入的离开原因不是它认识的原因。 |
| `HOVER_INPUT_REENTRANT` | 在悬停输入自己的回调里又调用了它。 |
| `HOVER_INPUT_SAMPLE` | 交给悬停输入的采样不是带有指针 id、指针类型、全局坐标和时间戳的对象。 |
| `HOVER_INPUT_SETUP_FAILED` | 建立悬停输入时失败。原因在 cause 中。 |
| `HOVER_INPUT_SURFACE_BUSY` | 悬停输入的 `surface` 还在处理之前的请求。 |
| `HOVER_INPUT_SURFACE_INVALID` | 交给悬停输入的 `surface` 无效。 |
| `HOVER_INPUT_VIEWPORT` | 交给悬停输入的视口版本号不是比上一次更大的整数。 |

### INPUT_ACTIONS

| 错误码 | 含义 |
| --- | --- |
| `INPUT_ACTIONS_INVALID` | 交给输入动作的内容无效。 |

### KEYBOARD

| 错误码 | 含义 |
| --- | --- |
| `KEYBOARD_REGISTRATION_CLOSED` | 键盘的 `registration` 已关闭，不再接受任何操作。 |
| `KEYBOARD_TARGET_INELIGIBLE` | 该键盘目标现在不能获得焦点，例如它被禁用或不在舞台上。 |
| `KEYBOARD_TARGET_INVALID` | 交给键盘的 `target` 无效。 |

### KEYBOARD_FOCUS_SCOPE

| 错误码 | 含义 |
| --- | --- |
| `KEYBOARD_FOCUS_SCOPE_ACTIVE` | 键盘焦点范围仍在活动中。 |
| `KEYBOARD_FOCUS_SCOPE_CLOSED` | 键盘焦点范围已关闭，不再接受任何操作。 |
| `KEYBOARD_FOCUS_SCOPE_INVALID` | 交给键盘焦点范围的内容无效。 |

### KEYBOARD_INPUT

| 错误码 | 含义 |
| --- | --- |
| `KEYBOARD_INPUT_CANCEL_INVALID` | 交给键盘输入的 `cancel` 无效。 |
| `KEYBOARD_INPUT_CLOSED` | 键盘输入已关闭，不再接受任何操作。 |
| `KEYBOARD_INPUT_FOCUS_INVALID` | 交给键盘输入的 `focus` 无效。 |
| `KEYBOARD_INPUT_HOST_FAILED` | 键盘输入的 `host` 失败了。原因在 cause 中。 |
| `KEYBOARD_INPUT_IN_USE` | 键盘输入已经在使用中。 |
| `KEYBOARD_INPUT_KEY_CAPACITY` | 键盘输入的 `key` 容量已满。 |
| `KEYBOARD_INPUT_OPTIONS_INVALID` | 交给键盘输入的选项无效：缺少某一项、类型不对或超出范围。 |
| `KEYBOARD_INPUT_REENTRANT` | 在键盘输入自己的回调里又调用了它。 |
| `KEYBOARD_INPUT_SAMPLE_INVALID` | 交给键盘输入的 `sample` 无效。 |
| `KEYBOARD_INPUT_SURFACE_INVALID` | 交给键盘输入的 `surface` 无效。 |

### LAYOUT

| 错误码 | 含义 |
| --- | --- |
| `LAYOUT_LIMIT` | 超出了布局的一项上限。 |
| `LAYOUT_OPTIONS_INVALID` | 交给布局的选项无效：缺少某一项、类型不对或超出范围。 |
| `LAYOUT_OVERFLOW` | 子对象放不进布局得到的空间。 |

### MANIFEST_BINDING

| 错误码 | 含义 |
| --- | --- |
| `MANIFEST_BINDING_ASSET_INVALID` | 交给清单绑定的 `asset` 无效。 |
| `MANIFEST_BINDING_ID_EXHAUSTED` | 清单绑定的 `id` 计数器用尽了。请新建一个。 |
| `MANIFEST_BINDING_INVALID` | 交给清单绑定的内容无效。 |
| `MANIFEST_BINDING_MANIFEST_INVALID` | 交给清单绑定的 `manifest` 无效。 |
| `MANIFEST_BINDING_REF_INVALID` | 交给清单绑定的 `ref` 无效。 |

### MANIFEST_GROUP

| 错误码 | 含义 |
| --- | --- |
| `MANIFEST_GROUP_ACQUIRE_FAILED` | 清单组的 `acquire` 失败了。原因在 cause 中。 |
| `MANIFEST_GROUP_BINDINGS_INVALID` | 交给清单组的 `bindings` 无效。 |
| `MANIFEST_GROUP_BINDING_INVALID` | 交给清单组的 `binding` 无效。 |
| `MANIFEST_GROUP_CLEANUP_FAILED` | 清理清单组时失败。各个原因在 cleanupErrors 中。 |
| `MANIFEST_GROUP_DISPOSED` | 清单组已销毁，不再接受任何操作。 |
| `MANIFEST_GROUP_INVALID` | 交给清单组的内容无效。 |
| `MANIFEST_GROUP_LIMIT` | 超出了清单组的一项上限。 |
| `MANIFEST_GROUP_MANIFEST_INVALID` | 交给清单组的 `manifest` 无效。 |
| `MANIFEST_GROUP_NOT_READY` | 清单组还没有就绪。 |
| `MANIFEST_GROUP_OPTIONS_INVALID` | 交给清单组的选项无效：缺少某一项、类型不对或超出范围。 |
| `MANIFEST_GROUP_QUEUE_LIMIT` | 超出了清单组的 `queue` 上限。 |
| `MANIFEST_GROUP_REENTRANT` | 在清单组自己的回调里又调用了它。 |
| `MANIFEST_GROUP_ROOTS_INVALID` | 交给清单组的 `roots` 无效。 |
| `MANIFEST_GROUP_SCOPE_INVALID` | 交给清单组的作用域不是这个 Engine 的一个打开的作用域。 |

### MESH

| 错误码 | 含义 |
| --- | --- |
| `MESH_GEOMETRY_INVALID` | 给出的不是由 createSharedGeometry2D 或 createTexturedGeometry2D 创建的几何体。 |
| `MESH_INVALID` | 交给网格的内容无效。 |
| `MESH_LEASE_INVALID` | 交给网格的 `lease` 无效。 |
| `MESH_MUTATION_REENTRANT` | 在网格的 `mutation` 自己的回调里又调用了它。 |
| `MESH_TEXTURE_INVALID` | 交给网格的 `texture` 无效。 |

### MESH_BINDING

| 错误码 | 含义 |
| --- | --- |
| `MESH_BINDING_DISPOSED` | 网格绑定已销毁，不再接受任何操作。 |
| `MESH_BINDING_FACTORY_REQUIRED` | 网格绑定要用它的工厂函数创建，不能用 new。 |
| `MESH_BINDING_STALE` | 交给网格绑定的内容已被更新的版本取代。 |

### MOTION

| 错误码 | 含义 |
| --- | --- |
| `MOTION_ALREADY_STARTED` | 动画链已经开始过了。 |
| `MOTION_OPTIONS_INVALID` | 交给动画链的选项无效：缺少某一项、类型不对或超出范围。 |

### MOUSE_INPUT

| 错误码 | 含义 |
| --- | --- |
| `MOUSE_INPUT_CALLBACK_FAILED` | 应用交给鼠标输入的回调抛出了异常。抛出的内容在 cause 中。 |
| `MOUSE_INPUT_CLEANUP_FAILED` | 清理鼠标输入时失败。各个原因在 cleanupErrors 中。 |
| `MOUSE_INPUT_EVENT_INVALID` | 交给鼠标输入的 `event` 无效。 |
| `MOUSE_INPUT_INVALID` | 交给鼠标输入的内容无效。 |
| `MOUSE_INPUT_IN_USE` | 鼠标输入已经在使用中。 |
| `MOUSE_INPUT_OPTIONS_INVALID` | 交给鼠标输入的选项无效：缺少某一项、类型不对或超出范围。 |
| `MOUSE_INPUT_REENTRANT` | 在鼠标输入自己的回调里又调用了它。 |
| `MOUSE_INPUT_SCOPE_INVALID` | 交给鼠标输入的作用域不是这个 Engine 的一个打开的作用域。 |
| `MOUSE_INPUT_SETUP_FAILED` | 建立鼠标输入时失败。原因在 cause 中。 |
| `MOUSE_INPUT_SURFACE_INVALID` | 交给鼠标输入的 `surface` 无效。 |

### NINE_SLICE_BITMAP

| 错误码 | 含义 |
| --- | --- |
| `NINE_SLICE_BITMAP_INVALID` | 交给九宫格位图的内容无效。 |
| `NINE_SLICE_BITMAP_LEASE_INVALID` | 交给九宫格位图的 `lease` 无效。 |
| `NINE_SLICE_BITMAP_TEXTURE_INVALID` | 交给九宫格位图的 `texture` 无效。 |

### PARAGRAPH

| 错误码 | 含义 |
| --- | --- |
| `PARAGRAPH_BACKEND_CLEANUP_FAILED` | 清理段落时失败。各个原因在 cleanupErrors 中。 |
| `PARAGRAPH_BACKEND_TERMINAL` | 段落的 `backend` 已经结束，不能再使用。 |
| `PARAGRAPH_BUILD_REFUSED` | 段落的 `build` 被拒绝了。 |
| `PARAGRAPH_CANCELLED` | 段落被取消了。 |
| `PARAGRAPH_DISPOSED` | 段落已销毁，不再接受任何操作。 |
| `PARAGRAPH_ELLIPSIS_DOES_NOT_FIT` | 段落太窄，连省略号都放不下。 |
| `PARAGRAPH_FACTORY_REQUIRED` | 段落要用它的工厂函数创建，不能用 new。 |
| `PARAGRAPH_FEATURE_UNSUPPORTED` | 段落不支持 `feature`。 |
| `PARAGRAPH_GEOMETRY_POINT_INVALID` | 交给段落的 `geometry point` 无效。 |
| `PARAGRAPH_GEOMETRY_POSITION_INVALID` | 交给段落的 `geometry position` 无效。 |
| `PARAGRAPH_GLYPH_UNRESOLVED` | 已注册的字体中没有段落里某个字符的字形。请添加覆盖它的字体。 |
| `PARAGRAPH_IMAGE_LIMIT` | 超出了段落的 `image` 上限。 |
| `PARAGRAPH_INVALID` | 交给段落的内容无效。 |
| `PARAGRAPH_MINIMUM_LINE_HEIGHT_UNSUPPORTED` | 段落不支持 `minimum line height`。 |
| `PARAGRAPH_NATIVE_GEOMETRY_INVALID` | 交给段落的 `native geometry` 无效。 |
| `PARAGRAPH_NATIVE_GLYPH_INVALID` | 交给段落的 `native glyph` 无效。 |
| `PARAGRAPH_NATIVE_RANGE_INVALID` | 交给段落的 `native range` 无效。 |
| `PARAGRAPH_NATIVE_STYLE_INVALID` | 交给段落的 `native style` 无效。 |
| `PARAGRAPH_PREPARE_CANCELLED` | 段落的 `prepare` 被取消了。 |
| `PARAGRAPH_RASTER_REFUSED` | 段落的 `raster` 被拒绝了。 |
| `PARAGRAPH_READBACK_REFUSED` | 段落的 `readback` 被拒绝了。 |
| `PARAGRAPH_REQUEST_INVALID` | 交给段落的 `request` 无效。 |
| `PARAGRAPH_REQUEST_REQUIRED` | 段落需要 `request`。 |
| `PARAGRAPH_REVISION_EXHAUSTED` | 段落的 `revision` 计数器用尽了。请新建一个。 |
| `PARAGRAPH_STALE` | 交给段落的内容已被更新的版本取代。 |

### PARAGRAPH_CACHE

| 错误码 | 含义 |
| --- | --- |
| `PARAGRAPH_CACHE_ALREADY_CREATED` | 段落缓存已经创建过了。 |
| `PARAGRAPH_CACHE_BUDGET` | 超出了段落缓存的一项上限。 |
| `PARAGRAPH_CACHE_CLOSED` | 段落缓存已关闭，不再接受任何操作。 |
| `PARAGRAPH_CACHE_INVALID` | 交给段落缓存的内容无效。 |
| `PARAGRAPH_CACHE_OPTIONS_INVALID` | 交给段落缓存的选项无效：缺少某一项、类型不对或超出范围。 |

### PARAGRAPH_FONT

| 错误码 | 含义 |
| --- | --- |
| `PARAGRAPH_FONT_ALLOCATION_REFUSED` | 段落字体的 `allocation` 被拒绝了。 |
| `PARAGRAPH_FONT_ALLOCATION_TERMINAL` | 段落字体的 `allocation` 已经结束，不能再使用。 |
| `PARAGRAPH_FONT_DECODE_REFUSED` | 段落字体的 `decode` 被拒绝了。 |
| `PARAGRAPH_FONT_NOT_REGISTERED` | 段落使用的字体族没有在它的字体集中注册。 |
| `PARAGRAPH_FONT_PROVIDER_REFUSED` | 段落字体的 `provider` 被拒绝了。 |

### PARAGRAPH_FONT_SET

| 错误码 | 含义 |
| --- | --- |
| `PARAGRAPH_FONT_SET_CANCELLED` | 段落字体集被取消了。 |
| `PARAGRAPH_FONT_SET_CLOSED` | 段落字体集已关闭，不再接受任何操作。 |
| `PARAGRAPH_FONT_SET_DECODE_REFUSED` | 段落字体集的 `decode` 被拒绝了。 |
| `PARAGRAPH_FONT_SET_IDENTITY_COLLISION` | 段落字体集中有两个字体的标识相同。 |
| `PARAGRAPH_FONT_SET_LIMIT` | 超出了段落字体集的一项上限。 |
| `PARAGRAPH_FONT_SET_OPTIONS` | 交给段落字体集的选项无效。 |
| `PARAGRAPH_FONT_SET_PROVIDER` | 交给段落字体集的提供者无效。 |
| `PARAGRAPH_FONT_SET_RETIRED` | 段落字体集已经退役，不能再使用。 |

### PARAGRAPH_PROVIDER

| 错误码 | 含义 |
| --- | --- |
| `PARAGRAPH_PROVIDER_BUSY` | 段落提供者还在处理之前的请求。 |
| `PARAGRAPH_PROVIDER_DISPOSED` | 段落提供者已销毁，不再接受任何操作。 |
| `PARAGRAPH_PROVIDER_INVALID` | 交给段落提供者的内容无效。 |
| `PARAGRAPH_PROVIDER_RESULT_INVALID` | 交给段落提供者的 `result` 无效。 |

### PARTICLE

| 错误码 | 含义 |
| --- | --- |
| `PARTICLE_CLEANUP_FAILED` | 清理粒子发射器时失败。各个原因在 cleanupErrors 中。 |
| `PARTICLE_CLOSED` | 粒子发射器已关闭，不再接受任何操作。 |
| `PARTICLE_OPTIONS_INVALID` | 交给粒子发射器的选项无效：缺少某一项、类型不对或超出范围。 |

### PHYSICS

| 错误码 | 含义 |
| --- | --- |
| `PHYSICS_BODY_INVALID` | 交给物理世界的 `body` 无效。 |
| `PHYSICS_BODY_LIMIT` | 超出了物理世界的 `body` 上限。 |
| `PHYSICS_CLOSED` | 物理世界已关闭，不再接受任何操作。 |
| `PHYSICS_LISTENER_FAILED` | 应用交给物理世界的监听器抛出了异常。抛出的内容在 cause 中。 |
| `PHYSICS_OPTIONS_INVALID` | 交给物理世界的选项无效：缺少某一项、类型不对或超出范围。 |

### POINTER_INPUT

| 错误码 | 含义 |
| --- | --- |
| `POINTER_INPUT_CALLBACK_FAILED` | 应用交给指针输入的回调抛出了异常。抛出的内容在 cause 中。 |
| `POINTER_INPUT_CAPACITY` | 指针输入已经装满。 |
| `POINTER_INPUT_CLEANUP_FAILED` | 清理指针输入时失败。各个原因在 cleanupErrors 中。 |
| `POINTER_INPUT_CLOSED` | 指针输入已关闭，不再接受任何操作。 |
| `POINTER_INPUT_DUPLICATE` | 同一内容向指针输入提供了两次。 |
| `POINTER_INPUT_EVENT_INVALID` | 交给指针输入的 `event` 无效。 |
| `POINTER_INPUT_EXHAUSTED` | 指针输入的一个计数器用尽了。请新建一个。 |
| `POINTER_INPUT_HOST_FAILED` | 指针输入的 `host` 失败了。原因在 cause 中。 |
| `POINTER_INPUT_NATIVE_FAILED` | 指针输入的 `native` 失败了。原因在 cause 中。 |
| `POINTER_INPUT_OPTIONS` | 交给指针输入的选项无效。 |
| `POINTER_INPUT_OPTIONS_INVALID` | 交给指针输入的选项无效：缺少某一项、类型不对或超出范围。 |
| `POINTER_INPUT_REASON` | 交给指针输入的取消原因不是它认识的原因。 |
| `POINTER_INPUT_REENTRANT` | 在指针输入自己的回调里又调用了它。 |
| `POINTER_INPUT_SAMPLE` | 交给指针输入的不是指针采样。 |
| `POINTER_INPUT_SETUP_FAILED` | 建立指针输入时失败。原因在 cause 中。 |
| `POINTER_INPUT_SURFACE_BUSY` | 指针输入的 `surface` 还在处理之前的请求。 |
| `POINTER_INPUT_SURFACE_INVALID` | 交给指针输入的 `surface` 无效。 |
| `POINTER_INPUT_VIEWPORT` | 交给指针输入的视口版本号不是比上一次更大的整数。 |

### RANDOM

| 错误码 | 含义 |
| --- | --- |
| `RANDOM_RANGE_INVALID` | 交给随机数生成器的 `range` 无效。 |
| `RANDOM_SEED_INVALID` | 交给随机数生成器的 `seed` 无效。 |

### SAVE_STORE

| 错误码 | 含义 |
| --- | --- |
| `SAVE_STORE_OPTIONS_INVALID` | 交给存档的选项无效：缺少某一项、类型不对或超出范围。 |

### SCOPE

| 错误码 | 含义 |
| --- | --- |
| `SCOPE_CLEANUP_FAILED` | 清理作用域时失败。各个原因在 cleanupErrors 中。 |
| `SCOPE_CLOSED` | 作用域已销毁，它拥有的一切也随之销毁。请新建一个作用域。 |
| `SCOPE_FACTORY_REQUIRED` | 作用域要用它的工厂函数创建，不能用 new。 |
| `SCOPE_LATE_CLEANUP_FAILED` | 清理作用域时失败。各个原因在 cleanupErrors 中。 |
| `SCOPE_REGISTRATION_ACTIVE` | 作用域的 `registration` 仍在活动中。 |

### SEQ

| 错误码 | 含义 |
| --- | --- |
| `SEQ_ATLAS_MISMATCH` | 交给序列的 `atlas` 不匹配。 |
| `SEQ_BINDING_CHANGED` | 请求进行期间序列的 `binding` 发生了变化。 |
| `SEQ_BUDGET` | 超出了序列的一项上限。 |
| `SEQ_CLIP_INVALID` | 交给序列的 `clip` 无效。 |
| `SEQ_INPUT_INVALID` | 交给序列的 `input` 无效。 |
| `SEQ_READ_FAILED` | 序列的 `read` 失败了。原因在 cause 中。 |
| `SEQ_REGION_INVALID` | 交给序列的 `region` 无效。 |
| `SEQ_TIME_INVALID` | 交给序列的 `time` 无效。 |

### SEQUENCE_RESET

| 错误码 | 含义 |
| --- | --- |
| `SEQUENCE_RESET_CANCELLED` | 序列重置槽被取消了。 |
| `SEQUENCE_RESET_CLEANUP_FAILED` | 清理序列重置槽时失败。各个原因在 cleanupErrors 中。 |
| `SEQUENCE_RESET_CONTROLLER_CHANGED` | 请求进行期间序列重置槽的 `controller` 发生了变化。 |
| `SEQUENCE_RESET_DISPOSED` | 序列重置槽已销毁，不再接受任何操作。 |
| `SEQUENCE_RESET_INITIAL_INVALID` | 交给序列重置槽的 `initial` 无效。 |
| `SEQUENCE_RESET_LOADER_INVALID` | 交给序列重置槽的 `loader` 无效。 |
| `SEQUENCE_RESET_NOT_PREPARED` | 序列重置槽还没有预备。 |
| `SEQUENCE_RESET_NOT_READY` | 序列重置槽还没有就绪。 |
| `SEQUENCE_RESET_OPTIONS_INVALID` | 交给序列重置槽的选项无效：缺少某一项、类型不对或超出范围。 |
| `SEQUENCE_RESET_POSTCOMMIT_FAILED` | 序列重置槽的 `postcommit` 失败了。原因在 cause 中。 |
| `SEQUENCE_RESET_PRESERVE_STATE` | 只有在序列正在播放或已暂停、且没有等待中的命令时，才能在保留位置的情况下重置它。 |
| `SEQUENCE_RESET_PRESERVE_TIMELINE` | 这次序列重置无法保留时间线。 |
| `SEQUENCE_RESET_REENTRANT` | 在序列重置槽自己的回调里又调用了它。 |
| `SEQUENCE_RESET_RESOURCE_MISMATCH` | 交给序列重置槽的 `resource` 不匹配。 |
| `SEQUENCE_RESET_RETIRED` | 序列重置槽已经退役，不能再使用。 |
| `SEQUENCE_RESET_TARGET_CHANGED` | 请求进行期间序列重置槽的 `target` 发生了变化。 |
| `SEQUENCE_RESET_TARGET_CLAIMED` | 序列重置槽的目标已被另一个占用。 |
| `SEQUENCE_RESET_TARGET_INVALID` | 交给序列重置槽的 `target` 无效。 |

### SEQ_PLAYBACK

| 错误码 | 含义 |
| --- | --- |
| `SEQ_PLAYBACK_ALREADY_STARTED` | 序列播放已经开始过了。 |
| `SEQ_PLAYBACK_CREATION_REENTRANT` | 在序列播放的 `creation` 自己的回调里又调用了它。 |
| `SEQ_PLAYBACK_INVALID` | 交给序列播放的内容无效。 |
| `SEQ_PLAYBACK_LIMIT` | 超出了序列播放的一项上限。 |
| `SEQ_PLAYBACK_NOT_STARTED` | 序列播放还没有开始。 |
| `SEQ_PLAYBACK_OPTIONS_INVALID` | 交给序列播放的选项无效：缺少某一项、类型不对或超出范围。 |
| `SEQ_PLAYBACK_REENTRANT` | 在序列播放自己的回调里又调用了它。 |
| `SEQ_PLAYBACK_SCOPE_INVALID` | 交给序列播放的作用域不是这个 Engine 的一个打开的作用域。 |
| `SEQ_PLAYBACK_TARGET_BUSY` | 序列播放的 `target` 还在处理之前的请求。 |
| `SEQ_PLAYBACK_TERMINAL` | 序列播放已经结束，不能再使用。 |
| `SEQ_PLAYBACK_TIME_RANGE` | `time` 超出了序列播放的范围。 |

### SEQ_PLAYER

| 错误码 | 含义 |
| --- | --- |
| `SEQ_PLAYER_DISPOSED` | 序列播放器已销毁，不再接受任何操作。 |
| `SEQ_PLAYER_INVALID` | 交给序列播放器的内容无效。 |

### SHARED_MATERIAL

| 错误码 | 含义 |
| --- | --- |
| `SHARED_MATERIAL_UNSUPPORTED` | 该材质不能用于这个对象：为区域创建的网格按区域采样，不能按页采样。 |

### SPINE

| 错误码 | 含义 |
| --- | --- |
| `SPINE_GROUP_RELEASE_FAILED` | Spine的 `group release` 失败了。原因在 cause 中。 |
| `SPINE_LOADER_RECEIVER` | Spine 加载器的方法被脱离加载器调用了。请在加载器上调用：loader.load(...)。 |
| `SPINE_LOADER_RELEASE_FAILED` | Spine的 `loader release` 失败了。原因在 cause 中。 |
| `SPINE_METADATA_LIMIT` | 超出了Spine的 `metadata` 上限。 |
| `SPINE_SETUP_FAILED` | 建立Spine时失败。原因在 cause 中。 |
| `SPINE_SETUP_RELEASE_FAILED` | Spine的 `setup release` 失败了。原因在 cause 中。 |
| `SPINE_SOURCE_RELEASE_FAILED` | Spine的 `source release` 失败了。原因在 cause 中。 |

### SPINE_DISPLAY

| 错误码 | 含义 |
| --- | --- |
| `SPINE_DISPLAY_CLEANUP_FAILED` | 清理Spine 显示对象时失败。各个原因在 cleanupErrors 中。 |
| `SPINE_DISPLAY_COMMAND_LIMIT` | 超出了Spine 显示对象的 `command` 上限。 |
| `SPINE_DISPLAY_GEOMETRY_INVALID` | 交给Spine 显示对象的 `geometry` 无效。 |
| `SPINE_DISPLAY_GEOMETRY_LIMIT` | 超出了Spine 显示对象的 `geometry` 上限。 |
| `SPINE_DISPLAY_INSTANCE_INVALID` | 交给Spine 显示对象的 `instance` 无效。 |
| `SPINE_DISPLAY_PAGE_OR_BLEND_INVALID` | 交给Spine 显示对象的 `page or blend` 无效。 |
| `SPINE_DISPLAY_SAMPLING_UNSUPPORTED` | Spine 显示对象不支持 `sampling`。 |

### SPINE_INSTANCE

| 错误码 | 含义 |
| --- | --- |
| `SPINE_INSTANCE_ADVANCE_FAILED` | Spine 实例的 `advance` 失败了。原因在 cause 中。 |
| `SPINE_INSTANCE_ANIMATION_INVALID` | 交给Spine 实例的 `animation` 无效。 |
| `SPINE_INSTANCE_ASSET_INVALID` | 交给Spine 实例的 `asset` 无效。 |
| `SPINE_INSTANCE_COMMAND_LIMIT` | 超出了Spine 实例的 `command` 上限。 |
| `SPINE_INSTANCE_DISPLAY_ACTIVE` | Spine 实例的 `display` 仍在活动中。 |
| `SPINE_INSTANCE_DISPOSED` | Spine 实例已销毁，不再接受任何操作。 |
| `SPINE_INSTANCE_ENTRY_LIMIT` | 超出了Spine 实例的 `entry` 上限。 |
| `SPINE_INSTANCE_FAULTED` | 这个 Spine 实例此前已经失败，不能再使用。 |
| `SPINE_INSTANCE_LISTENER_FAILED` | 应用交给Spine 实例的监听器抛出了异常。抛出的内容在 cause 中。 |
| `SPINE_INSTANCE_NONFINITE_POSE` | Spine 实例的某个姿态中有不是有限数字的值。 |
| `SPINE_INSTANCE_OPTIONS_INVALID` | 交给Spine 实例的选项无效：缺少某一项、类型不对或超出范围。 |
| `SPINE_INSTANCE_OUTPUT_INVALID` | 交给Spine 实例的 `output` 无效。 |
| `SPINE_INSTANCE_PAUSED_INVALID` | 交给Spine 实例的 `paused` 无效。 |
| `SPINE_INSTANCE_PLAYBACK_STEP_LIMIT` | 超出了Spine 实例的 `playback step` 上限。 |
| `SPINE_INSTANCE_POSTCOMMIT_FAILED` | Spine 实例的 `postcommit` 失败了。原因在 cause 中。 |
| `SPINE_INSTANCE_RATE_INVALID` | 交给Spine 实例的 `rate` 无效。 |
| `SPINE_INSTANCE_REENTRANT` | 在Spine 实例自己的回调里又调用了它。 |
| `SPINE_INSTANCE_RENDER_FAILED` | Spine 实例的 `render` 失败了。原因在 cause 中。 |
| `SPINE_INSTANCE_RESET_FAILED` | Spine 实例的 `reset` 失败了。原因在 cause 中。 |
| `SPINE_INSTANCE_RESET_NOT_PRISTINE` | 这个 Spine 实例不能这样重置：它已经不是刚创建时的状态。 |
| `SPINE_INSTANCE_SEEK_ACTIVE` | Spine 实例的 `seek` 仍在活动中。 |
| `SPINE_INSTANCE_SEEK_BACKWARD_EVENTS` | 向后跳转会经过 Spine 实例的事件，而事件不会倒着播放。 |
| `SPINE_INSTANCE_SEEK_EVENT_LIMIT` | 超出了Spine 实例的 `seek event` 上限。 |
| `SPINE_INSTANCE_SEEK_FAILED` | Spine 实例的 `seek` 失败了。原因在 cause 中。 |
| `SPINE_INSTANCE_SEEK_HISTORY` | Spine 实例无法跳回那么远：它的历史没有保存到那里。 |
| `SPINE_INSTANCE_SEEK_INVALID` | 交给Spine 实例的 `seek` 无效。 |
| `SPINE_INSTANCE_SEEK_LIMIT` | 超出了Spine 实例的 `seek` 上限。 |
| `SPINE_INSTANCE_SEEK_NOT_READY` | Spine 实例的 `seek` 还没有就绪。 |
| `SPINE_INSTANCE_SKINS_INVALID` | 交给Spine 实例的 `skins` 无效。 |
| `SPINE_INSTANCE_SKIN_INVALID` | 交给Spine 实例的 `skin` 无效。 |
| `SPINE_INSTANCE_STEP_LIMIT` | 超出了Spine 实例的 `step` 上限。 |
| `SPINE_INSTANCE_TICK_INVALID` | 交给Spine 实例的 `tick` 无效。 |
| `SPINE_INSTANCE_TRACK_INVALID` | 交给Spine 实例的 `track` 无效。 |
| `SPINE_INSTANCE_TRANSFORM_INVALID` | 交给Spine 实例的 `transform` 无效。 |

### SPINE_RESET

| 错误码 | 含义 |
| --- | --- |
| `SPINE_RESET_CANCELLED` | Spine 重置槽被取消了。 |
| `SPINE_RESET_CLEANUP_FAILED` | 清理Spine 重置槽时失败。各个原因在 cleanupErrors 中。 |
| `SPINE_RESET_DISPOSED` | Spine 重置槽已销毁，不再接受任何操作。 |
| `SPINE_RESET_INITIAL_INVALID` | 交给Spine 重置槽的 `initial` 无效。 |
| `SPINE_RESET_LOADER_INVALID` | 交给Spine 重置槽的 `loader` 无效。 |
| `SPINE_RESET_NOT_PREPARED` | Spine 重置槽还没有预备。 |
| `SPINE_RESET_NOT_READY` | Spine 重置槽还没有就绪。 |
| `SPINE_RESET_OPTIONS_INVALID` | 交给Spine 重置槽的选项无效：缺少某一项、类型不对或超出范围。 |
| `SPINE_RESET_POSTCOMMIT_FAILED` | Spine 重置槽的 `postcommit` 失败了。原因在 cause 中。 |
| `SPINE_RESET_PRESERVE_ANIMATION` | 这次 Spine 显示对象的重置无法保留动画。 |
| `SPINE_RESET_PRESERVE_SKIN` | 这次 Spine 显示对象的重置无法保留皮肤。 |
| `SPINE_RESET_PRESERVE_STATE` | 这次 Spine 显示对象的重置无法保留状态。 |
| `SPINE_RESET_REENTRANT` | 在Spine 重置槽自己的回调里又调用了它。 |
| `SPINE_RESET_RETIRED` | Spine 重置槽已经退役，不能再使用。 |
| `SPINE_RESET_SCOPE_CLOSED` | Spine 重置槽的 `scope` 已关闭，不再接受任何操作。 |
| `SPINE_RESET_TARGET_CHANGED` | 请求进行期间Spine 重置槽的 `target` 发生了变化。 |
| `SPINE_RESET_TARGET_CLAIMED` | Spine 重置槽的目标已被另一个占用。 |
| `SPINE_RESET_TARGET_INVALID` | 交给Spine 重置槽的 `target` 无效。 |

### SPRITE_SHEET

| 错误码 | 含义 |
| --- | --- |
| `SPRITE_SHEET_ATLAS_INVALID` | 交给精灵表的 `atlas` 无效。 |
| `SPRITE_SHEET_BITMAP_FAILED` | 精灵表的 `bitmap` 失败了。原因在 cause 中。 |
| `SPRITE_SHEET_DISPOSED` | 精灵表已销毁，不再接受任何操作。 |
| `SPRITE_SHEET_FRAME_UNKNOWN` | 精灵表中没有这样的 `frame`。 |
| `SPRITE_SHEET_INPUT_INVALID` | 交给精灵表的 `input` 无效。 |
| `SPRITE_SHEET_INVALID` | 交给精灵表的内容无效。 |
| `SPRITE_SHEET_LEASE_INVALID` | 交给精灵表的 `lease` 无效。 |
| `SPRITE_SHEET_LIMIT` | 超出了精灵表的一项上限。 |
| `SPRITE_SHEET_NAME_INVALID` | 交给精灵表的 `name` 无效。 |
| `SPRITE_SHEET_READ_FAILED` | 精灵表的 `read` 失败了。原因在 cause 中。 |
| `SPRITE_SHEET_REENTRANT` | 在精灵表自己的回调里又调用了它。 |
| `SPRITE_SHEET_REGION_INVALID` | 交给精灵表的 `region` 无效。 |

### STAGE

| 错误码 | 含义 |
| --- | --- |
| `STAGE_FACTORY_REQUIRED` | 舞台要用它的工厂函数创建，不能用 new。 |
| `STAGE_ROOT_ONLY` | 舞台是显示树的根：不能把它添加到容器中，也不能单独销毁它。 |

### TEXT

| 错误码 | 含义 |
| --- | --- |
| `TEXT_ACQUIRE_CANCELLED` | 文本的 `acquire` 被取消了。 |
| `TEXT_ASSETS_INVALID` | 交给文本的 `assets` 无效。 |
| `TEXT_COUNTER_EXHAUSTED` | 文本的 `counter` 计数器用尽了。请新建一个。 |
| `TEXT_EDIT_ACTIVE` | 文本的 `edit` 仍在活动中。 |
| `TEXT_EDIT_CLOSED` | 文本的 `edit` 已关闭，不再接受任何操作。 |
| `TEXT_EDIT_COMPOSING` | 文本正在用输入法组字，在它结束之前不能进行这次编辑。 |
| `TEXT_EDIT_OPTIONS` | 交给文本的选项无效。 |
| `TEXT_EDIT_REVISION_EXHAUSTED` | 文本的 `edit revision` 计数器用尽了。请新建一个。 |
| `TEXT_EDIT_SELECTION` | 交给文本编辑的选区无效。 |
| `TEXT_EDIT_STALE` | 交给文本的 `edit` 已被更新的版本取代。 |
| `TEXT_EDIT_VALUE` | 交给文本编辑的值无效。 |
| `TEXT_MEASURE_FAILED` | 文本的 `measure` 失败了。原因在 cause 中。 |
| `TEXT_PROVIDER_INVALID` | 交给文本的 `provider` 无效。 |
| `TEXT_RASTER_FAILED` | 文本的 `raster` 失败了。原因在 cause 中。 |
| `TEXT_RASTER_RESULT_INVALID` | 交给文本的 `raster result` 无效。 |
| `TEXT_REQUEST_INVALID` | 交给文本的 `request` 无效。 |
| `TEXT_REQUEST_LIMIT` | 超出了文本的 `request` 上限。 |
| `TEXT_RESOURCE_FAILED` | 文本的 `resource` 失败了。原因在 cause 中。 |
| `TEXT_SIGNAL_FAILED` | 文本的 `signal` 失败了。原因在 cause 中。 |

### TEXTURE

| 错误码 | 含义 |
| --- | --- |
| `TEXTURE_DISPOSED` | 纹理已销毁，不能再显示。 |
| `TEXTURE_FACTORY_REQUIRED` | 纹理要用它的工厂函数创建，不能用 new。 |
| `TEXTURE_IMAGE_INVALID` | 交给纹理的 `image` 无效。 |
| `TEXTURE_INVALID` | 交给纹理的内容无效。 |
| `TEXTURE_REGION_INVALID` | 交给纹理的 `region` 无效。 |

### TEXTURE_VIEW

| 错误码 | 含义 |
| --- | --- |
| `TEXTURE_VIEW_REGION_IMMUTABLE` | 纹理视图的区域在创建时就固定了。请另建一个视图。 |
| `TEXTURE_VIEW_REGION_INVALID` | 交给纹理视图的 `region` 无效。 |

### TEXT_CACHE

| 错误码 | 含义 |
| --- | --- |
| `TEXT_CACHE_ALREADY_CREATED` | 文本缓存已经创建过了。 |
| `TEXT_CACHE_BUDGET` | 超出了文本缓存的一项上限。 |
| `TEXT_CACHE_CLEANUP_FAILED` | 清理文本缓存时失败。各个原因在 cleanupErrors 中。 |
| `TEXT_CACHE_CLOSED` | 文本缓存已关闭，不再接受任何操作。 |
| `TEXT_CACHE_INVALID` | 交给文本缓存的内容无效。 |
| `TEXT_CACHE_NAMESPACE_FAILED` | 文本缓存的 `namespace` 失败了。原因在 cause 中。 |
| `TEXT_CACHE_OPTIONS_INVALID` | 交给文本缓存的选项无效：缺少某一项、类型不对或超出范围。 |
| `TEXT_CACHE_REENTRANT` | 在文本缓存自己的回调里又调用了它。 |

### TEXT_FIELD

| 错误码 | 含义 |
| --- | --- |
| `TEXT_FIELD_BUSY` | 文本框还在处理之前的请求。 |
| `TEXT_FIELD_CLEANUP_FAILED` | 清理文本框时失败。各个原因在 cleanupErrors 中。 |
| `TEXT_FIELD_DISPOSED` | 文本框已销毁，不再接受任何操作。 |
| `TEXT_FIELD_INVALID` | 交给文本框的内容无效。 |
| `TEXT_FIELD_REVISION_LIMIT` | 超出了文本框的 `revision` 上限。 |
| `TEXT_FIELD_SUPERSEDED` | 文本框的这次请求被更新的请求取代了。 |
| `TEXT_FIELD_UNPREPARED` | 文本框还没有准备好。 |

### TEXT_PLAN

| 错误码 | 含义 |
| --- | --- |
| `TEXT_PLAN_ALREADY_CREATED` | 文本计划已经创建过了。 |
| `TEXT_PLAN_INVALID` | 交给文本计划的内容无效。 |
| `TEXT_PLAN_RELEASE_FAILED` | 文本计划的 `release` 失败了。原因在 cause 中。 |
| `TEXT_PLAN_SCOPE_CLOSED` | 文本计划的 `scope` 已关闭，不再接受任何操作。 |

### TILEMAP

| 错误码 | 含义 |
| --- | --- |
| `TILEMAP_CELL_INVALID` | 交给瓦片地图的 `cell` 无效。 |
| `TILEMAP_CLEANUP_FAILED` | 清理瓦片地图时失败。各个原因在 cleanupErrors 中。 |
| `TILEMAP_CLOSED` | 瓦片地图已关闭，不再接受任何操作。 |
| `TILEMAP_COMPRESSION_UNSUPPORTED` | 瓦片地图不支持 `compression`。 |
| `TILEMAP_DATA_INVALID` | 交给瓦片地图的 `data` 无效。 |
| `TILEMAP_DRAW_FAILED` | 瓦片地图的 `draw` 失败了。原因在 cause 中。 |
| `TILEMAP_LAYER_UNKNOWN` | 瓦片地图中没有这样的 `layer`。 |
| `TILEMAP_LAYER_UNSUPPORTED` | 瓦片地图不支持 `layer`。 |
| `TILEMAP_OPTIONS_INVALID` | 交给瓦片地图的选项无效：缺少某一项、类型不对或超出范围。 |
| `TILEMAP_ORIENTATION_UNSUPPORTED` | 瓦片地图不支持 `orientation`。 |
| `TILEMAP_TEXTURE_MISSING` | 缺少瓦片地图需要的 `texture`。 |
| `TILEMAP_TILESET_MISSING` | 缺少瓦片地图需要的 `tileset`。 |
| `TILEMAP_TILESET_UNSUPPORTED` | 瓦片地图不支持 `tileset`。 |
| `TILEMAP_TILE_INVALID` | 交给瓦片地图的 `tile` 无效。 |

### TWEEN

| 错误码 | 含义 |
| --- | --- |
| `TWEEN_ALREADY_STARTED` | 缓动已经开始过了。 |
| `TWEEN_CALLBACK_RETURN_INVALID` | 交给缓动的 `callback return` 无效。 |
| `TWEEN_COMPLETE_FAILED` | 缓动的 `complete` 失败了。原因在 cause 中。 |
| `TWEEN_INVALID` | 交给缓动的内容无效。 |
| `TWEEN_NOT_STARTED` | 缓动还没有开始。 |
| `TWEEN_OPTIONS_INVALID` | 缓动选项无效：from 和 to 是有限数字，durationSeconds 大于零，onUpdate 是不返回任何值的函数。 |
| `TWEEN_RANGE_INVALID` | 交给缓动的 `range` 无效。 |
| `TWEEN_REENTRANT` | 在缓动自己的回调里又调用了它。 |
| `TWEEN_SCOPE_INVALID` | 交给缓动的作用域不是这个 Engine 的一个打开的作用域。 |
| `TWEEN_TERMINAL` | 缓动已经结束，不能再使用。 |
| `TWEEN_TIME_RANGE` | `time` 超出了缓动的范围。 |
| `TWEEN_UPDATE_FAILED` | 缓动的 `update` 失败了。原因在 cause 中。 |

### UI

| 错误码 | 含义 |
| --- | --- |
| `UI_BUSY` | UI还在处理之前的请求。 |
| `UI_CAP_EXCEEDED` | 超出了UI的一项上限。 |
| `UI_CLEANUP_FAILED` | 清理UI时失败。各个原因在 cleanupErrors 中。 |
| `UI_CLOSED` | UI已关闭，不再接受任何操作。 |
| `UI_CONTENT_INVALID` | 交给UI的 `content` 无效。 |
| `UI_DUPLICATE_ID` | UI 的两个部分使用了同一个 id。 |
| `UI_DUPLICATE_KEY` | 列表的两行使用了同一个 key。 |
| `UI_EDITOR_FONTS_CANCELLED` | UI的 `editor fonts` 被取消了。 |
| `UI_EDITOR_FONTS_CLOSED` | UI的 `editor fonts` 已关闭，不再接受任何操作。 |
| `UI_EDITOR_FONTS_DECODE` | UI 文本编辑器的某个字体无法解码。 |
| `UI_EDITOR_FONTS_FAMILY` | 交给 UI 文本编辑器的字体族无效。 |
| `UI_EDITOR_FONTS_INVALID` | 交给UI的 `editor fonts` 无效。 |
| `UI_EDITOR_FONTS_LIMIT` | 超出了UI的 `editor fonts` 上限。 |
| `UI_EDITOR_FONTS_OPTIONS` | 交给UI的选项无效。 |
| `UI_EDITOR_FONTS_PROFILE` | 交给 UI 文本编辑器的字体不属于它能读取的规格。 |
| `UI_EDITOR_FONTS_TIMEOUT` | UI的 `editor fonts` 耗时过长。 |
| `UI_EDITOR_FONTS_UNSUPPORTED` | UI不支持 `editor fonts`。 |
| `UI_ENGINE_INVALID` | 交给UI的 `engine` 无效。 |
| `UI_INPUT_BUSY` | UI的 `input` 还在处理之前的请求。 |
| `UI_INPUT_CLOSED` | UI的 `input` 已关闭，不再接受任何操作。 |
| `UI_INPUT_INVALID` | 交给UI的 `input` 无效。 |
| `UI_INVALID` | 交给UI的内容无效。 |
| `UI_LAYOUT_CYCLE` | UI 的布局依赖于它自己：某个尺寸由它所决定的另一个尺寸给出。 |
| `UI_LAYOUT_UNSTABLE` | UI 的布局经过八轮仍未稳定：某个尺寸一直在改变它所依赖的东西。 |
| `UI_LIMIT` | 超出了UI的一项上限。 |
| `UI_LIST_NOT_FOUND` | UI 中没有这个 id 的列表。 |
| `UI_MANAGED_GEOMETRY` | 这个对象的位置和尺寸由 UI 管理。请修改它的布局，而不是它的 x、y 或缩放。 |
| `UI_NOT_READY` | UI还没有就绪。 |
| `UI_OWNER_INVALID` | 交给UI的 `owner` 无效。 |
| `UI_PENDING_LIMIT` | 超出了UI的 `pending` 上限。 |
| `UI_PREPARATION_INVALID` | 交给UI的 `preparation` 无效。 |
| `UI_PREPARE_FAILED` | UI的 `prepare` 失败了。原因在 cause 中。 |
| `UI_REVISION_EXHAUSTED` | UI的 `revision` 计数器用尽了。请新建一个。 |
| `UI_ROW_NOT_REALIZED` | 该行现在不在屏幕上，没有可以操作的对象。请先把它滚动到可见范围。 |
| `UI_ROW_RETAINED` | 一个正在使用的行被从列表中移除，或者在使用期间被改动了。 |
| `UI_SCOPE_INVALID` | 交给UI的作用域不是这个 Engine 的一个打开的作用域。 |
| `UI_SOURCE_INVALID` | 交给UI的 `source` 无效。 |
| `UI_SOURCE_REVISION` | UI 在同一个版本号下读取列表的行时，这些行发生了变化。 |
| `UI_STAGE_TRANSFORM_UNSUPPORTED` | UI不支持 `stage transform`。 |
| `UI_STALE` | 交给UI的内容已被更新的版本取代。 |
| `UI_STALE_PREPARATION` | 预备好的 UI 已经与它所针对的 UI 不一致。请重新预备。 |
| `UI_TREE_SHAPE` | 新的 UI 描述与它要更新的树相比，节点不同，或者某个节点的种类不同。 |
| `UI_UNKNOWN_KEY` | 列表中没有这个 key 的行。 |
| `UI_UNKNOWN_LIST` | UI 中没有这个 id 的列表。 |
| `UI_VALUE_INVALID` | 交给UI的 `value` 无效。 |

### UI_CONTROL

| 错误码 | 含义 |
| --- | --- |
| `UI_CONTROL_CLOSED` | UI 控件已关闭，不再接受任何操作。 |
| `UI_CONTROL_DIRECTION` | 交给 UI 控件的方向不是两个有限数字。 |
| `UI_CONTROL_OPTIONS` | 交给UI 控件的选项无效。 |
| `UI_CONTROL_RADIUS` | 交给 UI 控件的半径不是大于零的有限数字。 |
| `UI_CONTROL_UNKNOWN_ITEM` | 控件中没有这个 id 的项。 |

### UI_KEYBOARD

| 错误码 | 含义 |
| --- | --- |
| `UI_KEYBOARD_CLOSED` | UI 键盘导航已关闭，不再接受任何操作。 |
| `UI_KEYBOARD_ID_INVALID` | 交给UI 键盘导航的 `id` 无效。 |
| `UI_KEYBOARD_INVALID` | 交给UI 键盘导航的内容无效。 |
| `UI_KEYBOARD_STOP_INVALID` | 交给UI 键盘导航的 `stop` 无效。 |
| `UI_KEYBOARD_SYNC_FAILED` | UI 键盘导航的 `sync` 失败了。原因在 cause 中。 |
| `UI_KEYBOARD_UNAVAILABLE` | UI 键盘导航在这里不可用。 |

### UI_LAYER

| 错误码 | 含义 |
| --- | --- |
| `UI_LAYER_ANCHOR_INVALID` | 交给UI 层的 `anchor` 无效。 |
| `UI_LAYER_BASE` | UI 的基础层始终是打开的，不能按名字打开或关闭。 |
| `UI_LAYER_CLEANUP_FAILED` | 清理UI 层时失败。各个原因在 cleanupErrors 中。 |
| `UI_LAYER_CLOSED` | UI 层已关闭，不再接受任何操作。 |
| `UI_LAYER_ID_DUPLICATE` | 同一个 `id` 向UI 层提供了两次。 |
| `UI_LAYER_ID_INVALID` | 交给UI 层的 `id` 无效。 |
| `UI_LAYER_INPUT_MISMATCH` | 交给UI 层的 `input` 不匹配。 |
| `UI_LAYER_MANAGER_OWNED` | 这个 Engine 已经有一个 UI 层管理器。一个 Engine 只有一个。 |
| `UI_LAYER_ROOT_OWNED` | 这个 UI 根已经属于某个层。 |
| `UI_LAYER_UNKNOWN` | UI 层不认识所指的内容。 |
| `UI_LAYER_VIEWPORT_TOO_SMALL` | 交给UI 层的 `viewport` 太小。 |

### UI_SEMANTICS

| 错误码 | 含义 |
| --- | --- |
| `UI_SEMANTICS_CAPACITY` | UI 语义已经装满。 |
| `UI_SEMANTICS_CLEANUP_FAILED` | 清理UI 语义时失败。各个原因在 cleanupErrors 中。 |
| `UI_SEMANTICS_CLOSED` | UI 语义已关闭，不再接受任何操作。 |
| `UI_SEMANTICS_DESCRIBE_FAILED` | UI 语义的 `describe` 失败了。原因在 cause 中。 |
| `UI_SEMANTICS_DESCRIPTION` | UI 语义条目的某个字段无效。条目和字段在 cause 中。 |
| `UI_SEMANTICS_DUPLICATE` | 同一内容向UI 语义提供了两次。 |
| `UI_SEMANTICS_EXHAUSTED` | UI 语义的一个计数器用尽了。请新建一个。 |
| `UI_SEMANTICS_FOCUS` | UI 语义中有多个条目获得焦点，或者获得焦点的条目是 inert 的。条目在 cause 中。 |
| `UI_SEMANTICS_LISTENER_FAILED` | 应用交给UI 语义的监听器抛出了异常。抛出的内容在 cause 中。 |
| `UI_SEMANTICS_OPTIONS` | 交给UI 语义的选项无效。 |
| `UI_SEMANTICS_PARENT` | UI 语义的某个条目没有放在它的角色所要求的那种条目之内。 |
| `UI_SEMANTICS_REENTRANT` | 在UI 语义自己的回调里又调用了它。 |
| `UI_SEMANTICS_RELATION` | UI 语义的某个条目引用了树中不存在的条目。条目在 cause 中。 |
| `UI_SEMANTICS_REVISION` | 交给 UI 语义的版本号比它已有的更旧。 |
| `UI_SEMANTICS_SURFACE_BUSY` | UI 语义的 `surface` 还在处理之前的请求。 |
| `UI_SEMANTICS_SURFACE_INVALID` | 交给UI 语义的 `surface` 无效。 |

### UI_TEXT_EDITOR

| 错误码 | 含义 |
| --- | --- |
| `UI_TEXT_EDITOR_CLOSED` | UI 文本编辑器已关闭，不再接受任何操作。 |
| `UI_TEXT_EDITOR_COMPOSING` | UI 文本编辑器正在用输入法组字。请等它结束。 |
| `UI_TEXT_EDITOR_HOST_IN_USE` | 交给UI 文本编辑器的 `host` 已经在使用中。 |
| `UI_TEXT_EDITOR_INVALID` | 交给UI 文本编辑器的内容无效。 |
| `UI_TEXT_EDITOR_LIMIT` | 超出了UI 文本编辑器的一项上限。 |
| `UI_TEXT_EDITOR_OPTIONS` | 交给UI 文本编辑器的选项无效。 |
| `UI_TEXT_EDITOR_PLACEMENT_UNSUPPORTED` | UI 文本编辑器不支持 `placement`。 |
| `UI_TEXT_EDITOR_REVISION_EXHAUSTED` | UI 文本编辑器的 `revision` 计数器用尽了。请新建一个。 |
| `UI_TEXT_EDITOR_ROOT_CLOSED` | UI 文本编辑器的 `root` 已关闭，不再接受任何操作。 |
| `UI_TEXT_EDITOR_ROOT_INVALID` | 交给UI 文本编辑器的 `root` 无效。 |
| `UI_TEXT_EDITOR_STALE` | 交给UI 文本编辑器的内容已被更新的版本取代。 |
| `UI_TEXT_EDITOR_STYLE` | 交给 UI 文本编辑器的样式无效。 |

### UI_THEME

| 错误码 | 含义 |
| --- | --- |
| `UI_THEME_INVALID` | 交给UI 主题的内容无效。 |
| `UI_THEME_LIMIT` | 超出了UI 主题的一项上限。 |
| `UI_THEME_METRICS_CHANGED` | 请求进行期间UI 主题的 `metrics` 发生了变化。 |
| `UI_THEME_TOKEN_MISSING` | 缺少UI 主题需要的 `token`。 |

### VIDEO

| 错误码 | 含义 |
| --- | --- |
| `VIDEO_CLEANUP_FAILED` | 清理视频时失败。各个原因在 cleanupErrors 中。 |
| `VIDEO_CLOSED` | 视频已关闭，不再接受任何操作。 |
| `VIDEO_FRAME_INVALID` | 交给视频的 `frame` 无效。 |
| `VIDEO_LISTENER_FAILED` | 应用交给视频的监听器抛出了异常。抛出的内容在 cause 中。 |
| `VIDEO_OPTIONS_INVALID` | 交给视频的选项无效：缺少某一项、类型不对或超出范围。 |
| `VIDEO_PLAY_REFUSED` | 浏览器拒绝播放视频，通常是因为视频有声音而页面还没有被点击过。请静音播放，或在点击后播放。 |
| `VIDEO_UNAVAILABLE` | 视频在这里不可用。 |

### WEBGL2

| 错误码 | 含义 |
| --- | --- |
| `WEBGL2_BACKING_LIMIT` | 超出了WebGL2 Host的 `backing` 上限。 |
| `WEBGL2_BACKPRESSURE` | WebGL2 Host持有的未完成帧已达上限。请稍后再绘制下一帧。 |
| `WEBGL2_CLOSED` | WebGL2 Host已关闭，不再接受任何操作。 |
| `WEBGL2_CLOSE_UNSAFE` | WebGL2 Host 关闭时没能释放它创建的全部对象。原因在 cause 中。 |
| `WEBGL2_CONTEXT_ATTRIBUTES_UNSUPPORTED` | WebGL2 Host不支持 `context attributes`。 |
| `WEBGL2_CONTEXT_LIMIT` | 超出了WebGL2 Host的 `context` 上限。 |
| `WEBGL2_CONTEXT_LOST` | 浏览器收回了 WebGL2 上下文。浏览器归还后 Host 会恢复；在此之前帧会被拒绝。 |
| `WEBGL2_CONTEXT_RESTORING` | WebGL2 上下文正在恢复。恢复后会重新接受帧。 |
| `WEBGL2_CONTEXT_UNAVAILABLE` | 浏览器没有为画布提供 WebGL2 上下文。画布可能已有另一种上下文，或者 WebGL2 被关闭了。 |
| `WEBGL2_DIAGNOSTIC_CALLBACK_FAILED` | 应用交给WebGL2 Host的回调抛出了异常。抛出的内容在 cause 中。 |
| `WEBGL2_FAILED` | WebGL2 Host失败了。原因在 cause 中。 |
| `WEBGL2_FORMAT_UNSUPPORTED` | WebGL2 Host不支持 `format`。 |
| `WEBGL2_FRAME_BUDGET` | 这一帧超出了 Host 创建时设定的上限。上限是 createSharedWebGL2Host 的选项。 |
| `WEBGL2_FRAME_INVALID` | 交给WebGL2 Host的 `frame` 无效。 |
| `WEBGL2_FRAME_PROFILE_UNSUPPORTED` | WebGL2 Host不支持 `frame profile`。 |
| `WEBGL2_GENERATION_EXHAUSTED` | WebGL2 Host的 `generation` 计数器用尽了。请新建一个。 |
| `WEBGL2_GEOMETRY_RANGE` | `geometry` 超出了WebGL2 Host的范围。 |
| `WEBGL2_NOT_STARTED` | Host 还没有启动。Engine 会启动它的 Host；请等 createEngine 完成后再绘制。 |
| `WEBGL2_OPTIONS_INVALID` | 交给WebGL2 Host的选项无效：缺少某一项、类型不对或超出范围。 |
| `WEBGL2_OUT_OF_MEMORY` | 图形设备内存不足。请减少纹理数量或尺寸。 |
| `WEBGL2_PRECISION_UNSUPPORTED` | WebGL2 Host不支持 `precision`。 |
| `WEBGL2_REENTRANT` | 在WebGL2 Host自己的回调里又调用了它。 |
| `WEBGL2_RENDER_FAILED` | WebGL2 Host的 `render` 失败了。原因在 cause 中。 |
| `WEBGL2_RESTORE_FAILED` | WebGL2 Host的 `restore` 失败了。原因在 cause 中。 |
| `WEBGL2_RESTORE_TIMEOUT` | WebGL2 Host的 `restore` 耗时过长。 |
| `WEBGL2_SERIAL_EXHAUSTED` | WebGL2 Host的 `serial` 计数器用尽了。请新建一个。 |
| `WEBGL2_START_CANCELLED` | WebGL2 Host的 `start` 被取消了。 |
| `WEBGL2_START_FAILED` | WebGL2 Host的 `start` 失败了。原因在 cause 中。 |
| `WEBGL2_STOPPED` | WebGL2 Host已停止，不再接受任何操作。 |
| `WEBGL2_SYNC_FAILED` | WebGL2 Host的 `sync` 失败了。原因在 cause 中。 |
| `WEBGL2_SYNC_TIMEOUT` | WebGL2 Host的 `sync` 耗时过长。 |
| `WEBGL2_VALIDATION` | WebGL2 认为 Host 的某个操作无效并拒绝了它。原因在 cause 中。 |

### WEBGL2_LAYER

| 错误码 | 含义 |
| --- | --- |
| `WEBGL2_LAYER_BUDGET` | 超出了WebGL2 层的一项上限。 |
| `WEBGL2_LAYER_DISPOSED` | WebGL2 层已销毁，不再接受任何操作。 |
| `WEBGL2_LAYER_EFFECT_INVALID` | 交给WebGL2 层的 `effect` 无效。 |
| `WEBGL2_LAYER_INVALID` | 交给WebGL2 层的内容无效。 |
| `WEBGL2_LAYER_NOT_READY` | WebGL2 层还没有就绪。 |
| `WEBGL2_LAYER_PENDING` | WebGL2 层还有未完成的工作。 |

### WEBGL2_READBACK

| 错误码 | 含义 |
| --- | --- |
| `WEBGL2_READBACK_DISABLED` | WebGL2 读回没有开启。请在其工厂函数的选项中开启。 |
| `WEBGL2_READBACK_FAILED` | WebGL2 读回失败了。原因在 cause 中。 |
| `WEBGL2_READBACK_PENDING` | WebGL2 读回还有未完成的工作。 |

### WEBGL2_UPLOAD

| 错误码 | 含义 |
| --- | --- |
| `WEBGL2_UPLOAD_ABORTED` | 分步的 WebGL2 上传被中止了。 |
| `WEBGL2_UPLOAD_DISPOSED` | 分步的 WebGL2 上传已销毁，不再接受任何操作。 |
| `WEBGL2_UPLOAD_EXPIRED` | 分步的 WebGL2 上传耗时过长，已被放弃。 |
| `WEBGL2_UPLOAD_INVALID` | 交给分步的 WebGL2 上传的内容无效。 |
| `WEBGL2_UPLOAD_NOT_READY` | 分步的 WebGL2 上传还没有就绪。 |
| `WEBGL2_UPLOAD_OPTIONS_INVALID` | 交给分步的 WebGL2 上传的选项无效：缺少某一项、类型不对或超出范围。 |
| `WEBGL2_UPLOAD_STALE` | 交给分步的 WebGL2 上传的内容已被更新的版本取代。 |
| `WEBGL2_UPLOAD_USED` | 分步的 WebGL2 上传已经用过一次，不能再用。 |

### WEBGPU

| 错误码 | 含义 |
| --- | --- |
| `WEBGPU_ADAPTER_UNAVAILABLE` | 浏览器没有提供 WebGPU 适配器。请改用 WebGL2 Host。 |
| `WEBGPU_BACKING_LIMIT` | 超出了WebGPU Host的 `backing` 上限。 |
| `WEBGPU_BACKPRESSURE` | WebGPU Host持有的未完成帧已达上限。请稍后再绘制下一帧。 |
| `WEBGPU_CLOSED` | WebGPU Host已关闭，不再接受任何操作。 |
| `WEBGPU_CLOSE_UNSAFE` | WebGPU Host 关闭时没能释放它创建的全部对象。原因在 cause 中。 |
| `WEBGPU_CONTEXT_UNAVAILABLE` | WebGPU Host的 `context` 在这里不可用。 |
| `WEBGPU_DEVICE_FAILED` | WebGPU Host的 `device` 失败了。原因在 cause 中。 |
| `WEBGPU_DEVICE_LIMIT` | 超出了WebGPU Host的 `device` 上限。 |
| `WEBGPU_DEVICE_LOST` | 浏览器收回了 WebGPU 设备。开启恢复时 Host 会恢复；在此之前帧会被拒绝。 |
| `WEBGPU_DIAGNOSTIC_CALLBACK_FAILED` | 应用交给WebGPU Host的回调抛出了异常。抛出的内容在 cause 中。 |
| `WEBGPU_FAILED` | WebGPU Host失败了。原因在 cause 中。 |
| `WEBGPU_FORMAT_UNSUPPORTED` | WebGPU Host不支持 `format`。 |
| `WEBGPU_FRAME_BUDGET` | 这一帧超出了 Host 创建时设定的上限。上限是 createSharedWebGPUHost 的选项。 |
| `WEBGPU_FRAME_INVALID` | 交给WebGPU Host的 `frame` 无效。 |
| `WEBGPU_FRAME_PROFILE_UNSUPPORTED` | WebGPU Host不支持 `frame profile`。 |
| `WEBGPU_GENERATION_EXHAUSTED` | WebGPU Host的 `generation` 计数器用尽了。请新建一个。 |
| `WEBGPU_GEOMETRY_RANGE` | `geometry` 超出了WebGPU Host的范围。 |
| `WEBGPU_INTERNAL` | WebGPU 报告了内部错误。原因在 cause 中。 |
| `WEBGPU_NOT_STARTED` | Host 还没有启动。Engine 会启动它的 Host；请等 createEngine 完成后再绘制。 |
| `WEBGPU_OPTIONS_INVALID` | 交给WebGPU Host的选项无效：缺少某一项、类型不对或超出范围。 |
| `WEBGPU_OUT_OF_MEMORY` | 图形设备内存不足。请减少纹理数量或尺寸。 |
| `WEBGPU_PRECISION_UNSUPPORTED` | WebGPU Host不支持 `precision`。 |
| `WEBGPU_QUEUE_FAILED` | WebGPU Host的 `queue` 失败了。原因在 cause 中。 |
| `WEBGPU_REENTRANT` | 在WebGPU Host自己的回调里又调用了它。 |
| `WEBGPU_RENDER_FAILED` | WebGPU Host的 `render` 失败了。原因在 cause 中。 |
| `WEBGPU_SCOPE_FAILED` | WebGPU Host的 `scope` 失败了。原因在 cause 中。 |
| `WEBGPU_SERIAL_EXHAUSTED` | WebGPU Host的 `serial` 计数器用尽了。请新建一个。 |
| `WEBGPU_START_CANCELLED` | WebGPU Host的 `start` 被取消了。 |
| `WEBGPU_START_FAILED` | WebGPU Host的 `start` 失败了。原因在 cause 中。 |
| `WEBGPU_STOPPED` | WebGPU Host已停止，不再接受任何操作。 |
| `WEBGPU_UNAVAILABLE` | 浏览器没有 WebGPU。请改用 WebGL2 Host。 |
| `WEBGPU_UNCAPTURED_ERROR` | WebGPU 设备在 Host 的操作之外报告了错误。报告的内容在 cause 中。 |
| `WEBGPU_VALIDATION` | WebGPU 认为 Host 的某个操作无效并拒绝了它。原因在 cause 中。 |

### WEBGPU_READBACK

| 错误码 | 含义 |
| --- | --- |
| `WEBGPU_READBACK_DISABLED` | WebGPU 读回没有开启。请在其工厂函数的选项中开启。 |
| `WEBGPU_READBACK_FAILED` | WebGPU 读回失败了。原因在 cause 中。 |
| `WEBGPU_READBACK_PENDING` | WebGPU 读回还有未完成的工作。 |

### WEBGPU_RECOVERY

| 错误码 | 含义 |
| --- | --- |
| `WEBGPU_RECOVERY_DEVICE_INVALID` | 交给WebGPU 设备恢复的 `device` 无效。 |
| `WEBGPU_RECOVERY_DISABLED` | WebGPU 设备恢复没有开启。请在其工厂函数的选项中开启。 |
| `WEBGPU_RECOVERY_FAILED` | WebGPU 设备恢复失败了。原因在 cause 中。 |
| `WEBGPU_RECOVERY_LIMIT` | 超出了WebGPU 设备恢复的一项上限。 |
| `WEBGPU_RECOVERY_STATE_INVALID` | 交给WebGPU 设备恢复的 `state` 无效。 |
| `WEBGPU_RECOVERY_TIMEOUT` | WebGPU 设备恢复耗时过长。 |

### WEBGPU_UPLOAD

| 错误码 | 含义 |
| --- | --- |
| `WEBGPU_UPLOAD_ABORTED` | 分步的 WebGPU 上传被中止了。 |
| `WEBGPU_UPLOAD_DISPOSED` | 分步的 WebGPU 上传已销毁，不再接受任何操作。 |
| `WEBGPU_UPLOAD_EXPIRED` | 分步的 WebGPU 上传耗时过长，已被放弃。 |
| `WEBGPU_UPLOAD_INVALID` | 交给分步的 WebGPU 上传的内容无效。 |
| `WEBGPU_UPLOAD_NOT_READY` | 分步的 WebGPU 上传还没有就绪。 |
| `WEBGPU_UPLOAD_OPTIONS_INVALID` | 交给分步的 WebGPU 上传的选项无效：缺少某一项、类型不对或超出范围。 |
| `WEBGPU_UPLOAD_STALE` | 交给分步的 WebGPU 上传的内容已被更新的版本取代。 |
| `WEBGPU_UPLOAD_USED` | 分步的 WebGPU 上传已经用过一次，不能再用。 |

### WEB_PNG

| 错误码 | 含义 |
| --- | --- |
| `WEB_PNG_BITMAP_INVALID` | 交给浏览器图片提供者的 `bitmap` 无效。 |
| `WEB_PNG_BLOB_FAILED` | 浏览器图片提供者的 `blob` 失败了。原因在 cause 中。 |
| `WEB_PNG_BYTES_INVALID` | 交给浏览器图片提供者的 `bytes` 无效。 |
| `WEB_PNG_CANCELLED` | 浏览器图片提供者被取消了。 |
| `WEB_PNG_CLEANUP_FAILED` | 清理浏览器图片提供者时失败。各个原因在 cleanupErrors 中。 |
| `WEB_PNG_CLOSE_INCOMPLETE` | 浏览器图片提供者已关闭，但它持有的东西没能全部释放。各个原因在 cleanupErrors 中。 |
| `WEB_PNG_CONTEXT_INVALID` | 交给浏览器图片提供者的 `context` 无效。 |
| `WEB_PNG_DECODE_FAILED` | 浏览器图片提供者的 `decode` 失败了。原因在 cause 中。 |
| `WEB_PNG_DESCRIPTOR_READ_FAILED` | 浏览器图片提供者的 `descriptor read` 失败了。原因在 cause 中。 |
| `WEB_PNG_INPUT_LIMIT` | 超出了浏览器图片提供者的 `input` 上限。 |
| `WEB_PNG_JOB_LIMIT` | 超出了浏览器图片提供者的 `job` 上限。 |
| `WEB_PNG_OPTIONS_INVALID` | 交给浏览器图片提供者的选项无效：缺少某一项、类型不对或超出范围。 |
| `WEB_PNG_PROFILE_UNSUPPORTED` | 浏览器图片提供者不支持 `profile`。 |
| `WEB_PNG_PROVIDER_CLOSED` | 浏览器图片提供者的 `provider` 已关闭，不再接受任何操作。 |
| `WEB_PNG_PROVIDER_INVALID` | 交给浏览器图片提供者的 `provider` 无效。 |
| `WEB_PNG_RASTER_FAILED` | 浏览器图片提供者的 `raster` 失败了。原因在 cause 中。 |
| `WEB_PNG_READBACK_INVALID` | 交给浏览器图片提供者的 `readback` 无效。 |
| `WEB_PNG_READ_FAILED` | 浏览器图片提供者的 `read` 失败了。原因在 cause 中。 |
| `WEB_PNG_SIGNAL_READ_FAILED` | 浏览器图片提供者的 `signal read` 失败了。原因在 cause 中。 |
| `WEB_PNG_STRUCTURE_INVALID` | 交给浏览器图片提供者的 `structure` 无效。 |
| `WEB_PNG_SURFACE_INVALID` | 交给浏览器图片提供者的 `surface` 无效。 |
| `WEB_PNG_UNAVAILABLE` | 浏览器图片提供者在这里不可用。 |
| `WEB_PNG_VALUE_INVALID` | 交给浏览器图片提供者的 `value` 无效。 |

### WEB_RESOURCE

| 错误码 | 含义 |
| --- | --- |
| `WEB_RESOURCE_BINDINGS_INVALID` | 交给浏览器资源来源的 `bindings` 无效。 |
| `WEB_RESOURCE_BODY_FAILED` | 浏览器资源来源的 `body` 失败了。原因在 cause 中。 |
| `WEB_RESOURCE_CANCELLED` | 浏览器资源来源被取消了。 |
| `WEB_RESOURCE_CLOSE_INCOMPLETE` | 浏览器资源来源已关闭，但它持有的东西没能全部释放。各个原因在 cleanupErrors 中。 |
| `WEB_RESOURCE_CONTEXT_INVALID` | 交给浏览器资源来源的 `context` 无效。 |
| `WEB_RESOURCE_DEADLINE_EXCEEDED` | 浏览器资源来源的一次请求超过了它的期限。 |
| `WEB_RESOURCE_FETCH_FAILED` | 浏览器资源来源的 `fetch` 失败了。原因在 cause 中。 |
| `WEB_RESOURCE_HTTP_STATUS` | 服务器对浏览器资源来源的一次请求返回了非成功的状态码。 |
| `WEB_RESOURCE_INPUT_LIMIT` | 超出了浏览器资源来源的 `input` 上限。 |
| `WEB_RESOURCE_INTEGRITY_MISMATCH` | 交给浏览器资源来源的 `integrity` 不匹配。 |
| `WEB_RESOURCE_LENGTH_MISMATCH` | 交给浏览器资源来源的 `length` 不匹配。 |
| `WEB_RESOURCE_MANIFEST_INVALID` | 交给浏览器资源来源的 `manifest` 无效。 |
| `WEB_RESOURCE_OPTIONS_INVALID` | 交给浏览器资源来源的选项无效：缺少某一项、类型不对或超出范围。 |
| `WEB_RESOURCE_QUEUE_LIMIT` | 超出了浏览器资源来源的 `queue` 上限。 |
| `WEB_RESOURCE_REF_INVALID` | 交给浏览器资源来源的 `ref` 无效。 |
| `WEB_RESOURCE_RESPONSE_INVALID` | 交给浏览器资源来源的 `response` 无效。 |
| `WEB_RESOURCE_SOURCE_CLOSED` | 浏览器资源来源的 `source` 已关闭，不再接受任何操作。 |
| `WEB_RESOURCE_SOURCE_INVALID` | 交给浏览器资源来源的 `source` 无效。 |
| `WEB_RESOURCE_UNAVAILABLE` | 浏览器资源来源在这里不可用。 |
| `WEB_RESOURCE_URL_INVALID` | 交给浏览器资源来源的 `url` 无效。 |

### WEB_TEXT

| 错误码 | 含义 |
| --- | --- |
| `WEB_TEXT_CANCELLED` | 浏览器文本提供者被取消了。 |
| `WEB_TEXT_CLEANUP_FAILED` | 清理浏览器文本提供者时失败。各个原因在 cleanupErrors 中。 |
| `WEB_TEXT_FONT_NOT_READY` | 浏览器文本提供者的 `font` 还没有就绪。 |
| `WEB_TEXT_PLAN_INVALID` | 交给浏览器文本提供者的 `plan` 无效。 |
| `WEB_TEXT_PLAN_LIMIT` | 超出了浏览器文本提供者的 `plan` 上限。 |
| `WEB_TEXT_PROVIDER_INVALID` | 交给浏览器文本提供者的 `provider` 无效。 |
| `WEB_TEXT_STATE_UNSUPPORTED` | 浏览器文本提供者不支持 `state`。 |
| `WEB_TEXT_UNAVAILABLE` | 浏览器文本提供者在这里不可用。 |

### 其他错误码

| 错误码 | 含义 |
| --- | --- |
| `ASYNC_EVENT_HANDLER` | 事件监听器返回了 Promise。监听器要在派发返回之前执行完；异步工作请直接启动，不要把它返回。 |
| `HOST_IN_USE` | 这个 Host 已经在为另一个 Engine 绘制。每个 Engine 需要自己的 Host。 |
| `INVALID_DISPLAY_CONTAINER` | 给出的不是本 SDK 创建的显示容器。 |
| `INVALID_DISPLAY_OBJECT` | 给出的不是本 SDK 创建的显示对象。 |
| `INVALID_EVENT` | 派发的不是用本 SDK 的事件类型创建的 Event。 |
| `INVALID_EVENT_DISPATCHER` | 给出的不是本 SDK 创建的事件派发器。 |
| `INVALID_FRAME_OPTIONS` | 帧选项无效：width 和 height 是大于零的整数，clearColor 在 0 到 0xffffff 之间，clearAlpha 在 0 到 1 之间。 |
| `INVALID_INDEX` | 子对象索引不是容器范围内的整数。 |
| `INVALID_PRIORITY` | 监听器优先级是整数。 |
| `INVALID_RENDERER` | 交给 Engine 的 Host 不能绘制这种帧。 |
| `INVALID_TIMEOUT` | 超时时间是大于等于零的整数毫秒。 |
| `NOT_A_CHILD` | 该显示对象不是这个容器的子对象。 |
| `NOT_READY` | 还没有就绪。请等它依赖的内容加载完成。 |
| `OBJECT_DISPOSED` | 对象已销毁，不能再修改或添加。请新建一个，或者在它的作用域销毁后不再使用它。 |
| `OPTIONS_INVALID` | 给出的选项无效：缺少某一项、类型不对或超出范围。 |
| `OWNERSHIP_CONFLICT` | 对象已经属于另一个作用域。一个对象只能用 scope.use 交给一个作用域，且只交一次。 |
| `RENDERER_REQUIRED` | 要求 Engine 绘制，但创建它时没有给能绘制的 Host。请把 createSharedWebGL2Host 或 createSharedWebGPUHost 得到的 Host 交给 createEngine。 |
| `SURFACE_IN_USE` | 这个画布已被另一个 Host 或输入使用。 |
