import crypto from 'node:crypto';
import { WORLD_CONFIG } from './config.js';

const projectiles = {};

export function createProjectile(playerId, x, y, angle, gunConfig, shipVelocity = { x: 0, y: 0 }) {
  const id = crypto.randomUUID();
  const radians = angle * Math.PI / 180;
  
  // Apply spread if configured
  const spreadRadians = (gunConfig.spread || 0) * Math.PI / 180;
  const finalAngle = radians + (Math.random() - 0.5) * spreadRadians;
  
  // Calculate projectile velocity (gun velocity + ship velocity for inheritance)
  const gunVx = Math.cos(finalAngle) * gunConfig.projectileSpeed;
  const gunVy = Math.sin(finalAngle) * gunConfig.projectileSpeed;
  
  projectiles[id] = {
    id,
    x,
    y,
    vx: gunVx + shipVelocity.x,
    vy: gunVy + shipVelocity.y,
    playerId,
    timestamp: Date.now(),
    lifetime: Math.min(gunConfig.projectileLifetime || 3000, WORLD_CONFIG.projectileLifetime),
    damage: gunConfig.damage || 1,
    radius: 2
  };
  
  console.log(`[projectile] Created projectile ${id} for player ${playerId} at (${x.toFixed(1)}, ${y.toFixed(1)}) angle ${(angle).toFixed(1)}° with ship velocity (${shipVelocity.x.toFixed(1)}, ${shipVelocity.y.toFixed(1)})`);
  return projectiles[id];
}

export function updateProjectiles(deltaTime) {
  const now = Date.now();
  let removed = 0;
  
  for (const id in projectiles) {
    const projectile = projectiles[id];
    
    // Update position
    projectile.x += projectile.vx * deltaTime;
    projectile.y += projectile.vy * deltaTime;
    
    // World wrapping (using configurable world size)
    if (projectile.x < 0) projectile.x = WORLD_CONFIG.width;
    if (projectile.x > WORLD_CONFIG.width) projectile.x = 0;
    if (projectile.y < 0) projectile.y = WORLD_CONFIG.height;
    if (projectile.y > WORLD_CONFIG.height) projectile.y = 0;
    
    // Lifetime check
    if (now - projectile.timestamp > projectile.lifetime) {
      delete projectiles[id];
      removed++;
    }
  }
  
  // Log cleanup every 5 seconds
  if (removed > 0 && now % 5000 < 16.67) {
    console.log(`[projectile] Cleaned up ${removed} expired projectiles. Active: ${Object.keys(projectiles).length}`);
  }
}

export function checkCollisions(players) {
  const hits = [];
  
  for (const projId in projectiles) {
    const projectile = projectiles[projId];
    
    for (const playerId in players) {
      // Skip self-collision
      if (playerId === projectile.playerId) continue;
      
      const player = players[playerId];
      const dx = projectile.x - player.body.position.x;
      const dy = projectile.y - player.body.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Simple circle collision (projectile radius + player radius)
      // Player radius is 10 pixels (from createPlayerBody), projectile radius is 2 pixels
      if (distance < projectile.radius + 10) {
        hits.push({
          projectileId: projId,
          playerId: playerId,
          damage: projectile.damage,
          shooterId: projectile.playerId
        });
        
        console.log(`[hit] Player ${playerId} hit by projectile from ${projectile.playerId} for ${projectile.damage} damage`);
        
        // Remove projectile after hit
        delete projectiles[projId];
        break;
      }
    }
  }
  
  return hits;
}

export function getProjectileSnapshot() {
  return { ...projectiles };
}

export function removeProjectile(id) {
  delete projectiles[id];
}

export function getProjectileCount() {
  return Object.keys(projectiles).length;
}

// Clean up old projectiles periodically
setInterval(() => {
  const now = Date.now();
  const maxAge = WORLD_CONFIG.projectileLifetime + 1000; // 1 second grace period
  let cleaned = 0;
  
  for (const id in projectiles) {
    const projectile = projectiles[id];
    if (now - projectile.timestamp > maxAge) {
      delete projectiles[id];
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`[projectile] Emergency cleanup: removed ${cleaned} stuck projectiles`);
  }
}, 10000); // Check every 10 seconds