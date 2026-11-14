// SPDX-License-Identifier: Apache-2.0

/** The buttons of a pad in the standard layout, by where they are: `a` is the lower face button. */
export type GamepadButtonName = 'a' | 'b' | 'x' | 'y' | 'l1' | 'r1' | 'l2' | 'r2' | 'select' | 'start' | 'l3' | 'r3' | 'up' | 'down' | 'left' | 'right' | 'home';
export type GamepadStickName = 'left' | 'right';
export interface GamepadButtonSample {
  readonly pressed: boolean;
  /** 0 to 1: how far a trigger is pulled. A plain button says 0 or 1. */
  readonly value: number;
}
/** What a host says of one pad at one moment. */
export interface GamepadSample {
  readonly index: number;
  readonly id: string;
  /** 'standard' when the host has arranged the buttons and axes in the standard layout. */
  readonly mapping: string;
  readonly buttons: readonly GamepadButtonSample[];
  /** -1 to 1 each. In the standard layout: left stick x and y, right stick x and y; down and right are positive. */
  readonly axes: readonly number[];
}
export interface GamepadStick {
  readonly x: number;
  readonly y: number;
}
/** A pad that is connected, as of the last sample. */
export interface GamepadPad {
  readonly index: number;
  readonly id: string;
  /** Whether the names of buttons and sticks mean anything for this pad. */
  readonly standard: boolean;
  readonly buttonCount: number;
  readonly axisCount: number;
  /** By name in the standard layout, or by number for any pad. A button the pad does not have is not pressed. */
  pressed(button: GamepadButtonName | number): boolean;
  value(button: GamepadButtonName | number): number;
  /** One axis as the host gave it. */
  axis(index: number): number;
  /** A stick with the dead zone taken out: nothing inside it, and the rest stretched to reach 1. */
  stick(name: GamepadStickName): GamepadStick;
}
export interface GamepadButtonChange {
  readonly pad: number;
  /** The number of the button on its pad. */
  readonly index: number;
  /** Its name, when the pad is in the standard layout and the button has one. */
  readonly name: GamepadButtonName | undefined;
  readonly pressed: boolean;
  readonly value: number;
  readonly timestamp: number;
}
export interface GamepadConnectionChange {
  readonly pad: number;
  readonly id: string;
  readonly connected: boolean;
  readonly standard: boolean;
  readonly timestamp: number;
}
export interface GamepadInputOptions {
  /** The part of a stick around its middle that counts as the middle, 0 to 0.9. Defaults to 0.15. */
  readonly deadZone?: number;
  /** Pads followed at once, 1 to 8. Others are left out. Defaults to 4. */
  readonly maxPads?: number;
  readonly onButton?: (change: GamepadButtonChange) => void;
  readonly onConnection?: (change: GamepadConnectionChange) => void;
}
/**
 * Pads as a stream of samples. It reads no device: a host gives it what every connected pad says,
 * each time it looks, and it tells what changed between one look and the next.
 */
export interface GamepadInput {
  readonly state: 'active' | 'closed';
  /** The pads that are connected, by index. */
  readonly pads: readonly GamepadPad[];
  pad(index: number): GamepadPad | undefined;
  /**
   * Everything that is connected now. A pad that is not among the samples has been taken away:
   * its buttons are let go first. The timestamp is in milliseconds and does not go back.
   */
  sample(samples: readonly (GamepadSample | null | undefined)[], timestamp: number): void;
  /** Lets every button go, as when the page loses the person's attention. The pads stay. */
  release(): void;
  /** Told each press and each letting go, after `onButton`. */
  subscribe(listener: (change: GamepadButtonChange) => void): () => void;
  /** Told after each sample has been taken in, with its timestamp. */
  onSample(listener: (timestamp: number) => void): () => void;
  /** Lets every button go and forgets the pads. A scope can own the input through this. */
  dispose(): void;
}

/** The part of a keyboard input that a pad drives. The logical keyboard input of the Engine is one. */
export interface GamepadKeyTarget {
  keyDown(sample: { readonly code: string; readonly key: string; readonly repeat?: boolean }): boolean;
  keyUp(sample: { readonly code: string; readonly key: string }): boolean;
  moveFocus(direction: 'next' | 'previous', wrap?: boolean): string | undefined;
}
/**
 * What a button does: a key, with the way the focus moves when nobody took the key; or a move of
 * the focus alone.
 */
export type GamepadKeyAction =
  | { readonly key: string; readonly code?: string; readonly otherwise?: 'next' | 'previous' }
  | { readonly focus: 'next' | 'previous' };
export interface GamepadKeysOptions {
  readonly gamepad: GamepadInput;
  readonly keyboard: GamepadKeyTarget;
  /** Only this pad. Without it every pad drives the keys. */
  readonly pad?: number;
  /** Replaces the usual action of a button, or takes it away with `null`. */
  readonly map?: Partial<Record<GamepadButtonName, GamepadKeyAction | null>>;
  /** The stick that also counts as the four directions. Defaults to 'left'; `false` for none. */
  readonly stick?: GamepadStickName | false;
  /** Whether the focus goes round from the last stop to the first. A pad has nowhere else to go: defaults to true. */
  readonly wrap?: boolean;
  /** How far the stick has to be pushed to count, 0.1 to 1. Defaults to 0.5. */
  readonly threshold?: number;
  /** Milliseconds a direction is held before it repeats, and between repeats. Default to 400 and 100. */
  readonly repeatDelay?: number;
  readonly repeatInterval?: number;
}
export interface GamepadKeys {
  /** The keys held down now. */
  readonly held: readonly string[];
  /** Lets the held keys go and stops listening to the pads. */
  dispose(): void;
}
