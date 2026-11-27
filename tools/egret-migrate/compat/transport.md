# Classic HTTP, sockets and channel calls

[简体中文](transport.zh-CN.md)

The compatibility bindings expose `egret.HttpRequest`, `egret.WebSocket` and `egret.ExternalInterface` to the game's existing scripts. Requests and socket connections belong to the current game. Closing it cancels outstanding requests, closes its sockets and detaches channel callbacks. Opening another connection on the same socket object after closing starts a fresh session.

## Browser

Converted games use the canvas window's XMLHttpRequest and WebSocket. Browser origin, cookie and TLS policy apply. For a channel SDK, pass its trusted adapter to `launchLegacyWeb(sdk, { ...options, externalChannel })`. Its `call(name, value, signal, dispatch)` forwards an allowed outgoing string and may call `dispatch(callbackName, string)` with a reply. Its optional `subscribe(name, listener)` returns the unsubscribe function for incoming native or browser events. The project supplies the mapping to the actual vendor SDK.

## Android

Enable the Android player's [network provider](../../../runtime-sdk/android/network/README.md) for the project's exact HTTPS and WSS origins. Existing classic request and socket code then uses the provider through these options.

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

Register the actual `channel.status` handler in the Activity via the channel map accepted by `GameNetwork.open`. It receives the original string and optionally resolves to the reply string consumed by the named callback. An unregistered operation surfaces an error. This adapter covers request/reply. A vendor that pushes unsolicited notifications requires a separate event integration.

- HTTP supports GET and POST with UTF-8 text or ArrayBuffer responses. POST accepts text, an ArrayBuffer or a typed array and can set Content-Type. Each request and response is bounded by the provider's 32 KiB limit. Cookies, other headers and response-header inspection require a project adapter. HTTP failure emits `ioError`. A deliberate abort or owner close suppresses late completions. Browser progress events are available for length-computable transfers; the native provider delivers complete responses.
- For binary sockets, set `socket.type = egret.WebSocket.TYPE_BINARY` before connecting, listen for `egret.ProgressEvent.SOCKET_DATA` and read into an `egret.ByteArray`. Android's host/port overload uses WSS. `connectByUrl` takes an allowed `wss://` URL including the server's path. Each message is limited to 32 KiB, and at most eight writes may be queued in the classic adapter. Local overload raises an error. Browser sockets also support text frames. Project-specific authentication, reconnection policy and game protocol remain in the business code.
- A closed game stops observing its transport. An already accepted transaction can still complete at its server. Existing request IDs and application-level reconciliation remain necessary for purchase and payment flows.

## Reproduction

Run `node --test tests/egret-migrate-transport.test.mjs`. The shared first-party classic entry is [classic.js](../../../tests/fixtures/migrate-transport/classic.js). Its host injects two local echo endpoints, a named channel and an observation callback. The same script ran through Windows Edge 158 and on a Galaxy Z Fold7 with Android 17 and the trimmed V8 player. Each host returned the exact 12-byte packet on one HTTPS POST and two independent WSS connections, including a Chinese UTF field, 0xFF and a trailing zero. The channel returned the expected Chinese string and game close retired the second connection. Each test server counted two opened and two closed sockets. These observations cover synthetic endpoints and an app-owned handler. Production service access, licensed channel SDKs and carrier-network behavior need their own acceptance.
