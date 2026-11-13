// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import type { DisplayObject } from '@egret/runtime';
import type { HoverInput, WheelPoint } from '../hoverInputTypes.js';
import type { PointerContact, PointerInput } from '../pointerInputTypes.js';

/**
 * The scroll position of one axis of a clipped viewport an application draws itself.
 *
 * It owns the offset only. The wheel arrives from the hover input, a drag of the scrollbar thumb
 * from the contact input, and keys through its methods. The application moves its content and
 * draws its thumb from what the control reports. Panning the content with a finger is a gesture
 * and is not recognized here.
 */

export type ScrollAxis = 'x' | 'y';

export interface ScrollWheelOptions {
    readonly hover: HoverInput;
    /** The viewport. A wheel over it or over a descendant scrolls. */
    readonly target: DisplayObject;
    /** Logical units of one wheel line. Defaults to 40. */
    readonly lineLength?: number;
}

export interface ScrollThumbOptions {
    readonly input: PointerInput;
    /** The thumb of the scrollbar. One contact drags it. */
    readonly target: DisplayObject;
    /** Length of the track the thumb moves along, in logical units. */
    readonly trackLength: number;
    /** The shortest the thumb is drawn. Defaults to 16, and is never more than the track. */
    readonly minimumLength?: number;
}

export interface ScrollControlOptions {
    /** The axis of the stage the offset moves along. Defaults to 'y'. */
    readonly axis?: ScrollAxis;
    /** Lengths of the viewport and of the content along the axis, in logical units. */
    readonly viewportLength: number;
    readonly contentLength: number;
    /** Where it starts. Defaults to 0 and is clamped to the range. */
    readonly offset?: number;
    readonly wheel?: ScrollWheelOptions;
    readonly thumb?: ScrollThumbOptions;
    readonly onScroll?: (offset: number) => void;
    readonly onDragChange?: (dragging: boolean) => void;
}

export interface ScrollThumb {
    /** Where the thumb begins on its track, and how long it is, in logical units. */
    readonly start: number;
    readonly length: number;
}

export interface ScrollControl {
    readonly axis: ScrollAxis;
    readonly offset: number;
    /** The largest offset: the content that does not fit, or zero. */
    readonly maximum: number;
    readonly viewportLength: number;
    readonly contentLength: number;
    /** Present when a thumb was given. A thumb as long as its track means nothing can scroll. */
    readonly thumb: ScrollThumb | undefined;
    readonly dragging: boolean;
    readonly enabled: boolean;
    /** Each returns whether the offset changed. */
    scrollTo(offset: number): boolean;
    scrollBy(delta: number): boolean;
    /** One wheel line, or one viewport less one line, toward the end (1) or the start (-1). */
    line(direction: 1 | -1): boolean;
    page(direction: 1 | -1): boolean;
    toStart(): boolean;
    toEnd(): boolean;
    /** New lengths after a layout or a change of content. The offset is clamped to the new range. */
    setLengths(viewportLength: number, contentLength: number): void;
    setEnabled(enabled: boolean): void;
    dispose(): void;
}

