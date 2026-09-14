import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import express from 'express';
import { verifyTwitchToken, bindPlayerIdentity, createNameResolver } from '../auth.js';
import { createPlayerApi } from '../playerApi.js';

const key = crypto.randomBytes(32);
const env = { TWITCH_EXTENSION_SECRET: key.toString('base64'), TWITCH_CHANNEL_ID: '10' };
const claims = { user_id: '123', opaque_user_id: 'U123', channel_id: '10', role: 'viewer', exp: Math.floor(Date.now() / 1000) + 3600 };
const sign = (changes = {}, options = {}) => jwt.sign({ ...claims, ...changes }, key, { algorithm: 'HS256', ...options });

test('only signed, linked, current Twitch player tokens are accepted', () => {
  assert.equal(verifyTwitchToken(sign(), env).userId, '123');
  for (const token of [undefined, 'bad', sign({ exp: 1 }), sign({ role: 'external' }),
    sign({ user_id: undefined }), sign({ channel_id: '20' }), sign({}, { algorithm: 'HS384' }),
    jwt.sign(claims, crypto.randomBytes(32))]) {
    assert.throws(() => verifyTwitchToken(token, env));
  }
  const parts = sign().split('.');
  parts[1] = Buffer.from(JSON.stringify({ ...claims, user_id: '999' })).toString('base64url');
  assert.throws(() => verifyTwitchToken(parts.join('.'), env));
  assert.throws(() => verifyTwitchToken(sign(), {}));
});

test('a game session cannot be taken over by a different Twitch account', () => {
  const player = {};
  bindPlayerIdentity(player, verifyTwitchToken(sign(), env));
  assert.throws(() => bindPlayerIdentity(player, verifyTwitchToken(sign({ user_id: '999' }), env)));
  assert.equal(player.twitchUserId, '123');
});

test('the name lookup uses the signed player ID and rejects a different account', async () => {
  const identity = verifyTwitchToken(sign(), env);
  const resolve = createNameResolver({ TWITCH_CLIENT_ID: 'client' }, async url => {
    assert.equal(new URL(url).searchParams.get('id'), '123');
    return { ok: true, json: async () => ({ data: [{ id: '999', display_name: 'SomeoneElse' }] }) };
  });
  await assert.rejects(resolve(identity, 'test-helix-token'));
});

test('HTTP preferences refuse strangers and ignore forged target IDs', async () => {
  const reads = [], writes = [];
  const app = express();
  app.use(express.json());
  app.use('/api/players', createPlayerApi({
    authenticate: token => verifyTwitchToken(token, env),
    resolveName: async () => 'VerifiedPlayer',
    validShip: key => key === 'spaceShips_001.png',
    getPreferences: async (...args) => { reads.push(args); return { selectedShip: 'spaceShips_001.png' }; },
    savePreferences: async (...args) => { writes.push(args); return true; }
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/players`;
  try {
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ twitchUserId: '999', selectedShip: 'spaceShips_001.png' }) })).status, 401);
    assert.equal(writes.length, 0);
    const headers = { Authorization: `Bearer ${sign()}`, 'Content-Type': 'application/json' };
    assert.equal((await fetch(url + '?twitchUserId=999', { headers })).status, 200);
    assert.deepEqual(reads[0], ['123', 'U123']);
    assert.equal((await fetch(url, { method: 'POST', headers, body: JSON.stringify({
      twitchUserId: '999', twitchUsername: 'SomeoneElse', twitchOpaqueId: 'U999', selectedShip: 'spaceShips_001.png'
    }) })).status, 200);
    assert.deepEqual(writes[0], ['123', 'VerifiedPlayer', 'U123', 'spaceShips_001.png', {}]);
    assert.equal((await fetch(url, { method: 'POST', headers, body: JSON.stringify({ selectedShip: 'missing.png' }) })).status, 400);
    assert.equal(writes.length, 1);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
