import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const exported = {};
const source = fs.readFileSync(new URL('../src/Game/PracticeWorld.ts', import.meta.url), 'utf8');
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: exported });
const definitions = JSON.parse(fs.readFileSync(new URL('../public/json/ships.json', import.meta.url), 'utf8'));
const ship = world => world.snapshot().players[world.playerId];
const advance = (world, frames, input) => { for (let i = 0; i < frames; i++) world.update(1000 / 60, input); };

test('practice spawns a visible ship, flies, turns, and wraps around the world', () => {
  const world = new exported.PracticeWorld(definitions[0]);
  assert.equal(ship(world).key, 'spaceShips_001.png');
  assert.equal(ship(world).x, 400);
  advance(world, 30, { up: true });
  assert.ok(ship(world).y < 225);
  const angle = ship(world).rotation;
  advance(world, 30, { right: true, up: true });
  assert.ok(ship(world).rotation > angle);
  advance(world, 600, { up: true });
  assert.ok(ship(world).x >= 0 && ship(world).x < 800);
  assert.ok(ship(world).y >= 0 && ship(world).y < 450);
});

test('practice fires while held, expires shots, and supports changing ships', () => {
  const world = new exported.PracticeWorld(definitions[1]);
  advance(world, 60, { space: true });
  const shots = Object.values(world.snapshot().projectiles);
  assert.ok(shots.length > 2, 'both guns keep firing');
  assert.ok(shots.every(s => Number.isFinite(s.x) && Number.isFinite(s.vx)));
  advance(world, 300, {});
  assert.equal(Object.keys(world.snapshot().projectiles).length, 0);
  const unarmed = new exported.PracticeWorld(definitions[7]);
  advance(unarmed, 60, { space: true });
  assert.equal(ship(unarmed).key, 'spaceShips_008.png');
  assert.equal(Object.keys(unarmed.snapshot().projectiles).length, 0);
});
