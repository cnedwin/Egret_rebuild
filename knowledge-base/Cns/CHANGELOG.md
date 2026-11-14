# 变更记录

[English](../en/CHANGELOG.md) | 简体中文

下列版本号标识工程检查点；工作区包仍为 private、版本 0.0.0，宿主协议为 1.0。各检查点的验收范围以子系统契约和证据为准。

## 滤镜：颜色矩阵、发光、投影和描边 — 2026-11-14

`DisplayObject.renderEffect` 支持 Egret 的二十数 `colorMatrix`、`glow`（对应 Egret 的 GlowFilter，可设 `inner`、`knockout`，带偏移即为投影）以及宽度最多 8 像素的 `outline`。它们在现有效果组中位于模糊之后执行，两个共享宿主都支持：新增一个通道把组的 alpha 横向扩散到临时目标，合成时再纵向扩散，并在所见颜色上应用矩阵，把发光绘制在组的下方或内部。每组 uniform 从 448 字节增至 576 字节，其他上限不变。新示例 `examples/filters` 在无头 Chromium 的软件 WebGL2 中，于六个方块周围各十六处与独立算出的值核对；这里没有在浏览器中绘制 WebGPU。属于 #266。[指南](docs/filters.md) · [示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/filters/README.zh-CN.md)

## 沿用 Egret 名称的混合模式 — 2026-11-14

`DisplayObject.blendMode` 可取 `normal`、`add`、`multiply`、`screen` 或 `erase`，作用于对象及其子对象，除非子对象设置了自己的模式。它就是对象共享材质的混合方式，因此着色会保留。`erase` 是材质合同中新增的混合方式，两个宿主都支持：绘制的内容按其 alpha 从目标中擦除。粒子和位图文字可用 `display.blendMode = 'add'` 发光。新示例 `examples/blend-modes` 在无头 Chromium 的软件 WebGL2 中逐像素与每个公式核对；这里没有在浏览器中绘制 WebGPU。属于 #266。[指南](docs/blend-modes.md) · [示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/blend-modes/README.zh-CN.md)

## 粒子颜色按所见颜色显示 — 2026-11-14

`@egret/engine/particles` 的颜色现在像位图文字的着色一样，以渲染器的线性光照交给渲染器，所以白色粒子纹理显示为所给的颜色；此前着色显示得比所给颜色更浅。这是在浏览器中检查位图文字着色时发现的。属于 #266。[指南](docs/particles.md)

## 位图字体 — 2026-11-14

`@egret/engine/bitmapfont` 是可选入口。`parseBitmapFont` 读取 BMFont 的文本、XML 和 JSON 格式（AngelCode 生成器、Hiero、Glyph Designer 和 Littera 保存的格式），以及 Egret 纹理合并工具写出的帧格式字体，并用各自的代码拒绝无法读取的内容。`layoutBitmapText` 按字体的字距调整、行距和字间距排版，按宽度在空格之后和表意文字之间换行——不在 `，。！？」` 等闭合标点之前换行——并左、中、右对齐。`createBitmapText` 按字体的每一页把文字绘制为一个网格，以所见颜色着色，并在文字或选项改变时重新排版。新示例 `examples/bitmap-font` 用页面绘制的两种字体显示标题、对话框和得分。已在 Node、真实引擎和无头 Chromium 的软件 WebGL2 中验证；没有读取由生成工具本身保存的字体。属于 #266。[指南](docs/bitmap-font.md) · [示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/bitmap-font/README.zh-CN.md)

## 2D 碰撞与简单物理 — 2026-11-14

`@egret/engine/physics2d` 是可选入口。由圆、矩形和凸多边形组成的世界——刚体可以是动态、运动学或静态的——在重力下按固定步长推进，按质量用弹性和摩擦把刚体推开，让堆叠稳定下来，并在速度低于阈值时不再弹起，使静止的东西保持静止。它通知接触的开始和结束（传感器也一样），按层和掩码过滤，并能查询某个点、某个矩形内以及射线上第一个遇到的刚体。`moveAndSlide` 移动角色，使其沿墙滑动而不会穿墙；`addTileColliders` 把网格的实心格子合并成少量静态矩形。刚体不会自行旋转。新示例 `examples/physics-2d` 是一间有弟子、石头、斜坡和池塘的练功房。已在 Node 和无头 Chromium 的软件 WebGL2 中验证；没有运行硬件 GPU 或手机。属于 #266。[指南](docs/physics-2d.md) · [示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/physics-2d/README.zh-CN.md)

## 2D 粒子 — 2026-11-14

`@egret/engine/particles` 是可选入口。发射器按速率、成批或在一段时间内产生粒子；每个粒子在点、矩形或圆内出生，以某个角度和速度出发，在任意步长下都以同样方式受重力和阻力影响，并从出生时的缩放、颜色、透明度和旋转过渡到消亡时的值。一个发射器的粒子在共享渲染器上以一张纹理绘制为一个网格，每次更新重建；同样的种子产生同样的粒子。新示例 `examples/particles` 有燃烧的火盆、飘落的花瓣和点击处迸出的火花。已在 Node 中的真实引擎上和无头 Chromium 的软件 WebGL2 中验证；没有运行硬件 GPU 或手机，目前也还没有加法混合。属于 #266。[指南](docs/particles.md) · [示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/particles/README.zh-CN.md)

## 瓦片地图，以及用 Tiled 制作的地图 — 2026-11-14

`@egret/engine/tilemap` 是可选入口。`importTiledMap` 把 Tiled 以 JSON 保存的正交地图——有限或无限、以数组或不压缩 base64 保存的图块层、地图内或单独文件中的图块集、分组、对象层、属性，以及作为数据的图块动画——读成冻结的数据，并用各自的代码拒绝无法读取的内容。`createTileMap` 用图块集的图片把图块层绘制成网格区块，每个区块每个图块集一个网格，支持边距、间距、翻转和比格子高的图块；可以按格子读取和修改图块，只重新绘制所在区块，并只显示与视野相交的区块。新示例 `examples/tilemap` 让一名弟子在 64×40 格的庭院中行走，并通过相机观看。已在 Node 中的真实引擎上和无头 Chromium 的软件 WebGL2 中验证；示例地图由脚本按 Tiled 的格式写出，不是 Tiled 本身保存的。属于 #266。[指南](docs/tilemap.md) · [示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/tilemap/README.zh-CN.md)

## 2D 相机 — 2026-11-14

`@egret/engine/camera` 是观察 2D 世界的可选视图。它设置装着世界的容器，让世界从相机看的位置呈现出来；可以跟随世界中任意位置的目标，平滑程度与帧率无关，并带有死区；停留在边界之内；围绕视图中心缩放和旋转；平移到某处；沿带种子的平滑噪声震动并逐渐平息；并让世界前后的图层以各自的速度和缩放比例移动。它能双向换算坐标，并判断什么能被看见。新示例 `examples/camera-2d` 让一名弟子在庭院里行走。已在 Node 中用真实显示树验证，并在无头 Chromium 和软件 WebGL2 中验证；没有运行硬件 GPU 或手机。属于 #266。[指南](docs/camera-2d.md) · [示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/camera-2d/README.zh-CN.md)

## 手柄 — 2026-11-14

两个可选入口用于读取手柄。`@egret/engine/input/gamepad` 接收每次查看时手柄的状态，告知每次按下、每次松开以及每个接入或被拔掉的手柄；按键按标准布局中的位置读取，摇杆带有死区。`bindGamepadKeys` 用手柄驱动键盘输入，所以能响应按键的 UI 就能响应手柄：十字键和左摇杆是方向键，在没有控件接收时移动焦点，`a` 是 Enter，`b` 是 Escape，肩键移动焦点，方向在按住时重复。`@egret/engine/web/gamepad` 每帧读取一次网页上的手柄，在页面隐藏或窗口失去焦点时松开所有按键，并能让支持震动的手柄震动。控件示例可以用手柄操作。已在 Node 和无头 Chromium 中用脚本写出的手柄列表验证；没有人握过手柄。属于 #266。[指南](docs/gamepad.md)

## 以流的方式播放长音乐 — 2026-11-14

