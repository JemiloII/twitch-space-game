import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createSessionSigner, readSessionSecret } from '../token.js';

test('only a token signed by this server is accepted', () => {
  const id = crypto.randomUUID();
  const signer = createSessionSigner(crypto.randomBytes(32));
  const other = createSessionSigner(crypto.randomBytes(32));
  assert.equal(signer.verify(id, signer.sign(id)), true);
  assert.equal(signer.verify(id, other.sign(id)), false);
  const oldToken = crypto.createHmac('sha256', 'your-secret-key').update(id).digest('hex');
  assert.equal(signer.verify(id, oldToken), false);
  for (const token of [null, '', 'bad', 'z'.repeat(64)]) assert.equal(signer.verify(id, token), false);
  assert.equal(signer.verify('__proto__', signer.sign('__proto__')), false);
});

test('production needs a private key and local starts use fresh keys', () => {
  assert.throws(() => readSessionSecret({ NODE_ENV: 'production' }), /SESSION_SECRET/);
  assert.throws(() => readSessionSecret({ SESSION_SECRET: 'short' }), /32 bytes/);
  assert.notDeepEqual(readSessionSecret({}), readSessionSecret({}));
});
