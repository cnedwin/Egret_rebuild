// SPDX-License-Identifier: Apache-2.0
// Finite final-line controls use standard native APIs, not qualification exports.
// A zero-width logical formatting slot must never acquire neighboring glyph ink.
const check = (value, message) => { if (!value) throw Error('LINE_BIDI_' + message); };
const equalBytes = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
export function makeLineParagraph(ck, fonts, text, width, rtl = false, align = 'Left') {
    const builder = ck.ParagraphBuilder.MakeFromFontProvider(new ck.ParagraphStyle({
        textStyle: { fontFamilies: ['Noto Sans', 'Noto Sans Arabic'], fontSize: 20, color: ck.BLACK },
        textDirection: rtl ? ck.TextDirection.RTL : ck.TextDirection.LTR,
        textAlign: ck.TextAlign[align], applyRoundingHack: false,
    }), fonts);
    try { builder.addText(text); const paragraph = builder.build(); paragraph.layout(width); return paragraph; }
    finally { builder.delete(); }
}
export function inspectLineParagraph(ck, paragraph, text) {
    const lines = paragraph.getLineMetrics(), nativeShapes = paragraph.getShapedLines();
    let shapes;
    try { shapes = nativeShapes.map(line => ({textRange: line.textRange, runs: line.runs.map(run => ({
        glyphs: Array.from(run.glyphs), positions: Array.from(run.positions), offsets: Array.from(run.offsets),
    }))})); }
    finally { for (const line of nativeShapes) for (const run of line.runs) run.typeface.delete(); }
    for (const line of lines) for (const key of ['width', 'height', 'baseline']) check(Number.isFinite(line[key]), 'FINITE_METRIC');
    for (const line of shapes) for (const run of line.runs) check(run.positions.every(Number.isFinite), 'FINITE_POSITION');
    const boxes = [];
    for (let i = 0; i < text.length; ++i) {
        const native = paragraph.getRectsForRange(i, i + 1, ck.RectHeightStyle.Tight, ck.RectWidthStyle.Tight);
        boxes.push(Array.from(native, box => ({rect: Array.from(box.rect), dir: box.dir.value})));
        for (const box of native) check(Array.from(box.rect).every(Number.isFinite), 'FINITE_RECT');
    }
    const surface = ck.MakeSurface(256, 512); check(surface, 'SURFACE');
    let pixels;
    try {
        const canvas = surface.getCanvas(); canvas.clear(ck.WHITE); canvas.drawParagraph(paragraph, 10, 10); surface.flush();
        const raw = canvas.readPixels(0, 0, {width: 256, height: 512, colorType: ck.ColorType.RGBA_8888,
            alphaType: ck.AlphaType.Unpremul, colorSpace: ck.ColorSpace.SRGB});
        check(raw, 'READBACK'); pixels = Uint8Array.from(raw);
    } finally { surface.dispose(); }
    return {lines, shapes, boxes, pixels};
}
export function verifyLineBidi(ck, fonts) {
    const texts = [
        'abc \u202Bمرحبا 123     \u202C xyz', 'abc \u202Bمرحبا\u200D\u202C xyz',
        'abc \u2067مرحبا \u2069 xyz', 'abc \u202BDEF \t ghi\u202C tail',
        'abc \u202BDEF     xyz\u202C', 'abc \u202Bمرحبا 123\u202C\nabc \u2067مرحبا 456  \u2069 z',
        '\n\n', 'a\r\nb\n', '\u202B\u202C', 'a \u2066b \u2067مرحبا 12  \u2069 c\u2069 end',
        'Cafe\u0301 \u202Bمرحبا 123   \u202C end', 'Hello \u00ADthere abc', 'a\u200Db \u200C c',
        'Latin words for normal wrapping', 'مرحبا 123 abc tail',
    ];
    let reflows = 0, alignments = 0;
    for (const text of texts) for (const rtl of [false, true]) for (const width of [95, 170, 450]) {
        const p = makeLineParagraph(ck, fonts, text, width, rtl);
        try {
            const before = inspectLineParagraph(ck, p, text);
            p.layout(width === 95 ? 170 : 95); inspectLineParagraph(ck, p, text); p.layout(width);
            const after = inspectLineParagraph(ck, p, text);
            check(equalBytes(before.pixels, after.pixels), 'REFLOW_PIXELS');
            check(JSON.stringify(before.boxes) === JSON.stringify(after.boxes), 'REFLOW_RECTS'); ++reflows;
        } finally { p.delete(); }
    }
    for (const align of ['Left', 'Right', 'Center', 'Justify']) for (const rtl of [false, true]) {
        const p = makeLineParagraph(ck, fonts, texts[0], 95, rtl, align);
        try { inspectLineParagraph(ck, p, texts[0]); ++alignments; } finally { p.delete(); }
    }
    const p = makeLineParagraph(ck, fonts, texts[0], 95);
    try {
        const row = inspectLineParagraph(ck, p, texts[0]);
        check(JSON.stringify(row.lines.map(l => [l.startIndex, l.endIndex])) === '[[0,11],[11,21],[21,24]]', 'FIXTURE_LINES');
        check(Math.abs(row.boxes[11][0].rect[0]) < .001, 'DIGITS_AT_LINE_START');
        check(Math.abs(row.shapes[1].runs[0].positions[0]) < .001, 'GLYPH_AT_LINE_START');
        for (let i = 14; i <= 18; ++i) {
            const box = row.boxes[i][0]; check(box.dir === 1, 'RESET_SPACE_DIRECTION');
            check(box.rect[0] >= row.boxes[i - 1][0].rect[2] - .001, 'RESET_SPACE_ORDER');
            const y = (box.rect[1] + box.rect[3]) / 2;
            const left = p.getGlyphPositionAtCoordinate(box.rect[0] + .2 * (box.rect[2] - box.rect[0]), y);
            const right = p.getGlyphPositionAtCoordinate(box.rect[0] + .8 * (box.rect[2] - box.rect[0]), y);
            check(left.pos === i && right.pos === i + 1, 'RESET_SPACE_HIT');
        }
        check(row.boxes[19][0].rect[0] === row.boxes[19][0].rect[2], 'PDF_ZERO_ADVANCE');
    } finally { p.delete(); }
    const ghost = makeLineParagraph(ck, fonts, texts[4], 95);
    try { const row = inspectLineParagraph(ck, ghost, texts[4]);
        for (let i = 9; i <= 12; ++i) check(row.boxes[i][0].rect[0] >= row.boxes[i - 1][0].rect[2] - .001, 'GHOST_ADVANCE');
    } finally { ghost.delete(); }
    return {status: 'PASS', reflows, alignments, fixedOracles: ['final-line-L1-L2-glyph-rect-hit', 'sequential-ghost-advance'],
        scope: 'Finite native line integration, not full Unicode/script/font/device/performance acceptance.'};
}
