import Phaser, { Scene, Physics } from 'phaser';
import { Controls } from './controls';
import { RecolorTexture } from './RecolorTexture';

export type Ship = Physics.Matter.Sprite;

function colorHash(color: Record<string, string>) {
  const colorEntries = Object.entries(color).sort();
  return colorEntries.map(([from, to]) => `${from.slice(1)}_${to.slice(1)}`).join('_');
}

export function createShip(scene: Scene, x: number, y: number, color?: Record<string, string>): Ship {
  let key = 'ship';
  if (color) {
    key += `_${colorHash(color)}`;
    
    if (!scene.textures.exists(key)) {
      RecolorTexture(scene, 'ship', key, color);
    }
  }

  const ship = scene.matter.add.sprite(x, y, key)
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

export function updateShipMovement(ship: Ship, cursors: Controls) {
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

