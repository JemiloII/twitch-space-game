import { Scene, GameObjects, BlendModes } from 'phaser';

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

const TRAIL_SCALE = 0.03;
const MIN_TRAIL = 0.25;
const CORE_RATIO = 0.35;
const CENTER_RATIO = 0.2;

export class ProjectileSystem {
  scene: Scene;
  projectiles: Record<string, GameObjects.Container> = {};

  constructor(scene: Scene) {
    this.scene = scene;
  }

  updateProjectiles(projectileData: Record<string, ProjectileData>): void {
    for (const id in this.projectiles) {
      if (!projectileData[id]) {
        this.projectiles[id].destroy();
        delete this.projectiles[id];
      }
    }

    for (const id in projectileData) {
      const data = projectileData[id];
      const { x, y, vx, vy, radius } = data;
      const velocity = Math.hypot(vx, vy);
      const angle = Math.atan2(vy, vx);
      const trailLength = Math.max(velocity * TRAIL_SCALE, MIN_TRAIL);
      const coreSize = radius * CORE_RATIO;

      if (!this.projectiles[id]) {
        const container = this.scene.add.container(x, y);

        container.add([
          this.makeTrailGlow(trailLength * 1.8, coreSize * 3, angle, 0.2),
          this.makeTrailGlow(trailLength * 1.1, coreSize * 1.5, angle, 0.6),
          this.makeCore(trailLength, coreSize, angle),
          this.makeCenter(coreSize)
        ]);

        this.projectiles[id] = container;
      } else {
        const projectile = this.projectiles[id];
        projectile.setPosition(x, y);
        for (let i = 0; i < 3; i++) {
          (projectile.list[i] as GameObjects.Graphics).setRotation(angle);
        }
      }
    }
  }

  makeTrailGlow(width: number, height: number, angle: number, alpha: number): GameObjects.Graphics {
    const g = this.scene.add.graphics();
    g.fillGradientStyle(0x00ffff, 0x00ffff, 0x00ffff, 0x00ffff, alpha, alpha, 0, 0);
    g.fillEllipse(0, 0, width, height);
    g.setRotation(angle);
    g.setBlendMode(BlendModes.ADD);
    return g;
  }

  makeCore(width: number, height: number, angle: number): GameObjects.Graphics {
    const g = this.scene.add.graphics();
    g.fillGradientStyle(0xffffff, 0xffffff, 0x00ffff, 0x00ffff, 1.0, 1.0, 0.8, 0.8);
    g.fillEllipse(0, 0, width, height);
    g.setRotation(angle);
    g.setBlendMode(BlendModes.ADD);
    return g;
  }

  makeCenter(coreSize: number): GameObjects.Graphics {
    const g = this.scene.add.graphics();
    g.fillStyle(0xffffff, 1.0);
    g.fillCircle(0, 0, coreSize * CENTER_RATIO);
    g.setBlendMode(BlendModes.ADD);
    return g;
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
