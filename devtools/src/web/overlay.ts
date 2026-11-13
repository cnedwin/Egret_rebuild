// SPDX-License-Identifier: Apache-2.0
// The on-screen monitor. It is ordinary DOM above the game canvas, so drawing
// it adds nothing to the game's draw calls and it stays readable when the
// graphics device is lost.
import { createPerformanceMonitor, evaluateHints, inertPerformanceMonitor } from '../core/index.js';
import type { Hint, HitchRecord, PerformanceMonitor, PerformanceMonitorOptions, PerformanceSnapshot, SharedFrameStats, SourceValues } from '../core/index.js';
import { isDebugMode } from './debugMode.js';

export type MonitorCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type MonitorTab = 'overview' | 'render' | 'resources' | 'hitches' | 'custom';

export interface AttachPerformanceMonitorOptions extends PerformanceMonitorOptions {
    /** True or false decides directly. The default follows the page's debug mode. */
    readonly enabled?: boolean;
    /** Where the element is added. Default document.body. */
    readonly parent?: HTMLElement;
    readonly corner?: MonitorCorner;
    /** The game canvas, for the size shown in the header and the export. */
    readonly canvas?: HTMLCanvasElement;
    /** A short backend label such as webgl2 or webgpu. */
    readonly backend?: string;
    /** The graphics adapter, when the game knows it. */
    readonly adapter?: string;
    /** Count frame boundaries with the monitor's own animation frame. Default true. */
    readonly autoTick?: boolean;
    /** KeyboardEvent.code that shows or hides the monitor. Default Backquote; null for none. */
    readonly toggleKey?: string | null;
    /** Regions one shared frame may hold; the warning appears at 80 percent. Default 128. */
    readonly regionLimit?: number;
    readonly language?: 'en' | 'zh';
    /** Key for the remembered position and state. Default egret.devtools.monitor. */
    readonly storageKey?: string;
}

export interface PerformanceMonitorHandle {
    /** False when debug mode is off: nothing was added to the page. */
    readonly enabled: boolean;
    readonly monitor: PerformanceMonitor;
    /** The host element, or null when not enabled. */
    readonly element: HTMLElement | null;
    readonly visible: boolean;
    readonly expanded: boolean;
    readonly tab: MonitorTab;
    /** True while the panel shows a held snapshot. Collection continues. */
    readonly paused: boolean;
    setVisible(visible: boolean): void;
    setExpanded(expanded: boolean): void;
    setTab(tab: MonitorTab): void;
    setPaused(paused: boolean): void;
    /** Redraw now instead of at the next quarter second. */
    refresh(): void;
    dispose(): void;
}

const TABS: readonly MonitorTab[] = ['overview', 'render', 'resources', 'hitches', 'custom'];

const TEXT = {
    en: {
        overview: 'Overview', renderTab: 'Render', resources: 'Resources', hitchTab: 'Hitches', custom: 'Custom',
        frame: 'Frame interval', work: 'Frame work', dropped: 'dropped', hitches: 'hitches', pauses: 'pauses', sections: 'Sections',
        render: 'Shared frame', commands: 'commands', runs: 'runs (est.)', triangles: 'triangles', effects: 'effect passes',
        breaks: 'breaks', regions: 'regions', pages: 'pages', counters: 'Counters', gauges: 'Gauges', hints: 'Hints', other: 'other',
        exportLabel: 'Export', reset: 'Reset', hide: 'Hide', pause: 'Pause', resume: 'Resume', overhead: 'monitor',
        material: 'material', page: 'page', region: 'region', clip: 'clip', barrier: 'barrier', waiting: 'waiting for frames',
        handles: 'Handles (alive)', memory: 'Memory', pageBytes: 'frame pages (est.)', heap: 'JS heap (browser est.)', growing: 'growing',
        noHitches: 'No long frames yet.', noCustom: 'Nothing registered. Use addCount, setGauge or addSource.', noRender: 'No frame observed yet.',
        noHandles: 'No handle tracker registered.', frameWord: 'frame', held: 'held',
    },
    zh: {
        overview: '概览', renderTab: '渲染', resources: '资源', hitchTab: '卡顿', custom: '自定义',
        frame: '帧间隔', work: '帧内工作', dropped: '掉帧', hitches: '卡顿', pauses: '暂停', sections: '分段耗时',
        render: '共享帧', commands: '命令', runs: '批次（估算）', triangles: '三角形', effects: '离屏通道',
        breaks: '打断', regions: '区域', pages: '页', counters: '计数', gauges: '仪表', hints: '提示', other: '其余',
        exportLabel: '导出', reset: '重置', hide: '隐藏', pause: '暂停', resume: '继续', overhead: '监控自身',
        material: '材质', page: '换页', region: '区域', clip: '裁剪', barrier: '屏障', waiting: '等待帧数据',
        handles: '句柄（存活）', memory: '内存', pageBytes: '帧内页面（估算）', heap: 'JS 堆（浏览器估算）', growing: '持续增长',
        noHitches: '还没有长帧。', noCustom: '还没有登记内容。使用 addCount、setGauge 或 addSource。', noRender: '还没有观察到帧。',
        noHandles: '还没有登记句柄跟踪器。', frameWord: '帧', held: '已暂停',
    },
} as const;
type Words = { readonly [Key in keyof typeof TEXT.en]: string };

