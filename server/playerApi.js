import { Router } from 'express';
import { verifyTwitchToken, resolveTwitchName } from './auth.js';

export function createPlayerApi({ getPreferences, savePreferences, validShip,
  authenticate = verifyTwitchToken, resolveName = resolveTwitchName }) {
  const router = Router();
  router.use((req, res, next) => {
    try {
      req.identity = authenticate(req.headers.authorization?.replace(/^Bearer /i, ''));
      next();
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  });
  router.get('/', async (req, res) => {
    const { userId, opaqueId } = req.identity;
    res.json(await getPreferences(userId, opaqueId));
  });
  router.post('/', async (req, res) => {
    const { selectedShip, shipColors = {} } = req.body || {};
    if (!validShip(selectedShip) || !shipColors || typeof shipColors !== 'object' || Array.isArray(shipColors) ||
        Object.entries(shipColors).some(([from, to]) => !/^#[0-9a-f]{6}$/i.test(from) ||
          typeof to !== 'string' || !/^#[0-9a-f]{6}$/i.test(to))) {
      return res.status(400).json({ error: 'Choose a valid ship and colors.' });
    }
    const { userId, opaqueId } = req.identity;
    const name = await resolveName(req.identity, req.headers['x-twitch-helix-token']);
    const saved = await savePreferences(userId, name, opaqueId, selectedShip, shipColors);
    res.status(saved ? 200 : 500).json(saved ? { success: true } : { error: 'Could not save your ship.' });
  });
  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Could not load or save your ship.' });
  });
  return router;
}
