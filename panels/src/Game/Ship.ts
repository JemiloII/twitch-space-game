import { Scene, Physics } from 'phaser';
import { RecolorTexture } from './RecolorTexture';
import { LoadSubtexture } from './LoadSubtexture.ts';
import { ThrusterSystem, type ThrusterConfig } from './Thruster';

export type Ship = Physics.Matter.Sprite & {
  thrusterSystem?: ThrusterSystem;
  thrusterConfigs?: ThrusterConfig[];
};

function colorHash(color: Record<string, string>) {
  const colorEntries = Object.entries(color).sort();
  return colorEntries.map(([from, to]) => `${from.slice(1)}_${to.slice(1)}`).join('_');
}

async function loadThrusterConfigs(key: string): Promise<ThrusterConfig[]> {
  try {
    const response = await fetch('/json/ships.json');
    const ships = await response.json();
    const ship = ships.find((s: any) => s.subtexture?.includes(key.replace('.png', '')));
    return ship?.thrusters || [];
  } catch (error) {
    console.warn('Failed to load thruster configs:', error);
    return [];
  }
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
    .setMass(1) as Ship;
  
  // Set inertia to prevent rotation from collisions
  if (ship.body) {
    (ship.body as any).inertia = Infinity;
  }
  
  // Initialize thruster system
  ship.thrusterSystem = new ThrusterSystem(scene);
  
  // Load and create thrusters asynchronously
  loadThrusterConfigs(key).then(thrusterConfigs => {
    ship.thrusterConfigs = thrusterConfigs;
    if (thrusterConfigs.length > 0) {
      ship.thrusterSystem!.createThrusters(ship, thrusterConfigs);
    }
  });
  
  return ship;
}

export function updateShipThrusters(ship: Ship, isThrusting: boolean): void {
  if (ship.thrusterSystem && ship.thrusterConfigs) {
    ship.thrusterSystem.updateThrusterPositions(ship, ship.thrusterConfigs);
    
    if (isThrusting) {
      ship.thrusterSystem.startThrusterAnimation();
    } else {
      ship.thrusterSystem.stopThrusterAnimation();
    }
  }
}

export function destroyShipThrusters(ship: Ship): void {
  if (ship.thrusterSystem) {
    ship.thrusterSystem.destroyThrusters();
  }
}
