# Android 播放器网络接入

[English](README.md) | 简体中文

游戏可通过 HTTPS 获取区服目录，通过 WSS 收发原有二进制协议。每个启用网络的播放器视图独立管理连接和在途请求。离线播放器无需联网权限和网络 JAR。

## 导出工程

在 `network.json` 中列出每个目标的协议、主机和非默认端口。以下为示例域名。宿主沿用 Android 的默认 TLS 信任和主机名校验，HTTP 重定向会作为响应返回。导出器核对两个本地 JAR 的摘要，并将其原始许可证放入应用。[Android HTTPS](https://developer.android.com/reference/javax/net/ssl/HttpsURLConnection) · [Java-WebSocket 1.6.0](https://github.com/TooTallNate/Java-WebSocket/tree/v1.6.0) · [SLF4J 2.0.13](https://github.com/qos-ch/slf4j/tree/v_2.0.13)

```json
{
  "schemaVersion": 1,
  "origins": ["https://directory.example.org", "wss://gateway.example.org"]
}
```

从 Maven Central 获取下列 JAR，放在 `archives.json` 同目录。该清单可同时登记其他渠道库。导出器与 Gradle 各自校验归档字节。[Java-WebSocket 归档](https://central.sonatype.com/artifact/org.java-websocket/Java-WebSocket/1.6.0) · [SLF4J 归档](https://central.sonatype.com/artifact/org.slf4j/slf4j-api/2.0.13)

```json
{
  "schemaVersion": 1,
  "libraries": [
    {
      "file": "Java-WebSocket-1.6.0.jar",
      "sha256": "eae29213e4f16515639c28957200f011b3967fffcada1962cf0255d24919c22f"
    },
    {
      "file": "slf4j-api-2.0.13.jar",
      "sha256": "e7c2a48e8515ba1f49fa637d57b4e2f590b3f5bd97407ac699c3aa5efb1204a9"
    }
  ]
}
```

```text
node runtime-sdk/android/player/create-app.mjs --project <game> --aar <egret-player.aar> --esbuild <esbuild-module> --id org.example.game --network <network.json> --channel <archives.json> --out <new-directory>
```

独立应用和嵌入式游戏的正常入口都会注册 `network.request`。选装网络的工程会增加 `android.permission.INTERNET`。宿主 Activity 也可以自行构造 `PlayerNetwork` 并将处理器注册到播放器视图。每次新建视图使用一个新的实例。

## 游戏 API

```js
import { createPlayerNetwork } from '@egret/android-player-network';

const network = createPlayerNetwork(services.host);
const directory = await network.request('https://directory.example.org/worlds', { signal });
const socket = await network.connect('wss://gateway.example.org/session', signal);
try {
  await socket.send(Uint8Array.of(0, 255, 42));
  const message = await socket.receive(signal);
  if (!message.done) handleGamePacket(message.bytes);
} finally {
  await socket.close();
}
```

`request` 支持 GET 和 POST。POST 可提供 `bytes: Uint8Array` 和 `application/json` 等 MIME 类型。响应包含 HTTP 状态和原始字节，包括 HTTP 错误正文。每个正文或消息上限为 32 KiB。每个会话最多同时处理四个 HTTPS 请求、一个活动 WSS 连接、八个待取接收帧和一个等待读取。前一发送帧仍在缓冲时，新发送会收到背压错误。接收队列溢出会关闭当前连接，防止静默丢包或乱序。

取消尚在等待的读取会撤销该次等待。宿主会保留队首消息，直到 JavaScript 收到消息并确认序号。取消与到包同时发生时，下次读取仍能取到这条消息。重新连接会得到新句柄，旧句柄无法通过新连接发送。关闭视图会回收全部在途工作。发送成功表示已进入本地发送队列；背包、支付等业务仍由原游戏的服务端确认。

经典协议处理器可以从 `@egret/legacy/protocol` 导入 `ByteArray` 和 `Endian`，继续使用游戏原有的字段顺序与字节序。将 `new Uint8Array(writer.buffer)` 传给 `send`。收到消息后用 `new ByteArray(bytes)` 包装字节，在读取数值或 UTF 字段之前设置原有字节序。

## 验证

Java 测试在本机启动 HTTPS、WSS 测试服务，核对主机名错误、禁跳转、取消、背压、重连和关闭。使用 JDK 17、两个指定 JAR 和仅桌面测试所需的 `org.json:json:20250517`。用 keytool 生成含 `localhost` SAN 的临时 PKCS12 证书。编译 `PlayerNetwork.java`、播放器的 `ProjectHostServices.java` 以及 `network/test` 下的两个 Java 测试文件。在独立 JVM 中指定测试信任库和对应密码，运行 `org.egret.runtime.network.PlayerNetworkTest <证书库>`。Android 使用系统 JSON API。JavaScript 侧可运行 `node --test runtime-sdk/project/network.test.mjs`。

Galaxy Z Fold7 的 Android 17 和裁剪 V8 15.7.112.19 已实际回显一次 HTTPS 请求、两次二进制 WSS 消息，验证取消等待读取、拒绝未授权来源、重连后拒绝旧句柄。最终夹具使用公开的经典协议编解码器，写入并读回一个 12 字节的小端包，包含数值、UTF 字符串“起航”和两个二进制字段。对端在两次连接上都核对了完整字节。点按嵌入式 Activity 的 Close game 按钮后，对端累计记录两次建立和两次关闭。这项结果对应显式关闭播放器视图。另一轮仅执行 Android 返回操作时，根 Activity 未能稳定关闭。调试 APK 仅对 localhost 信任临时证书。生产端点、真实登录、多机流量和吞吐仍待验证。
