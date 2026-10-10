import { orient2d } from 'robust-predicates';
import type { PreparationBudget2D } from './prepareRectangles2D.js';
/** Conventional orientation of represented coordinates; dependency root stays DOM-free. */
export function packedOrientation(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, budget?: PreparationBudget2D): number {
    budget?.admitPredicate();
    return -Math.sign(orient2d(ax, ay, bx, by, cx, cy));
}