const STYLE = `
:host{all:initial;position:fixed;z-index:2147483000;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#e8e6dc;touch-action:none;user-select:none;-webkit-user-select:none}
.box{background:rgba(28,28,26,.94);border-radius:6px;min-width:0}
.badge{display:flex;align-items:center;gap:6px;padding:4px 8px;cursor:pointer;white-space:nowrap}
.badge b{font-weight:600;font-size:13px}
.dim{color:#b4b2a9}.good{color:#97c459}.warn{color:#ef9f27}.bad{color:#f09595}
canvas{display:block}
.panel{width:min(320px,calc(100vw - 16px));border-top:1px solid #444441}
.env{padding:5px 8px;color:#b4b2a9;font-size:11px;overflow-wrap:anywhere}
.tabs{display:flex;border-bottom:1px solid #444441}
.tabs button{flex:1;border:0;border-radius:0;padding:5px 2px;text-align:center;color:#b4b2a9;border-bottom:2px solid transparent}
.tabs button[aria-selected=true]{color:#e8e6dc;border-bottom-color:#5dcaa5}
.body{max-height:min(60vh,460px);overflow:auto;overscroll-behavior:contain;touch-action:pan-y}
.sec{padding:6px 8px;border-bottom:1px solid #3a3a38}
.title{color:#b4b2a9;font-size:11px;margin-bottom:2px}
.row{display:flex;justify-content:space-between;gap:10px}
.row span:last-child{text-align:right;overflow-wrap:anywhere}
.stack{display:flex;height:8px;border-radius:3px;overflow:hidden;background:#444441;margin:3px 0 4px}
.stack i{display:block;height:100%}
.key{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:5px}
.hint{padding:2px 0 2px 8px;border-left:2px solid #ef9f27;margin:3px 0}
.hint.bad{border-left-color:#e24b4a;color:#f09595}
.hitch{display:flex;justify-content:space-between;gap:8px;padding:4px 8px;cursor:pointer;border-bottom:1px solid #3a3a38}
.hitch[aria-expanded=true]{background:#3a3a38}
.empty{padding:10px 8px;color:#b4b2a9}
.actions{display:flex;gap:6px;padding:6px 8px;flex-wrap:wrap}
button{all:unset;cursor:pointer;padding:3px 8px;border:1px solid #5f5e5a;border-radius:4px;color:#e8e6dc;font:inherit}
button:focus-visible,.hitch:focus-visible{outline:2px solid #5dcaa5;outline-offset:-2px}
`;

const PALETTE = ['#7f77dd', '#d4537e', '#1d9e75', '#378add', '#ba7517', '#d85a30', '#639922'];
const ms = (value: number): string => value >= 100 ? value.toFixed(0) : value.toFixed(1);
const bytes = (value: number): string => value >= 1048576 ? (value / 1048576).toFixed(1) + ' MB' : value >= 1024 ? (value / 1024).toFixed(0) + ' KB' : value + ' B';

function grade(value: number, budget: number): 'good' | 'warn' | 'bad' {
    return value <= budget * 1.1 ? 'good' : value <= budget * 2 ? 'warn' : 'bad';
}

