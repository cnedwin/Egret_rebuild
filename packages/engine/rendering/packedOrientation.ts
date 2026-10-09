import { orient2d } from 'robust-predicates';
/** Conventional orientation of represented coordinates; dependency root stays DOM-free. */
export function packedOrientation(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
    return -Math.sign(orient2d(ax, ay, bx, by, cx, cy));
}
