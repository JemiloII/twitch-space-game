import { Scene } from 'phaser';

export function createBackground(scene: Scene) {
  scene.add.image(0, 0, 'sky')
    .setOrigin(0)
    .setDisplaySize(900, 450);
}
