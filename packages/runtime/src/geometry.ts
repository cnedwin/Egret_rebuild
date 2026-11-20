// SPDX-License-Identifier: Apache-2.0
// Egret 5's Point, Rectangle and Matrix, for code that is moved over with them. Each is also a plain object of the
// shape the engine takes, `{ x, y }`, `{ x, y, width, height }` and `{ a, b, c, d, tx, ty }`, so one can be passed
// wherever such an object is asked for. Angles are in radians, as they were there.

/** A place: `x` and `y`. */
export class Point {
  public x: number;
  public y: number;
  public constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  /** The distance from the origin. */
  public get length(): number {
    return Math.hypot(this.x, this.y);
  }
  public setTo(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }
  public clone(): Point {
    return new Point(this.x, this.y);
  }
  public copyFrom(source: { readonly x: number; readonly y: number }): void {
    this.x = source.x;
    this.y = source.y;
  }
  public equals(other: { readonly x: number; readonly y: number }): boolean {
    return this.x === other.x && this.y === other.y;
  }
  /** A new point that is this one moved by another. */
  public add(other: { readonly x: number; readonly y: number }): Point {
    return new Point(this.x + other.x, this.y + other.y);
  }
  /** A new point that is this one less another. */
  public subtract(other: { readonly x: number; readonly y: number }): Point {
    return new Point(this.x - other.x, this.y - other.y);
  }
  /** Moves it by an amount. */
  public offset(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
  }
  /** Scales it to a length, keeping its direction. A point at the origin stays there. */
  public normalize(thickness: number): void {
    const length = this.length;
    if (length > 0) {
      this.x *= thickness / length;
      this.y *= thickness / length;
    }
  }
  public toString(): string {
    return `(x=${this.x}, y=${this.y})`;
  }
  public static distance(
    a: { readonly x: number; readonly y: number },
    b: { readonly x: number; readonly y: number }
  ): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  /** The point a fraction `f` of the way from `b` to `a`: `a` at 1, `b` at 0, as Egret's. */
  public static interpolate(
    a: { readonly x: number; readonly y: number },
    b: { readonly x: number; readonly y: number },
    f: number
  ): Point {
    return new Point(b.x + (a.x - b.x) * f, b.y + (a.y - b.y) * f);
  }
  /** The point at a length and an angle in radians from the origin. */
  public static polar(length: number, angle: number): Point {
    return new Point(length * Math.cos(angle), length * Math.sin(angle));
  }
}

