import { Scene, Physics } from 'phaser';
import { RecolorTexture } from './RecolorTexture';
import { LoadSubtexture } from './LoadSubtexture.ts';

export type Ship = Physics.Matter.Sprite;

function colorHash(color: Record<string, string>) {
  const colorEntries = Object.entries(color).sort();
  return colorEntries.map(([from, to]) => `${from.slice(1)}_${to.slice(1)}`).join('_');
}

export function createShip(
  scene: Scene,
  key: string = 'spaceShips_001.png',
  spawn_x: number,
  spawn_y: number,
  color?: Record<string, string>
): Ship {
  let shipKey = key;
  if (!scene.textures.exists(key)) {
    LoadSubtexture(scene, 'spritesheet', key);
  }

  if (color) {
    const colorHashKey = `${key}_${colorHash(color)}`;
    if (!scene.textures.exists(colorHashKey)) {
      RecolorTexture(scene, key, colorHashKey, color);
      shipKey = colorHashKey;
    }
  }

  const ship = scene.matter.add.sprite(spawn_x, spawn_y, shipKey)
    .setScale(0.125)
    .setOrigin(0.5)
    .setFrictionAir(0.025) // Match server configuration
    .setMass(1);
  
  // Set inertia to prevent rotation from collisions
  if (ship.body) {
    (ship.body as any).inertia = Infinity;
  }
  
  return ship;
}
