// SPDX-License-Identifier: Apache-2.0
// This source qualification retains owned text, without granting playback or asset authority.
import type { SpineImportInput, SpineImportDiagnostic, SpineSourceSpan } from '@egret/project/spine';
import { prepareF2MeshSource } from './source-plan.js';
import type { F2MeshSourcePlan, F2MeshSourceResult } from './source-plan.js';
import { qualifyF2Profile, createProfileInternalDiagnostic } from './profile-source.js';

export type F2MeshProfileDiagnosticCode =
  | 'F2_PROFILE_SHAPE' | 'F2_PROFILE_FIELD' | 'F2_PROFILE_ATLAS'
  | 'F2_PROFILE_REFERENCE' | 'F2_PROFILE_TRANSFORM' | 'F2_PROFILE_NUMBER'
  | 'F2_PROFILE_TIME' | 'F2_PROFILE_DEFORM' | 'F2_PROFILE_LIMIT'
  | 'F2_PROFILE_REQUIRED' | 'F2_PROFILE_INTERNAL';

export interface F2MeshProfileDiagnostic {
  readonly code: F2MeshProfileDiagnosticCode;
  readonly severity: 'error';
  readonly source: 'input' | 'skeleton' | 'atlas';
  readonly pointer: string;
  readonly message: string;
  readonly span?: SpineSourceSpan;
}

export interface F2MeshProfilePlan {
  readonly planVersion: 1;
  readonly profile: 'static-unweighted-linear-4.3.13';
  readonly sourcePlan: F2MeshSourcePlan;
  readonly ownedInput: SpineImportInput;
  readonly page: {
    readonly pageName: string; readonly assetId: string;
    readonly width: number; readonly height: number; readonly regionCount: number;
  };
  readonly bones: readonly {
    readonly name: string; readonly pointer: string; readonly span: SpineSourceSpan;
    readonly parentIndex: number; readonly depth: number; readonly x: number; readonly y: number;
  }[];
  readonly slots: readonly {
    readonly name: string; readonly pointer: string; readonly span: SpineSourceSpan;
    readonly boneIndex: number; readonly attachmentPointer: string | null;
  }[];
  readonly attachments: readonly {
    readonly pointer: string; readonly span: SpineSourceSpan; readonly slotIndex: number;
    readonly attachmentName: string; readonly path: string; readonly kind: 'region' | 'mesh';
    readonly vertexCount: number; readonly indexCount: number;
  }[];
  readonly animations: readonly {
    readonly name: string; readonly pointer: string; readonly span: SpineSourceSpan;
    readonly duration: number; readonly timelineCount: number; readonly keyframeCount: number;
    readonly expandedDeformScalarCount: number;
    readonly timelines: readonly {
      readonly kind: 'translate' | 'deform'; readonly pointer: string; readonly span: SpineSourceSpan;
      readonly boneIndex: number | null; readonly slotIndex: number | null;
      readonly attachmentPointer: string | null; readonly keyframeCount: number;
      readonly firstTime: number; readonly lastTime: number;
      readonly expandedDeformScalarCount: number;
    }[];
  }[];
  readonly acceptance: {
    readonly sourceProfile: 'passed'; readonly linearTimelineSourceAdmission: 'passed';
    readonly coreCompatibility: 'not_run'; readonly poseNumerics: 'not_run';
    readonly resourceIdentity: 'not_run'; readonly playback: 'not_run'; readonly rendering: 'not_run';
    readonly licenseEntitlement: 'unverified';
  };
}

export type F2MeshProfileResult =
  | { readonly ok: true; readonly value: F2MeshProfilePlan;
      readonly diagnostics: readonly SpineImportDiagnostic[] }
  | Extract<F2MeshSourceResult, { readonly ok: false }>
  | { readonly ok: false; readonly stage: 'profile';
      readonly diagnostics: readonly [F2MeshProfileDiagnostic] };

function refused(diagnostic: F2MeshProfileDiagnostic): F2MeshProfileResult {
  return Object.freeze({ ok: false, stage: 'profile', diagnostics: Object.freeze([diagnostic] as const) });
}

export function createF2MeshProfilePlan(input: SpineImportInput): F2MeshProfileResult {
  try {
    // A owns the one snapshot/SP1/view sequence. Its public result remains unchanged.
    const prepared = prepareF2MeshSource(input);
    if (!prepared.ok) return prepared.result;
    const qualified = qualifyF2Profile(prepared.root, prepared.result.value);
    if (!qualified.ok) return refused(qualified.diagnostic);
    const value: F2MeshProfilePlan = Object.freeze({
      planVersion: 1, profile: 'static-unweighted-linear-4.3.13',
      sourcePlan: prepared.result.value, ownedInput: prepared.owned, ...qualified.data,
      acceptance: Object.freeze({ sourceProfile: 'passed', linearTimelineSourceAdmission: 'passed',
        coreCompatibility: 'not_run', poseNumerics: 'not_run', resourceIdentity: 'not_run',
        playback: 'not_run', rendering: 'not_run', licenseEntitlement: 'unverified' }),
    });
    return Object.freeze({ ok: true, value, diagnostics: prepared.result.diagnostics });
  } catch {
    return refused(createProfileInternalDiagnostic());
  }
}
