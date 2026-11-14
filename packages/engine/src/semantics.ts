// SPDX-License-Identifier: Apache-2.0
/** Optional semantic tree of a drawn UI: no page, listener or renderer is loaded by this entry. */
export { createUiSemantics, semanticBoundsOf } from './semanticTree.js';
export { createUiListSemantics, semanticBoxOf } from './semanticList.js';
export type { SemanticListRow, SemanticListSource, UiListSemantics, UiListSemanticsOptions } from './semanticList.js';
export type { SemanticAction, SemanticBounds, SemanticChecked, SemanticDescription, SemanticExtent, SemanticNode, SemanticNodeOptions, SemanticOrientation, SemanticPosition, SemanticRange, SemanticRole, SemanticSnapshot, SemanticSnapshotNode, SemanticsState, UiSemantics, UiSemanticsOptions } from './semanticTypes.js';
