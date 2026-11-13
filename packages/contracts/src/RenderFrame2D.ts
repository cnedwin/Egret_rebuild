/** Immutable logical-coordinate values shared by CPU capture and render hosts. */
export interface Matrix2D {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly tx: number;
  readonly ty: number;
}

export interface Rectangle2D {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ClipRectangle2D {
  readonly matrix: Matrix2D;
  readonly rect: Rectangle2D;
}
