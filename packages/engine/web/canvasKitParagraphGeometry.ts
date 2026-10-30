// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import type { ParagraphMetrics, ParagraphRequest, ParagraphTextCluster, ParagraphTextGeometryData, ParagraphTextLine } from '@egret/engine/paragraph';

export interface NativeGeometryLine {
  readonly startIndex: number; readonly endIndex: number; readonly left?: number;
  readonly width: number; readonly baseline: number; readonly ascent: number; readonly height: number;
}
export interface NativeGeometryParagraph {
  getGlyphInfoAt?(index: number): {readonly graphemeClusterTextRange: {readonly start: number; readonly end: number};
    readonly graphemeLayoutBounds: readonly number[]; readonly dir: unknown; readonly isEllipsis: boolean} | null;
}
/** Copy standard native grapheme advances while the painted paragraph is alive. */
export function captureCanvasKitTextGeometry(paragraph: NativeGeometryParagraph, nativeLines: readonly NativeGeometryLine[],
  request: ParagraphRequest, metrics: ParagraphMetrics, layout: {readonly text: string; readonly boundaries: Uint32Array | undefined},
  rtl: unknown, ltr: unknown, native: <T>(work:()=>T)=>T): ParagraphTextGeometryData {
  if(typeof paragraph.getGlyphInfoAt!=='function')throw new EgretError('PARAGRAPH_FEATURE_UNSUPPORTED');
  const fail=():never=>{throw new EgretError('PARAGRAPH_NATIVE_GEOMETRY_INVALID');};
  const scalar=(v:number):number=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1048576?v:fail();
  const authored=(index:number):number=>layout.boundaries?.[index]??index;
  const clusters: ParagraphTextCluster[]=[],lines: ParagraphTextLine[]=[];
  let lineIndex=0;
  for(let index=0;index<layout.text.length;) {
    const info=native(()=>paragraph.getGlyphInfoAt!(index));
    if(info===null){index++;continue;}
    // Ellipsis is a shaped affix, not an authored source cluster. Hidden source
    // must never become selectable merely because the native query finds it.
    if(info.isEllipsis){index++;continue;}
    const {start,end}=info.graphemeClusterTextRange;
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start!==index||end<=start||end>layout.text.length)fail();
    while(lineIndex<nativeLines.length&&start>=nativeLines[lineIndex]!.endIndex) {
      const row=nativeLines[lineIndex]!;
      if(start===row.endIndex&&/^[\r\n]+$/.test(layout.text.slice(start,end)))break;
      if(lineIndex+1<nativeLines.length&&start>=nativeLines[lineIndex+1]!.startIndex)lineIndex++;
      else break;
    }
    const line=nativeLines[lineIndex];
    if(!line){index=end;continue;}
    if(/[\r\n]/.test(layout.text.slice(start,end))){index=end;continue;}
    if(start<line.startIndex||end>line.endIndex){index=end;continue;}
    const bounds=info.graphemeLayoutBounds;
    if(!bounds||bounds.length!==4||(info.dir!==rtl&&info.dir!==ltr))fail();
    const left=scalar(bounds[0]!),top=scalar(bounds[1]!),right=scalar(bounds[2]!),bottom=scalar(bounds[3]!);
    if(right<left||bottom<top)fail();
    clusters.push(Object.freeze({start:authored(start),end:authored(end),lineIndex,direction:info.dir===rtl?'rtl':'ltr',left,top,right,bottom}));
    index=end;
  }
  for(let i=0;i<nativeLines.length;i++) {
    const row=nativeLines[i]!,metric=metrics.lines[i]!;
    const left=scalar(row.left!),right=scalar(left+row.width),top=scalar(row.baseline-row.ascent),bottom=scalar(top+row.height);
    let end=metric.end;
    if(metrics.truncated&&i===nativeLines.length-1)end=clusters.filter(c=>c.lineIndex===i).reduce((value,c)=>Math.max(value,c.end),metric.start);
    lines.push(Object.freeze({start:metric.start,end,left,right,top,bottom}));
  }
  return Object.freeze({lines:Object.freeze(lines),clusters:Object.freeze(clusters)});
}
