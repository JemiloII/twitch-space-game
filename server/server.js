import fs from 'node:fs';
import https from 'node:https';
import cors from 'cors';
import express from 'express';
import { WebSocketServer } from 'ws';
import { updatePhysics, getPlayerSnapshot } from './physics.js';
import { getProjectileCount } from './projectiles.js';
import { initDatabase, getPlayer, savePlayer } from './database.js';
import { routeMessage } from './socketMessages.js';
import { handleDisconnection, setupLifecycleTimers } from './playerLifecycle.js';

const app = express();

// Use the same certificates as Vite
const httpsOptions = {
  cert: fs.readFileSync('C:\\Certbot\\live\\game.shibiko.ai\\fullchain.pem'),
  key: fs.readFileSync('C:\\Certbot\\live\\game.shibiko.ai\\privkey.pem')
};

const server = https.createServer(httpsOptions, app);
const wss = new WebSocketServer({ server });

const players = {}; // { socket.id: { body, input } }
const disconnectedPlayers = {}; // { playerId: { player, timeoutId } }
const sleepingPlayers = {}; // { playerId: { player, sleepTime } } - for inactive players that can be reactivated

// Initialize database
await initDatabase();

wss.on('connection', socket => {
  socket.on('message', async raw => {
    await routeMessage(socket, raw, players, disconnectedPlayers, sleepingPlayers);
  });

  socket.on('close', () => {
    handleDisconnection(socket.playerId, players, disconnectedPlayers);
  });
});


setInterval(() => {
  const startTime = Date.now();
  updatePhysics(players);
  const physicsTime = Date.now() - startTime;
  
  const snapshot = getPlayerSnapshot(players);
  const snapshotTime = Date.now() - startTime - physicsTime;
  
  const playerCount = Object.keys(players).length;
  const clientCount = wss.clients.size;
  const projectileCount = getProjectileCount();
  const messageSize = JSON.stringify({ type: 'snapshot', ...snapshot }).length;
  
  // Log performance metrics every 5 seconds
  if (Date.now() % 5000 < 16.67) { // roughly every 5 seconds at 60fps
    console.log(`[perf] Players: ${playerCount}, Clients: ${clientCount}, Projectiles: ${projectileCount}, Physics: ${physicsTime}ms, Snapshot: ${snapshotTime}ms, Message: ${messageSize}B`);
  }

  wss.clients.forEach(client => {
    if (client.readyState !== 1) return;

    client.send(JSON.stringify({
      type: 'snapshot',
      ...snapshot
    }));
  });
}, 1000 / 60);

// Setup lifecycle timers using modular system
setupLifecycleTimers(players, sleepingPlayers, disconnectedPlayers);

app.use(cors());
app.use(express.json());
// app.use(express.static('public'));

// API endpoint to get player data
app.get('/api/players', async (req, res) => {
  try {
    const { twitchUserId, twitchOpaqueId } = req.query;
    
    if (!twitchUserId && !twitchOpaqueId) {
      return res.status(400).json({ error: 'Either twitchUserId or twitchOpaqueId is required' });
    }
    
    const playerData = await getPlayer(twitchUserId, twitchOpaqueId);
    res.json(playerData);
  } catch (error) {
    console.error('[api] Error getting player data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to save player data
app.post('/api/players', async (req, res) => {
  try {
    const { twitchUserId, twitchUsername, twitchOpaqueId, selectedShip, shipColors } = req.body;
    
    if (!twitchUserId && !twitchOpaqueId) {
      return res.status(400).json({ error: 'Either twitchUserId or twitchOpaqueId is required' });
    }
    
    const success = await savePlayer(twitchUserId, twitchUsername, twitchOpaqueId, selectedShip, shipColors);
    
    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to save player data' });
    }
  } catch (error) {
    console.error('[api] Error saving player data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

server.listen(2087, '0.0.0.0', () => console.log('Server running on https://game.shibiko.ai:2087'));
