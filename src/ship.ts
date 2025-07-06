import { Scene, Types } from 'phaser';
import { Controls } from './controls';

export type Ship = Types.Physics.Arcade.SpriteWithDynamicBody;

export function createShip(scene: Scene, x: number, y: number): Ship {
  return scene.physics.add.sprite(x, y, 'ship')
    .setScale(0.25)
    .setOrigin(0.5)
    .setCollideWorldBounds(false)
    .setDamping(true)
    .setDrag(0.99)
    .setAngularDrag(400)
    .setMaxVelocity(300);
}

export function updateShipMovement(
  scene: Scene,
  ship: Ship,
  cursors: Controls
) {
    const { left, rotateLeft, right, rotateRight, up } = cursors;
    const leftRotation = left.isDown || rotateLeft.isDown;
    const rightRotation = right.isDown || rotateRight.isDown;

  switch(true) {
    case leftRotation && rightRotation:
        ship.setAngularVelocity(0);
        break;
    case leftRotation:
        ship.setAngularVelocity(-150);
        break;
    case rightRotation:
        ship.setAngularVelocity(150);
        break;
    default:
        ship.setAngularVelocity(0);
  }

  if (up.isDown) {
    const angle = ship.rotation + Phaser.Math.DegToRad(90);
    scene.physics.velocityFromRotation(angle, 200, ship.body.acceleration);
  } else {
    ship.setAcceleration(0);
  }
}