/** One sentence for a hint, in the panel's language. */
function hintSentence(hint: Hint, zh: boolean, words: Words): string {
    const subject = hint.subject ?? '', value = hint.value ?? 0, limit = hint.limit ?? 0;
    const reason = (words as Record<string, string>)[subject] ?? subject;
    switch (hint.id) {
        case 'cpu-bound': return zh ? `帧内工作超出预算（p95 ${ms(value)} / ${ms(limit)} ms）${subject ? `，最大的分段是 ${subject}` : ''}。` : `Frame work is over budget (p95 ${ms(value)} of ${ms(limit)} ms)${subject ? `; the largest section is ${subject}` : ''}.`;
        case 'present-bound': return zh ? `帧间隔偏长（p95 ${ms(value)} ms），但页面自身的工作很少：时间花在 GPU、合成或显示上。` : `Frames are long (p95 ${ms(value)} ms) while the page's own work is small: the time goes to the GPU, the compositor or the display.`;
        case 'slow-frames': return zh ? `95 分位帧间隔 ${ms(value)} ms，超过预算 ${ms(limit)} ms 的 1.5 倍。` : `The 95th percentile frame is ${ms(value)} ms, over one and a half budgets of ${ms(limit)} ms.`;
        case 'recent-hitch': return zh ? `最近有一帧用了 ${ms(value)} ms${subject ? `，其中 ${subject} 最长` : ''}。详见“卡顿”。` : `A recent frame took ${ms(value)} ms${subject ? `, most of it in ${subject}` : ''}. See Hitches.`;
        case 'regions-full': return zh ? `帧内区域已达上限（${value} / ${limit}），更多不同的图集帧会被拒绝。` : `Regions are at the per-frame limit (${value} of ${limit}); more distinct atlas frames will be refused.`;
        case 'regions-near-limit': return zh ? `帧内区域接近上限（${value} / ${limit}）。` : `Regions are near the per-frame limit (${value} of ${limit}).`;
        case 'run-breaks': return zh ? `${limit} 个批次中有 ${value} 个被“${reason}”打断。` : `${value} of ${limit} runs end at a ${reason} change.`;
        case 'effect-passes': return zh ? `本帧有 ${value} 个模糊或遮罩通道，每个都要离屏绘制。` : `This frame has ${value} blur or mask passes; each is drawn offscreen.`;
        case 'host-failed': return zh ? `宿主报告失败：${subject}。` : `The host reported a failure: ${subject}.`;
        case 'host-not-active': return zh ? `宿主状态为 ${subject}，当前没有在绘制。` : `The host is ${subject} and is not drawing.`;
        case 'host-backlog': return zh ? `宿主有 ${value} 帧尚未完成，提交快于 GPU 完成。` : `The host has ${value} unfinished frames: submission is outrunning the GPU.`;
        case 'handles-growing': return zh ? `${subject} 的存活数持续增长（现在 ${value}），可能没有释放。` : `Live ${subject} keep growing (now ${value}); they may not be released.`;
    }
}

/**
 * Show the performance monitor, if the page is in debug mode. Outside debug
 * mode this adds nothing to the page and returns an inert monitor, so the
 * calls a game makes on it cost one empty function call each.
 */
