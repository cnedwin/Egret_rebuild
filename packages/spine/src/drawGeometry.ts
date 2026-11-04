// SPDX-License-Identifier: Apache-2.0
// Convert used Core buffers, never vendor pools or animation algorithms.
import { BlendMode, TextureFilter, TextureWrap } from '@esotericsoftware/spine-core';
import type { RenderCommand } from '@esotericsoftware/spine-core';
import { createSharedGeometry2D, createSharedMaterial2D, EgretError } from '@egret/engine';
import type { AssetLease, Texture, SharedGeometry2D, SharedMaterial2D } from '@egret/engine';
import type { SpineAssetPort } from './assetAuthority.js';
export interface SpineDrawLimits { commands: number; vertices: number; indices: number; }
export interface SpineDrawRow { lease: AssetLease<Texture>; geometry: SharedGeometry2D; material: SharedMaterial2D; }
export function drawFault(code: string): EgretError { return new EgretError('SPINE_DISPLAY_' + code); }
const modes = new Map<BlendMode, SharedMaterial2D['blend']>([[BlendMode.Normal,'normal'],[BlendMode.Additive,'add-accumulate'],[BlendMode.Multiply,'multiply-factor'],[BlendMode.Screen,'screen']]);
/** Premultiplied shared-frame output over straight pages; no reinterpretation of shared-frame/1. */
export function copySpineDraws(head: RenderCommand | undefined, asset: SpineAssetPort, limits: SpineDrawLimits, materials: Map<string, SharedMaterial2D>): SpineDrawRow[] {
  const setup = asset.getSetup(), leases = asset.getPages(), rows: SpineDrawRow[] = [], seen = new Set<RenderCommand>();
  let vertices = 0, indices = 0;
  for(let command=head;command;command=command.next) {
    if(seen.has(command)||rows.length>=limits.commands) throw drawFault('COMMAND_LIMIT'); seen.add(command);
    const n=command.numVertices,k=command.numIndices;
    if(!Number.isSafeInteger(n)||!Number.isSafeInteger(k)||n<3||k<3||k%3!==0)throw drawFault('GEOMETRY_INVALID');
    vertices+=n;indices+=k;if(vertices>limits.vertices||indices>limits.indices)throw drawFault('GEOMETRY_LIMIT');
    if(!(command.positions instanceof Float32Array)||command.positions.length!==n*2||!(command.uvs instanceof Float32Array)||command.uvs.length!==n*2
      ||!(command.colors instanceof Uint32Array)||command.colors.length!==n||!(command.darkColors instanceof Uint32Array)||command.darkColors.length!==n
      ||!(command.indices instanceof Uint16Array)||command.indices.length!==k)throw drawFault('GEOMETRY_INVALID');
    const pageIndex=setup.atlas.pages.findIndex(page=>page.texture===command.texture),page=setup.atlas.pages[pageIndex],lease=leases[pageIndex],blend=modes.get(command.blendMode);
    if(!page||!lease||!blend)throw drawFault('PAGE_OR_BLEND_INVALID');
    const filter=page.minFilter===TextureFilter.Nearest?'nearest':page.minFilter===TextureFilter.Linear?'linear':undefined;
    if(page.pma||!filter||page.magFilter!==page.minFilter||page.uWrap!==TextureWrap.ClampToEdge||page.vWrap!==TextureWrap.ClampToEdge)throw drawFault('SAMPLING_UNSUPPORTED');
    const key=blend+':'+filter;let material=materials.get(key);if(!material){material=createSharedMaterial2D({blend,filter,samplingDomain:'page'});materials.set(key,material);}
    const positions=new Float32Array(n*2),lightColors=new Float32Array(n*4),darkColors=new Float32Array(n*3);
    for(let i=0;i<n;i++) {
      positions[i*2]=command.positions[i*2]!;positions[i*2+1]=-command.positions[i*2+1]!;
      // Core emits packed ARGB8; shared vertices store straight light and dark coefficients.
      const light=command.colors[i]!,dark=command.darkColors[i]!;
      lightColors.set([((light>>>16)&255)/255,((light>>>8)&255)/255,(light&255)/255,(light>>>24)/255],i*4);
      darkColors.set([((dark>>>16)&255)/255,((dark>>>8)&255)/255,(dark&255)/255],i*3);
    }
    rows.push({lease,material,geometry:createSharedGeometry2D({positions,uvs:new Float32Array(command.uvs),lightColors,darkColors,indices:new Uint16Array(command.indices)})});
  }
  return rows;
}
