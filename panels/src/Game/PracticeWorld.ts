import type { GunConfig } from './Gun';
import type { ProjectileData } from './Projectile';

export interface PracticeShipDefinition {
  subtexture: string;
  guns?: GunConfig[];
}

export interface PracticeInput {
  up?: boolean;
  left?: boolean;
  right?: boolean;
  rotateLeft?: boolean;
  rotateRight?: boolean;
  space?: boolean;
}

const WIDTH = 800, HEIGHT = 450, STEP = 1000 / 60;
const wrap = (value: number, size: number) => (value % size + size) % size;

// A browser-only world. It never sends controls or preferences to the live server.
export class PracticeWorld {
  readonly playerId = 'practice-player';
  readonly ship: PracticeShipDefinition;
  private x = WIDTH / 2;
  private y = HEIGHT / 2;
  private vx = 0;
  private vy = 0;
  private rotation = -Math.PI / 2;
  private elapsed = 0;
  private accumulated = 0;
  private nextId = 0;
  private nextShot: number[] = [];
  private input: PracticeInput = {};
  private projectiles: Record<string, ProjectileData & { lifetime: number }> = {};

  constructor(ship: PracticeShipDefinition) {
    this.ship = ship;
  }

  update(delta: number, input: PracticeInput) {
    this.input = { ...input };
    this.accumulated += Math.max(0, Math.min(delta, 100));
    while (this.accumulated >= STEP - 0.0001) {
      this.step();
      this.accumulated -= STEP;
    }
  }

  private step() {
    this.elapsed += STEP;
    const seconds = STEP / 1000;
    const turn = Number(Boolean(this.input.right || this.input.rotateRight)) -
      Number(Boolean(this.input.left || this.input.rotateLeft));
    this.rotation += turn * 5 * seconds;
    if (this.input.up) {
      this.vx += Math.cos(this.rotation) * 1000 * seconds;
      this.vy += Math.sin(this.rotation) * 1000 * seconds;
    }
    this.vx *= 0.975;
    this.vy *= 0.975;
    this.x = wrap(this.x + this.vx * seconds, WIDTH);
    this.y = wrap(this.y + this.vy * seconds, HEIGHT);

    for (const [id, shot] of Object.entries(this.projectiles)) {
      shot.x = wrap(shot.x + shot.vx * seconds, WIDTH);
      shot.y = wrap(shot.y + shot.vy * seconds, HEIGHT);
      if (this.elapsed - shot.timestamp >= shot.lifetime) delete this.projectiles[id];
    }
    if (!this.input.space) return;
    for (const [index, gun] of (this.ship.guns || []).entries()) {
      if (this.elapsed + 0.0001 < (this.nextShot[index] || 0) || Object.keys(this.projectiles).length >= 100) continue;
      const angle = this.rotation + (gun.rotation + (Math.random() - 0.5) * gun.spread) * Math.PI / 180;
      const cos = Math.cos(this.rotation), sin = Math.sin(this.rotation);
      const id = `practice-shot-${++this.nextId}`;
      this.projectiles[id] = {
        id, playerId: this.playerId,
        x: wrap(this.x + gun.x * cos - gun.y * sin, WIDTH),
        y: wrap(this.y + gun.x * sin + gun.y * cos, HEIGHT),
        vx: Math.cos(angle) * gun.projectileSpeed + this.vx,
        vy: Math.sin(angle) * gun.projectileSpeed + this.vy,
        timestamp: this.elapsed, lifetime: gun.projectileLifetime,
        damage: gun.damage, radius: 2
      };
      this.nextShot[index] = this.elapsed + gun.fireRate;
    }
  }

  snapshot() {
    return {
      type: 'snapshot',
      players: {
        [this.playerId]: {
          x: this.x, y: this.y, rotation: this.rotation,
          username: 'You', key: this.ship.subtexture, input: { ...this.input }
        }
      },
      projectiles: Object.fromEntries(Object.entries(this.projectiles).map(([id, shot]) => [id, { ...shot }]))
    };
  }
}
