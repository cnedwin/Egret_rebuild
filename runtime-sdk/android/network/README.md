# Android player networking

English | [简体中文](README.zh-CN.md)

Games can fetch a server directory over HTTPS and exchange their original binary packets over WSS. Each enabled player view owns its connections and in-flight requests. The offline player needs no network permission or network JARs.

## Export

List the exact scheme, host and optional non-default port of each origin in `network.json`. The following names are examples. The host uses Android's default TLS trust and hostname checks. HTTP redirects are returned to the caller. The exporter pins the two local JARs and includes their original license files in the app. [Android HTTPS](https://developer.android.com/reference/javax/net/ssl/HttpsURLConnection) · [Java-WebSocket 1.6.0](https://github.com/TooTallNate/Java-WebSocket/tree/v1.6.0) · [SLF4J 2.0.13](https://github.com/qos-ch/slf4j/tree/v_2.0.13)

```json
{
  "schemaVersion": 1,
  "origins": ["https://directory.example.org", "wss://gateway.example.org"]
}
```

Place these Maven Central JARs beside `archives.json`. Other vendor libraries can appear in the same channel manifest. The local exporter and Gradle check the archived bytes. [Java-WebSocket artifact](https://central.sonatype.com/artifact/org.java-websocket/Java-WebSocket/1.6.0) · [SLF4J artifact](https://central.sonatype.com/artifact/org.slf4j/slf4j-api/2.0.13)

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

Both standalone and embedded normal game entry points register `network.request`. The optional export adds `android.permission.INTERNET`. An embedding Activity can construct its own `PlayerNetwork` and register the handler in the player view instead. A new view requires a fresh provider.

## Game API

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

`request` accepts GET and POST. A POST can supply `bytes: Uint8Array` and a MIME type such as `application/json`. The reply contains the HTTP status and raw bytes, including HTTP error bodies. Each body or message is bounded to 32 KiB. Four concurrent HTTPS requests, one live WSS connection, eight queued incoming frames and one waiting reader fit in each session. The sender gets a backpressure error if an earlier frame is still buffered. Incoming overflow closes that connection to avoid silent loss or reordering.

Canceling a pending read withdraws the waiter. The host keeps the oldest message until JavaScript receives and acknowledges its sequence. If cancellation races with a delivery, the next receive can recover the same packet. Reconnecting uses a fresh handle. A stale handle cannot send through the new connection. Closing the view retires all pending work. A successful send reports local queue admission. Games should use their original server acknowledgements for operations such as inventory or payments.

Classic packet handlers can import `ByteArray` and `Endian` from `@egret/legacy/protocol`. Keep the game's field order and byte order. Use `new Uint8Array(writer.buffer)` for `send`, then pass the `bytes` of a received message to `new ByteArray(bytes)`. Set the byte order on the reader before reading numeric or UTF fields.

## Verification

The Java test starts local HTTPS and WSS servers, checks hostname refusal, redirects, cancellation, backpressure, reconnect and closure. Use JDK 17, the two pinned JARs and the desktop-only `org.json:json:20250517` test dependency. Generate a temporary PKCS12 certificate with a SAN for `localhost` using keytool. Compile `PlayerNetwork.java`, the player’s `ProjectHostServices.java` and both Java files under `network/test`. Run `org.egret.runtime.network.PlayerNetworkTest <keystore>` in a separate JVM with that test trust store and its password. Android uses its built-in JSON API. Run `node --test runtime-sdk/project/network.test.mjs` for the JavaScript bridge tests.

A Galaxy Z Fold7 running Android 17 and cropped V8 15.7.112.19 echoed one HTTPS request and two binary WSS messages. A canceled waiting read returned, an unlisted origin was refused, and a stale handle failed after reconnect. The final fixture used the public classic packet codec to encode and decode a 12-byte little-endian message carrying a number, the UTF string “起航” and two binary fields. The peer checked the encoded bytes on both connections. After tapping the embedded Activity’s Close game button, the peer had observed two opens and two closes. This result measures explicit view closure. Android Back alone did not consistently close the root Activity in a separate run. The debug APK trusted an ephemeral certificate only for localhost. Production endpoints, login, multi-device traffic and throughput are still unverified.
