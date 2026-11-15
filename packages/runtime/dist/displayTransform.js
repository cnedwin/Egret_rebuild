/** Preserve capture's parent-times-local binary64 expression order exactly. */
export function composeDisplayTransform(p, s) {
    const angle = ((s.rotation % 360) * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // Without skew the two axes turn together, by the expressions this always used. With skew, the x axis is turned by
    // the rotation and skewY, and the y axis by the rotation and skewX.
    let a = cos * s.scaleX, b = sin * s.scaleX, c = -sin * s.scaleY, d = cos * s.scaleY;
    if (s.skewX !== 0 || s.skewY !== 0) {
        const xAxis = (((s.rotation + s.skewY) % 360) * Math.PI) / 180, yAxis = (((s.rotation + s.skewX) % 360) * Math.PI) / 180;
        a = Math.cos(xAxis) * s.scaleX;
        b = Math.sin(xAxis) * s.scaleX;
        c = -Math.sin(yAxis) * s.scaleY;
        d = Math.cos(yAxis) * s.scaleY;
    }
    // Keep the original zero-pivot expressions, including signed-zero behavior.
    if (s.anchorOffsetX === 0 && s.anchorOffsetY === 0)
        return {
            a: p.a * a + p.c * b,
            b: p.b * a + p.d * b,
            c: p.a * c + p.c * d,
            d: p.b * c + p.d * d,
            tx: p.a * s.x + p.c * s.y + p.tx,
            ty: p.b * s.x + p.d * s.y + p.ty
        };
    // Subtract the transformed local pivot before composing with the parent.
    const localX = s.x - a * s.anchorOffsetX - c * s.anchorOffsetY;
    const localY = s.y - b * s.anchorOffsetX - d * s.anchorOffsetY;
    return {
        a: p.a * a + p.c * b,
        b: p.b * a + p.d * b,
        c: p.a * c + p.c * d,
        d: p.b * c + p.d * d,
        tx: p.a * localX + p.c * localY + p.tx,
        ty: p.b * localX + p.d * localY + p.ty
    };
}
//# sourceMappingURL=displayTransform.js.map