// SPDX-License-Identifier: Apache-2.0
// Writes the two error code references from the sources and from the sentences the runtime gives.
// Usage: node tools/error-codes.mjs [--check]
// Every code a source file throws is listed under its area with its sentence: the English one is the runtime's own,
// from packages/runtime/dist/errorHelp.js, and the Chinese one is made here by the same rules. With --check nothing is
// written, and the tool fails when either document differs from what it would write.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeErrorCode } from '../packages/runtime/dist/errorHelp.js';

const root = fileURLToPath(new URL('..', import.meta.url));
export const ERROR_CODE_DOCUMENTS = { en: 'knowledge-base/en/docs/error-codes.md', zh: 'knowledge-base/Cns/docs/error-codes.md' };
function* sources(directory) {
  for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const relative = directory + '/' + entry.name;
    if (entry.isDirectory()) { if (entry.name !== 'dist' && entry.name !== 'node_modules' && entry.name !== 'test' && entry.name !== 'tests') yield* sources(relative); }
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) yield relative;
  }
}
/**
 * The codes the sources name whole: the first argument of `new EgretError(`, and every other capital literal that the
 * runtime has a sentence for, since most parts throw through a helper of their own. A code that a part puts together
 * from its area and a short name while running is not found here; its message carries its sentence all the same.
 */
