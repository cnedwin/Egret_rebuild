# 白鹭引擎浏览器单文件

[English](https://github.com/cnedwin/Egret_rebuild/blob/main/tools/browser-distribution/README.md) | 简体中文

这两个包分发白鹭引擎已构建的浏览器脚本，每个包都带 ES 模块和传统脚本。按需导入 UI、文字、Spine、工程服务或其他子模块的项目，使用五个模块包中的相应入口。需要确认源码版本时，查看已安装包的 `package.json` 版本，再打开对应标签的 GitHub 发行页。[发行历史](https://github.com/cnedwin/Egret_rebuild/releases)

| 游戏需要 | 安装 | 模块入口 | 可直接部署的脚本 |
| --- | --- | --- | --- |
| 2D 游戏 | `npm install @egret/2d` | `import { play } from '@egret/2d'` | `egret2d.js` |
| World3D 场景与 2D 界面 | `npm install @egret/3d` | `import { play3d } from '@egret/3d'` | `egret3d.js` |

## 使用构建工具

在以 ES 模块为入口的浏览器应用中选择一个示例。第一个绘制圆形，第二个显示地面和球体。

```js
import { play } from '@egret/2d';

await play({
  width: 480, height: 270, audio: false,
  setup(game) { game.circle(240, 135, 30, 0xff6b6b); }
});
```

```js
import { play3d } from '@egret/3d';

await play3d({
  width: 480, height: 270, audio: false,
  setup(game) {
    game.ground(12, 0x2d6a4f);
    const ball = game.sphere(0.5, 0xe8453c, { y: 1 });
    game.follow(ball, { y: 4, z: 6 });
  }
});
```

## 在普通 HTML 页面加载

将 `node_modules/@egret/2d/egret2d.js` 复制到 HTML 页面旁，然后从全局 `Egret` 启动游戏。

```html
<script src="./egret2d.js"></script>
<script>
  Egret.play({
    width: 480, height: 270, audio: false,
    setup(game) { game.circle(240, 135, 30, 0xff6b6b); }
  });
</script>
```

3D 页面改为复制 `node_modules/@egret/3d/egret3d.js`，用 `Egret.play3d` 调用上面的 3D 示例。直接使用浏览器 ES 模块时，复制对应的 `.mjs` 文件，通过 HTTP 提供，并以相对 URL 导入，例如 `import { play } from './egret2d.mjs'`。发布页面时随文件保留许可和版权声明。

## 一个游戏使用一套引擎

一个项目可以为不同页面或独立入口同时安装这两个包及 `@egret/engine`。每个正在运行的游戏只选择一套入口创建对象。3D 包也包含 2D 的 `play`。把精灵、场景、纹理、资源租约和销毁操作都留在创建它们的同一套引擎中。不同入口间交换关卡 JSON、坐标、标识等普通数据。两种传统脚本都会定义全局 `Egret`，同一页面只加载其中一个。

[Play 指南](https://github.com/cnedwin/Egret_rebuild/blob/main/knowledge-base/Cns/docs/play.md) · [World3D 入门](https://github.com/cnedwin/Egret_rebuild/blob/main/knowledge-base/Cns/docs/play3d.md) · [发行与安装](https://github.com/cnedwin/Egret_rebuild/blob/main/knowledge-base/Cns/docs/release-archives.md)