function length(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function displayTarget(value: unknown): DisplayObject {
    if (value === null || typeof value !== 'object' || typeof (value as DisplayObject).on !== 'function') throw new EgretError('UI_CONTROL_OPTIONS');
    return value as DisplayObject;
}

export function createScrollControl(options: ScrollControlOptions): ScrollControl {
    if (options === null || typeof options !== 'object' || Array.isArray(options)) throw new EgretError('UI_CONTROL_OPTIONS');
    const { axis = 'y', wheel, thumb, onScroll, onDragChange } = options;
    let { viewportLength, contentLength } = options;
    const initial = options.offset ?? 0;
    if ((axis !== 'x' && axis !== 'y') || !length(viewportLength) || viewportLength <= 0 || !length(contentLength) || !length(initial)
        || (onScroll !== undefined && typeof onScroll !== 'function') || (onDragChange !== undefined && typeof onDragChange !== 'function')) throw new EgretError('UI_CONTROL_OPTIONS');
    let lineLength = 40, trackLength = 0, minimumLength = 16;
    if (wheel !== undefined) {
        if (wheel === null || typeof wheel !== 'object' || wheel.hover === null || typeof wheel.hover !== 'object' || wheel.hover.events === null || typeof wheel.hover.events !== 'object') throw new EgretError('UI_CONTROL_OPTIONS');
        displayTarget(wheel.target);
        lineLength = wheel.lineLength ?? 40;
        if (!length(lineLength) || lineLength <= 0) throw new EgretError('UI_CONTROL_OPTIONS');
    }
    if (thumb !== undefined) {
        if (thumb === null || typeof thumb !== 'object' || thumb.input === null || typeof thumb.input !== 'object' || typeof thumb.input.observe !== 'function') throw new EgretError('UI_CONTROL_OPTIONS');
        displayTarget(thumb.target);
        trackLength = thumb.trackLength; minimumLength = thumb.minimumLength ?? 16;
        if (!length(trackLength) || trackLength <= 0 || !length(minimumLength)) throw new EgretError('UI_CONTROL_OPTIONS');
    }
    let closed = false, enabled = true;
    const range = (): number => Math.max(0, contentLength - viewportLength);
    let offset = Math.min(initial, range());
    let drag: { readonly session: PointerContact['session']; readonly origin: number; readonly from: number } | undefined;

    function open(): void { if (closed) throw new EgretError('UI_CONTROL_CLOSED'); }
    function move(next: number): boolean {
        const clamped = Math.min(range(), Math.max(0, next));
        if (clamped === offset) return false;
        offset = clamped;
        onScroll?.(clamped);
        return true;
    }
    function request(next: number): boolean {
        open();
        if (typeof next !== 'number' || !Number.isFinite(next)) throw new EgretError('UI_CONTROL_OPTIONS');
        return enabled ? move(next) : false;
    }
    /** The share of the content that shows, on the track; a content that fits fills it. */
    function thumbLength(): number {
        return Math.min(trackLength, Math.max(minimumLength, trackLength * viewportLength / contentLength));
    }
    function setDragging(next: typeof drag): void {
        const was = drag !== undefined;
        drag = next;
        if (was !== (next !== undefined)) onDragChange?.(next !== undefined);
    }
    const along = (contact: PointerContact): number => axis === 'y' ? contact.globalY : contact.globalX;
    const subscriptions: (() => void)[] = [];
    if (wheel !== undefined) {
        subscriptions.push(wheel.target.on(wheel.hover.events.wheel, event => {
            // A viewport inside this one that could still move has already taken the wheel.
            if (closed || !enabled || event.defaultPrevented) return;
            const point: WheelPoint = event.payload;
            // The zoom gesture of the platform is not a scroll.
            if (point.zoom === true) return;
            const delta = axis === 'y' ? point.deltaY : point.deltaX;
            const step = point.unit === 'pixel' ? delta : point.unit === 'line' ? delta * lineLength : delta * viewportLength;
            // At its end the viewport leaves the wheel to whatever is outside it.
            if (move(offset + step)) event.preventDefault();
        }));
    }
    if (thumb !== undefined) {
        const { input, target } = thumb;
        const owns = (contact: PointerContact): boolean => drag !== undefined && contact.session === drag.session;
        subscriptions.push(
            target.on(input.events.begin, event => {
                // One contact drags the thumb. A second is refused rather than taking over.
                if (closed || !enabled || drag !== undefined) return;
                setDragging({ session: event.payload.session, origin: along(event.payload), from: offset });
            }),
            target.on(input.events.move, event => {
                if (closed || !owns(event.payload)) return;
                const travel = trackLength - thumbLength();
                // A thumb that fills its track has nowhere to go.
                if (travel > 0) move(drag!.from + (along(event.payload) - drag!.origin) * range() / travel);
            }),
            target.on(input.events.end, event => { if (!closed && owns(event.payload)) setDragging(undefined); }),
            target.on(input.events.cancel, event => { if (!closed && owns(event.payload)) setDragging(undefined); }),
            // A thumb that has left the stage receives no event; the stream of the input still ends the drag.
            input.observe(notification => {
                if (closed || !owns(notification.contact)) return;
                if (notification.kind === 'end' || notification.kind === 'cancel') setDragging(undefined);
            }),
        );
    }

    return Object.freeze({
        axis,
        get offset() { return offset; },
        get maximum() { return range(); },
        get viewportLength() { return viewportLength; },
        get contentLength() { return contentLength; },
        get thumb() {
            if (thumb === undefined) return undefined;
            const size = thumbLength(), most = range();
            return Object.freeze({ start: most === 0 ? 0 : (trackLength - size) * offset / most, length: size });
        },
        get dragging() { return drag !== undefined; },
        get enabled() { return enabled; },
        scrollTo(next: number) { return request(next); },
        scrollBy(delta: number) { return request(offset + delta); },
        line(direction: 1 | -1) { return request(offset + direction * lineLength); },
        page(direction: 1 | -1) { return request(offset + direction * Math.max(lineLength, viewportLength - lineLength)); },
        toStart() { return request(0); },
        toEnd() { return request(range()); },
        setLengths(nextViewport: number, nextContent: number) {
            open();
            if (!length(nextViewport) || nextViewport <= 0 || !length(nextContent)) throw new EgretError('UI_CONTROL_OPTIONS');
            viewportLength = nextViewport; contentLength = nextContent;
            move(offset);
        },
        setEnabled(next: boolean) {
            open();
            if (typeof next !== 'boolean') throw new EgretError('UI_CONTROL_OPTIONS');
            if (enabled === next) return;
            enabled = next;
            // A disabled scrollbar does not keep a drag.
            if (!enabled) setDragging(undefined);
        },
        dispose() {
            if (closed) return;
            closed = true;
            let failure: unknown;
            try { setDragging(undefined); } catch (cause) { failure = cause; }
            for (const unsubscribe of subscriptions) try { unsubscribe(); } catch (cause) { failure ??= cause; }
            if (failure !== undefined) throw failure;
        },
    });
}
