// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '../EgretError.js';
import type { ParagraphMetrics, ParagraphRequest, ParagraphTextAffinity, ParagraphTextCaret, ParagraphTextCluster,
  ParagraphTextGeometry, ParagraphTextGeometryData, ParagraphTextLine, ParagraphTextSelection } from './types.js';

const invalid = (): never => { throw new EgretError('PARAGRAPH_PROVIDER_RESULT_INVALID'); };
const scalar = (v: number): number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1048576 ? (v === 0 ? 0 : v) : invalid();
function boundary(text: string, value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > text.length) return invalid();
  const unit = text.charCodeAt(value), prior = text.charCodeAt(value - 1);
  if ((unit >= 0xdc00 && unit <= 0xdfff && prior >= 0xd800 && prior <= 0xdbff)
    || (prior === 13 && unit === 10)) return invalid();
  return value;
}
function box(value: ParagraphTextLine): {left: number; top: number; right: number; bottom: number} {
  const left=scalar(value.left),top=scalar(value.top),right=scalar(value.right),bottom=scalar(value.bottom);
  if (right < left || bottom < top) return invalid();
  return {left,top,right,bottom};
}
/** Copy native/source geometry once; subsequent queries retain no provider/native object. */
export function snapshotParagraphTextGeometry(data: ParagraphTextGeometryData, request: ParagraphRequest, metrics: ParagraphMetrics): ParagraphTextGeometry {
  if (!data || typeof data!=='object') return invalid();
  const sourceLines=data.lines,sourceClusters=data.clusters;
  if(!Array.isArray(sourceLines)||!Array.isArray(sourceClusters))return invalid();
  const lineCount=sourceLines.length,clusterCount=sourceClusters.length;
  if(lineCount!==metrics.lines.length||!Number.isSafeInteger(clusterCount)||clusterCount>8192)return invalid();
  const text=request.text, lines: ParagraphTextLine[]=[],clusters: ParagraphTextCluster[]=[];
  for (let i=0;i<lineCount;i++) {
    const row=sourceLines[i]!,metric=metrics.lines[i]!;
    const start=boundary(text,row.start),end=boundary(text,row.end);
    if (start !== metric.start || end < start || end > metric.end || (end !== metric.end && !(metrics.truncated && i===lineCount-1))) return invalid();
    lines.push(Object.freeze({start,end,...box(row)}));
  }
  let previousEnd=0;
  for (let index=0;index<clusterCount;index++) {
    const cluster=sourceClusters[index]!;
    const start=boundary(text,cluster.start),end=boundary(text,cluster.end),lineIndex=cluster.lineIndex,direction=cluster.direction;
    if (start < previousEnd || end <= start || !Number.isSafeInteger(lineIndex) || lineIndex < 0 || lineIndex >= lines.length || (direction !== 'ltr' && direction !== 'rtl')) return invalid();
    const line=lines[lineIndex]!;
    if (start < line.start || end > line.end || /[\r\n]/.test(text.slice(start,end))) return invalid();
    previousEnd=end;
    clusters.push(Object.freeze({start,end,lineIndex,direction,...box(cluster)}));
  }
  Object.freeze(lines);Object.freeze(clusters);
  // This bounded logical fee includes source units and fixed scalar rows. It is
  // explicitly not a measurement of VM objects, physical memory or Wasm heaps.
  const storageBytes=text.length*2+lines.length*112+clusters.length*160;
  const stops: ParagraphTextCaret[][]=lines.map(()=>[]);
  const leading=(c: ParagraphTextCluster): number => c.direction==='rtl'?c.right:c.left;
  const trailing=(c: ParagraphTextCluster): number => c.direction==='rtl'?c.left:c.right;
  const stop=(offset: number,affinity: ParagraphTextAffinity,lineIndex: number,x: number): ParagraphTextCaret => Object.freeze({offset,affinity,lineIndex,x,top:lines[lineIndex]!.top,bottom:lines[lineIndex]!.bottom});
  for (const cluster of clusters) {
    stops[cluster.lineIndex]!.push(stop(cluster.start,'downstream',cluster.lineIndex,leading(cluster)),stop(cluster.end,'upstream',cluster.lineIndex,trailing(cluster)));
  }
  for (let i=0;i<lines.length;i++) {
    const line=lines[i]!,row=stops[i]!;
    if (!row.length) {
      const x=request.direction==='rtl'?line.right:line.left;
      row.push(stop(line.start,'downstream',i,x));
      if(line.end!==line.start)row.push(stop(line.end,'upstream',i,x));
    } else {
      // Native line ranges may include trailing formatting with no glyph box.
      if (!row.some(s=>s.offset===line.start)) row.push(stop(line.start,'downstream',i,row[0]!.x));
      if (!row.some(s=>s.offset===line.end)) row.push(stop(line.end,'upstream',i,row[row.length-1]!.x));
    }
    Object.freeze(row);
  }
  Object.freeze(stops);
  const all=Object.freeze(stops.flat());
  function queryOffset(offset: number): void {
    if(!Number.isSafeInteger(offset)||offset<0||offset>text.length)throw new EgretError('PARAGRAPH_GEOMETRY_POSITION_INVALID');
  }
  function caret(offset: number, affinity: ParagraphTextAffinity='downstream'): ParagraphTextCaret | undefined {
    queryOffset(offset);
    if(affinity!=='upstream'&&affinity!=='downstream')throw new EgretError('PARAGRAPH_GEOMETRY_POSITION_INVALID');
    if(!all.length)return undefined;
    const containing=clusters.find(c=>c.start<offset&&offset<c.end);
    if(containing)offset=affinity==='upstream'?containing.start:containing.end;
    const matching=all.filter(s=>s.offset===offset),exact=matching.filter(s=>s.affinity===affinity);
    if(exact.length)return affinity==='upstream'?exact[0]:exact[exact.length-1];
    if(matching.length)return affinity==='upstream'?matching[0]:matching[matching.length-1];
    // Hard-break interiors and hidden truncated source map to admitted stops;
    // they never manufacture a caret inside CRLF or a synthetic ellipsis.
    const directional=all.filter(s=>affinity==='upstream'?s.offset<offset:s.offset>offset);
    const candidates=directional.length?directional:all;
    return candidates.reduce((best,s)=>Math.abs(s.offset-offset)<Math.abs(best.offset-offset)?s:best);
  }
  const geometry: ParagraphTextGeometry=Object.freeze({text,storageBytes,lines,clusters,
    getCaret:caret,
    hitTest(x: number,y: number) {
      if(typeof x!=='number'||!Number.isFinite(x)||typeof y!=='number'||!Number.isFinite(y))throw new EgretError('PARAGRAPH_GEOMETRY_POINT_INVALID');
      if(!lines.length)return undefined;
      const distance=(top: number,bottom: number): number => y<top?top-y:y>bottom?y-bottom:0;
      let lineIndex=0;
      for(let i=1;i<lines.length;i++)if(distance(lines[i]!.top,lines[i]!.bottom)<distance(lines[lineIndex]!.top,lines[lineIndex]!.bottom))lineIndex=i;
      const row=stops[lineIndex]!;
      const cluster=clusters.find(c=>c.lineIndex===lineIndex&&c.right>c.left&&x>=c.left&&x<=c.right);
      let selected: ParagraphTextCaret;
      if(cluster) {
        const before=x<(cluster.left+cluster.right)/2;
        const start=cluster.direction==='ltr'?before:!before;
        const offset=start?cluster.start:cluster.end,affinity=start?'downstream':'upstream';
        selected=row.find(s=>s.offset===offset&&s.affinity===affinity)!;
      } else selected=row.reduce((best,s)=>Math.abs(s.x-x)<Math.abs(best.x-x)?s:best);
      const line=lines[lineIndex]!;
      return Object.freeze({...selected,inside:cluster!==undefined&&y>=line.top&&y<=line.bottom});
    },
    getSelectionRects(start: number,end: number) {
      queryOffset(start);queryOffset(end);
      if(end<start)throw new EgretError('PARAGRAPH_GEOMETRY_POSITION_INVALID');
      if(start===end)return Object.freeze([]);
      const rows: ParagraphTextSelection[]=clusters.filter(c=>c.start<end&&c.end>start&&c.right>c.left&&c.bottom>c.top)
        .map(c=>({...c})).sort((a,b)=>a.lineIndex-b.lineIndex||a.left-b.left);
      const merged: ParagraphTextSelection[]=[];
      for(const row of rows) {
        const last=merged[merged.length-1];
        if(last&&last.lineIndex===row.lineIndex&&last.direction===row.direction&&last.top===row.top&&last.bottom===row.bottom&&Math.abs(last.right-row.left)<=0.0001
          &&(last.direction==='ltr'?last.end===row.start:last.start===row.end)) {
          merged[merged.length-1]={...last,start:Math.min(last.start,row.start),end:Math.max(last.end,row.end),right:row.right};
        } else merged.push(row);
      }
      return Object.freeze(merged.map(row=>Object.freeze(row)));
    },
  });
  return geometry;
}