`mixer.stream(url)` 打开一个边读边播的文件，所以长音乐不会在内存中保留已解码的样本。流和其他声音一样：可以作为音乐，可以渐变、暂停和调节音量。它同一时间只有一个发声位，并自己给出播放位置。在网页上，它是一个被接入音频图的媒体元素；因为输出挂起并不会让它停下，所以只要输出不在运行，适配器就暂停它，并在第一次触碰中启动它。页面在同一轮里隐藏又显示，或游戏在同一轮里暂停又恢复，现在最终都会有声音：即使输出仍在运行，也会请求它再次运行，这样正在途中的挂起就不会成为最后的结果。已在 Node 和无头 Chromium 中用浏览器自己的媒体元素验证；没有运行手机、Safari 或 Firefox。属于 #266。[指南](docs/audio.md#以流的方式播放长音乐)

## 2D 游戏的声音 — 2026-11-14

两个可选入口为 2D 游戏提供声音。`@egret/engine/audio` 是不依赖 DOM 的混音器：从字节解码并计入预算的声音；带有音量、速率、左右平衡、渐变、暂停和播放位置的发声位；同一时间只有一首、并以渐变让位给下一首的音乐；总音量之下若干个有名字的音量；以及让最早的发声位让位的上限。`@egret/engine/web/audio` 是它基于 Web Audio 的后端：在第一次点击、按键或轻触允许页面发声之前，混音器保持锁定；页面隐藏期间保持静音。引擎的 scope 可以拥有混音器和声音。新示例 `examples/audio-mixer` 播放由页面生成的音乐和音效。已在 Node 和无头 Chromium 中验证，并测量了浏览器渲染出的样本；没有任何东西去听扬声器，也没有运行手机、Safari 或 Firefox。长音乐是整体解码的：以流的方式播放不在这一步之内。[指南](docs/audio.md) · [示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/audio-mixer/README.zh-CN.md)

## 从哪个界面示例开始 — 2026-11-14

新增一页，按界面的内容列出各个 UI 示例：控件、文本框、设置、标签页、长列表、行的下拉选择和菜单、多行选择、可排序的表格、树、行囊和按步分配的数量。它说明这些示例的共同点，以及界面完成之前应该检查什么，其中每一条都曾是某个示例里发现的缺陷。只涉及文档。属于 #90。[指南](docs/ui-examples.md)

## 可展开和收起的树，以及标题 — 2026-11-14

语义树新增 `tree`、`treeitem` 和 `heading` 三个角色，并用 `level` 表示项目的深度和标题的级别；`createUiListSemantics` 接受 `role: 'tree'`：显示出来的行就是树的项目，各自带有它说明的深度，以及在同一父项目之下的位置。新示例 `examples/ui-tree` 是一个由堂口、队伍和成员组成的门派，可以用按下和方向键展开、收起，上方有一个标题。已在 Node 和无头 Chromium 的软件 WebGL2 上检查；没有运行读屏软件。属于 #90。[指南](docs/ui-semantics.md#树) · [示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-tree/README.zh-CN.md)

## 可排序的托管列表表格 — 2026-11-14

`createUiListSemantics` 接受 `role: 'grid'` 以及 `columns` 和 `rowOffset`：托管列表的行作为网格的行发布，应用在每一行里添加单元格，并在它们上方添加一行表头，`rowBounds` 让单元格可以根据所在的行来度量。语义树新增带 `sort` 的 `columnheader`；`row` 和 `gridcell` 只有在自己是被选中的对象时才说明 `selected`。新示例 `examples/ui-roster-table` 通过表头按四列对四十名成员排序，并可以选中一行。已在 Node 和无头 Chromium 的软件 WebGL2 上检查；没有运行读屏软件。属于 #90。[指南](docs/ui-semantics.md#托管列表的表格) · [示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-roster-table/README.zh-CN.md)

## 数据源替换之后，滚动到列表当前所在的位置 — 2026-11-14

托管列表的 `setScrollOffset` 会丢弃滚动到列表当前偏移的请求，即使同一轮里还有一次数据源替换在等待提交。列表随后跟随锚点去了另一个偏移，这违反了“显式滚动覆盖锚点保留”的规则：处于顶部的列表在换了新的顺序并被要求留在顶部之后，并没有留在顶部。现在只要还有其他变更待提交，这样的滚动就会被保留。已在 Node 中用真实 Engine 和 UI 根检查。属于 #87。[指南](docs/ui-data-panel.md)

## 单元格网格，以及一个行囊 — 2026-11-14

语义树新增 `grid`、`row` 和 `gridcell` 三个角色，并用 `extent` 表示网格的行数和列数；浏览器投射会连同行列数和序号一起写出它们。新示例 `examples/ui-inventory` 是一个二十四格的行囊：一个键盘停靠点，带有由方向键、Home、End、Page Up 和 Page Down 沿两个方向移动的光标，一个显示光标所在物品的面板，使用、丢弃和整理三个按钮，以及一行 status。已在 Node 和无头 Chromium 的软件 WebGL2 上检查；没有运行读屏软件。属于 #90。[指南](docs/ui-semantics.md#网格) · [示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-inventory/README.zh-CN.md)

## 经过无法获得焦点的按钮时，Tab 可以离开画布 — 2026-11-14

浏览器投射为每个可按下的节点生成一个原生按钮，但只有在节点可以应请求获得焦点时，才把它标记为非 Tab 停靠点。于是被禁用的按钮，或者没有焦点动作的按钮，成了页面的停靠点：过了应用的最后一个停靠点，Tab 落在这个隐藏的元素上，投射又把焦点交还给画布，键盘因此无法离开画布。现在每个原生按钮从一开始就带有 `tabindex="-1"`。在 `examples/ui-multi-select` 和 `examples/ui-tabs` 中，被禁用的按钮也不再是应用的停靠点。已在 Node 中检查，并在无头 Chromium 的软件 WebGL2 上用 Tab 键实际走出画布。属于 #90。[指南](docs/ui-semantics.md#投射)

## 按步改变的数量，以及会被朗读的消息 — 2026-11-14

语义树新增 `spinbutton`、`status` 和 `alert` 三个角色，浏览器投射会写出它们：带有范围、按步改变的数量，以及文字变化时由读屏软件朗读的两种消息。新示例 `examples/ui-stepper` 用范围的按键和两侧的按钮把一个固定的总数分给四个数量，说明还剩多少，并说明某个数量为什么没有增加。已在 Node 和无头 Chromium 的软件 WebGL2 上检查；没有运行读屏软件。属于 #90。[指南](docs/ui-semantics.md#消息) · [示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-stepper/README.zh-CN.md)

## 两个示例的弹出层在第一次打开之前 — 2026-11-14

`examples/ui-dropdown` 和 `examples/ui-context-menu` 中的弹出层原先只在第一次打开时才注册为层。在那之前，它的根只是一个普通的根：被绘制在舞台左上角，它的行也是键盘停靠点。现在两个示例都在开始时以关闭状态注册它，菜单示例的按钮在被禁用期间也不再是键盘停靠点。语义树自始至终是正确的，所以原有的检查没有发现问题；现在检查会在任何东西打开之前读取屏幕角落的颜色，并走一遍 Tab 顺序。只涉及示例。属于 #90。[指南](docs/ui-layers.md#生命周期与示例)

## 行的动作菜单 — 2026-11-14

语义树新增 `menu` 和 `menuitem` 两个角色，`createUiListSemantics` 接受 `role: 'menu'`，于是弹出层里的托管列表会作为菜单告知辅助技术，其中的菜单项可以执行，或说明自己不能执行。新示例 `examples/ui-context-menu` 把这样的菜单挂在滚动名册的行上，用鼠标右键、菜单键、Shift+F10、一个按钮或一次请求打开。已在 Node 和无头 Chromium 的软件 WebGL2 上检查。属于 #90。[指南](docs/ui-semantics.md#菜单) · [示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-context-menu/README.zh-CN.md)

## 字体迟到和主题改变之下持有焦点的编辑器行 — 2026-11-14

一个 CPU 层面的整合用例检查：持有焦点的编辑器行在字体迟到、主题改变，或两者与新的文本值同时发生时，托管列表的各行、焦点、编辑器的文字几何和语义树保持一致。只涉及测试；原生输入元素和真实字体仍需在浏览器中运行。属于 #87。[指南](docs/native-text-editing.md#验证与剩余资格)

## 用 Shift 选中一段行，用 Control+A 选中所有人 — 2026-11-14

