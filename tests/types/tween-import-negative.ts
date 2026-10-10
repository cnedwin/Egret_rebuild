// First-party prospective named diagnostics, frozen before compiler execution.
// Isolated unsuppressed source keeps missing imports out of working consumers.
// TWEEN_IMPORT_CASE owner-factory TS2305
import {createTweenOwner} from '@egret/engine';
// TWEEN_IMPORT_CASE context-type TS2305
import type {TweenContext} from '@egret/engine';
// TWEEN_IMPORT_CASE owner-type TS2305
import type {TweenOwner} from '@egret/engine';
// TWEEN_IMPORT_CASE erased-brand-value TS2305
import {tweenBrand} from '@egret/engine';
// TWEEN_IMPORT_CASE no-root-factory TS2305
import {createTween} from '@egret/engine';
// TWEEN_IMPORT_CASE no-runtime-port TS2305
import type {Tween} from '@egret/runtime';
// TWEEN_IMPORT_CASE no-owner-subpath TS2307
import * as privateTween from '@egret/engine/tween';
// TWEEN_IMPORT_CASE no-types-subpath TS2307
import * as privateTweenTypes from '@egret/engine/tweenTypes';
import * as TweenAbsentPublic from '@egret/engine';
// TWEEN_IMPORT_CASE no-Tween-value TS2339
TweenAbsentPublic.Tween;
// TWEEN_IMPORT_CASE no-static-get TS2339
TweenAbsentPublic.Tween.get({});
// TWEEN_IMPORT_CASE no-runtime-owner TS2305
import type {TweenOwner as RuntimeTweenOwner} from '@egret/runtime';
void createTweenOwner; void tweenBrand; void createTween; void privateTween; void privateTweenTypes;
