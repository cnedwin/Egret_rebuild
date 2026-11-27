# iOS Runtime SDK 宿主

[English](README.md)

宿主用 JavaScriptCore 运行随应用打包的白鹭 7 游戏场景。Rust 校验输出为不透明画面的 EGR2 帧，处理贴图引用、绘制顺序和物理像素裁剪，Metal 在等比适配的 320 × 192 舞台呈现结果。沿用的场景使用一张 32 × 8 图集驱动 40 张卡片。iOS 独立打包当前覆盖这一类 2D 场景。

## 在 Mac 上构建

需要安装 iOS 模拟器运行时的 Xcode、CMake 3.24 或更新版本、Node 26.7.0、pnpm 11.25.0 及 Rust 1.100.0。示例最低支持 iOS 16.4。在仓库根目录运行，选择新的输出目录。资源准备阶段打包当前编译的引擎并附带发行许可。

```bash
export OUT="$(mktemp -d)"
export RUSTUP_TOOLCHAIN=1.100.0
target=aarch64-apple-ios-sim
[[ $(uname -m) == arm64 ]] || target=x86_64-apple-ios
rustup toolchain install "$RUSTUP_TOOLCHAIN" --profile minimal --target "$target" aarch64-apple-ios
pnpm install --frozen-lockfile --ignore-scripts
node tools/build.mjs
npm install --prefix "$OUT/bundler" --no-save --ignore-scripts esbuild@0.28.2
node runtime-sdk/ios/prepare.mjs --esbuild "$OUT/bundler/node_modules/esbuild" --out "$OUT/scene"
bash runtime-sdk/ios/build.sh simulator "$OUT/build" "$OUT/scene"
bash runtime-sdk/ios/build.sh device "$OUT/build" "$OUT/scene"
```

在 `$OUT/build/simulator/EgretIosPlayer.xcodeproj` 打开 `EgretPlayer` 运行方案。显示循环逐帧读取 JavaScriptCore 实时生成的场景。应用进入后台时释放 GPU 贴图表和渲染器，返回前台时重新创建渲染器并从仍在运行的游戏场景重新发布图集。真机安装前先设置 `EGRET_BUNDLE_ID` 再生成真机工程，打开 `$OUT/build/device/EgretIosPlayer.xcodeproj`，选择开发团队并由 Xcode 签名。脚本生成的真机应用未经签名。

## 验证构建结果

```bash
node --test runtime-sdk/ios/scene.test.mjs
cargo test --locked --offline --manifest-path runtime-sdk/native/Cargo.toml
python3 runtime-sdk/ios/verify-simulator.py --app "$OUT/build/simulator/product/EgretPlayer.app" --out "$OUT/evidence"
node runtime-sdk/ios/check-receipt.mjs "$OUT/evidence/receipt.json"
```

验证器创建临时模拟器并启动应用，读取实测记录。JSC 第 0 帧和第 7 帧的指纹须与原 Node 场景一致。有 Metal 设备时，还核对四个参考像素、动画变化、释放纹理后的缺页错误、重建后逐字节一致的画面，以及系统图层的呈现回调。关闭游戏须退还一张图集。模拟器未提供 GPU 时，记录中会单列该状态。实体 iPhone 签名安装、真实前后台切换、温控和帧时仍需真机实测。

## 原生接口

`runtime-sdk/native/include/egret_frame2d.h` 提供 `egret_frame2d_create/page/decode/destroy`，每个解码器由一条渲染线程持有。贴图成功上传后，使用 1–255 号槽登记尺寸，0 号白色纹理供纯色图元绘制。传入零尺寸释放已登记的槽。顶点和绘制批次由解码器持有，调用方可读取至下次解码或销毁。每个批次含贴图槽、顶点范围、透明度、UV 裁剪和左上原点的物理像素裁剪。解码失败会清空输出视图。

首版 Metal 支持在不透明清屏画面上按常规混合、最近邻采样绘制四边形，可使用半透明贴图、图集裁切和轴对齐裁剪。EGR3–EGR6、文字输入、音频、触屏操作及原生 World3D 尚待接入。示例覆盖保留 JS 游戏期间的渲染资源重建。进程终止后的持久化恢复需另行实现。C 接口沿用白鹭自研 Rust 代码，宿主接入 Apple 系统框架。[JavaScriptCore](https://developer.apple.com/documentation/javascriptcore) · [MetalKit](https://developer.apple.com/documentation/metalkit/mtkview)
