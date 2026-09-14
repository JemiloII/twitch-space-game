import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/Game/Ship.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

function makeScene() {
  return {
    textures: { exists: () => true },
    matter: { add: { sprite(x, y, key) {
      return {
        x, y, key, scene: {}, body: {}, scale: 0,
        setScale(scale) {
          assert.ok(this.body, 'cannot resize a destroyed ship');
          this.scale = scale;
          return this;
        },
        setOrigin() { return this; }, setFrictionAir() { return this; }, setMass() { return this; },
        destroy() { this.scene = undefined; this.body = undefined; }
      };
    } } }
  };
}

test('a slow ship load updates the current ship and leaves a removed ship alone', async () => {
  let finish;
  const data = new Promise(resolve => { finish = resolve; });
  const exported = {};
  class ThrusterSystem { createThrusters() {} }
  class GunSystem { loadGunConfigs() {} }
  vm.runInNewContext(compiled, {
    exports: exported,
    fetch: async () => ({ json: () => data }),
    require: () => ({ ThrusterSystem, GunSystem })
  });
  const scene = makeScene();
  const oldShip = exported.createShip(scene, 'spaceShips_001.png', 100, 100);
  oldShip.destroy();
  const currentShip = exported.createShip(scene, 'spaceShips_002.png', 200, 200);
  finish([
    { subtexture: 'spaceShips_001.png', scale: 0.15 },
    { subtexture: 'spaceShips_002.png', scale: 0.14 }
  ]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(oldShip.scale, 0.125);
  assert.equal(currentShip.scale, 0.14);
});
