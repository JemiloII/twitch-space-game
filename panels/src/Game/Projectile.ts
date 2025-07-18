import { Scene, GameObjects } from 'phaser';

export interface ProjectileData {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  playerId: string;
  timestamp: number;
  damage: number;
  radius: number;
}

export class ProjectileSystem {
  private scene: Scene;
  private projectiles: Record<string, GameObjects.Container> = {};

  constructor(scene: Scene) {
    this.scene = scene;
  }

  updateProjectiles(projectileData: Record<string, ProjectileData>): void {
    // Remove old projectiles
    for (const id in this.projectiles) {
      if (!projectileData[id]) {
        this.projectiles[id].destroy();
        delete this.projectiles[id];
      }
    }

    // Add/update projectiles
    for (const id in projectileData) {
      const data = projectileData[id];
      
      if (!this.projectiles[id]) {
        // Create new streaky light projectile
        const projectile = this.scene.add.container(data.x, data.y);
        
        // Calculate velocity magnitude and direction
        const velocity = Math.sqrt(data.vx * data.vx + data.vy * data.vy);
        const angle = Math.atan2(data.vy, data.vx);
        
        // Create streaky trail based on velocity (very short)
        const trailLength = Math.max(velocity * 0.04, 4); // Even shorter trail
        const coreSize = data.radius * 1.0;
        
        // Outer glow (largest, most transparent)
        const outerGlow = this.scene.add.graphics();
        outerGlow.fillGradientStyle(0x00FFFF, 0x00FFFF, 0x00FFFF, 0x00FFFF, 0.2, 0.2, 0.0, 0.0);
        outerGlow.fillEllipse(0, 0, trailLength * 2, coreSize * 4);
        outerGlow.setRotation(angle);
        outerGlow.setBlendMode(Phaser.BlendModes.ADD);
        
        // Middle glow (medium size, more opaque)
        const middleGlow = this.scene.add.graphics();
        middleGlow.fillGradientStyle(0x00FFFF, 0x00FFFF, 0x00FFFF, 0x00FFFF, 0.6, 0.6, 0.0, 0.0);
        middleGlow.fillEllipse(0, 0, trailLength * 1.2, coreSize * 2);
        middleGlow.setRotation(angle);
        middleGlow.setBlendMode(Phaser.BlendModes.ADD);
        
        // Core streak (bright center)
        const core = this.scene.add.graphics();
        core.fillGradientStyle(0xFFFFFF, 0xFFFFFF, 0x00FFFF, 0x00FFFF, 1.0, 1.0, 0.8, 0.8);
        core.fillEllipse(0, 0, trailLength, coreSize);
        core.setRotation(angle);
        core.setBlendMode(Phaser.BlendModes.ADD);
        
        // Bright center point
        const centerPoint = this.scene.add.graphics();
        centerPoint.fillStyle(0xFFFFFF, 1.0);
        centerPoint.fillCircle(0, 0, coreSize * 0.3);
        centerPoint.setBlendMode(Phaser.BlendModes.ADD);
        
        // Add all elements to container
        projectile.add([outerGlow, middleGlow, core, centerPoint]);
        
        this.projectiles[id] = projectile;
        
        console.log(`[client] Created streaky projectile visual ${id} at (${data.x.toFixed(1)}, ${data.y.toFixed(1)}) vel=${velocity.toFixed(1)} trail=${trailLength.toFixed(1)}px`);
      } else {
        // Update existing projectile position
        this.projectiles[id].x = data.x;
        this.projectiles[id].y = data.y;
        
        // Update rotation based on velocity
        const angle = Math.atan2(data.vy, data.vx);
        const velocity = Math.sqrt(data.vx * data.vx + data.vy * data.vy);
        
        // Update all child graphics rotations
        this.projectiles[id].list.forEach((child, index) => {
          if (index < 3) { // First 3 elements need rotation update
            (child as GameObjects.Graphics).setRotation(angle);
          }
        });
      }
    }
  }

  destroyProjectiles(): void {
    for (const id in this.projectiles) {
      this.projectiles[id].destroy();
    }
    this.projectiles = {};
  }

  getProjectileCount(): number {
    return Object.keys(this.projectiles).length;
  }
}