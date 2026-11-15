import { EgretError } from "@egret/runtime";
const reservations = new WeakMap();
/** Reserve before startup; release only after host.close successfully resolves. */
export function reserveSurface(surface) {
    if (reservations.has(surface))
        throw new EgretError("SURFACE_IN_USE");
    // Token identity prevents an old release closure clearing a later reservation.
    const reservation = {};
    reservations.set(surface, reservation);
    return () => {
        if (reservations.get(surface) === reservation)
            reservations.delete(surface);
    };
}
//# sourceMappingURL=surfaceOwnership.js.map