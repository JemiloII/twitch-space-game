import crypto from 'node:crypto';

const SECRET = 'your-secret-key';

export function sign(id) {
  console.log('signing id:', id);
  return crypto.createHmac('sha256', SECRET).update(id).digest('hex');
}

export function verify(id, token) {
  console.log('verifying id:', id, 'token:', token);
  return id && token && sign(id) === token;
}
