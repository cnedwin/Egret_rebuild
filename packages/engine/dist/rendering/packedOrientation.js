import { orient2d } from 'robust-predicates';
/** Conventional orientation of represented coordinates; dependency root stays DOM-free. */
export function packedOrientation(ax, ay, bx, by, cx, cy, budget) {
    budget?.admitPredicate();
    return -Math.sign(orient2d(ax, ay, bx, by, cx, cy));
}
//# sourceMappingURL=packedOrientation.js.map