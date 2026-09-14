import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectile, updateProjectiles, checkCollisions, getProjectileSnapshot, removeProjectile } from '../projectiles.js';

test('shots move, ignore their owner, and disappear when they hit another ship', () => {
  const shot = createProjectile('owner', 100, 100, 0, {
    projectileSpeed: 600, projectileLifetime: 1000, damage: 2, spread: 0
  });
  updateProjectiles(1 / 60);
  assert.equal(shot.x, 110);
  assert.equal(shot.y, 100);
  assert.deepEqual(checkCollisions({ owner: { body: { position: { x: 110, y: 100 } } } }), []);
  const hits = checkCollisions({ target: { body: { position: { x: 110, y: 100 } } } });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].damage, 2);
  assert.equal(getProjectileSnapshot()[shot.id], undefined);
});

test('old shots expire even without a collision', () => {
  const shot = createProjectile('owner', 100, 100, 0, { projectileSpeed: 100, projectileLifetime: 100 });
  try {
    shot.timestamp -= 101;
    updateProjectiles(0);
    assert.equal(getProjectileSnapshot()[shot.id], undefined);
  } finally {
    removeProjectile(shot.id);
  }
});
