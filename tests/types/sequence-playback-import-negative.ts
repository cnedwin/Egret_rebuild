// SPDX-License-Identifier: Apache-2.0
// Import admission cases stay separate from valid consumers and member/type cases.

// SEQP_TYPE_CASE SEQP-I01
import { SequencePlayback } from '@egret/engine';
// SEQP_TYPE_CASE SEQP-I02
import { SequencePlaybackOptions } from '@egret/engine';
// SEQP_TYPE_CASE SEQP-I03
import { SequencePlaybackState } from '@egret/engine';
// SEQP_TYPE_CASE SEQP-I04
import { createSequencePlayback } from '@egret/engine';
// SEQP_TYPE_CASE SEQP-I05
import { createSequencePlaybackOwner } from '@egret/engine';
// SEQP_TYPE_CASE SEQP-I06
import type { SequencePlaybackOwner } from '@egret/engine';
// SEQP_TYPE_CASE SEQP-I07
import type { SequencePlaybackContext } from '@egret/engine';
// SEQP_TYPE_CASE SEQP-I08
import { sequencePlaybackBrand } from '@egret/engine';
// SEQP_TYPE_CASE SEQP-I09
import * as privateOwner from '@egret/engine/sequencePlayback';
// SEQP_TYPE_CASE SEQP-I10
import type { SequencePlayback as PrivatePlayback } from '@egret/engine/sequencePlaybackTypes';
// SEQP_TYPE_CASE SEQP-I11
import type { SequencePlayback as RuntimePlayback } from '@egret/runtime';
// SEQP_TYPE_CASE SEQP-I12
import type { SequencePlaybackOptions as RuntimePlaybackOptions } from '@egret/runtime';
// SEQP_TYPE_CASE SEQP-I13
import type { SequencePlaybackState as RuntimePlaybackState } from '@egret/runtime';
