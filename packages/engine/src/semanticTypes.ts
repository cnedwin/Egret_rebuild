// SPDX-License-Identifier: Apache-2.0
/**
 * What a control is to someone who cannot see the canvas. The set is closed: it is the first
 * control set of the UI, and each role is projected to the page in one known way.
 */
export type SemanticRole = 'group' | 'image' | 'text' | 'button' | 'checkbox' | 'switch' | 'radiogroup' | 'radio'
  | 'listbox' | 'option' | 'list' | 'listitem' | 'scrollbar' | 'slider' | 'spinbutton' | 'progressbar' | 'tablist' | 'tab' | 'tabpanel' | 'menu' | 'menuitem' | 'dialog' | 'textbox'
  | 'status' | 'alert';
/** What assistive technology may ask of a node: its activation, or the keyboard focus. */
export type SemanticAction = 'activate' | 'focus';
export type SemanticChecked = boolean | 'mixed';
export type SemanticOrientation = 'horizontal' | 'vertical';
export type SemanticsState = 'active' | 'closed';

/** A rectangle in the logical coordinates of the stage, the ones picking uses. */
export interface SemanticBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
export interface SemanticRange {
  readonly now: number;
  readonly min: number;
  readonly max: number;
}
/** Where an item stands in its whole set, from one. A virtual list reports the set, not what is realized. */
export interface SemanticPosition {
  readonly index: number;
  readonly size: number;
}

/**
 * What a node is at this moment, read from the control that draws it. `describe` returns one of
 * these each time the tree is published, so there is no second copy of the state to keep in step.
 */
export interface SemanticDescription {
  readonly bounds: SemanticBounds;
  /** The accessible name. For a `text` node it is the text itself, and for a `status` or an `alert` the message, which may be empty. */
  readonly name?: string;
  /** The text of a `textbox`. */
  readonly value?: string;
  /** A hidden node is left out with everything under it, and what is under it is not asked. */
  readonly hidden?: boolean;
  readonly disabled?: boolean;
  /** Whether the node holds the keyboard focus of the application. At most one node may. */
  readonly focused?: boolean;
  /** `checkbox`, `switch` and `radio`. Only a checkbox may be 'mixed'. */
  readonly checked?: SemanticChecked;
  /** `option` and `tab`. */
  readonly selected?: boolean;
  /** `button`: whether what it opens is open. */
  readonly expanded?: boolean;
  /** `dialog`: while a modal dialog is published, everything outside it is inert. */
  readonly modal?: boolean;
  /** `textbox`. */
  readonly multiline?: boolean;
  /** `listbox`: whether several of its options may be selected at once. */
  readonly multiple?: boolean;
  /** `scrollbar`, `slider` and `spinbutton`, which need it, and `progressbar`, which without it shows work of unknown length. */
  readonly range?: SemanticRange;
  /** `scrollbar`, `slider`, `tablist` and `menu`. */
  readonly orientation?: SemanticOrientation;
  /** `scrollbar`: the id of the node it scrolls. `tab`: the id of its panel. The node must be published with it. */
  readonly controls?: string;
  /** `radio`, `option`, `listitem`, `tab` and `menuitem`. */
  readonly position?: SemanticPosition;
  /** Reading order among the nodes of one parent, lowest first. Equal values keep the order of addition. */
  readonly order?: number;
}

export interface SemanticNodeOptions {
  /** One to 128 characters, distinct among the nodes of the tree. */
  readonly id: string;
  readonly role: SemanticRole;
  /** The id of the node this one is inside. Without it the node is at the top. */
  readonly parent?: string;
  readonly describe: () => SemanticDescription;
  /** The same activation a completed press or a key reaches. Without it the node cannot be activated. */
  readonly onActivate?: () => void;
  /** Moves the keyboard focus of the application to the control. Without it the node cannot be focused. */
  readonly onFocus?: () => void;
}

export interface SemanticNode {
  readonly id: string;
  readonly role: SemanticRole;
  readonly parent: string | undefined;
  /** False once the node, or a node it is inside, was removed. */
  readonly attached: boolean;
  /** Removes the node and everything inside it. The next publication no longer has them. */
  remove(): void;
}

/** One published node. Frozen, and the same object from one snapshot to the next while nothing in it changed. */
export interface SemanticSnapshotNode {
  readonly id: string;
  readonly role: SemanticRole;
  readonly parent: string | undefined;
  readonly name: string;
  readonly bounds: SemanticBounds;
  readonly disabled: boolean;
  readonly focused: boolean;
  /** Outside the modal dialog that is published last. An inert node refuses every action. */
  readonly inert: boolean;
  readonly actions: readonly SemanticAction[];
  readonly value: string | undefined;
  readonly checked: SemanticChecked | undefined;
  readonly selected: boolean | undefined;
  readonly expanded: boolean | undefined;
  readonly modal: boolean | undefined;
  readonly multiline: boolean | undefined;
  readonly multiple: boolean | undefined;
  readonly range: SemanticRange | undefined;
  readonly orientation: SemanticOrientation | undefined;
  readonly controls: string | undefined;
  readonly position: SemanticPosition | undefined;
}

export interface SemanticSnapshot {
  /** Grows by one with every publication that differs from the one before. */
  readonly revision: number;
  /** The layout revision the bounds belong to, as given to `publish`. */
  readonly layoutRevision: number | undefined;
  /** Every published node, a parent before what is inside it, in reading order. */
  readonly nodes: readonly SemanticSnapshotNode[];
  readonly focused: string | undefined;
}

export interface UiSemanticsOptions {
  /** Most nodes the tree holds at once. Defaults to 256, and is at most 4,096. */
  readonly maxNodes?: number;
}

/**
 * The semantic tree of a UI the application draws: what each control is, what it is called and
 * what state it is in. It is a description of the same controls, read from them at each
 * publication, and it performs the same activations. It draws nothing and touches no page.
 */
export interface UiSemantics {
  readonly state: SemanticsState;
  /** The last publication. Before the first it is revision 0 with no nodes. */
  readonly snapshot: SemanticSnapshot;
  /** Nodes held now, published or not. */
  readonly size: number;
  add(options: SemanticNodeOptions): SemanticNode;
  /**
   * Reads every node and publishes the tree as one snapshot. A failure publishes nothing and the
   * snapshot before it stays. A publication equal to the last returns that snapshot unchanged.
   */
  publish(layoutRevision?: number): SemanticSnapshot;
  /**
   * Performs an action on a published node. False when the node is not published, was removed,
   * is disabled or inert, or does not offer the action.
   */
  perform(id: string, action: SemanticAction): boolean;
  /** Told after each publication that differs. The returned function stops it. */
  observe(listener: (snapshot: SemanticSnapshot, previous: SemanticSnapshot) => void): () => void;
  onClose(listener: () => void): () => void;
  dispose(): void;
}
