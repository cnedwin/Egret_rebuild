import { isTexturedGeometry2D } from '@egret/contracts';
import type { TexturedGeometry2D } from '@egret/contracts';
import { EgretError } from './EgretError.js';

function debit(used: number, count: number, limit: number): number {
  // Subtraction admission precedes addition, allocation and indexed work.
  if (!Number.isSafeInteger(count) || count < 0 || count > limit - used) {
    throw new EgretError('FRAME_BUDGET_EXCEEDED');
  }
  return used + count;
}

/** Hidden-inclusive authoring admission is independent of emitted frame tables. */
export class TexturedCaptureBudget {
  private nodes = 0;
  private units = 0;
  private triangles = 0;
  private geometryBytes = 0;
  private commands = 0;
  private clipReferences = 0;
  private readonly geometries = new Set<TexturedGeometry2D>();

  public admitNode(): void { this.nodes = debit(this.nodes, 1, 65536); }
  public admitAuthoringUnits(count: number): void { this.units = debit(this.units, count, 65536); }
  public admitSourceTriangles(count: number): void { this.triangles = debit(this.triangles, count, 65536); }
  public admitGeometry(geometry: TexturedGeometry2D): void {
    if (!isTexturedGeometry2D(geometry)) throw new EgretError('MESH_GEOMETRY_INVALID');
    if (this.geometries.has(geometry)) return;
    debit(this.geometries.size, 1, 128);
    this.geometryBytes = debit(this.geometryBytes, geometry.logicalByteLength, 16777216);
    this.geometries.add(geometry);
  }
  public admitEmission(clipCount: number): void {
    const commands = debit(this.commands, 1, 65536);
    const clips = debit(this.clipReferences, clipCount, 262144);
    this.commands = commands;
    this.clipReferences = clips;
  }
}
