// Configurable world settings per server instance
export const WORLD_CONFIG = {
  width: parseInt(process.env.WORLD_WIDTH) || 800,
  height: parseInt(process.env.WORLD_HEIGHT) || 450,
  maxProjectiles: parseInt(process.env.MAX_PROJECTILES) || 100,
  projectileLifetime: Math.min(parseInt(process.env.PROJECTILE_LIFETIME) || 5000, 5000) // 5 second max
};

console.log('[config] World configuration loaded:', WORLD_CONFIG);