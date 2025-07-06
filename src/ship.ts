import { Scene, Physics } from 'phaser';
import { Controls } from './controls';

export type Ship = Physics.Matter.Sprite;

export function createShip(scene: Scene, x: number, y: number): Ship {
  const ship = scene.matter.add.sprite(x, y, 'ship')
    .setScale(0.25)
    .setOrigin(0.5)
    .setFrictionAir(0.02)
    .setMass(1);
  
  // Set inertia to prevent rotation from collisions
  if (ship.body) {
    (ship.body as any).inertia = Infinity;
  }
  
  return ship;
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
        ship.setAngularVelocity(-3);
        break;
    case rightRotation:
        ship.setAngularVelocity(3);
        break;
    default:
        ship.setAngularVelocity(0);
  }

  if (up.isDown) {
    const angle = ship.rotation;
    const force = 0.002;
    ship.applyForce(new Phaser.Math.Vector2(
      Math.cos(angle) * force,
      Math.sin(angle) * force
    ));
  }
}