export function collectErrorCodes() {
  const codes = new Set();
  for (const name of ['contracts', 'runtime', 'engine', 'spine']) for (const file of sources('packages/' + name)) {
    if (file.endsWith('/errorHelp.ts')) continue;
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    for (const match of text.matchAll(/new EgretError\(\s*['"]([A-Z][A-Z0-9_]*[A-Z0-9])['"]/g)) codes.add(match[1]);
    for (const match of text.matchAll(/['"]([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)['"]/g)) if (describeErrorCode(match[1]) !== '') codes.add(match[1]);
  }
  return [...codes].sort();
}

// The Chinese sentences, by the rules of packages/runtime/src/errorHelp.ts. A name between an area and an ending
// stays as it is spelled in the code.
const ZH_AREAS = [
  ['ANIMATION', '动画协调器'], ['ASSET_GROUP', '资源组'], ['ASSET_LEASE', '资源租约'], ['ASSET_MANAGER', '资源管理器'], ['ASSET_PROVIDER', '资源提供者'], ['ASSET', '资源管理器'],
  ['AUDIO', '音频混音器'], ['BITMAP_BINDING', '位图绑定'], ['BITMAP_BUTTON', '位图按钮'], ['BITMAP_FONT', '位图字体'], ['BITMAP_RESOURCE', '位图资源槽'], ['BITMAP_TEXT', '位图文本'],
  ['BITMAP', '位图'], ['BOUNDS', '边界查询'], ['BROWSER_TEXT_EDITOR', '浏览器文本编辑器'], ['BROWSER_TEXT_INPUT', '浏览器文本输入'], ['CAMERA', '相机'], ['CLOCK', '游戏时钟'],
  ['CONTENT_GROUP', '内容组'], ['CONTENT_LOADER', '内容加载器'], ['CONTENT', '内容加载'], ['COORDINATE', '坐标查询'], ['DISPLAY_EFFECT', '渲染效果'], ['DISPLAY_SUBTREE', '预备的显示子树'],
  ['DISPLAY_TREE', '显示树'], ['DISPLAY', '显示对象'], ['ENGINE', 'Engine'], ['EVENT', '事件'], ['FONT_CONTENT', '字体内容'], ['FRAME_LOOP', '帧循环'], ['FRAME', '帧'],
  ['GAMEPAD', '手柄输入'], ['GRAPHICS', 'graphics'], ['HIT_TEST', '命中测试'], ['HOVER_INPUT', '悬停输入'], ['KEYBOARD_FOCUS_SCOPE', '键盘焦点范围'], ['KEYBOARD_INPUT', '键盘输入'],
  ['KEYBOARD', '键盘'], ['LAYOUT', '布局'], ['MANIFEST_BINDING', '清单绑定'], ['MANIFEST_GROUP', '清单组'], ['MESH_BINDING', '网格绑定'], ['MESH', '网格'], ['MOUSE_INPUT', '鼠标输入'],
  ['NINE_SLICE_BITMAP', '九宫格位图'], ['PARAGRAPH_CACHE', '段落缓存'], ['PARAGRAPH_FONT_SET', '段落字体集'], ['PARAGRAPH_FONT', '段落字体'], ['PARAGRAPH_PROVIDER', '段落提供者'],
  ['PARAGRAPH', '段落'], ['PARTICLE', '粒子发射器'], ['PHYSICS', '物理世界'], ['POINTER_INPUT', '指针输入'], ['SCOPE', '作用域'], ['SEQUENCE_RESET', '序列重置槽'],
  ['SEQ_PLAYBACK', '序列播放'], ['SEQ_PLAYER', '序列播放器'], ['SEQ', '序列'], ['SHARED_MATERIAL', '共享材质'], ['SPINE_DISPLAY', 'Spine 显示对象'], ['SPINE_INSTANCE', 'Spine 实例'],
  ['SPINE_RESET', 'Spine 重置槽'], ['SPINE', 'Spine'], ['SPRITE_SHEET', '精灵表'], ['STAGE', '舞台'], ['TEXTURE_VIEW', '纹理视图'], ['TEXTURE', '纹理'], ['TEXT_CACHE', '文本缓存'],
  ['TEXT_FIELD', '文本框'], ['TEXT_PLAN', '文本计划'], ['TEXT', '文本'], ['TILEMAP', '瓦片地图'], ['TWEEN', '缓动'], ['UI_CONTROL', 'UI 控件'], ['UI_KEYBOARD', 'UI 键盘导航'],
  ['UI_LAYER', 'UI 层'], ['UI_SEMANTICS', 'UI 语义'], ['UI_TEXT_EDITOR', 'UI 文本编辑器'], ['UI_THEME', 'UI 主题'], ['UI', 'UI'], ['VIDEO', '视频'], ['WEBGL2_LAYER', 'WebGL2 层'],
  ['WEBGL2_READBACK', 'WebGL2 读回'], ['WEBGL2_UPLOAD', '分步的 WebGL2 上传'], ['WEBGL2', 'WebGL2 Host'], ['WEBGPU_READBACK', 'WebGPU 读回'], ['WEBGPU_RECOVERY', 'WebGPU 设备恢复'],
  ['WEBGPU_UPLOAD', '分步的 WebGPU 上传'], ['WEBGPU', 'WebGPU Host'], ['WEB_PNG', '浏览器图片提供者'], ['WEB_RESOURCE', '浏览器资源来源'], ['WEB_TEXT', '浏览器文本提供者'],
];
const ZH_ENDINGS = [
  ['OPTIONS_INVALID', '交给{a}的选项无效：缺少某一项、类型不对或超出范围。'], ['SCOPE_INVALID', '交给{a}的作用域不是这个 Engine 的一个打开的作用域。'],
  ['CLEANUP_FAILED', '清理{a}时失败。各个原因在 cleanupErrors 中。'], ['SETUP_FAILED', '建立{a}时失败。原因在 cause 中。'],
  ['CALLBACK_FAILED', '应用交给{a}的回调抛出了异常。抛出的内容在 cause 中。'], ['LISTENER_FAILED', '应用交给{a}的监听器抛出了异常。抛出的内容在 cause 中。'],
  ['FACTORY_REQUIRED', '{a}要用它的工厂函数创建，不能用 new。'], ['ALREADY_STARTED', '{a}已经开始过了。'], ['ALREADY_CREATED', '{a}已经创建过了。'],
  ['NOT_STARTED', '{a}还没有开始。'], ['NOT_READY', '{a}还没有就绪。', '{a}的 `{o}` 还没有就绪。'], ['BUDGET_EXCEEDED', '超出了{a}的一项上限。'], ['CAP_EXCEEDED', '超出了{a}的一项上限。'],
  ['IN_USE', '{a}已经在使用中。', '交给{a}的 `{o}` 已经在使用中。'], ['OPTIONS', '交给{a}的选项无效。'], ['INVALID', '交给{a}的内容无效。', '交给{a}的 `{o}` 无效。'],
  ['FAILED', '{a}失败了。原因在 cause 中。', '{a}的 `{o}` 失败了。原因在 cause 中。'], ['CLOSED', '{a}已关闭，不再接受任何操作。', '{a}的 `{o}` 已关闭，不再接受任何操作。'],
  ['DISPOSED', '{a}已销毁，不再接受任何操作。', '{a}的 `{o}` 已销毁，不再接受任何操作。'], ['RELEASED', '{a}已释放，不能再使用。', '{a}的 `{o}` 已释放，不能再使用。'],
  ['TERMINAL', '{a}已经结束，不能再使用。', '{a}的 `{o}` 已经结束，不能再使用。'], ['RETIRED', '{a}已经退役，不能再使用。', '{a}的 `{o}` 已经退役，不能再使用。'],
  ['REENTRANT', '在{a}自己的回调里又调用了它。', '在{a}的 `{o}` 自己的回调里又调用了它。'], ['LIMIT', '超出了{a}的一项上限。', '超出了{a}的 `{o}` 上限。'],
  ['BUDGET', '超出了{a}的一项上限。', '超出了{a}的 `{o}` 上限。'], ['CAPACITY', '{a}已经装满。', '{a}的 `{o}` 容量已满。'],
  ['EXHAUSTED', '{a}的一个计数器用尽了。请新建一个。', '{a}的 `{o}` 计数器用尽了。请新建一个。'], ['UNSUPPORTED', '{a}不支持这种用法。', '{a}不支持 `{o}`。'],
  ['UNAVAILABLE', '{a}在这里不可用。', '{a}的 `{o}` 在这里不可用。'], ['BUSY', '{a}还在处理之前的请求。', '{a}的 `{o}` 还在处理之前的请求。'],
  ['ACTIVE', '{a}仍在活动中。', '{a}的 `{o}` 仍在活动中。'], ['PENDING', '{a}还有未完成的工作。', '{a}的 `{o}` 尚未完成。'],
  ['STALE', '交给{a}的内容已被更新的版本取代。', '交给{a}的 `{o}` 已被更新的版本取代。'], ['SUPERSEDED', '{a}的这次请求被更新的请求取代了。'],
  ['CHANGED', '请求进行期间{a}发生了变化。', '请求进行期间{a}的 `{o}` 发生了变化。'], ['CANCELLED', '{a}被取消了。', '{a}的 `{o}` 被取消了。'], ['ABORTED', '{a}被中止了。', '{a}的 `{o}` 被中止了。'],
  ['REQUIRED', '没有提供{a}需要的内容。', '{a}需要 `{o}`。'], ['UNKNOWN', '{a}不认识所指的内容。', '{a}中没有这样的 `{o}`。'], ['MISSING', '缺少{a}需要的内容。', '缺少{a}需要的 `{o}`。'],
  ['DUPLICATE', '同一内容向{a}提供了两次。', '同一个 `{o}` 向{a}提供了两次。'], ['MISMATCH', '交给{a}的两项内容不匹配。', '交给{a}的 `{o}` 不匹配。'],
  ['RANGE', '某个数字超出了{a}的范围。', '`{o}` 超出了{a}的范围。'], ['TIMEOUT', '{a}耗时过长。', '{a}的 `{o}` 耗时过长。'], ['EXPIRED', '{a}耗时过长，已被放弃。', '{a}的 `{o}` 耗时过长，已被放弃。'],
  ['LOST', '{a}丢失了。', '{a}的 `{o}` 丢失了。'], ['BACKWARDS', '交给{a}的时间早于上一次。', '交给{a}的 `{o}` 早于上一次。'],
  ['BACKPRESSURE', '{a}持有的未完成帧已达上限。请稍后再绘制下一帧。'], ['REFUSED', '{a}被拒绝了。', '{a}的 `{o}` 被拒绝了。'],
  ['NOT_FOUND', '{a}没有找到所指的内容。', '{a}没有找到所指的 `{o}`。'], ['NOT_REGISTERED', '所指的内容没有在{a}注册。', '所指的 `{o}` 没有注册。'],
  ['TOO_LONG', '交给{a}的内容太长。', '交给{a}的 `{o}` 太长。'], ['TOO_SMALL', '交给{a}的内容太小。', '交给{a}的 `{o}` 太小。'],
  ['DISABLED', '{a}没有开启。请在其工厂函数的选项中开启。'], ['STOPPED', '{a}已停止，不再接受任何操作。'], ['USED', '{a}已经用过一次，不能再用。'],
  ['UNPREPARED', '{a}还没有准备好。'], ['UNRESOLVED', '找不到{a}需要的内容。', '找不到{a}需要的 `{o}`。'],
];
const ZH_WRITTEN = {
  OBJECT_DISPOSED: '对象已销毁，不能再修改或添加。请新建一个，或者在它的作用域销毁后不再使用它。',
  ENGINE_CLOSED: 'Engine 已关闭。用它创建的任何东西都不能再使用。',
  ENGINE_MISMATCH: '对象属于另一个 Engine。显示树、作用域及其资源都只属于一个 Engine。',
  SCOPE_CLOSED: '作用域已销毁，它拥有的一切也随之销毁。请新建一个作用域。',
  FRAME_RENDER_FAILED: 'Host 拒绝或未能绘制这一帧。原因在 cause 中：以 _BACKPRESSURE 结尾的错误码表示 Host 还在处理之前的帧，使用 @egret/engine/web/loop 的帧循环可以避免。',
  FRAME_BUDGET_EXCEEDED: '舞台上的内容超出了一帧的上限：65,536 个节点或命令、256 种材质、128 个几何体或 65,536 个网格三角形。绘制不同形状的 sprite 各算一个几何体。',
  FRAME_IMAGE_BUDGET: '这一帧使用的图片超出上限：64 页、4,096 个区域或 64 MiB 的不同像素。请把图片合并到更少的图集中。',
  FRAME_TRANSFORM_INVALID: '某个显示对象被放到了角点不是有限数字的位置。请检查它及其父级的 x、y、缩放和旋转。',
  FRAME_STAGE_INVALID: '帧是从 Engine 的舞台捕获的，而这不是一个舞台。',
  FRAME_REENTRANT: '在捕获一帧的过程中又请求了一帧。请在帧循环中绘制，不要在捕获的回调里绘制。',
  INVALID_FRAME_OPTIONS: '帧选项无效：width 和 height 是大于零的整数，clearColor 在 0 到 0xffffff 之间，clearAlpha 在 0 到 1 之间。',
  INVALID_RENDERER: '交给 Engine 的 Host 不能绘制这种帧。',
  RENDERER_REQUIRED: '要求 Engine 绘制，但创建它时没有给能绘制的 Host。请把 createSharedWebGL2Host 或 createSharedWebGPUHost 得到的 Host 交给 createEngine。',
  OWNERSHIP_CONFLICT: '对象已经属于另一个作用域。一个对象只能用 scope.use 交给一个作用域，且只交一次。',
  DISPLAY_VALUE_INVALID: '交给显示对象的值无效：位置、缩放和旋转是有限数字，alpha 在 0 到 1 之间，visible 是布尔值。',
  DISPLAY_CYCLE: '容器不能添加到它自己或它的后代中。',
  DISPLAY_TREE_INVARIANT: '显示树在遍历过程中发生了变化，或者某个节点被到达了两次。不要在捕获或查询的过程中修改显示树。',
  STAGE_ROOT_ONLY: '舞台是显示树的根：不能把它添加到容器中，也不能单独销毁它。',
  NOT_A_CHILD: '该显示对象不是这个容器的子对象。',
  INVALID_INDEX: '子对象索引不是容器范围内的整数。',
  INVALID_DISPLAY_OBJECT: '给出的不是本 SDK 创建的显示对象。',
  INVALID_DISPLAY_CONTAINER: '给出的不是本 SDK 创建的显示容器。',
  GRAPHICS_VALUE_INVALID: '交给 graphics 的值无效：坐标是有限数字，尺寸不能为负，颜色在 0 到 0xffffff 之间，alpha 在 0 到 1 之间。',
  GRAPHICS_FILL_REQUIRED: '形状需要填充或线条。请在绘制前调用 beginFill 或 lineStyle。',
  GRAPHICS_BUDGET: '绘图超出了一个 sprite 的上限：一条路径最多 8,192 个点。sprite 保持原有内容。请把其余部分画到另一个 sprite 中。',
  CLOCK_DELTA_LIMIT: '交给 engine.advanceTime 的时间与上一次相差超过了时钟一步允许的长度。请分成更小的步，@egret/engine/web/loop 的帧循环在标签页被隐藏后就是这样做的。',
  CLOCK_SOURCE_BACKWARDS: '交给 engine.advanceTime 的时间早于上一次。它接受的秒数不能倒退。',
  CLOCK_SOURCE_INVALID: '交给 engine.advanceTime 的时间不是大于等于零的有限秒数。',
  CLOCK_REENTRANT: '在时钟的 tick 回调里或捕获帧的过程中调用了 engine.advanceTime。',
  FRAME_LOOP_CLOSED: '帧循环已销毁。请新建一个。',
  TWEEN_OPTIONS_INVALID: '缓动选项无效：需要大于零的 duration 和一个 update 函数。',
  ASSET_LOAD_FAILED: '提供者加载资源失败。它抛出的内容在 cause 中。',
  ASSET_PROVIDER_MISSING: '没有为这种资源类型注册提供者。请在获取之前用 engine.assets.register 注册。',
  ASSET_PROVIDER_REGISTERED: '这种资源类型已经注册过提供者。',
  ASSET_ACQUIRE_CANCELLED: '对资源的请求被取消了：由它的信号取消，或者因为它的作用域被销毁。',
  ASSET_LEASE_RELEASED: '租约已释放，它的资源可能已不存在。请重新获取该资源。',
  BITMAP_TEXTURE_REQUIRED: 'Bitmap 要用 engine.assets.acquire 得到的纹理租约创建。',
  TEXTURE_DISPOSED: '纹理已销毁，不能再显示。',
  SHARED_MATERIAL_UNSUPPORTED: '该材质不能用于这个对象：为区域创建的网格按区域采样，不能按页采样。',
  MESH_GEOMETRY_INVALID: '给出的不是由 createSharedGeometry2D 或 createTexturedGeometry2D 创建的几何体。',
  UI_MANAGED_GEOMETRY: '这个对象的位置和尺寸由 UI 管理。请修改它的布局，而不是它的 x、y 或缩放。',
  OPTIONS_INVALID: '给出的选项无效：缺少某一项、类型不对或超出范围。',
  NOT_READY: '还没有就绪。请等它依赖的内容加载完成。',
  INVALID_EVENT: '派发的不是用本 SDK 的事件类型创建的 Event。',
  INVALID_EVENT_DISPATCHER: '给出的不是本 SDK 创建的事件派发器。',
  INVALID_PRIORITY: '监听器优先级是整数。',
  INVALID_TIMEOUT: '超时时间是大于等于零的整数毫秒。',
  UI_DUPLICATE_ID: 'UI 的两个部分使用了同一个 id。',
  UI_DUPLICATE_KEY: '列表的两行使用了同一个 key。',
  UI_UNKNOWN_KEY: '列表中没有这个 key 的行。',
  UI_UNKNOWN_LIST: 'UI 中没有这个 id 的列表。',
  UI_LIST_NOT_FOUND: 'UI 中没有这个 id 的列表。',
  UI_CONTROL_UNKNOWN_ITEM: '控件中没有这个 id 的项。',
  UI_LAYOUT_CYCLE: 'UI 的布局依赖于它自己：某个尺寸由它所决定的另一个尺寸给出。',
  LAYOUT_OVERFLOW: '子对象放不进布局得到的空间。',
  PARAGRAPH_FONT_NOT_REGISTERED: '段落使用的字体族没有在它的字体集中注册。',
  PARAGRAPH_GLYPH_UNRESOLVED: '已注册的字体中没有段落里某个字符的字形。请添加覆盖它的字体。',
  PARAGRAPH_ELLIPSIS_DOES_NOT_FIT: '段落太窄，连省略号都放不下。',
  COORDINATE_TRANSFORM_SINGULAR: '路径上某个显示对象的缩放为零，所以舞台上的点没有对应的本地点。',
  TEXTURE_VIEW_REGION_IMMUTABLE: '纹理视图的区域在创建时就固定了。请另建一个视图。',
  WEBGPU_UNCAPTURED_ERROR: 'WebGPU 设备在 Host 的操作之外报告了错误。报告的内容在 cause 中。',
  WEBGL2_CONTEXT_RESTORING: 'WebGL2 上下文正在恢复。恢复后会重新接受帧。',
  ASYNC_EVENT_HANDLER: '事件监听器返回了 Promise。监听器要在派发返回之前执行完；异步工作请直接启动，不要把它返回。',
  HOST_IN_USE: '这个 Host 已经在为另一个 Engine 绘制。每个 Engine 需要自己的 Host。',
  SURFACE_IN_USE: '这个画布已被另一个 Host 或输入使用。',
  VIDEO_PLAY_REFUSED: '浏览器拒绝播放视频，通常是因为视频有声音而页面还没有被点击过。请静音播放，或在点击后播放。',
  AUDIO_HOST_UNAVAILABLE: '页面没有 Web Audio，或者在页面被点击之前不允许启动。',
  WEBGL2_CONTEXT_UNAVAILABLE: '浏览器没有为画布提供 WebGL2 上下文。画布可能已有另一种上下文，或者 WebGL2 被关闭了。',
  WEBGL2_CONTEXT_LOST: '浏览器收回了 WebGL2 上下文。浏览器归还后 Host 会恢复；在此之前帧会被拒绝。',
  WEBGL2_OUT_OF_MEMORY: '图形设备内存不足。请减少纹理数量或尺寸。',
  WEBGL2_FRAME_BUDGET: '这一帧超出了 Host 创建时设定的上限。上限是 createSharedWebGL2Host 的选项。',
  WEBGL2_NOT_STARTED: 'Host 还没有启动。Engine 会启动它的 Host；请等 createEngine 完成后再绘制。',
  WEBGPU_ADAPTER_UNAVAILABLE: '浏览器没有提供 WebGPU 适配器。请改用 WebGL2 Host。',
  WEBGPU_UNAVAILABLE: '浏览器没有 WebGPU。请改用 WebGL2 Host。',
  WEBGPU_DEVICE_LOST: '浏览器收回了 WebGPU 设备。开启恢复时 Host 会恢复；在此之前帧会被拒绝。',
  WEBGPU_OUT_OF_MEMORY: '图形设备内存不足。请减少纹理数量或尺寸。',
  WEBGPU_FRAME_BUDGET: '这一帧超出了 Host 创建时设定的上限。上限是 createSharedWebGPUHost 的选项。',
  WEBGPU_NOT_STARTED: 'Host 还没有启动。Engine 会启动它的 Host；请等 createEngine 完成后再绘制。',
};
const areaOf = code => ZH_AREAS.find(([prefix]) => code === prefix || code.startsWith(prefix + '_'));
function describeZh(code) {
  if (ZH_WRITTEN[code]) return ZH_WRITTEN[code];
  const area = areaOf(code);
  if (!area) return '';
  const rest = code.slice(area[0].length + 1).split('_').filter(Boolean);
  const ending = ZH_ENDINGS.find(([suffix]) => { const parts = suffix.split('_'); return rest.length >= parts.length && rest.slice(-parts.length).join('_') === suffix; });
  if (ending) {
    const object = rest.slice(0, rest.length - ending[0].split('_').length).join(' ').toLowerCase();
    return (object && ending[2] ? ending[2] : ending[1]).replaceAll('{a}', area[1]).replaceAll('{o}', object);
  }
  return rest.length ? area[1] + '出现问题：`' + rest.join(' ').toLowerCase() + '`。' : '';
}

const HEAD = {
  en: `# Error codes

English | [简体中文](../../Cns/docs/error-codes.md)

Every error this SDK throws is an \`EgretError\` with a \`code\`. This page lists each code with what it means. It is written by \`node tools/error-codes.mjs\` from the sources, and \`tests/error-codes.test.mjs\` fails when this page no longer matches them.

## Reading an error

| Part | Holds |
| --- | --- |
| \`error.code\` | The code, in capitals. It is stable: a program compares it |
| \`error.message\` | The code and, where there is one, the sentence below. It is for people and its wording may change |
| \`error.cause\` | What made this error happen, when something did: the Host's own error behind \`FRAME_RENDER_FAILED\`, or what an application callback threw |
| \`error.cleanupErrors\` | What went wrong while cleaning up after the error, if anything |

A code is an area and what went wrong there. The area is how the code begins, and the ending says what happened: \`..._OPTIONS_INVALID\` for options that are not valid, \`..._CLOSED\` and \`..._DISPOSED\` for something used after its end, \`..._REENTRANT\` for a call made from inside its own callback, \`..._LIMIT\` and \`..._BUDGET\` for a limit that was passed, and \`..._FAILED\` for a failure whose cause is in \`cause\`.

Sentences that also say what to do were written for the codes a game meets most. The others are put together from the area and the ending. A code marked — has no sentence yet, and its message is the code alone.\n\nThe rows are the codes the sources name whole. Some parts put a code together from their area and a short name while running, so a code can be thrown that has no row here; its message carries its sentence all the same, made by the same rule.

## The codes a game meets first

| Code | Meaning |
| --- | --- |
`,
  zh: `# 错误码

[English](../../en/docs/error-codes.md) | 简体中文

本 SDK 抛出的每个错误都是带 \`code\` 的 \`EgretError\`。本页列出每个错误码及其含义。它由 \`node tools/error-codes.mjs\` 根据源码生成；当本页与源码不一致时 \`tests/error-codes.test.mjs\` 会失败。

## 怎样读一个错误

| 部分 | 内容 |
| --- | --- |
| \`error.code\` | 大写的错误码。它是稳定的：程序用它来比较 |
| \`error.message\` | 错误码，以及有说明时的一句英文说明。它是给人看的，措辞可能调整；本页给出对应的中文 |
| \`error.cause\` | 导致这个错误的原因（如果有）：\`FRAME_RENDER_FAILED\` 背后 Host 自己的错误，或应用回调抛出的内容 |
| \`error.cleanupErrors\` | 出错后清理时又出现的问题（如果有） |

错误码由"哪个部分"和"出了什么问题"组成。开头表示部分，结尾表示发生了什么：\`..._OPTIONS_INVALID\` 表示选项无效，\`..._CLOSED\` 和 \`..._DISPOSED\` 表示在结束之后还在使用，\`..._REENTRANT\` 表示在自己的回调里又调用了自己，\`..._LIMIT\` 和 \`..._BUDGET\` 表示超出了上限，\`..._FAILED\` 表示失败，原因在 \`cause\` 中。

游戏最常遇到的错误码有专门写的说明，其中包含该怎么做。其余说明由部分和结尾拼成。标为 — 的错误码还没有说明，它的 message 只有错误码本身。\n\n表中各行是源码里完整写出的错误码。有些部分在运行时用自己的前缀加一个短名拼出错误码，所以可能抛出本页没有列出的错误码；它的 message 仍然带有按同样规则生成的说明。

## 游戏最先遇到的错误码

| 错误码 | 含义 |
| --- | --- |
`,
};
const FIRST = ['FRAME_RENDER_FAILED', 'WEBGL2_BACKPRESSURE', 'WEBGPU_BACKPRESSURE', 'CLOCK_DELTA_LIMIT', 'OBJECT_DISPOSED', 'SCOPE_CLOSED', 'ENGINE_CLOSED', 'ENGINE_MISMATCH', 'DISPLAY_VALUE_INVALID',
  'FRAME_TRANSFORM_INVALID', 'FRAME_BUDGET_EXCEEDED', 'FRAME_IMAGE_BUDGET', 'GRAPHICS_FILL_REQUIRED', 'GRAPHICS_VALUE_INVALID', 'ASSET_PROVIDER_MISSING', 'ASSET_LOAD_FAILED', 'BITMAP_TEXTURE_REQUIRED',
  'ASYNC_EVENT_HANDLER', 'VIDEO_PLAY_REFUSED', 'WEBGL2_CONTEXT_LOST', 'WEBGPU_DEVICE_LOST', 'WEBGPU_UNAVAILABLE'];
const GROUPS = { en: ['All codes, by area', 'Other codes', 'Code', 'Meaning'], zh: ['全部错误码，按部分排列', '其他错误码', '错误码', '含义'] };

/** The text of one of the two documents, 'en' or 'zh', for the given codes. */
export function buildErrorCodeDocument(language, codes) {
  const say = language === 'en' ? describeErrorCode : describeZh, cell = code => say(code) || '—';
  let out = HEAD[language];
  for (const code of FIRST) { if (!codes.includes(code)) throw new Error('A code listed first is no longer thrown: ' + code); out += '| `' + code + '` | ' + cell(code) + ' |\n'; }
  out += '\n## ' + GROUPS[language][0] + '\n';
  // Areas in the order of their names; a code of no area goes last.
  const names = [...new Set(ZH_AREAS.map(([prefix]) => prefix))].sort(), byArea = new Map(names.map(name => [name, []])), other = [];
  for (const code of codes) { const area = areaOf(code); if (area) byArea.get(area[0]).push(code); else other.push(code); }
  const table = rows => '| ' + GROUPS[language][2] + ' | ' + GROUPS[language][3] + ' |\n| --- | --- |\n' + rows.map(code => '| `' + code + '` | ' + cell(code) + ' |\n').join('');
  for (const name of names) { const rows = byArea.get(name); if (rows.length !== 0) out += '\n### ' + name + '\n\n' + table(rows); }
  if (other.length !== 0) out += '\n### ' + GROUPS[language][1] + '\n\n' + table(other);
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const codes = collectErrorCodes(), check = process.argv.includes('--check');
  let stale = 0;
  for (const language of ['en', 'zh']) {
    const text = buildErrorCodeDocument(language, codes), file = path.join(root, ERROR_CODE_DOCUMENTS[language]);
    if (check) { if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) { console.error('Out of date: ' + ERROR_CODE_DOCUMENTS[language] + '. Run node tools/error-codes.mjs'); stale++; } }
    else fs.writeFileSync(file, text);
  }
  const without = codes.filter(code => describeErrorCode(code) === '');
  console.log(codes.length + ' codes; ' + without.length + ' without a sentence' + (without.length ? ': ' + without.join(', ') : '') + (check ? stale ? '; documents OUT OF DATE' : '; documents current' : '; documents written'));
  process.exitCode = stale ? 1 : 0;
}