在多选示例中，按住 Shift 再按移动键，会选中从离开的那一行到到达的那一行之间的所有成员；Control+A 选中所有在场的人。只涉及示例。属于 #90。[示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-multi-select/README.zh-CN.md)

## 设置示例的存档行可以悬停和按住 — 2026-11-14

`examples/ui-settings` 中存档列表的行在指针下面会变亮，按住时变暗，两套主题都是如此，做法是使用行绑定得到的显示对象。只涉及示例。属于 #90。[指南](docs/ui-controls.md#托管列表的行)

## 在列表中同时选中多行 — 2026-11-14

语义树的列表框接受 `multiple`，`createUiListSemantics` 会把它传下去，所以可以选中多行的列表会被如实告知辅助技术。新示例 `examples/ui-multi-select` 可以通过按下、在获得焦点的行上按空格或辅助技术的请求，从四十名成员中选出任意多人并派出；已经外出的成员是被禁用的选项。属于 #90。[示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-multi-select/README.zh-CN.md)

## 托管列表上手指可以拖动的滚动条 — 2026-11-14

下拉示例的名册有了滚动条，它的滑块可以用鼠标或手指拖动，另有一个 `scrollbar` 节点指明它所滚动的列表。手指仍然不能平移各行，那属于手势；在此之前，手机通过滑块到达列表的其余部分。只涉及示例和文档。属于 #90。[示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-dropdown/README.zh-CN.md)

## 托管列表的行可以悬停和按住 — 2026-11-14

托管列表中一行的绑定会得到 `target`，即这一行的显示对象。悬停控件和动作控件在它上面监听，所以行在指针下面会变亮，按住时变暗，完成一次按下就被激活，与自绘按钮一样。下拉示例用这种方式绘制它的行和选项。属于 #90。[指南](docs/ui-controls.md#托管列表的行)

## 标签页与进度条 — 2026-11-14

语义树新增 `tablist`、`tab`、`tabpanel` 和 `progressbar` 角色。标签说明自己是否被选中，并可以指明它显示的面板；进度条说明工作进行到哪里，或者工作量未知。新示例 `examples/ui-tabs` 把三个标签画成一个选择组和一个键盘停靠点，其中一个面板里有进度条。这些角色不在 #90 的首批控件集合之内。属于 #90。[指南](docs/ui-semantics.md#标签页与进度)

## 列表每一行的下拉选择 — 2026-11-14

新示例 `examples/ui-dropdown` 在滚动的托管列表中被激活的那一行下面打开一个弹出选择层，按下、键盘和辅助技术都可以激活；这一行滚走后它会关闭。为此增加了两处小功能：层管理器的锚点接受 `align: 'start' | 'center' | 'end'`，弹出层可以挂在一行的末尾；`createUiListSemantics` 接受 `hidden`，已关闭的层中的列表不进入语义树。属于 #90。[示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-dropdown/README.zh-CN.md)

## 滑动条：范围内的一个值 — 2026-11-14

`@egret/engine/ui` 的 `createRangeControl` 为应用自绘的滑动条保存范围内的一个值：按在轨道上，值就移到那里，同一个触点可以拖动它，值始终落在范围的步进上。`createControlKeys` 新增 `'range'` 类型，按键与原生滑动条相同；语义树新增 `slider` 角色，投射时带有它的数值和两端。设置示例增加了音量。滑动条不在 #90 的首批控件集合之内，因为设置界面需要它而加入。属于 #90。[指南](docs/ui-controls.md#范围内的一个值)

## 选项组作为一个停靠点，不再移动它 — 2026-11-14

控件示例不再把键盘停靠点从一个选项移到另一个选项。一个组的各个选项放在同一个显示对象里，这个对象就是停靠点，也只做一次按键绑定；选择移动时焦点留在那里，所以按住方向键现在可以连续经过各个选项。指南说明了做法。只涉及示例和文档。属于 #90。[指南](docs/ui-controls.md#按键)

## 把 UI 放在一起的一个设置界面 — 2026-11-14

新增的示例把 UI 的各个部件放在同一个界面上：一个开关、一组选项、一个可以输入中文的文本框、一个主题开关、一个重置前在模态卡片中询问的按钮，以及一个作为键盘单个停靠点的两百项存档托管列表。每个控件都通过同一份状态响应按下、常用按键和辅助技术的请求。切换主题时，自绘控件、各行、文字和未打开的卡片在同一帧内换色。八个场景在无头 Chromium 的软件 WebGL2 上通过；没有运行硬件 GPU、手机、输入法或读屏软件。它不含遮罩或模糊组，也不演练设备恢复。属于 #90。[示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-settings/README.zh-CN.md)

## 托管列表作为键盘的一个停靠点 — 2026-11-14

托管 UI 根的 `keyboard: {input, idPrefix, tabStop}` 让列表的各行成为键盘的一个停靠点。Tab 从上次持有焦点的行进入列表，没有这样的行时从第一个可见行进入，并从那里离开，与原生列表框一致；行与行之间的焦点由应用移动。不提供 `tabStop` 时，每个可见行仍各自是一个停靠点。列表示例已改用它，真实浏览器检查用 Tab 离开画布并回到同一行。属于 #89。[指南](docs/ui-data-panel.md#托管虚拟行的键盘焦点)

## 皮肤为状态给出的名称 — 2026-11-14

`@egret/engine/ui` 的 `selectUiSkin` 给出主题皮肤为控件当前成立的状态所提供的名称。几种状态同时成立时，按玩家读取控件的顺序取第一个：不可用、按住、已设置、获得焦点、被指向；皮肤没有命名的状态落到下一个，最后落到 `default`。控件示例通过它从主题取得颜色，真实浏览器检查读取每种状态实际绘制出的颜色。已在 Node 和无头 Chromium 的软件 WebGL2 中检查。属于 #90。[指南](docs/ui-controls.md#绘制状态)

## 托管 UI 的盒与层的语义 — 2026-11-14

`@egret/engine/ui/semantics` 的 `semanticBoxOf` 度量托管 UI 根所布局的一个盒，因此叶子或整张卡片都可以成为语义树的节点。借助它，层管理器的弹出层或模态层可以描述为对话框，层关闭时隐藏。列表示例新增一张模态卡片：在无头 Chromium 中，浏览器计算出的树此时只有对话框及其按钮，不含它后面的列表；卡片关闭后焦点回到原来的行。没有运行读屏软件。属于 #90。[指南](docs/ui-semantics.md#托管-ui-的盒与层)

## 托管列表各行的语义 — 2026-11-14

`@egret/engine/ui/semantics` 的 `createUiListSemantics` 让语义树与托管 UI 的虚拟列表保持一致：列表一个节点，每个可见行一个节点，带有它在舞台上的位置和在全部记录中的序号。持有焦点的行就是获得焦点的节点；滚走的行连同它的节点一起消失，所以投射永远不会指向一个不存在的元素。新增的示例列出五万行，只发布可见的八行。已在真实 UI 根上检查，并对照了无头 Chromium 计算出的列表框；没有运行读屏软件。属于 #90。[指南](docs/ui-semantics.md#托管虚拟列表)

## 控件的常用按键 — 2026-11-14

`@egret/engine/ui` 的 `createControlKeys` 在获得焦点的显示对象上绑定自绘控件的常用按键：按钮、开关和文本框是空格或回车，松开时生效；多选一是方向键、Home 和 End；滚动位置在此之外还有 Page Up 和 Page Down；移动是方向键和 W A S D 键位。按住的键会被报告，可以据此绘制；按住期间失去焦点不产生激活；更靠近焦点处已接管的键不再处理；滚动到头后把按键交还给页面。三个控件示例都已改用它。已在真实 Engine 上以及无头 Chromium 的软件 WebGL2（美式布局）中检查；没有运行实体键盘、其他布局或读屏软件。属于 #90。[指南](docs/ui-controls.md#按键)

## Spine 替换会保留进行中的混合 — 2026-11-14

