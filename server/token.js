import crypto from 'node:crypto';

export function readSessionSecret(env = process.env) {
  if (env.SESSION_SECRET) {
    if (Buffer.byteLength(env.SESSION_SECRET) < 32) {
      throw new Error('SESSION_SECRET must contain at least 32 bytes.');
    }
    return env.SESSION_SECRET;
  }
  if (env.NODE_ENV === 'production') {
    throw new Error('Set a private SESSION_SECRET before starting the production server.');
  }
  // Local sessions may reset on restart. Never use a public fallback key.
  return crypto.randomBytes(32);
}

export function createSessionSigner(secret) {
  const sign = id => crypto.createHmac('sha256', secret).update(id).digest('hex');
  const verify = (id, token) => {
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id) ||
        typeof token !== 'string' || !/^[0-9a-f]{64}$/i.test(token)) return false;
    return crypto.timingSafeEqual(Buffer.from(sign(id), 'hex'), Buffer.from(token, 'hex'));
  };
  return { sign, verify };
}

export const { sign, verify } = createSessionSigner(readSessionSecret());
