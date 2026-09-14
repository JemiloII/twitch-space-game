import jwt from 'jsonwebtoken';

export class AuthError extends Error {
  constructor(message = 'Sign in with Twitch and share your ID to play.') {
    super(message);
    this.status = 401;
  }
}

export function verifyTwitchToken(token, env = process.env) {
  if (!env.TWITCH_EXTENSION_SECRET) throw new AuthError('Twitch sign-in is not configured on this server.');
  let claims;
  try {
    claims = jwt.verify(token, Buffer.from(env.TWITCH_EXTENSION_SECRET, 'base64'), { algorithms: ['HS256'] });
  } catch {
    throw new AuthError();
  }
  if (!claims || typeof claims !== 'object' || !Number.isFinite(claims.exp) ||
      typeof claims.user_id !== 'string' || !/^\d+$/.test(claims.user_id) ||
      typeof claims.opaque_user_id !== 'string' || !claims.opaque_user_id.startsWith('U') ||
      !['viewer', 'moderator', 'broadcaster'].includes(claims.role) ||
      typeof claims.channel_id !== 'string' || !claims.channel_id ||
      (env.TWITCH_CHANNEL_ID && claims.channel_id !== env.TWITCH_CHANNEL_ID)) throw new AuthError();
  return { userId: claims.user_id, opaqueId: claims.opaque_user_id, expiresAt: claims.exp * 1000 };
}

export function bindPlayerIdentity(player, identity) {
  if (player.twitchUserId && player.twitchUserId !== identity.userId) throw new AuthError();
  player.twitchUserId = identity.userId;
  player.twitchOpaqueId = identity.opaqueId;
  player.authExpiresAt = identity.expiresAt;
}

// Resolve names from Twitch, never from a caller's claimed username.
export function createNameResolver(env = process.env, fetchImpl = fetch) {
  const cache = new Map();
  return async (identity, helixToken) => {
    const cached = cache.get(identity.userId);
    if (cached && cached.expiresAt > Date.now()) return cached.name;
    if (!env.TWITCH_CLIENT_ID || typeof helixToken !== 'string') throw new AuthError('Twitch name lookup is not configured.');
    const response = await fetchImpl(`https://api.twitch.tv/helix/users?id=${identity.userId}`, {
      headers: { Authorization: `Extension ${helixToken}`, 'Client-Id': env.TWITCH_CLIENT_ID },
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new AuthError('Could not check your Twitch name. Please try again.');
    const { data } = await response.json();
    const user = data?.find(user => user.id === identity.userId);
    if (typeof user?.display_name !== 'string' || !user.display_name) throw new AuthError();
    if (cache.size >= 1000) cache.delete(cache.keys().next().value);
    cache.set(identity.userId, { name: user.display_name, expiresAt: Math.min(identity.expiresAt, Date.now() + 300000) });
    return user.display_name;
  };
}

export const resolveTwitchName = createNameResolver();
