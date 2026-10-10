# Actual red baseline

Run `4852e532-7bff-40a8-b13e-dcc29cdb4022`: 11 executed, 0 passed, 11 failed, browser 154.0.4258.62; no page errors, console diagnostics or import/404 failure. It preceded production function implementation. The entire production module at red was:

```js
export async function createReferenceChain() {
  throw new Error('Reference chain behavior is not implemented');
}
```

The first sandbox launch failed before tests due to fresh Edge profile environment permission. It is not a behavioral red run and not included in counts. The following escalated fresh-profile run executed all cases (`3966c2c1-6a8d-4e80-a47c-5112b35b5bfa`); only the browser's default favicon request generated a 404 diagnostic. An inline empty favicon removed that unrelated request and the clean red run above was preserved before implementation.
