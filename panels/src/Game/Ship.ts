import Phaser, { Scene, Physics } from 'phaser';
import { type Controls } from './Controls.ts';
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
    .setFrictionAir(0.025) // Match server configuration
    .setMass(1);
  
  // Set inertia to prevent rotation from collisions
  if (ship.body) {
    (ship.body as any).inertia = Infinity;
  }
  
  return ship;
}

// Physics configuration matching server
const PHYSICS_CONFIG = {
  rotationSpeed: 5,
  forceMultiplier: 0.0005,
  speed: 40
};

export function updateShipMovement(ship: Ship, cursors: Controls) {
  const { left, rotateLeft, right, rotateRight, up } = cursors;
  const leftRotation = left.isDown || rotateLeft.isDown;
  const rightRotation = right.isDown || rotateRight.isDown;
  
  const tickRate = 1 / 60;

  // Handle rotation to match server logic
  if (leftRotation && !rightRotation) {
    ship.setAngularVelocity(-PHYSICS_CONFIG.rotationSpeed);
  } else if (rightRotation && !leftRotation) {
    ship.setAngularVelocity(PHYSICS_CONFIG.rotationSpeed);
  } else {
    ship.setAngularVelocity(0);
  }

  if (up.isDown) {
    const angle = ship.rotation;
    const force = PHYSICS_CONFIG.speed * tickRate * PHYSICS_CONFIG.forceMultiplier;
    ship.applyForce(new Phaser.Math.Vector2(
      Math.cos(angle) * force,
      Math.sin(angle) * force
    ));
  }
}

