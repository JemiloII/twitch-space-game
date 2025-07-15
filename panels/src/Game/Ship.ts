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

async function loadShipData(key: string): Promise<{thrusters: ThrusterConfig[], scale: number}> {
  try {
    const response = await fetch('/json/ships.json');
    const ships = await response.json();
    const ship = ships.find((s: any) => s.subtexture?.includes(key.replace('.png', '')));
    return {
      thrusters: ship?.thrusters || [],
      scale: ship?.scale || 0.125 // fallback to original hardcoded value
    };
  } catch (error) {
    console.warn('Failed to load ship data:', error);
    return {
      thrusters: [],
      scale: 0.125 // fallback to original hardcoded value
    };
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
    .setScale(0.125) // Default scale, will be updated from JSON
    .setOrigin(0.5)
    .setFrictionAir(0.025) // Match server configuration
    .setMass(1) as Ship;
  
  // Set inertia to prevent rotation from collisions
  if (ship.body) {
    (ship.body as any).inertia = Infinity;
  }
  
  // Initialize thruster system
  ship.thrusterSystem = new ThrusterSystem(scene);
  
  // Load ship data and apply scale and thrusters asynchronously
  loadShipData(key).then(shipData => {
    // Apply scale from JSON data
    ship.setScale(shipData.scale);
    
    // Set up thrusters
    ship.thrusterConfigs = shipData.thrusters;
    if (shipData.thrusters.length > 0) {
      ship.thrusterSystem!.createThrusters(ship, shipData.thrusters);
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