/** A rectangle: its top left corner `x`, `y`, and its `width` and `height`. */
export class Rectangle {
  public x: number;
  public y: number;
  public width: number;
  public height: number;
  public constructor(x = 0, y = 0, width = 0, height = 0) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }
  public get left(): number {
    return this.x;
  }
  /** Moves the left side, keeping the right side where it is. */
  public set left(value: number) {
    this.width += this.x - value;
    this.x = value;
  }
  public get right(): number {
    return this.x + this.width;
  }
  public set right(value: number) {
    this.width = value - this.x;
  }
  public get top(): number {
    return this.y;
  }
  /** Moves the top side, keeping the bottom side where it is. */
  public set top(value: number) {
    this.height += this.y - value;
    this.y = value;
  }
  public get bottom(): number {
    return this.y + this.height;
  }
  public set bottom(value: number) {
    this.height = value - this.y;
  }
  public get topLeft(): Point {
    return new Point(this.left, this.top);
  }
  public set topLeft(value: { readonly x: number; readonly y: number }) {
    this.top = value.y;
    this.left = value.x;
  }
  public get bottomRight(): Point {
    return new Point(this.right, this.bottom);
  }
  public set bottomRight(value: { readonly x: number; readonly y: number }) {
    this.bottom = value.y;
    this.right = value.x;
  }
  public setTo(x: number, y: number, width: number, height: number): this {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    return this;
  }
  public clone(): Rectangle {
    return new Rectangle(this.x, this.y, this.width, this.height);
  }
  public copyFrom(source: RectangleLike): void {
    this.setTo(source.x, source.y, source.width, source.height);
  }
  public equals(other: RectangleLike): boolean {
    return this.x === other.x && this.y === other.y && this.width === other.width && this.height === other.height;
  }
  /** Whether it has no area. */
  public isEmpty(): boolean {
    return this.width <= 0 || this.height <= 0;
  }
  public setEmpty(): void {
    this.setTo(0, 0, 0, 0);
  }
  /** Whether a point is inside it: its left and top sides count, its right and bottom do not. */
  public contains(x: number, y: number): boolean {
    return x >= this.x && x < this.x + this.width && y >= this.y && y < this.y + this.height;
  }
  public containsPoint(point: { readonly x: number; readonly y: number }): boolean {
    return this.contains(point.x, point.y);
  }
  /** Whether another rectangle lies wholly inside it. An empty one lies nowhere. */
  public containsRect(other: RectangleLike): boolean {
    if (other.width <= 0 || other.height <= 0) return false;
    return (
      other.x >= this.x &&
      other.y >= this.y &&
      other.x + other.width <= this.x + this.width &&
      other.y + other.height <= this.y + this.height
    );
  }
  /** Whether the two share some area. */
  public intersects(other: RectangleLike): boolean {
    return !this.intersection(other).isEmpty();
  }
  /** The area the two share, or an empty rectangle. */
  public intersection(other: RectangleLike): Rectangle {
    const left = Math.max(this.x, other.x),
      top = Math.max(this.y, other.y),
      right = Math.min(this.x + this.width, other.x + other.width),
      bottom = Math.min(this.y + this.height, other.y + other.height);
    return right <= left || bottom <= top ? new Rectangle() : new Rectangle(left, top, right - left, bottom - top);
  }
  /** The least rectangle holding both. An empty one adds nothing. */
  public union(other: RectangleLike): Rectangle {
    if (this.isEmpty()) return new Rectangle(other.x, other.y, other.width, other.height);
    if (other.width <= 0 || other.height <= 0) return this.clone();
    const left = Math.min(this.x, other.x),
      top = Math.min(this.y, other.y);
    return new Rectangle(
      left,
      top,
      Math.max(this.x + this.width, other.x + other.width) - left,
      Math.max(this.y + this.height, other.y + other.height) - top
    );
  }
  /** Grows it by `dx` on the left and on the right, and `dy` at the top and at the bottom. */
  public inflate(dx: number, dy: number): void {
    this.x -= dx;
    this.width += 2 * dx;
    this.y -= dy;
    this.height += 2 * dy;
  }
  public inflatePoint(point: { readonly x: number; readonly y: number }): void {
    this.inflate(point.x, point.y);
  }
  public offset(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
  }
  public offsetPoint(point: { readonly x: number; readonly y: number }): void {
    this.offset(point.x, point.y);
  }
  public toString(): string {
    return `(x=${this.x}, y=${this.y}, width=${this.width}, height=${this.height})`;
  }
}
export interface RectangleLike {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * A matrix of the plane, as Egret's and a canvas's: a point (x, y) goes to (a·x + c·y + tx, b·x + d·y + ty).
 * `concat`, `rotate`, `scale` and `translate` add a change after the ones it has; `prepend` adds one before them.
 */
export class Matrix {
  public a: number;
  public b: number;
  public c: number;
  public d: number;
  public tx: number;
  public ty: number;
  public constructor(a = 1, b = 0, c = 0, d = 1, tx = 0, ty = 0) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.tx = tx;
    this.ty = ty;
  }
  public setTo(a: number, b: number, c: number, d: number, tx: number, ty: number): this {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.tx = tx;
    this.ty = ty;
    return this;
  }
  public clone(): Matrix {
    return new Matrix(this.a, this.b, this.c, this.d, this.tx, this.ty);
  }
  public copyFrom(source: MatrixLike): this {
    return this.setTo(source.a, source.b, source.c, source.d, source.tx, source.ty);
  }
  public equals(other: MatrixLike): boolean {
    return (
      this.a === other.a &&
      this.b === other.b &&
      this.c === other.c &&
      this.d === other.d &&
      this.tx === other.tx &&
      this.ty === other.ty
    );
  }
  public identity(): void {
    this.setTo(1, 0, 0, 1, 0, 0);
  }
  /** Adds another matrix's change after this one's. */
  public concat(other: MatrixLike): void {
    this.setTo(
      this.a * other.a + this.b * other.c,
      this.a * other.b + this.b * other.d,
      this.c * other.a + this.d * other.c,
      this.c * other.b + this.d * other.d,
      this.tx * other.a + this.ty * other.c + other.tx,
      this.tx * other.b + this.ty * other.d + other.ty
    );
  }
  /** The same as `concat`. */
  public append(a: number, b: number, c: number, d: number, tx: number, ty: number): this {
    this.concat({ a, b, c, d, tx, ty });
    return this;
  }
  /** Adds a change before this one's. */
  public prepend(a: number, b: number, c: number, d: number, tx: number, ty: number): this {
    const m = { a: this.a, b: this.b, c: this.c, d: this.d, tx: this.tx, ty: this.ty };
    this.setTo(a, b, c, d, tx, ty);
    this.concat(m);
    return this;
  }
  /** Turns it into its inverse. One with no inverse becomes what Egret made of it: no scale, and its move reversed. */
  public invert(): void {
    const det = this.a * this.d - this.b * this.c;
    if (det === 0 || !Number.isFinite(det)) {
      this.setTo(0, 0, 0, 0, -this.tx, -this.ty);
      return;
    }
    const { a, b, c, d, tx, ty } = this;
    this.setTo(d / det, -b / det, -c / det, a / det, (c * ty - d * tx) / det, (b * tx - a * ty) / det);
  }
  /** Adds a turn by an angle in radians. */
  public rotate(angle: number): void {
    if (angle === 0) return;
    const cos = Math.cos(angle),
      sin = Math.sin(angle);
    this.concat({ a: cos, b: sin, c: -sin, d: cos, tx: 0, ty: 0 });
  }
  public scale(sx: number, sy: number): void {
    this.concat({ a: sx, b: 0, c: 0, d: sy, tx: 0, ty: 0 });
  }
  public translate(dx: number, dy: number): void {
    this.tx += dx;
    this.ty += dy;
  }
  /** Where a point goes. */
  public transformPoint(x: number, y: number, result?: Point): Point {
    const out = result ?? new Point();
    return out.setTo(this.a * x + this.c * y + this.tx, this.b * x + this.d * y + this.ty);
  }
  /** Where a direction goes: the change without its move. */
  public deltaTransformPoint(point: { readonly x: number; readonly y: number }): Point {
    return new Point(this.a * point.x + this.c * point.y, this.b * point.x + this.d * point.y);
  }
  /** Sets it to scale, then turn by an angle in radians, then move. */
  public createBox(scaleX: number, scaleY: number, rotation = 0, tx = 0, ty = 0): void {
    const cos = Math.cos(rotation),
      sin = Math.sin(rotation);
    // Adding 0 makes a zero that came out negative an ordinary one.
    this.setTo(scaleX * cos + 0, scaleX * sin + 0, -scaleY * sin + 0, scaleY * cos + 0, tx, ty);
  }
  /**
   * Sets it to the matrix `beginGradientFill` takes for a box of a width and height at `tx`, `ty`, turned by an
   * angle in radians: the gradient's own square of 1638.4 units fitted to the box.
   */
  public createGradientBox(width: number, height: number, rotation = 0, tx = 0, ty = 0): void {
    this.createBox(width / 1638.4, height / 1638.4, rotation, tx + width / 2, ty + height / 2);
  }
  public toString(): string {
    return `(a=${this.a}, b=${this.b}, c=${this.c}, d=${this.d}, tx=${this.tx}, ty=${this.ty})`;
  }
}
export interface MatrixLike {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly tx: number;
  readonly ty: number;
}
