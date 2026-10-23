// SPDX-License-Identifier: Apache-2.0
/** Optional owned sequence controls share the Engine clock without loading into the default entry. */
export {createSequenceController} from './sequenceController.js';
export type {SequenceMarker, SequenceControllerOptions, SequenceControllerState,
  SequenceEventSource, SequenceControllerEvent, SequenceSeekRequest,
  SequenceControllerStatus, SequenceController} from './types.js';
