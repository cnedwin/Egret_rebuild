// SPDX-License-Identifier: Apache-2.0
// Authored source ranges share the paragraph's layout, raster and UI lifetime.
export function equipmentCopy(fontSize, index) {
  const number = index === undefined ? '' : ' ' + String(index + 1).padStart(2, '0');
  const segments = [
    { text: 'Dawnblade' + number + ' / 晨曦之刃', style: { fontSize: fontSize * 1.5, fillColor: 0xffc46b } },
    { text: '\nLegendary equipment / 传说装备', style: { fontSize: fontSize * 0.8, fillColor: 0xb5c7dd } },
    { text: '\nAttack +128', style: { fillColor: 0x74e4a2 } },
    { text: ' · Critical +12%', style: { fillColor: 0x76c9ff } },
    { text: '\n攻击 +128 · 暴击 +12%', style: { fontFamilies: ['Noto Sans CJK SC'], fillColor: 0x74e4a2 } },
    { text: '\nEquip effect: light the path ahead. The complete description wraps with the available panel width.' },
    { text: '\n装备效果：照亮前路。说明按面板宽度自然换行，后续内容的位置由真实文字高度决定。' },
  ];
  if (index !== undefined && index % 3 === 2) segments.push({ text: '\nBonus / 套装加成' });
  let text = '';
  const runs = [];
  for (const segment of segments) {
    const start = text.length;
    text += segment.text;
    if (segment.style) runs.push(Object.freeze({ start, end: text.length, ...segment.style,
      ...(segment.style.fontFamilies ? { fontFamilies: Object.freeze([...segment.style.fontFamilies]) } : {}) }));
  }
  return Object.freeze({ text, runs: Object.freeze(runs) });
}
