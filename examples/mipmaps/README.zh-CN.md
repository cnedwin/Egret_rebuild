# 多级缩小：比原图画得更小的图片

[English](README.md) | 简体中文

图片画得比纹素小很多时，大部分纹素会被跳过，移动时还会闪出零散的亮点和暗点。材质设置 `mipmapFilter: 'linear'` 后，会改从页面的多级缩小副本采样，并在最近的两级之间混合：

```js
bitmap.sharedMaterial = createSharedMaterial2D({ filter: 'linear', mipmapFilter: 'linear' });
```

上排是一张由单纹素黑白方格组成的页面，缩到约八分之一：先不用副本，再用副本；用副本后是均匀的灰色。下排是一个区域，所在页面上还有一块红色区域，缩到约四分之一：灰色保持灰色，旁边的红色不会渗进来。某帧第一次这样采样一个页面时，引擎会自己生成副本，页面字节约增加三分之一。区域与其他区域共用页面，只读取各边都能整除的副本层级：图集中的区域放在 2、4、8… 纹素的倍数位置上，就能用到更深的层级。规则见[渲染配置契约](../../knowledge-base/Cns/docs/shared-render-profile-contract.md)。

## 运行

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

在服务器打印的地址上打开 `/examples/mipmaps/index.html`。加 `?backend=webgl2` 或 `?backend=webgpu` 选择 Host。

## 检查

```text
node examples/mipmaps/verify.mjs <Playwright index.mjs 的绝对路径> [<新的输出目录>] [software]
```

脚本在两个 Host 上绘制该页面并读取每个方块：用副本时是均匀的灰色，不用时不均匀，区域中没有红色。不加 `software` 时，以有界面方式启动本机安装的 Edge，使用电脑自己的 GPU。加 `software` 时，以无界面软件渲染运行；此时无法绘制的 WebGPU 适配器只记录，不算失败。开发容器中 WebGL2 的软件渲染检查已通过；WebGPU 在该环境丢失设备（main 上同样如此），仍待真机验证。
