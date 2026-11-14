// SPDX-License-Identifier: Apache-2.0
/** Optional gamepad input, free of the DOM; importing it reads no device and starts no work. */
export { createGamepadInput } from './gamepadInput.js';
export { bindGamepadKeys } from './gamepadKeys.js';
export type {
  GamepadButtonChange, GamepadButtonName, GamepadButtonSample, GamepadConnectionChange, GamepadInput, GamepadInputOptions, GamepadKeyAction, GamepadKeys,
  GamepadKeysOptions, GamepadKeyTarget, GamepadPad, GamepadSample, GamepadStick, GamepadStickName,
} from './gamepadTypes.js';
