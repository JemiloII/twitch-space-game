import { Input, Scene } from 'phaser';

const { Keyboard: { KeyCodes } } = Input;

export type Controls = {
  up: Input.Keyboard.Key;
  down: Input.Keyboard.Key;
  left: Input.Keyboard.Key;
  right: Input.Keyboard.Key;
  space: Input.Keyboard.Key;
  shift: Input.Keyboard.Key;
  rotateLeft: Input.Keyboard.Key;
  rotateRight: Input.Keyboard.Key;
};

export function setControls(scene: Scene) {
    return scene.input!.keyboard!.addKeys({
      up: KeyCodes.W,
      down: KeyCodes.S,
      left: KeyCodes.A,
      right: KeyCodes.D,
      rotateLeft: KeyCodes.Q,
      rotateRight: KeyCodes.E
    }) as Controls;
}
