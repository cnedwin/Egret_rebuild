/** Immutable logical-coordinate values shared by CPU capture and render hosts. */
export interface Matrix2D {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly tx: number;
  readonly ty: number;
}

/** An axis-aligned rectangle in its own coordinate space. */
export interface Rectangle2D {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A clip rectangle together with the matrix that places it on the frame. */
export interface ClipRectangle2D {
  readonly matrix: Matrix2D;
  readonly rect: Rectangle2D;
}
