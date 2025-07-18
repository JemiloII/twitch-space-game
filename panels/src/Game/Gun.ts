import { Scene } from 'phaser';

export interface GunConfig {
  x: number;
  y: number;
  rotation: number;
  fireRate: number;
  projectileSpeed: number;
  projectileLifetime: number;
  damage: number;
  spread: number;
}

export class GunSystem {
  private scene: Scene;
  private gunConfigs: GunConfig[] = [];

  constructor(scene: Scene) {
    this.scene = scene;
  }

  loadGunConfigs(gunConfigs: GunConfig[]): void {
    this.gunConfigs = gunConfigs;
    console.log(`[client] Loaded ${gunConfigs.length} gun configurations`);
  }

  getGunConfigs(): GunConfig[] {
    return this.gunConfigs;
  }

  getGunCount(): number {
    return this.gunConfigs.length;
  }

  // Visual gun rendering could be added here if needed
  // For now, guns are invisible - only projectiles are visible
  
  // Helper method to calculate gun positions (used by server)
  calculateGunPositions(shipX: number, shipY: number, shipRotation: number): Array<{x: number, y: number, angle: number}> {
    const positions: Array<{x: number, y: number, angle: number}> = [];
    
    this.gunConfigs.forEach(gunConfig => {
      const cos = Math.cos(shipRotation);
      const sin = Math.sin(shipRotation);
      
      // Calculate gun position relative to ship
      const gunX = shipX + (gunConfig.x * cos - gunConfig.y * sin);
      const gunY = shipY + (gunConfig.x * sin + gunConfig.y * cos);
      const gunAngle = shipRotation + (gunConfig.rotation * Math.PI / 180);
      
      positions.push({
        x: gunX,
        y: gunY,
        angle: gunAngle
      });
    });
    
    return positions;
  }
}