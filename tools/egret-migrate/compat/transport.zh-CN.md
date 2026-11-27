# 旧版 HTTP、套接字与渠道调用

[English](transport.md)

原业务脚本可以继续调用 `egret.HttpRequest`、`egret.WebSocket` 和 `egret.ExternalInterface`。请求和连接由本局游戏持有。关闭游戏时会取消进行中的请求、关闭套接字并注销渠道回调。关闭后可以在同一个套接字对象上重新连接，新连接拥有独立的会话。

## 浏览器

转换后的工程使用画布所在窗口的 XMLHttpRequest 和 WebSocket，遵循浏览器的来源、Cookie 和 TLS 规则。渠道 SDK 可通过 `launchLegacyWeb(sdk, { ...options, externalChannel })` 注入。适配器的 `call(name, value, signal, dispatch)` 转发已授权的字符串调用，通过 `dispatch(callbackName, string)` 返回结果。可选的 `subscribe(name, listener)` 接收宿主主动推送的事件并返回解除订阅的函数。项目负责对接实际厂商的 SDK。

## Android

先为项目需要的 HTTPS 和 WSS 来源启用 Android 播放器的[网络服务](../../../runtime-sdk/android/network/README.zh-CN.md)，再按下面的方式接入原业务脚本。

```js
import { createPlayerNetwork } from '@egret/android-player-network';
import { openLegacyAndroid } from '@egret/legacy/android';

const game = await openLegacyAndroid(services, {
  ...convertedEntry,
  network: createPlayerNetwork(services.host),
  channelActions: {
    queryStatus: { action: 'channel.status', callback: 'statusResult' }
  }
});
```

在 Activity 中使用 `GameNetwork.open` 接收的渠道映射注册实际的 `channel.status` 处理器。它接收原字符串，并可将结果字符串交给指定的旧版回调。未注册的操作会报告错误。此适配器覆盖请求和应答，厂商主动推送通知需要单独接入事件。

- HTTP 支持 GET、POST 和 UTF-8 文本或 ArrayBuffer 响应。POST 可发送字符串、ArrayBuffer 或类型化数组，可设置 Content-Type。请求和响应各自沿用原生服务的 32 KiB 上限。Cookie、其他请求头和响应头查询需要项目适配。失败派发 `ioError`，主动取消或关闭后丢弃迟到结果。浏览器对长度可计算的传输派发进度，原生服务在收到完整响应后交付。
- 二进制套接字在连接前设置 `socket.type = egret.WebSocket.TYPE_BINARY`，监听 `egret.ProgressEvent.SOCKET_DATA` 并读入 `egret.ByteArray`。Android 的主机名和端口重载使用 WSS，`connectByUrl` 可传入包含服务端路径的已授权 `wss://` 地址。单条消息上限为 32 KiB，经典适配器最多排队八次写入，超出本地限制时抛出错误。浏览器也支持文本帧。项目原有的鉴权、重连策略和游戏协议继续由业务代码执行。
- 游戏关闭后会停止接收传输结果。服务端已受理的交易仍可能完成，支付等流程仍需沿用原有的请求标识和对账机制。

## 复验

运行 `node --test tests/egret-migrate-transport.test.mjs`。两个宿主共用仓库的[自制经典业务入口](../../../tests/fixtures/migrate-transport/classic.js)，宿主注入两个本地回显端点、一个已注册渠道和结果接收函数。Windows Edge 158 与搭载 Android 17 的 Galaxy Z Fold7 裁剪 V8 播放器均完成一次 HTTPS POST、两次独立 WSS 连接，回收的 12 字节数据逐字节一致，含中文 UTF 字段、0xFF 和结尾的零字节。渠道返回预期中文字符串，游戏关闭后最后一个连接被回收，两个测试服务分别记录到两次打开和两次关闭。本次验证使用自制端点和应用自己的处理器；线上服务、授权厂商 SDK 和运营商网络仍需分别验收。
