# 共享 UI 遮罩与模糊

[English](../../en/docs/shared-ui-effects.md) | 简体中文

M3.4 / [#90](https://github.com/cnedwin/Egret_rebuild/issues/90) · 有界实现

## 使用

创建共享 WebGPU 或 WebGL2 Host 时设置 `enableEffects: true`，在发布托管 UI 内容前设置 `DisplayObject.renderEffect`：

```ts
panel.renderEffect = {
    blurRadius: 2,
    alphaMask: maskBitmap,
    maskRect: { x: 0, y: 0, width: 320, height: 240 },
};
// Remove the effect without changing the display tree or input routing.
panel.renderEffect = undefined;
```

不可变描述接受 0 至 8 的整数逻辑像素模糊半径，省略时为零。遮罩要求在受影响节点局部坐标中提供宽高为正的 maskRect。遮罩 Bitmap 借用同一 Engine 中已有的有效纹理租约，不增加资源加载器或引用计数系统；其自身显示变换、透明度和父节点不参与遮罩定位，只使用纹理 Alpha，不使用 RGB。遮罩若同时加入显示树，不会被自动隐藏。首阶段只准入完整、未裁剪、未旋转的图像视图；裁剪或图集遮罩视图明确拒绝。

效果作用于子树的渲染内容并保留绘制顺序。子节点延续逐次绘制的透明度与材质语义，效果结果使用普通 source-over 合成。隔离组内依赖目标颜色的混合针对组内透明目标执行，不针对外部场景；仅用于不透明输出的 add-preserve 混合在效果组内拒绝。本项不提供背景模糊。

## 渲染与限制

共享执行顺序为：子树绘制到透明、线性预乘 Alpha 工作目标，执行固定的横向和纵向方框模糊，乘以最近邻采样的遮罩 Alpha，应用继承的矩形裁剪，再合成到父目标。中间 sRGB 目标沿用已有硬件解码／写入约定。半径为逻辑半径乘 Host pixelRatio 后向上取整，最大 16 个物理像素；视口外的采样为透明。嵌套效果由内向外执行。这是一种固定卷积核，不代表通用滤镜图或高斯模糊兼容。

每组使用当前表面尺寸。每帧最多八组、四层嵌套，每组最多八个继承裁剪矩形；效果裁剪同时计入调用方既有 maxClipRectangles 限制。每个活动嵌套层需要两个临时／颜色目标，复用 Host 既有保留池。普通工作目标与效果目标合计每次提交不超过 64 MiB，待完成颜色额度不超过 128 MiB。每组 448 字节 uniform 输入计入上传准入；源图像页保留既有预算。奇异或无法表示的坐标映射在原生分配前拒绝。

复用的是目标分配，不是跨帧缓存的效果像素。每次提交仍重新合成效果；本项不宣称静态效果 GPU 时间或帧率改善。既有段落准备和图像驻留仍可复用。

## 所有权、恢复与兼容

捕获结果保存不可变变换、裁剪、参数和图像身份，后续参数修改不会重写旧帧。遮罩替换沿用既有 Bitmap／资源槽语义；遮罩已销毁或租约失效时不能进行新的捕获。效果不扩大命中区域，也不自动提供像素级遮罩命中测试；既有显式命中形状和输入所有者保持权威。

立即提交与暂存提交复用同一 Host 的资源预留、待完成记录和完成后回收机制；取消只退役对应记录。设备丢失使原生代际失效，恢复从同一 CPU 帧和源资源重建效果，不创建第二个管理器。夹具实际触发 WebGL 上下文丢失，并销毁／替换显式持有且借给 Host 的 WebGPU 设备，不使用模拟成功标记。

未开启效果能力时，无效果渲染仍可使用。向未开启 enableEffects 的共享 Host 提交效果会在分配前拒绝；旧 Canvas／普通／textured 捕获遇到活动 renderEffect 明确拒绝，不静默忽略。移除描述后可回到旧路径，不自动降低视觉效果。触摸路由、手势和移动控件未改变。

## 示例与证据

[既有段落 UI 示例](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/paragraph-panel) 支持 `?content=equipment&effects=1&backend=webgl2` 或 `backend=webgpu`。可在普通列和变高列表中切换遮罩、模糊、两者与关闭；切换通过既有 UI 事务同时重新发布两侧。默认示例不开启效果。

[验证摘要](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/paragraph-panel/effects-verification-summary.json) 记录 82 项通过的有界原生／UI 检查：两后端、DPR 1 和 3、独立程序化像素参考（每通道允许误差最大 4）、嵌套效果、变换遮罩、裁剪、暂存上传、取消、热复用、实际原生恢复、清理及既有 UI 替换。参考由矩形、遮罩象限和规定方框卷积独立计算，不以两个后端互相一致代替参考；运行前后核对实际源输入散列。先前失败与通过记录分开保留。

完成普通构建后运行 `node examples/paragraph-panel/verify-effects.mjs <playwright-1.62.1-root> <new-output-directory>`。使用默认无头 Edge，不增加额外启动参数，保存原始像素、截图及源身份。公开行为测试加入普通测试套件；独立评审、完整源码／类型／发布／双语门禁及受保护 CI 仍是单独的交付条件。

本项不关闭完整 M3.4／M4、完整主题控件、IME、无障碍、手机／原生／小游戏支持或性能资格。M1.2 仍为 10.3 ms，对应目标 8 ms。效果代码、程序化遮罩、着色器及数学参考为独立编写的第一方 Apache-2.0 实现；既有已注明来源的段落／字体依赖原样复用。

示例为普通段落预留两个效果组，仅装饰列表的前六个稳定行键。其余行正常绘制，短文本、行数限制及滚动均不会突破八组上限。
