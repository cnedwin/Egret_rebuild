// SPDX-License-Identifier: Apache-2.0
// A tab row distributes surplus in proportion to preferred widths. Under constraint,
// short entries keep their preferred width and the larger entries share the remainder.
export function tabWidths(preferred, available) {
  const total = preferred.reduce((sum, width) => sum + width, 0);
  if (!total || total === available) return preferred;
  const average = available / preferred.length;
  const large = preferred.filter(width => width > average);
  const remaining = available - preferred.filter(width => width <= average).reduce((sum, width) => sum + width, 0);
  let used = 0;
  let rounded = 0;
  return preferred.map(width => {
    used += total < available ? (available * width) / total : width <= average ? width : remaining / large.length;
    const edge = Math.round(used);
    const result = edge - rounded;
    rounded = edge;
    return result;
  });
}
export const Direction = Object.freeze({ LTR: 'ltr', RTL: 'rtl', TTB: 'ttb', BTT: 'btt' });

export function progressClass(Component, game) {
  return class ProgressBar extends Component {
    #minimum = 0;
    #maximum = 100;
    #value = 0;
    #shown = 0;
    #duration = 500;
    #snap = 1;
    #direction = Direction.LTR;
    #label;
    #tick;
    #target = 0;
    constructor() {
      super();
      this.addEventListener('removedFromStage', this.stopSlide, this);
    }
    get minimum() {
      return this.#minimum;
    }
    set minimum(number) {
      this.#minimum = finite(number);
      if (this.#maximum < number) this.#maximum = number;
      this.#resetRange();
    }
    get maximum() {
      return this.#maximum;
    }
    set maximum(number) {
      this.#maximum = finite(number);
      if (this.#minimum > number) this.#minimum = number;
      this.#resetRange();
    }
    get value() {
      return this.#value;
    }
    set value(number) {
      const next = this.#snapped(finite(number));
      if (next === this.#value) return;
      const start = this.#tick ? this.#target : this.#shown;
      this.#tick?.dispose();
      this.#tick = undefined;
      this.#target = this.#value = next;
      const duration = (this.#duration * Math.abs(start - next)) / (this.#maximum - this.#minimum);
      if (!this.stage || !(duration > 0) || !Number.isFinite(duration)) {
        this.stopSlide();
        return;
      }
      let elapsed = 0;
      this.#shown = start;
      this.refreshProgress();
      this.#tick = game.engine.clock.onTick(game.scope, frame => {
        elapsed += frame.deltaSeconds * 1000;
        if (elapsed >= duration) {
          this.stopSlide();
          return;
        }
        const fraction = (1 - Math.cos((Math.PI * elapsed) / duration)) / 2;
        this.#shown = this.#snapped(start + (next - start) * fraction);
        this.refreshProgress();
      });
    }
    get snapInterval() {
      return this.#snap;
    }
    set snapInterval(value) {
      this.#snap = Math.abs(finite(value));
      this.#resetRange();
    }
    #snapped(value) {
      const lo = this.#minimum,
        hi = this.#maximum,
        step = this.#snap;
      value = Math.max(lo, Math.min(hi, value));
      if (!step) return value;
      const lower = Math.max(lo, lo + Math.floor((value - lo) / step) * step),
        upper = Math.min(hi, lower + step);
      return Number((value - lower >= (upper - lower) / 2 ? upper : lower).toPrecision(15));
    }
    #resetRange() {
      this.#value = this.#snapped(this.#value);
      this.stopSlide();
    }
    get slideDuration() {
      return this.#duration;
    }
    set slideDuration(value) {
      this.#duration = Math.max(0, finite(value));
      if (!this.#duration) this.stopSlide();
    }
    get direction() {
      return this.#direction;
    }
    set direction(value) {
      if (!Object.values(Direction).includes(value)) throw new RangeError('Unknown progress direction.');
      this.#direction = value;
      this.refreshProgress();
    }
    get labelFunction() {
      return this.#label;
    }
    set labelFunction(value) {
      if (value != null && typeof value !== 'function') throw new TypeError('Expected a progress label function.');
      this.#label = value;
      this.refreshProgress();
    }
    valueToLabel(value, maximum) {
      return this.#label ? this.#label(value, maximum) : value + ' / ' + maximum;
    }
    stopSlide() {
      this.#tick?.dispose();
      this.#tick = undefined;
      this.#shown = this.#target = this.#value;
      this.refreshProgress();
    }
    refreshProgress() {
      const target = this.thumb;
      if (target && !target.isDisposed) {
        const w = target.width,
          h = target.height;
        const ratio = this.#maximum ? Math.max(0, Math.min(1, this.#shown / this.#maximum)) : 0;
        const horizontal = this.#direction === Direction.LTR || this.#direction === Direction.RTL;
        const width = horizontal ? Math.round(w * ratio) : w,
          height = horizontal ? h : Math.round(h * ratio);
        const x = this.#direction === Direction.RTL ? w - width : 0,
          y = this.#direction === Direction.BTT ? h - height : 0;
        const clip = target.clipRect;
        if (!clip || clip.x !== x || clip.y !== y || clip.width !== width || clip.height !== height)
          target.clipRect = { x, y, width, height };
      }
      if (this.labelDisplay && !this.labelDisplay.isDisposed) {
        const label = this.valueToLabel(this.#shown, this.#maximum);
        if (this.labelDisplay.text !== label) this.labelDisplay.text = label;
      }
    }
    dispose() {
      this.#tick?.dispose();
      this.#tick = undefined;
      super.dispose();
    }
  };
}
function finite(value) {
  if (!Number.isFinite(value)) throw new TypeError('Expected a finite range value.');
  return value;
}