export function attachPerformanceMonitor(options: AttachPerformanceMonitorOptions = {}): PerformanceMonitorHandle {
    const enabled = options.enabled ?? isDebugMode();
    if (!enabled || typeof document === 'undefined') {
        const monitor = inertPerformanceMonitor();
        return Object.freeze({
            enabled: false, monitor, element: null, visible: false, expanded: false, tab: 'overview' as const, paused: false,
            setVisible(): void {}, setExpanded(): void {}, setTab(): void {}, setPaused(): void {}, refresh(): void {}, dispose(): void {},
        });
    }
    const monitor = createPerformanceMonitor(options);
    const zh = (options.language ?? (navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en')) === 'zh';
    const text: Words = zh ? TEXT.zh : TEXT.en;
    const storageKey = options.storageKey ?? 'egret.devtools.monitor';
    const regionLimit = options.regionLimit ?? 128;
    const corner = options.corner ?? 'top-left';

    let saved: { x?: number; y?: number; expanded?: boolean; visible?: boolean; tab?: string } = {};
    try { const raw = localStorage.getItem(storageKey); if (raw) saved = JSON.parse(raw) as typeof saved; } catch { /* start fresh */ }
    let visible = saved.visible !== false, expanded = saved.expanded === true, disposed = false;
    let tab: MonitorTab = TABS.find((name) => name === saved.tab) ?? 'overview';
    let x = typeof saved.x === 'number' ? saved.x : Number.NaN, y = typeof saved.y === 'number' ? saved.y : Number.NaN;
    const remember = (): void => {
        try { localStorage.setItem(storageKey, JSON.stringify({ ...(Number.isNaN(x) ? {} : { x, y }), expanded, visible, tab })); } catch { /* not remembered */ }
    };
    // While paused the panel shows these; the monitor keeps collecting behind them.
    let held: { readonly snapshot: PerformanceSnapshot; readonly hitches: readonly HitchRecord[]; readonly intervals: Float32Array } | undefined;
    let openHitch = -1, hitchKey = '';

    const make = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, content?: string): HTMLElementTagNameMap[K] => {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (content !== undefined) element.textContent = content;
        return element;
    };
    const host = make('div');
    host.setAttribute('data-egret-devtools', 'performance-monitor');
    const root = host.attachShadow({ mode: 'open' });
    const style = make('style', undefined, STYLE);
    const box = make('div', 'box');
    const badge = make('div', 'badge'); badge.setAttribute('role', 'button'); badge.tabIndex = 0;
    const fpsText = make('b', undefined, '--'), msText = make('span', undefined, '--');
    const graph = make('canvas'), bigGraph = make('canvas');
    badge.append(fpsText, make('span', 'dim', 'fps'), msText, make('span', 'dim', 'ms'), graph);
    const panel = make('div', 'panel');
    const env = make('div', 'env'), tabBar = make('div', 'tabs'), body = make('div', 'body'), actions = make('div', 'actions');
    tabBar.setAttribute('role', 'tablist');
    panel.append(env, tabBar, body, actions);
    box.append(badge, panel);
    root.append(style, box);
    (options.parent ?? document.body).append(host);

    function button(label: string, action: () => void): HTMLButtonElement {
        const element = make('button', undefined, label); element.type = 'button';
        element.addEventListener('click', (event) => { event.stopPropagation(); action(); });
        return element;
    }
    const tabLabels: Record<MonitorTab, string> = { overview: text.overview, render: text.renderTab, resources: text.resources, hitches: text.hitchTab, custom: text.custom };
    const tabButtons = new Map<MonitorTab, HTMLButtonElement>();
    for (const name of TABS) {
        const element = button(tabLabels[name], () => setTab(name));
        element.setAttribute('role', 'tab'); element.dataset['tab'] = name;
        tabButtons.set(name, element); tabBar.append(element);
    }
    const pauseButton = button(text.pause, () => setPaused(held === undefined));
    actions.append(pauseButton, button(text.exportLabel, () => { void exportSession(); }), button(text.reset, () => { monitor.reset(); held = undefined; openHitch = -1; draw(); }), button(text.hide, () => setVisible(false)));

    function place(): void {
        if (Number.isNaN(x)) {
            const inset = (side: string): string => `calc(8px + env(safe-area-inset-${side}, 0px))`;
            host.style.left = corner.endsWith('left') ? inset('left') : ''; host.style.right = corner.endsWith('right') ? inset('right') : '';
            host.style.top = corner.startsWith('top') ? inset('top') : ''; host.style.bottom = corner.startsWith('bottom') ? inset('bottom') : '';
            return;
        }
        const rect = host.getBoundingClientRect();
        x = Math.max(0, Math.min(x, innerWidth - rect.width)); y = Math.max(0, Math.min(y, innerHeight - rect.height));
        host.style.right = host.style.bottom = ''; host.style.left = x + 'px'; host.style.top = y + 'px';
    }

    type Row = readonly [string, string, (string | undefined)?];
    function section(title: string, rows: readonly Row[]): HTMLElement {
        const element = make('div', 'sec');
        if (title) element.append(make('div', 'title', title));
        for (const [label, value, tone] of rows) {
            const row = make('div', 'row');
            row.append(make('span', 'dim', label), make('span', tone, value)); element.append(row);
        }
        return element;
    }
    const sourceRows = (values: SourceValues): Row[] => Object.entries(values).map(([key, value]) => [key, /Bytes$/.test(key) && typeof value === 'number' ? bytes(value) : String(value)] as const);

    /** Mean time per frame by section, as one stacked bar with its key. */
    function breakdown(snapshot: PerformanceSnapshot): HTMLElement | null {
        const rows = snapshot.sections.filter((entry) => entry.meanMs > 0);
        if (rows.length === 0) return null;
        const measured = rows.reduce((sum, row) => sum + row.meanMs, 0);
        // Work the game did not name: whatever beginFrame..endFrame held beyond the sections.
        const rest = snapshot.work ? Math.max(0, snapshot.work.meanMs - measured) : 0;
        const total = Math.max(measured + rest, snapshot.budgetMs);
        const element = section(`${text.sections} · ${ms(measured + rest)} / ${ms(snapshot.budgetMs)} ms`, []);
        const bar = make('div', 'stack');
        const add = (name: string, value: number, detail: string, color: string): void => {
            const part = make('i'); part.style.width = (value / total * 100).toFixed(2) + '%'; part.style.background = color; bar.append(part);
            const row = make('div', 'row'), left = make('span', 'dim'), key = make('span', 'key');
            key.style.background = color; left.append(key, name);
            row.append(left, make('span', undefined, detail)); element.append(row);
        };
        element.append(bar);
        rows.forEach((row, index) => add(row.name, row.meanMs, `${ms(row.meanMs)} (max ${ms(row.maxMs)})`, PALETTE[index % PALETTE.length] as string));
        if (rest > 0.05) add(text.other, rest, ms(rest), '#888780');
        return element;
    }

    function frameSection(frame: SharedFrameStats): HTMLElement {
        const switches = frame.switches, reasons = (['material', 'page', 'region', 'clip', 'barrier'] as const).filter((key) => switches[key] > 0);
        return section(`${text.render} #${frame.frameId} · ${frame.width}×${frame.height}`, [
            [text.commands, `${frame.commands} → ${frame.runs} ${text.runs}`],
            [text.breaks, reasons.length > 0 ? reasons.map((key) => `${text[key]} ${switches[key]}`).join(' · ') : '0'],
            [`${text.triangles} / ${text.effects}`, `${frame.triangles} / ${frame.effects}`],
            [text.regions, `${frame.regions} / ${regionLimit}`, frame.regions >= regionLimit ? 'bad' : frame.regions >= regionLimit * 0.8 ? 'warn' : undefined],
            [text.pages, `${frame.pages} · ${bytes(frame.pageBytes)}`],
        ]);
    }

    function environment(): Record<string, number | string | boolean | null> {
        const canvas = options.canvas;
        return {
            userAgent: navigator.userAgent, backend: options.backend ?? null, adapter: options.adapter ?? null,
            devicePixelRatio, viewportWidth: innerWidth, viewportHeight: innerHeight,
            canvasWidth: canvas?.width ?? null, canvasHeight: canvas?.height ?? null,
            hardwareConcurrency: navigator.hardwareConcurrency ?? null, page: location.origin + location.pathname,
        };
    }

    async function exportSession(): Promise<void> {
        const content = JSON.stringify(monitor.exportSession(environment()), null, 2);
        const name = 'egret-performance-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
        const file = new File([content], name, { type: 'application/json' });
        // Phones have no download folder worth finding; hand the file to the share sheet instead.
        if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
            try { await navigator.share({ files: [file], title: name }); return; } catch { /* cancelled or refused: download instead */ }
        }
        const link = make('a'), url = URL.createObjectURL(file);
        link.href = url; link.download = name; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    /** Frame intervals as bars, newest on the right, with the budget as a line. */
    function drawGraph(target: HTMLCanvasElement, cssWidth: number, cssHeight: number, bars: number, intervals: Float32Array, budget: number, line: boolean): void {
        const ratio = Math.min(3, devicePixelRatio || 1), width = Math.round(cssWidth * ratio), height = Math.round(cssHeight * ratio);
        if (target.width !== width || target.height !== height) { target.width = width; target.height = height; target.style.width = cssWidth + 'px'; target.style.height = cssHeight + 'px'; }
        const context = target.getContext('2d'); if (!context) return;
        context.clearRect(0, 0, width, height);
        const top = budget * 3, barWidth = width / bars, start = Math.max(0, intervals.length - bars);
        for (let i = start; i < intervals.length; i++) {
            const value = intervals[i] as number, tone = grade(value, budget);
            context.fillStyle = tone === 'good' ? '#97c459' : tone === 'warn' ? '#ef9f27' : '#e24b4a';
            const barHeight = Math.max(ratio, Math.min(1, value / top) * height);
            context.fillRect((bars - (intervals.length - i)) * barWidth, height - barHeight, Math.max(1, barWidth - (barWidth > 2 * ratio ? ratio : 0)), barHeight);
        }
        if (line) { context.fillStyle = '#b4b2a9'; context.fillRect(0, Math.round(height - height / 3), width, Math.max(1, Math.round(ratio / 2))); }
    }

    function overview(snapshot: PerformanceSnapshot, hitches: readonly HitchRecord[], intervals: Float32Array): HTMLElement[] {
        const parts: HTMLElement[] = [];
        const timing = (summary: NonNullable<PerformanceSnapshot['interval']>): string => `p50 ${ms(summary.p50Ms)} · p95 ${ms(summary.p95Ms)} · p99 ${ms(summary.p99Ms)}`;
        const pacing: Row[] = [];
        if (snapshot.interval) pacing.push([text.frame, timing(snapshot.interval), grade(snapshot.interval.p95Ms, snapshot.budgetMs)]);
        else pacing.push([text.frame, text.waiting]);
        if (snapshot.work) pacing.push([text.work, timing(snapshot.work), grade(snapshot.work.p95Ms, snapshot.budgetMs)]);
        pacing.push([`${text.dropped} / ${text.hitches} / ${text.pauses}`, `${snapshot.dropped} / ${snapshot.hitches} / ${snapshot.pauses}`, snapshot.hitches > 0 ? 'warn' : undefined]);
        const head = section(`${Math.round(snapshot.fps)} fps · ${text.frameWord} ${snapshot.frames}${held ? ' · ' + text.held : ''}`, []);
        drawGraph(bigGraph, 304, 44, 152, intervals, snapshot.budgetMs, true);
        head.append(bigGraph);
        for (const row of section('', pacing).children) head.append(row.cloneNode(true));
        parts.push(head);
        const split = breakdown(snapshot);
        if (split) parts.push(split);
        const hints = evaluateHints(snapshot, { regionLimit, hitches });
        if (hints.length > 0) {
            const element = section(text.hints, []);
            for (const hint of hints) element.append(make('div', hint.severity === 'problem' ? 'hint bad' : 'hint', hintSentence(hint, zh, text)));
            parts.push(element);
        }
        if (snapshot.frame) parts.push(section('', [[text.overhead, ms(snapshot.overheadMs) + ' ms']]));
        return parts;
    }

    const isRenderSource = (name: string): boolean => name === 'host' || name.startsWith('webgl2') || name.startsWith('webgpu') || name.startsWith('world3d');

    function renderTab(snapshot: PerformanceSnapshot): HTMLElement[] {
        const parts: HTMLElement[] = [];
        if (snapshot.frame) parts.push(frameSection(snapshot.frame));
        for (const [name, values] of Object.entries(snapshot.sources)) if (isRenderSource(name)) parts.push(section(name, sourceRows(values)));
        const world = Object.entries(snapshot.gauges).filter(([key]) => key.startsWith('world3d'));
        if (world.length > 0) parts.push(section('world3d', world.map(([key, value]) => [key.slice(7).trim(), String(value)] as const)));
        return parts.length > 0 ? parts : [make('div', 'empty', text.noRender)];
    }

    function resourcesTab(snapshot: PerformanceSnapshot): HTMLElement[] {
        const parts: HTMLElement[] = [];
        const handles = snapshot.sources['handles'];
        if (handles) {
            parts.push(section(text.handles, Object.entries(handles).map(([kind, value]) => {
                const growing = typeof value === 'string' && value.endsWith('↑');
                return [kind, growing ? `${value} ${text.growing}` : String(value), growing ? 'warn' : undefined] as const;
            })));
        } else parts.push(make('div', 'empty', text.noHandles));
        const memory: Row[] = [];
        if (snapshot.frame) memory.push([text.pageBytes, bytes(snapshot.frame.pageBytes)]);
        for (const [key, value] of Object.entries(snapshot.sources['host'] ?? {})) if (/Bytes$/.test(key) && typeof value === 'number') memory.push(['host ' + key, bytes(value)]);
        const heap: unknown = (performance as { readonly memory?: { readonly usedJSHeapSize?: unknown } }).memory?.usedJSHeapSize;
        if (typeof heap === 'number') memory.push([text.heap, bytes(heap)]);
        if (memory.length > 0) parts.push(section(text.memory, memory));
        return parts;
    }

    function hitchesTab(hitches: readonly HitchRecord[]): HTMLElement[] {
        if (hitches.length === 0) return [make('div', 'empty', text.noHitches)];
        const parts: HTMLElement[] = [];
        // Newest first.
        for (let index = hitches.length - 1; index >= 0; index--) {
            const hitch = hitches[index] as HitchRecord, open = hitch.frame === openHitch;
            const top = Object.entries(hitch.sections).sort((a, b) => b[1] - a[1])[0];
            const row = make('div', 'hitch'); row.setAttribute('role', 'button'); row.tabIndex = 0; row.setAttribute('aria-expanded', String(open));
            row.dataset['frame'] = String(hitch.frame);
            row.append(make('span', 'dim', `#${hitch.frame} +${(hitch.atMs / 1000).toFixed(1)}s`), make('span', undefined, top ? `${top[0]} ${ms(top[1])}` : ''), make('span', grade(hitch.intervalMs, monitor.snapshot().budgetMs), ms(hitch.intervalMs) + ' ms'));
            const toggle = (): void => { openHitch = open ? -1 : hitch.frame; draw(); };
            row.addEventListener('click', toggle);
            row.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); } });
            parts.push(row);
            if (open) {
                const rows: Row[] = [[text.frame, ms(hitch.intervalMs) + ' ms'], [text.work, hitch.workMs === null ? '--' : ms(hitch.workMs) + ' ms']];
                for (const [name, value] of Object.entries(hitch.sections).sort((a, b) => b[1] - a[1])) rows.push([name, ms(value) + ' ms']);
                parts.push(section('', rows));
                if (hitch.frameStats) parts.push(frameSection(hitch.frameStats));
            }
        }
        return parts;
    }

    function customTab(snapshot: PerformanceSnapshot): HTMLElement[] {
        const parts: HTMLElement[] = [];
        if (snapshot.counters.length > 0) parts.push(section(text.counters, snapshot.counters.map((entry) => [entry.name, `${entry.last} (Σ ${entry.total})`] as const)));
        const gauges = Object.entries(snapshot.gauges).filter(([key]) => !key.startsWith('world3d'));
        if (gauges.length > 0) parts.push(section(text.gauges, gauges.map(([key, value]) => [key, String(value)] as const)));
        for (const [name, values] of Object.entries(snapshot.sources)) if (!isRenderSource(name) && name !== 'handles') parts.push(section(name, sourceRows(values)));
        return parts.length > 0 ? parts : [make('div', 'empty', text.noCustom)];
    }

    function drawPanel(): void {
        const snapshot = held?.snapshot ?? monitor.snapshot(), hitches = held?.hitches ?? monitor.hitches();
        env.textContent = [options.backend, options.adapter, options.canvas ? options.canvas.width + '×' + options.canvas.height : undefined].filter((part): part is string => !!part).join(' · ');
        env.hidden = env.textContent === '';
        for (const [name, element] of tabButtons) {
            element.setAttribute('aria-selected', String(name === tab));
            element.textContent = name === 'hitches' && hitches.length > 0 ? `${tabLabels[name]} ${hitches.length}` : tabLabels[name];
        }
        pauseButton.textContent = held ? text.resume : text.pause;
        pauseButton.setAttribute('aria-pressed', String(held !== undefined));
        if (tab === 'hitches') {
            // Rebuilding a row between press and release would swallow the click, so
            // the list is rebuilt only when what it shows has changed.
            const key = `${hitches.length}:${hitches.at(-1)?.frame ?? 0}:${openHitch}`;
            if (key === hitchKey && body.dataset['tab'] === 'hitches') return;
            hitchKey = key;
        }
        body.dataset['tab'] = tab;
        const parts = tab === 'overview' ? overview(snapshot, hitches, held?.intervals ?? monitor.history().intervalMs)
            : tab === 'render' ? renderTab(snapshot) : tab === 'resources' ? resourcesTab(snapshot) : tab === 'hitches' ? hitchesTab(hitches) : customTab(snapshot);
        body.replaceChildren(...parts);
    }

    function draw(): void {
        if (disposed || !visible) return;
        const snapshot = monitor.snapshot(), interval = snapshot.interval;
        fpsText.textContent = interval ? String(Math.round(snapshot.fps)) : '--';
        fpsText.className = interval ? grade(1000 / Math.max(1, snapshot.fps), snapshot.budgetMs) : 'dim';
        msText.textContent = interval ? ms((snapshot.work ?? interval).meanMs) : '--';
        badge.setAttribute('aria-label', interval ? `${Math.round(snapshot.fps)} fps` : text.waiting);
        badge.setAttribute('aria-expanded', String(expanded));
        drawGraph(graph, 64, 18, 32, monitor.history().intervalMs, snapshot.budgetMs, false);
        panel.hidden = !expanded;
        if (expanded) drawPanel();
    }

    function setVisible(next: boolean): void {
        if (disposed) return;
        visible = next; host.style.display = visible ? '' : 'none'; remember();
        if (visible) { place(); draw(); }
    }
    function setExpanded(next: boolean): void {
        if (disposed) return;
        expanded = next; remember(); draw(); place();
    }
    function setTab(next: MonitorTab): void {
        if (disposed || !TABS.includes(next)) return;
        tab = next; hitchKey = ''; body.scrollTop = 0; remember(); draw(); place();
    }
    function setPaused(next: boolean): void {
        if (disposed) return;
        held = next ? { snapshot: monitor.snapshot(), hitches: monitor.hitches(), intervals: monitor.history().intervalMs } : undefined;
        hitchKey = ''; draw();
    }

    // Drag from the badge; a press that does not move is a click that opens the panel.
    let dragId = -1, dragX = 0, dragY = 0, moved = false;
    badge.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        const rect = host.getBoundingClientRect();
        dragId = event.pointerId; dragX = event.clientX - rect.left; dragY = event.clientY - rect.top; moved = false;
        badge.setPointerCapture(event.pointerId);
    });
    badge.addEventListener('pointermove', (event) => {
        if (event.pointerId !== dragId) return;
        const rect = host.getBoundingClientRect();
        if (!moved && Math.hypot(event.clientX - rect.left - dragX, event.clientY - rect.top - dragY) < 4) return;
        moved = true; x = event.clientX - dragX; y = event.clientY - dragY; place();
    });
    const endDrag = (event: PointerEvent): void => {
        if (event.pointerId !== dragId) return;
        dragId = -1;
        if (moved) remember(); else if (event.type === 'pointerup') setExpanded(!expanded);
    };
    badge.addEventListener('pointerup', endDrag);
    badge.addEventListener('pointercancel', endDrag);
    badge.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setExpanded(!expanded); } });

    const toggleKey = options.toggleKey === undefined ? 'Backquote' : options.toggleKey;
    const onKey = (event: KeyboardEvent): void => {
        if (event.code !== toggleKey || event.ctrlKey || event.metaKey || event.altKey) return;
        const target = event.target as HTMLElement | null;
        if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
        setVisible(!visible);
    };
    // Three fingers down at once: the same toggle for devices without a keyboard.
    const onTouch = (event: TouchEvent): void => { if (event.touches.length === 3) setVisible(!visible); };
    const onResize = (): void => { if (visible) place(); };
    if (toggleKey !== null) addEventListener('keydown', onKey);
    addEventListener('touchstart', onTouch, { passive: true });
    addEventListener('resize', onResize);

    let frameRequest = 0;
    const onFrame = (at: number): void => { monitor.tick(at); frameRequest = requestAnimationFrame(onFrame); };
    if (options.autoTick !== false) frameRequest = requestAnimationFrame(onFrame);
    // Four redraws a second are readable and keep the monitor's own cost out of the frame.
    const redraw = setInterval(draw, 250);

    host.style.display = visible ? '' : 'none';
    place(); draw();

    return Object.freeze({
        enabled: true, monitor, element: host,
        get visible(): boolean { return visible; },
        get expanded(): boolean { return expanded; },
        get tab(): MonitorTab { return tab; },
        get paused(): boolean { return held !== undefined; },
        setVisible, setExpanded, setTab, setPaused, refresh: draw,
        dispose(): void {
            if (disposed) return;
            disposed = true;
            cancelAnimationFrame(frameRequest); clearInterval(redraw);
            removeEventListener('keydown', onKey); removeEventListener('touchstart', onTouch); removeEventListener('resize', onResize);
            host.remove(); monitor.dispose();
        },
    });
}
