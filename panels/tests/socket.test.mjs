import test from 'node:test';
import assert from 'node:assert/strict';
import { socketHarness } from './helpers/socketHarness.mjs';

const connected = { type: 'connected', id: 'test-player', token: 'test-token' };
test('snapshots keep reaching the scene after a disconnect', () => {
  const h = socketHarness();
  let snapshots = 0;
  const stop = h.api.listen(m => { if (m.type === 'snapshot') snapshots++; });
  h.api.connect();
  h.sockets[0].open(); h.sockets[0].receive(connected);
  h.sockets[0].receive({ type: 'snapshot' });
  h.sockets[0].close(); h.runTimers();
  h.sockets[1].open(); h.sockets[1].receive(connected);
  h.sockets[1].receive({ type: 'snapshot' });
  assert.equal(snapshots, 2);
  h.sockets[0].receive({ type: 'snapshot' });
  assert.equal(snapshots, 2, 'old connections must be ignored');
  stop(); h.sockets[1].receive({ type: 'snapshot' });
  assert.equal(snapshots, 2, 'a stopped scene must not get updates');
});

test('late listeners receive the player ID and forced reconnect has one retry', () => {
  const h = socketHarness();
  h.api.connect(); h.sockets[0].open(); h.sockets[0].receive(connected);
  let id;
  h.api.listen(m => { if (m.type === 'connected') id = m.id; });
  assert.equal(id, connected.id);
  h.sockets[0].receive({ type: 'rejection' });
  assert.equal(h.timers.size, 1);
  h.runTimers(); h.sockets[1].open();
  assert.equal(h.sockets.length, 2);
  assert.equal(h.sockets[1].sent[0].id, null);
});
