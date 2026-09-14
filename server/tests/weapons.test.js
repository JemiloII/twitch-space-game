import test from 'node:test';
import assert from 'node:assert/strict';
import { updateWeapons } from '../weapons.js';

test('holding fire keeps shooting at each gun rate without more key messages', () => {
  const shots = [];
  const player = {
    body: { position: { x: 100, y: 100 }, angle: 0, velocity: { x: 0, y: 0 } },
    input: { space: true }, authExpiresAt: 10000,
    gunConfigs: [{ x: 20, y: 0, rotation: 0, fireRate: 100 }, { x: 20, y: 5, rotation: 0, fireRate: 200 }]
  };
  const players = { player };
  const shoot = (...args) => shots.push(args);
  for (const now of [1000, 1050, 1100, 1150, 1200]) updateWeapons(players, now, shoot);
  assert.equal(shots.length, 5);
  assert.equal(shots[0][1], 120);
  player.input.space = false;
  updateWeapons(players, 2000, shoot);
  assert.equal(shots.length, 5, 'releasing fire stops shots');
  player.input.space = true;
  player.authExpiresAt = 2000;
  updateWeapons(players, 2100, shoot);
  assert.equal(shots.length, 5, 'expired players cannot keep firing');
});