Spine 重置槽的 `requestPreserving` 不再拒绝正从一个动画混合到另一个动画的播放器。轨道仍在混合退出的条目与当前条目一起被保留：每个混合进行到哪里、每个被混合的旋转朝哪个方向转，以及条目保持的内容。使用相同资源时，副本在之后的每个 tick 都处于原播放器的姿态，这在七种混合、每种九个替换时刻上得到验证。资源现在还必须包含那些只是正在混合退出的动画。已经结束的动画留在骨骼上的值仍然不保留，文档现已写明。这条路径的硬件和 WebGPU 行仍未运行。[指南](docs/spine-reset-slot.md#保留播放)

## 跳转中的物理 — 2026-11-14

跳转测试旁新增了一个带物理约束的原创 Spine 夹具。六项用例表明约束确实被模拟并且记得之前发生的事，固定了把一次推进切成六十分之一秒并把较短余数放在最后的规则，并确认带物理时跳转与直接运行相等：在每一步的结尾、每一步之内、当前时间之后，以及经过重置槽创建的实例。代码没有改动。夹具不是编辑器导出文件，也没有使用独立参考。[指南](docs/spine-seek.md#物理)

## 从干净消费者打开页面 — 2026-11-14

`tools/verify-clean-consumer-page.mjs` 从干净消费者检查结束的地方继续：它只对消费者目录提供服务，写入一个通过 import map 导入已安装引擎的页面（import map 根据已安装各包的清单生成），并在真实浏览器中打开。页面绘制一个按钮并响应一次注入的按下，Host 回读的帧会被检查。它在无头 Chromium 的软件渲染下用 WebGL2 通过，128 个请求全部留在消费者内部。WebGPU、硬件 GPU 和其他浏览器都没有打开过它，其中的时间是一次运行的观察值，不是预算。[指南](docs/clean-consumer.md#从消费者打开页面)

## 基于平台文字输入的文本框控件 — 2026-11-14

`@egret/engine/ui` 的 `createTextFieldControl` 保存应用所绘文本框的文字以及它是否正在编辑。完成一次按下、按键或辅助技术的请求，都会在应用指明的位置上方打开编辑器；平台文字输入原样就是这样一个编辑器，因此玩家用平台自带的输入法在自绘文本框里输入中文。多个文本框共用一个编辑器，取消的编辑不改变文字，长度上限按读者的方式数字符。新增的示例绘制了由两个文本框和一个按钮组成的表单。其中的输入法组字通过 Chromium 的协议驱动，没有运行真实输入法、屏幕键盘或真人操作。[指南](docs/ui-controls.md#文本框)

## 自绘界面的语义 — 2026-11-14

`@egret/engine/ui/semantics` 保存一棵描述应用所绘控件的树：每个控件的角色、名称、范围和状态，在每次发布时从控件读取，并带有按下和按键已经触达的激活与聚焦请求。`@egret/engine/web/semantics` 把它投射到页面：键盘仍属于画布，画布拥有一个覆盖在各控件上方的不可见元素容器，并把持有焦点的元素指明为活动后代。模态对话框让其外的一切变为 inert。控件示例现在描述了它的开关、选项和按钮。投射对照无头 Chromium 的无障碍树做了检查，没有运行读屏软件、其他辅助技术或其他浏览器。[指南](docs/ui-semantics.md)

## Spine 实例的分阶段跳转 — 2026-11-14

`instance.seek` 把 Spine 实例移到另一个已用时间。播放在一个私有副本上从设置姿态重建：按有上限的分片重放实例接受过的命令和增量，提交之前实例不受影响。事件默认不派发；向前跳转可以重放事件，数量有上限，且只在成功之后派发。历史有上限，超出后被丢弃，此后的跳转会被拒绝。出错的实例可以通过跳转到它最后发布的时间恢复。测试使用原创的数值夹具，其中没有物理约束。[指南](docs/spine-seek.md) · [#84](https://github.com/cnedwin/Egret_rebuild/issues/84)

## 视口的滚动位置 — 2026-11-14

`@egret/engine/ui` 的 `createScrollControl` 保存应用自己绘制的裁剪视口在一个轴上的偏移。滚轮经悬停输入滚动它，只有偏移确实移动时才被消费，所以内层视口会把滚轮向外交，最外层交给页面。一个触点可以拖动滚动条滑块，`line`、`page`、`toStart` 和 `toEnd` 供按键使用。悬停示例的列表现在用它滚动。用手指平移内容属于手势，本控件不识别。[指南](docs/ui-controls.md#滚动位置) · [#90](https://github.com/cnedwin/Egret_rebuild/issues/90)

## 控件的悬停、开关和多选一状态 — 2026-11-14

`@egret/engine/ui` 在移动和动作控件之外新增 `createHoverControl`、`createToggleControl` 和 `createSelectionGroup`。它们保存应用自己绘制的控件的状态：鼠标或手写笔在目标或其后代上时的悬停、是否选中，以及若干键中被选中的一个并可在可用项之间移动。按键走的是指针所走的同一批方法。悬停输入现在会指明 enter 和 leave 的另一端（`related`），并接受后加的观察者。新增的指南说明了全部五个控件。检查包括真实 Engine 上的单元测试，以及无头 Chromium 软件 WebGL2 中注入输入的真实页面；目前不向辅助技术通报任何内容。[指南](docs/ui-controls.md) · [#90](https://github.com/cnedwin/Egret_rebuild/issues/90)

## 悬停与滚轮路由 — 2026-11-14

两个可选入口在显示树上路由悬停和滚轮。`@egret/engine/input/hover` 是逻辑输入；`@egret/engine/web/hover` 监听画布，并与触点适配器共用它。目标能得知鼠标或手写笔进入、在其上移动或离开，每次离开都带原因；滚轮交给它下面的对象，页面是否滚动由应用选择的策略决定。检查包括真实 Engine 上的单元测试，以及无头 Chromium 软件 WebGL2 中注入输入的真实页面。没有使用真实的鼠标、手写笔或触控板，也没有在硬件 GPU、WebGPU、Safari 和 Firefox 上运行；托管控件尚未使用它。[指南](docs/pointer-hover.md) · [#89](https://github.com/cnedwin/Egret_rebuild/issues/89)

## 默认引擎的干净消费者检查 — 2026-11-14

`tools/verify-clean-consumer.mjs` 用固定版本的 pnpm 打包默认引擎的三个包，安装到仓库之外的新工程并在那里使用。未经修改的公开示例可以运行，23 个入口都从已安装的副本解析并加载，最小路线不加载 Web、3D 或可选模块，严格的 TypeScript 消费者可以编译。检查在 Node 中进行。这些包仍未发布，从消费者一侧的浏览器运行、首次可交互和真人演练仍然开放。[指南](docs/clean-consumer.md) · [#93](https://github.com/cnedwin/Egret_rebuild/issues/93)

## 换装工作室打开工程 — 2026-11-14

换装工作室可在运行中的页面内打开已导出的工程。文件先在当前工程的副本上准入，并作为一次编辑事务写入，角色的稳定 ID 不变。新配色在加载并由 Host 接收期间保留原画面，随后工程、角色和列表一起切换。被拒绝的文件、加载失败或取消都不改变任何东西。新增浏览器验证的 WebGL2 各项已在软件渲染的无头 Chromium 上通过；WebGPU、硬件和手机各项尚未运行。[#91](https://github.com/cnedwin/Egret_rebuild/issues/91) · [换装工作室](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/outfit-studio/README.zh-CN.md)

## SharedFrame2D 与渲染诊断 — 2026-11-14

SharedFrame2D 成为 WebGPU 和 WebGL2 的公共 2D 帧路径。旧 Canvas Host、旧帧捕获及早期 scene3d Host 已退役。共享路径已支持保持顺序的跨纹理页合批，以及稳定命令、打包和批次复用。集成像素对比使用软件渲染。可选调试面板和 GPU 计时工具报告各自可用的计数与时间来源。 [#187](https://github.com/cnedwin/Egret_rebuild/pull/187) · [#188](https://github.com/cnedwin/Egret_rebuild/pull/188) · [#190](https://github.com/cnedwin/Egret_rebuild/pull/190) · [#193](https://github.com/cnedwin/Egret_rebuild/pull/193)

## 保留播放的 Spine 替换 — 2026-11-14

Spine reset 槽新增 `requestPreserving`。新资源版本在候选被捕获时，从播放器所处的位置接续每条轨道的动画和队列，以及皮肤、速率、暂停和位置。资源必须以相同名称包含每个被保留的动画，长度和事件时间表相同；无法延续播放的资源在发布前被拒绝，正在混合的播放同样被拒绝。保留后的播放器已逐 tick 对照被替换的播放器检查，示例在软件渲染的无头 Chromium 上通过了 WebGL2 浏览器验证。WebGPU、硬件和手机各项尚未运行。[#86](https://github.com/cnedwin/Egret_rebuild/issues/86) · [契约](docs/spine-reset-slot.md#保留播放)

## 画布原生文字输入 — 2026-11-14

可选浏览器适配层在游戏画布上方放置原生文本框。测试覆盖公开 API 行为及 Chromium 协议驱动的组合输入示例。托管编辑仍作为独立路径提供。此适配层的实体输入法、移动软键盘、Safari 和 Firefox 仍待验收。 [#195](https://github.com/cnedwin/Egret_rebuild/pull/195)

## PC 与 Android 的有限图形观察 — 2026-11-13

World3D WebGL2 阴影图集与帧统计在硬件 Edge 及一种 Android Chrome 配置上完成检查。SharedFrame2D 冷纹理与附件改动另有硬件 Edge 成对像素对照、选定 Android 生命周期与计时记录。两份结果分别绑定各自的源码、负载及图形适配器。 [#179](https://github.com/cnedwin/Egret_rebuild/pull/179) · [#185](https://github.com/cnedwin/Egret_rebuild/pull/185)

## World3D 玩法物理与渲染 — 2026-11-13

自动实例化合并兼容的绘制项，拾取层级加速稠密网格查询。物理增加形状扫掠、组合刚体、接触报告和求解器改进，并提供布娃娃、街机式载具、绳索、布料和消息端口辅助组件。最新 PR 记录了 27 项无头软件渲染 WebGL2／WebGPU 固定对比，以及使用 MessageChannel 和 Node 工作线程的远程测试。浏览器 Worker、实体设备和性能仍待验收。 [#163](https://github.com/cnedwin/Egret_rebuild/pull/163) · [#166](https://github.com/cnedwin/Egret_rebuild/pull/166) · [#167](https://github.com/cnedwin/Egret_rebuild/pull/167) · [#168](https://github.com/cnedwin/Egret_rebuild/pull/168)

## Windows 合并检查并行化 — 2026-11-13

一个 Windows 作业执行结构和发布检查，四个独立测试分片在同一候选上覆盖完整套件。#164 合并前的最终托管运行从创建到完成用时 13 分 12 秒。 [#164](https://github.com/cnedwin/Egret_rebuild/pull/164) · [托管运行记录](https://github.com/cnedwin/Egret_rebuild/actions/runs/43294257120)

## World3D 角色、地形与特效 — 2026-11-12–13

系列交付涵盖角色控制、资源解码、导航、地形与水面、蒙皮人群和特效。该系列最后一个检查点在 Windows Edge 通过 25 项固定 WebGL2／WebGPU 离屏对比，以及两个后端各自的软粒子深度检查。 [#154](https://github.com/cnedwin/Egret_rebuild/pull/154)–[#159](https://github.com/cnedwin/Egret_rebuild/pull/159) · [#161](https://github.com/cnedwin/Egret_rebuild/pull/161)

## 固定桌面渲染 CPU 目标 — 2026-11-12

Windows E20 的全脏 Engine p95 中位数达到 5.3 ms，三种状态均达到 CPU 与准备目标。稀疏和全脏帧节奏仍超出目标，GPU 时间未测。[#153](https://github.com/cnedwin/Egret_rebuild/pull/153)

## World3D 渲染、物理与展厅 — 2026-11-12

新增可选独立 3D 场景图及渲染器，接入 glTF、光照阴影、后处理和物理，提供功能展厅与固定 CPU 回归负载。各后端的功能与已验证环境见 [World3D 契约](docs/world3d.md)。[#147](https://github.com/cnedwin/Egret_rebuild/pull/147) · [#148](https://github.com/cnedwin/Egret_rebuild/pull/148) · [#149](https://github.com/cnedwin/Egret_rebuild/pull/149) · [#151](https://github.com/cnedwin/Egret_rebuild/pull/151) · [#152](https://github.com/cnedwin/Egret_rebuild/pull/152)

## WebGL2 等距地图 — 2026-11-12

独立示例使用白鹭公开接口展示网格移动、碰撞、深度排序及有界帧提交。 [#136](https://github.com/cnedwin/Egret_rebuild/pull/136)

## 共享几何构造 — 2026-11-11

减少 Spine 角色逐帧构造共享几何的开销，保留输入复制、数值校验和身份规则。桌面双后端及一部 Android 真机的短时对照显示动画阶段下降，正式帧间隔、CPU／GPU 和设备目标仍待验收。 [#140](https://github.com/cnedwin/Egret_rebuild/pull/140)

## 序列播放状态保留 — 2026-11-11

兼容 ContentLoader 资源的逐帧时间边界完全一致时，替换会延续播放位置、循环、速率、暂停状态与标记序号。双浏览器后端通过有限像素和生命周期检查，Spine 状态保留仍待交付。 [#139](https://github.com/cnedwin/Egret_rebuild/pull/139)

## 共享裁剪优化 — 2026-11-11

WebGPU 和 WebGL2 复用完全包含的多边形，沿用原预算计费与相交裁剪。固定场景短时对照记录 Host p95 的变化，完整 M4 验收仍开放。 [#138](https://github.com/cnedwin/Egret_rebuild/pull/138)

## 固定换装负载与多点触摸 — 2026-11-11

同一换装工作室运行固定桌面和移动档位，并记录两后端桌面计时及 Android 受控多触点结果。正式帧间隔和触摸响应目标仍待验收。 [#137](https://github.com/cnedwin/Egret_rebuild/pull/137)

## 可编辑换装工作室 — 2026-11-07

同一个 Engine 组合独立 Spine 实例、序列动画、托管 UI 与不透明 3D 背景。桌面双后端验证精简场景、替换路径和冷启动开销。 [#135](https://github.com/cnedwin/Egret_rebuild/pull/135)

## UI 弹出层与模态层合成 — 2026-11-07 · [#134](https://github.com/cnedwin/Egret_rebuild/pull/134)

新增可选根级弹出层与模态层、分阶段发布、裁剪锚点、指针屏障及键盘和原生编辑交互资格的包含与恢复。现有表单整合草稿重命名，继续共享字体和生命周期。桌面证据、首次锁屏拒绝、两项真实手机失败及最终32项当前设备观察分别记录。程序化回退不再激活后台编辑器，宽度重建先结束组合输入再保存重命名模型。完整 M3.4、语义、触摸贡献及 M1.2 继续开放。[契约](docs/ui-layers.md)。

## Android 原生编辑与响应式表单 — 2026-11-07 · [#133](https://github.com/cnedwin/Egret_rebuild/pull/133)

修复取消后的终止组合回调，保留活动会话重入拒绝。既有表单按宽度／启动 DPR 响应，并独立退役界面 Scope，固定夹具保持不变。记录三星实际键盘、两后端最终源码生命周期及桌面检查，区分前序复用与失败边界。见[证据及剩余资格](docs/android-native-text-editing.md)。

## 产品／核心路线统一——2026-11-07

将当前能力与完整产品需求及原 M2–M4 工作包统一，整理白皮书、工程／交付计划和导航。下一阶段优先原生编辑、同一混合参考及剩余内容／动画，保留触摸边界、M1.2 失败和设备／素材限制。可选 Spine／CanvasKit 实现替代过时的无播放器／无 provider 表述。不改变引擎行为、验收目标、依赖或历史回执，参见[工程计划](docs/工程规划.md)。

## Android 内存口径与生命周期 — 2026-11-07

精确目标诊断区分缓存的 performance.memory 读数、活跃 JS 和 backing storage；段落、序列与 Spine 示例补充两后端有限 Android 生命周期／恢复证据，历史 41.4 ms 触发条件仍未复现。不宣称引擎修复或完整 M4／M1.2 验收。见[补充验证](docs/android-device-validation.md#回调内存与生命周期补充验证--2026-11-07)。

## Android 装备字体选择 — 2026-11-06

段落示例按捕获的字体组生成装备样式范围，保留默认夹具，并支持候选组实际注册的 CJK 别名。真机失败、短路径复现和指定后端检查分别记录；核心准入和预算不变。见 [Android 组件验证](docs/android-device-validation.md)。完整 M4 与 M1.2 验收保持 OPEN。

## 可选 Spine 资产 — 2026-10-30

固定官方 Core 4.3.13，通过既有资源与 Scope 读取 JSON 设置资产及原始多页图集。可选 SDK 保留明确许可条件和不可变信息；完整播放、图形、稳定素材集与独立参考继续开放。 [SDK](docs/spine-content-ingress.md).

## 段落对齐与行数限制 — 2026-10-29

只读段落新增左／右／居中／start／end／两端对齐及固定省略号的 maxLines。硬换行／空白行溢出显示省略号，过窄时明确拒绝且保留已提交内容；继续复用既有 UI 几何与资源所有权。见[布局契约](docs/paragraph-layout-controls.md)。针对性 36 项及每后端 20 项实际浏览器检查属于有限功能证据；完整 M3.2、设备、IME 和性能继续 OPEN。

## 最终行双向排版 — 2026-10-29

可选段落运行库在换行后应用原生逐行 L1／L2，绘制、几何与命中共享 canonical 字形存储。有限原生及实际浏览器检查覆盖重置空格、控制逻辑槽和宽度恢复；完整 M3.2、设备与性能验收仍未完成。见[行契约](docs/paragraph-line-bidi.md)。

## M2.2 序列帧控制 — 2026-10-23

可选动画入口增加倍率、有限总播放次数、有序标记以及显式静默／重放跳转，共享既有时钟和资源所有权。新旧播放不能同时占用同一个 Bitmap。参见[序列帧控制契约](docs/sequence-controls.md)。完整 Spine 与 M2.2 验收仍然开放。

## M3.1 完整提交的 UI 面板 — 2026-10-23

M3.1 增加托管 UI 根、显式 prepare/commit、自动行列布局、稳定键变高列表和有界异步行复用。多个面板复用现有渲染器、输入路由和资源所有者。详见[UI 面板契约](docs/ui-data-panel.md)。完整控件、段落文字、焦点／IME、手势、移动端资格与性能验收继续开放。

## M2.1 内容构建基础 — 2026-10-23

M2.1 增加经过字节验证的 PNG／图集／序列帧构建、持久缓存复用、依赖失效和通过现有项目事务采用的不可变代次，保留源文件与旧代次。参阅[内容构建契约](docs/content-build-pipeline.md)。完整 Spine、字体和目标变体继续开放。

## M3.3 多触点基础 — 2026-10-23

M3.3 增加可选 DOM-free 触点路由及 Engine／浏览器入口，支持独立多触点会话、捕获、取消，以及视口和生命周期清理。附双区域示例与可复现桌面采集器，定向回归通过 176 项。参阅[契约与证据](docs/multi-pointer-input.md)。完整 M3.3 焦点／IME、M3.4 手势及 Android／iPhone 真机验收继续开放。

## M1.2 准备阶段后续优化 — 2026-10-21

有界裁剪校验与矩形复用、同槽缓存查找、角点临时数组减少及已包含边处理，减少重复准备工作，同时保留原有工作预算和失败顺序，不改变公开 API。候选的原生预检、像素及操作计数已通过，每帧 draw 仍为基线 991、候选 155。此前正式计时未达到目标；最新诊断因前台窗口切换中断，尚无有效候选成对计时或新一轮正式计时结果。M1.2 验收继续开放；参阅[验证记录与边界](docs/incremental-frame-preparation-evidence.md)。

## M1.5 交付 — 2026-10-21

资源清单、依赖感知的共享加载、分阶段上传及统一 WebGL2/WebGPU 恢复已通过 [PR #79](https://github.com/cnedwin/Egret_rebuild/pull/79) 交付，main 为 `4924b471b52927184252191055f902c30c29af52`。[CI 执行 39455045264](https://github.com/cnedwin/Egret_rebuild/actions/runs/39455045264) 的四个作业全部成功。Windows 完整集成门禁通过 290 项发布检查、4,528 项核心测试和 160 项 Spine F2 测试，各组失败、取消和跳过均为零。

固定 C7 七案以及二十四个受影响的浏览器套件（三十六次调用）均已完成实际执行与独立评审。M1.2 正式成对性能及外部平台/设备验收继续开放。[验证记录](docs/resource-recovery-evidence.md)保留较早截止点与本地失败执行，并另行记录此次完成的交付。

## M1.5 资源恢复验证 — 2026-10-20

M1.5 增加资源清单、依赖感知加载和共享资源所有权，支持有界加载与完整性校验、分阶段上传，以及统一的 WebGL2/WebGPU 恢复。Windows / Chrome for Testing 157.0.8103.6 上的七项固定恢复验证及受影响的浏览器回归均已通过独立评审。WebGL2 与 WebGPU 各完成 100 次资源循环、十次原生丢失与恢复循环及 30 分钟前台运行。在此验证截止点，最终工作包评审、M1.5 受保护合并门禁与 M1.2 正式性能验收仍待完成。参阅[验证记录](docs/resource-recovery-evidence.md)。

流程简化已单独通过 [PR #78](https://github.com/cnedwin/Egret_rebuild/pull/78) 合并。交付情况以仓库的 [PR 记录](https://github.com/cnedwin/Egret_rebuild/pulls)为准；较早条目保留各自记录截止点。

## M1.3 候选 — 共享纹理页与渲染

显式共享配置分离源页、逻辑纹理区域、材质状态和已完成帧身份。多个图集区域共享规范化上传，裁边/旋转、九宫格、明暗双色、有序边界和有界目标复用共同支撑复杂 2D 界面。有限线性 B1 路径先合成不透明 3D 与共享 UI，最后统一转换一次输出；既有颜色配置继续保留。

100 项聚焦检查、24 项类型负例，以及固定桌面矩阵中的 30 个正常场景和 11 组三段数值反例，均在记录范围内通过。完整回归和受保护集成仍待完成。参阅[契约](docs/shared-render-profile-contract.md)与[结果及限制](docs/shared-rendering-evidence.md)。这些结果不构成性能、手机或完整 Spine 声明。

## M1.2 功能已交付 — 增量有序帧准备

已通过 [PR #74](https://github.com/cnedwin/Egret_rebuild/pull/74) 合并，主干提交为 `9f899dbe92c5e4d448d3408c3dca2f4c9ade847f`；正式性能验收仍开放。下文早期候选观察保留各自记录截止点。

M1.2 复用未变化的显示变换、裁剪和已准备几何，并在保持绘制顺序及公开 API 的前提下合并相邻兼容绘制。当前资源仍执行完整准入，保存帧保持与后续修改隔离。固定原生操作场景记录的每帧 draw 为基线 991、候选 155。

参阅[契约](docs/incremental-frame-preparation-contract.md)及[验证记录与边界](docs/incremental-frame-preparation-evidence.md)。操作计数不能证明耗时提升。在该早期截止点，基线在固定预热中达到两帧在途上限。后续完成的计时及当前候选状态另见上文，M1.2 性能验收继续开放。完整发布门禁和仓库交付分别记录。

## M1.1 已交付 — WebGPU 提交复用

已通过 [PR #73](https://github.com/cnedwin/Egret_rebuild/pull/73) 合并，主干提交为 `fa88111f5e73503e1804f92a9f444207110b773c`。早期证据保留原记录截止点；仓库交付不扩大其性能或平台支持声明。

M1.1 增加安全完成后的顶点、索引、uniform 缓冲复用及完整键绑定复用，并省去已覆盖热图像的裁剪复制。有限缓存保留原准入规则、绘制顺序与公开 API。参阅[契约](docs/warm-submission-contract.md)及[当前证据](docs/warm-submission-evidence.md)。实际操作计数、原生图像验证、性能与仓库交付分别验收。

## 0.61.0 — 实验性 WebGPU 图像驻留

**0.61.0 工程预览**增加由各 WebGPU Host 独立管理的内部图像缓存，复用已安全完成的精确裁剪 GPU 图像。LRU 机制维持 32 MiB 逻辑图像池和最多 256 个可复用条目，保留原公开准入、渲染模式与生命周期管理，不增加公开 API 或依赖。

参阅[契约](docs/gpu-image-residency-contract.md)及[证据与限制](docs/gpu-image-residency-evidence.md)。受控规格/所有权结果和实际当前桌面回归结果具有各自范围。新增缓存专用浏览器矩阵延期并保持 OPEN。物理 GPU 内存、性能、目标设备与实际 device-loss 恢复仍未验证。工作区包仍为 private、版本 0.0.0，Host 协议仍为 1.0。

## 0.60.0 候选 — 图集导入规划

**0.60.0 工程预览**增加可选 `@egret/project/atlas` 入口，以一个显式 PNG 绑定规划严格单页 Aseprite stable-marker JSON-array。两个运行时值与十六个擦除类型为既有 SpriteSheet、SequenceClip 工厂生成自有、冻结的输入。精确 profile 为 `aseprite-json-array-1.3.18.6-v1`；exporter 输出兼容性、声明 hash 与许可资格仍未验证。

参阅[契约](docs/atlas-import-plan-contract.md)及[证据与限制](docs/atlas-import-plan-evidence.md)。

已独立接受的保存结果分别为聚焦 planner 47/47、较早正常 SDK 核心 3625/3625 与单独 F2 160/160，以及独立 CPU firstGREEN 5/5；这些重叠范围不相加。独立审查还接受所选新增 Native Canvas/WebGPU 四次读回结果。最终集成门禁/prepush 及 0.60 Git/远端交付仍待完成。工作区包仍为 private、版本 0.0.0，Host 协议仍为 1.0。

## 0.59.0 交付更新

前一 0.59 增量已通过 [PR #48](https://github.com/cnedwin/Egret_rebuild/pull/48) 交付，Main 为 `44f49f9d97a7baebc400fd4940541529dc33d147`。较早 0.59 读物和证据保留原编写截止点，新增交付说明不改写它们。未报告远端 status 或 check run，不据此推断 CI 通过。

## 0.59.0 候选 — 标准化图集帧 — 2026-10-17

现有 SpriteSheet 与 SequenceClip 工厂的显式 `'trim-rotation-v1'` profile 支持带透明裁边和顺时针90度打包的单页帧。拥有的 layout 通过 Bitmap 和现有序列播放保留逻辑尺寸与放置，默认矩形路径保持兼容。参阅[契约](docs/atlas-frame-layout-contract.md)、[证据与边界](docs/atlas-frame-layout-evidence.md)和[示例指南](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/trimmed-atlas-playback/README.md)。

已获独立接受的十二阶段 SDK `node tools/verify.mjs` 运行通过 **3559/3559 项核心测试**及单独的 **160/160 项 Spine 实验测试**，两套的 failed/cancelled/skipped/todo 均为 **0**。单独的桌面 Canvas 与纹理 WebGPU 验证通过六个全新上下文和 30 次零容差完整 RGBA 读回，包括指定突变对照及原资源退役后的重放。当前验证器增加了第十三个图集源码边界阶段；截至本次编写，完整重跑、最终公开内容/prepush、0.59 Git 交付与远端 CI 仍待完成。此前失败与修复保留在所链接证据中。exporter 导入、多页、pivot/nine-slice 导入、动画 retarget、controller seek/rate/events、完整 Spine R020/V020、迁移 R008/V006 以及物理设备/性能接受保持 OPEN。

## 0.58.0 — Bitmap 原子绑定与组合换装

工程预览 **0.58.0** 增加 `Engine.captureBitmapBindings(scope, targets)` 及擦除类型 `BitmapBindingTicket`。组合换装示例等待两张服装纹理全部就绪，再同时提交两个图层的绑定。请求等待、失败、取消或被后续请求替代时保留可用服装；票据拒绝覆盖调用方之后设置的绑定。

已记录的桌面 Canvas 与 WebGPU 检查通过六个独立上下文，保留 54 份原始 RGBA 读回，覆盖独立的旧图层对照、真实鼠标选择、动画边界，以及原始读取尚未结束时关闭。该结果只适用于有限桌面范围；通用依赖清单、更多内容类型、完整 UI、Spine、生产宿主、移动性能和物理内存验收仍保持开放。

参阅[规格](docs/prepared-resource-groups-spec.md)、[证据与边界](docs/prepared-resource-groups-evidence.md)及[示例指南](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/prepared-resource-groups/README.md)。

## 0.57.0 — 真实资源场景集成

工程预览 **0.57.0** 通过既有公开 Engine API，组合真实 PNG 资源、共享图集播放、文本与鼠标输入。默认使用 Canvas，纹理 WebGPU 场景作为显式选择的实验路径。资源准备、画面就绪、输入就绪及安全关闭具有各自边界。参阅[集成记录](docs/resource-scene-integration.md)和[示例指南](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/resource-scene/README.md)。

桌面 Canvas/WebGPU 流程已完成七个独立上下文，保留 64 份原始 RGBA 画面；在记录的环境中，固定点与字体区域比较、错误对照和完整关闭均通过。手机、跨环境字体、性能与能耗验收仍保持开放。

## 0.56.0 交付更新 — 2026-10-16

0.56 资源替换增量已通过 [PR #45](https://github.com/cnedwin/Egret_rebuild/pull/45) 交付，Main 为 `19c308af4d7c9590f886c8105d5d678e708184c5`；早期核验记录保留各自原有截止点。

## 0.56.0 — 可恢复位图资源替换

`Engine.createBitmapResourceSlot(scope, bitmap)` 通过既有根入口，为一个持久 Bitmap 增加显式异步 Texture 替换，并增加擦除类型 `BitmapResourceSlot` 与 `BitmapResourceSlotState`。槽借用初始绑定，仅拥有新替换租约。请求等待、失败或取消时保留先前可用绑定，只有最新已接受意图可以提交；取消或被新请求取代会拒绝对应请求 Promise。参阅[规格](docs/位图资源槽规格.md)、[证据及剩余验收](docs/位图资源槽核验.md)和[组合示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/bitmap-resource-slot/README.md)。

聚焦行为、严格消费者及记录的桌面 Canvas/WebGPU 组合已通过各自限定检查；完整本地／公开门禁及仓库交付在所链接证据中分别记录，完整 UI、Spine R020/V020 与旧工程迁移 R008/V006 保持 OPEN。前一个 0.55 增量已通过 [PR #44](https://github.com/cnedwin/Egret_rebuild/pull/44) 交付，Main 为 `f6b7968db89febfdbe00fb1322f208ab2135f68f`；较早条目继续保留各自历史证据截止点。

## 0.55.0 — 显式本地线性布局

可选 `@egret/engine/layout` 将显式数字记录转换为冻结的局部矩形计划，调用方负责过滤成员、排列子对象并应用坐标。双 Button 示例连接既有共享输入、借用程序化图集、嵌套裁剪及保存/实时帧。参阅[规格](docs/local-linear-layout-spec.md)及[验证范围](docs/local-linear-layout-evidence.md)。

## 文档维护 — 2026-10-15

公开叙述围绕产品目标、设计推导、契约与交付重新组织，产品文档、导航和双语阅读版本共同维护，来源、许可及原始实验证据保持可追溯。本次文字整理不增加引擎能力。

## 前次集成 — 0.54.0

工程预览 0.54.0 已通过 [PR #42](https://github.com/cnedwin/Egret_rebuild/pull/42) 集成，Main 为 efd2a9c91fb6cfe633214b50b82cf7952941452a，tree 为 2b39b8439a5b30ce3572edc162e8a7a916a76185。已记录的完整本地检查通过核心 3218/3218 和 Spine 源码 160/160；桌面 Canvas/WebGPU 检查完成 38 次主读回和 87552 通道比较，容差为 0。这些验证范围分别记录且存在重叠。远端 CI 没有返回检查项，不据此推断 CI 通过。

## 0.54.0

可复用位图按钮连接共享鼠标输入、资源租约及按下／禁用皮肤，在事件路由结束后最终复查命中。 [详细说明](docs/位图按钮契约.md).

## 0.53.0

可运行图集示例连接纹理加载、SpriteSheet 裁剪、Engine 时钟播放、显式锚点及保存／实时画面。 [详细说明](docs/锚点图集播放契约.md).

## 0.52.0

显式锚点偏移在画面收集、坐标转换、bounds 和拾取中共用变换语义。 [详细说明](docs/显示锚点偏移契约.md).

## 0.51.0

按索引插入子对象，保持父子顺序、所有权和重入校验。 [详细说明](docs/容器按索引插入契约.md).

## 0.50.0

查询直接子对象当前索引，不改变显示树。 [详细说明](docs/容器子节点索引契约.md).

## 0.49.0

批量分离全部直接子对象，保持各自资源与生命周期规则。 [详细说明](docs/容器清空子节点契约.md).

## 0.48.0

NineSliceBitmap 基于既有几何、纹理租约和自有画面提供固定边框背景。 [详细说明](docs/九宫格位图契约.md).

## 0.47.0

实验性官方 Spine Core 桥接将原创手动测试内容接入 Mesh2D 画面，完整 Spine 仍按独立需求验收。 [详细说明](docs/SpineCore手动网格桥接.md).

## 0.46.0

可选浏览器 PNG Provider 在既有资源系统上增加受限静态图像解码和显式关闭。 [详细说明](docs/浏览器PNG纹理Provider契约.md).

## 0.45.1

共用路径／字节身份工具、规范文本写入器和必需钩子，处理 Windows 路径写法及换行漂移。 [详细说明](docs/仓库路径身份与换行规范.md).

## 0.45.0

命名 SpriteSheet 帧让静态裁剪与序列播放共用一个图集租约。 [详细说明](docs/命名图集契约.md).

## 0.44.0

Scope 所有的序列播放使用显式 Engine 时钟，支持单次与循环控制。 [详细说明](docs/时钟驱动序列动画契约.md).

## 0.43.0

Spine 线性动画源规格定义版本化输入及源码层检查。 [详细说明](docs/Spine线性动画源规格契约.md).

## 0.42.0

Spine 网格源规划定义自有网格画面准备及校验范围。 [详细说明](docs/Spine网格源规划契约.md).

## 0.41.0

九宫格几何定义边框与拉伸语义，为显示组件提供基础。 [详细说明](docs/九宫格几何NS1契约.md).

## 0.40.0

ByteWriter 提供自有二进制输出、显式字节序和事务式游标行为。 [详细说明](docs/字节写入器BW1契约.md).

## 0.39.0

纹理场景组合通过显式浏览器 Host 连接选定三维 pass 与独立于深度的 UI。 [详细说明](docs/textured-scene-host-contract.md).

## 0.38.0

公共 Matrix4 编写接口开放既有第一方 CPU 矩阵语义。 [详细说明](docs/公共3D场景契约.md).

## 0.37.0

原创 Spine F1 实验增加显式选择的 Engine 时钟集成。

## 0.36.0

原创 F1 Spine 实验连接手动动画测试内容、网格画面与浏览器验证。

## 0.35.0

Scope 所有权针对已记录的公开属性覆盖及释放重入案例得到修正。 [详细说明](docs/Scope私有所有权.md).

## 0.34.0

可选 Spine 导入规划器增加严格元数据与扫描优先的拒绝语义。 [详细说明](docs/Spine导入计划契约.md).

## 0.33.0

主鼠标输入连接显式命中区域、类型化显示事件和 Scope 生命周期。 [详细说明](docs/主鼠标输入契约.md).

## 0.32.0

可选公共场景与网格入口开放选定的自有 CPU 画面和浏览器 Host。 [详细说明](docs/公共3D场景契约.md).

## 0.31.0

资源获取组增加完整输入预检、受限本地等待队列及统一释放。 [详细说明](docs/资源批量获取.md).

## 0.30.0

Canvas 拾取示例展示公共命中查询、类型化路由及派发后的视觉反馈。 [详细说明](docs/显示拾取示例.md).

## 0.29.0

逻辑命中测试定义显式矩形输入及显示树拾取。 [详细说明](docs/显示命中HT1.md).

## 0.28.0

Canvas 文字路径在已验证子集中连接栅格图像、替换、代际与生命周期。 [详细说明](docs/Canvas文字WC1.md).

## 0.27.2

显示树挂接减少特定同级扫描，保持校验与释放顺序。 [详细说明](docs/显示树扩展性.md).

## 0.27.1

ByteReader 提供自有标量读取、显式字节序、独立复制及原子游标。 [详细说明](docs/字节读取器BR1契约.md).

## 0.27.0

可选的非编辑 TextField 连接已准备文字图像、资源租约和显式替换。 [详细说明](docs/文字显示TF1契约.md).

## 0.26.0

标量 Tween 增加 Scope 所有的过渡、选定缓动函数及终态释放。 [详细说明](docs/标量补间契约.md).

## 0.25.0

显式 Engine 时钟将游戏时间推进与渲染、捕获分开。 [详细说明](docs/游戏时间核心契约.md).

## 0.24.0

文字栅格编排增加精确请求、带符号度量、资源槽位及显式预算。 [详细说明](docs/文字栅格T1契约.md).

## 0.23.0

自有纹理几何与 Mesh2D 增加不可变捕获、准备和显式 WebGPU 路径。 [详细说明](docs/自有纹理几何与Mesh2D契约.md).

## 0.22.0

接收者局部内容 bounds 增加不可变测量结果与显式遍历预算。 [详细说明](docs/显示内容边界契约.md).

## 0.21.0

公共局部／全局坐标查询增加不可变点及祖先／生命周期边界。 [详细说明](docs/显示坐标查询契约.md).

## 0.20.0

SequencePlayer 提供显式时间图集采样及公共浏览器示例。 [详细说明](docs/显式时间序列播放器契约.md).

## 0.19.0

Bitmap 区域接纳／捕获与 B1 浏览器验证器建立独立的图像和场景检查。 [详细说明](docs/bitmap-region-contract.md).

## 0.18.0

单个命名旧 MovieClip 的 CPU 转换保留裁剪、偏移和编写的停留时间，完整迁移仍未完成。 [详细说明](docs/legacy-movieclip-contract.md).

## 0.17.0

内部 CPU 场景、网格、序列与 RES 意图扩展初始核心，未完成生产宿主验收。 [详细说明](docs/3d-cpu-scene-contract.md).

## 0.16.0

图像源投影、画面准备、CPU 混合参考及三维／RES 分析形成统一证据记录。 [详细说明](docs/核心框架实现记录.md).

## 0.13.0

浏览器 WebGPU 矩形执行建立固定的渲染与生命周期规格。 [详细说明](docs/WebGPU矩形执行合同.md).

## 0.12.0

显示变换、继承可见性／透明度、裁剪及不可变画面接入独立 Canvas 适配器。 [详细说明](docs/显示与帧执行合同.md).

## 0.11.0

类型化资源增加共享获取、独立租约、取消与代际隔离。 [详细说明](docs/资源核心合同.md).

## 0.10.0

双语阅读、当前文件身份、关键英文注释与推送前检查形成共用贡献规范。 [详细说明](docs/双语文档与推送前检查.md).

## 0.9.0

仓库整合独立核心源码与知识库，建立公开协作和来源署名。 [详细说明](docs/开源协作与公开表达规范.md).

## 0.8.0

首个独立无界面核心实现 contracts、runtime 与 engine 的职责、生命周期及类型化事件。 [详细说明](docs/核心框架实现记录.md).

## 0.7.0

工程结构、现代 API 约定与代码质量规范形成共用实现基础。 [详细说明](docs/工程技术架构与项目结构.md).

## 0.6.2

技术研究补充 shader 资产分发和工程持续编辑流程的设计考虑。 [详细说明](docs/Shaders与Playground产品技术启发.md).

## 0.6.1

独立实现、显式依赖与研究来源分别建立规范。 [详细说明](docs/独立实现与第三方依赖规范.md).

## 0.6.0

图形后端、编译与原生运行时方案作为候选设计进行分析。 [详细说明](docs/图形后端编译与原生Runtime选型.md).

## 0.5.0

固定版本第三方资产实验检查动画实例、文字、资源释放和上下文恢复。

## 0.4.0

参考研究明确源码版本、许可、集成角色与验证职责。 [详细说明](docs/开源实现优先与验证分工.md).

## 0.3.0

事件、资源、UI 和混合图形实验细化身份、代际与恢复约束。

## 0.2.0

首版白皮书、需求与工程规划将设计假设连接到技术实验。

## 0.1.0

初始知识库组织产品范围、架构候选、交付与社区参与。

## 历史验证记录

早期结果、失败、修正及 PENDING 状态，按原日期和源码身份保存在对应证据及[固定版本详细记录](https://github.com/cnedwin/Egret_rebuild/blob/efd2a9c91fb6cfe633214b50b82cf7952941452a/knowledge-base/en/CHANGELOG.md)中，表达历史检查点，不代表当前集成状态。本页记录各版本主要变化，详细测试数值随相关实验或子系统维护。

完整 Spine 支持于 2026-10-10 登记为 R020/V020，上述导入、网格及手动 Core 实验尚未完成这项要求。旧工程自动迁移 R008/V006 仍未完成。
