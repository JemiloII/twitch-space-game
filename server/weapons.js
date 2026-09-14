import { createProjectile } from './projectiles.js';

// Run once per simulation tick. Keyboard repeat speed must not set the fire rate.
export function updateWeapons(players, now = Date.now(), shoot = createProjectile) {
  for (const [playerId, player] of Object.entries(players)) {
    if (!player.body || !player.input.space || !player.authExpiresAt || player.authExpiresAt <= now) continue;
    player.gunShotTimes ??= {};
    for (const [index, gun] of (player.gunConfigs || []).entries()) {
      const gunId = `gun_${index}`;
      const lastShot = player.gunShotTimes[gunId];
      if (lastShot !== undefined && now - lastShot < gun.fireRate) continue;
      const body = player.body;
      const cos = Math.cos(body.angle), sin = Math.sin(body.angle);
      shoot(playerId,
        body.position.x + gun.x * cos - gun.y * sin,
        body.position.y + gun.x * sin + gun.y * cos,
        body.angle * 180 / Math.PI + gun.rotation,
        gun, { x: body.velocity.x, y: body.velocity.y });
      player.gunShotTimes[gunId] = now;
    }
  }
}
