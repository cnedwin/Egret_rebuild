# 实际失败基线

[English](../../en/evidence/asset-reference-red-provenance.md) | 简体中文

运行 `4852e532-7bff-40a8-b13e-dcc29cdb4022`：实际执行 11 项，0 项通过，11 项失败；浏览器 154.0.4258.62。没有页面错误、控制台诊断、导入失败或 404。该运行发生在生产函数实现之前，当时整个生产模块为：

```js
export async function createReferenceChain() {
  throw new Error('Reference chain behavior is not implemented');
}
```

首次沙箱启动因新的 Edge profile 环境权限而在测试开始前失败。这不是行为失败运行，不计入案例数。随后经权限升级的全新 profile 运行实际执行全部案例（`3966c2c1-6a8d-4e80-a47c-5112b35b5bfa`）；仅浏览器默认 favicon 请求产生一条 404 诊断。加入内联空 favicon 后消除了这一无关请求，并在实现前保留上述无噪音失败运行。
