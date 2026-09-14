import crypto from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';
import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { WebSocketServer } from 'ws';
import { sign, verify } from './token.js';
import { createPlayerBody, removePlayerBody, updatePhysics, getPlayerSnapshot } from './physics.js';
import { createProjectile, getProjectileCount } from './projectiles.js';
import { initDatabase, getPlayerPreferences, savePlayerPreferences } from './database.js';
import { AuthError, verifyTwitchToken, bindPlayerIdentity, resolveTwitchName } from './auth.js';
import { createPlayerApi } from './playerApi.js';

const ships = JSON.parse(fs.readFileSync(new URL('../panels/public/json/ships.json', import.meta.url), 'utf8'));
const validShip = key => ships.some(ship => ship.subtexture === key);

const app = express();

const certFile = process.env.TLS_CERT_FILE;
const keyFile = process.env.TLS_KEY_FILE;
if (Boolean(certFile) !== Boolean(keyFile)) {
  throw new Error('Set both TLS_CERT_FILE and TLS_KEY_FILE to use HTTPS.');
}
const server = certFile
  ? https.createServer({ cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) }, app)
  : http.createServer(app);
const wss = new WebSocketServer({ server });

const players = {}; // { socket.id: { body, input } }
const disconnectedPlayers = {}; // { playerId: { player, timeoutId } }
const sleepingPlayers = {}; // { playerId: { player, sleepTime } } - for inactive players that can be reactivated

// Initialize database
await initDatabase();

wss.on('connection', socket => {
  let playerId = undefined;

  let messageQueue = Promise.resolve();
  const handleMessage = async raw => {
    try {
      const message = JSON.parse(raw.toString());
      if (!message || typeof message !== 'object' || Array.isArray(message)) return;
      if (message.type === 'handshake') {
        if (playerId) return;
        let { id, token } = message;

        const isValid = typeof id === 'string' && typeof token === 'string' && verify(id, token);
        if (!isValid) {
          id = crypto.randomUUID();
          token = sign(id);
          console.log('[server] assigning new player ID:', id);
        }

        playerId = id;
        if (disconnectedPlayers[playerId]) {
          console.log('[server] player reconnecting from disconnectedPlayers:', playerId);
          clearTimeout(disconnectedPlayers[playerId].timeoutId);
          delete disconnectedPlayers[playerId];
        } else if (sleepingPlayers[playerId]) {
          console.log('[server] REACTIVATING sleeping player:', playerId);
          // Restore sleeping player to active state
          const sleepingPlayer = sleepingPlayers[playerId];
          players[playerId] = sleepingPlayer.player;
          players[playerId].lastInputTime = Date.now(); // Reset input time
          delete sleepingPlayers[playerId];
          console.log('[server] player successfully reactivated without refresh!');
        } else if (!players[playerId]) {
          console.log('[server] creating new player (genuinely new or lost from system):', playerId);
          // Spectators get a session, but only verified players get a physics body.
          const body = null;
          
          players[playerId] = {
            body: body,
            // For now, use the first 6 chars of ID as username
            username: playerId.substring(0, 6),
            twitchUsername: null,
            twitchUserId: null,
            twitchOpaqueId: null,
            shipKey: 'spaceShips_001.png',
            keyPressed: null,
            keyActive: false,
            lastInputTime: Date.now(),
            gunConfigs: [],
            lastShotTime: 0,
            input: {
              up: false,
              down: false,
              left: false,
              right: false,
              rotateLeft: false,
              rotateRight: false,
              space: false,
              shift: false
            }
          };
        }

        const response = { type: 'connected', id: playerId, token };
        socket.send(JSON.stringify(response));
        return;
      }

      // Ensure input is only accepted after a successful handshake
      if (!playerId) {
        console.warn('[server] rejecting message without handshake - no playerId');
        return;
      }
      
      // Check if player is in sleeping state and reactivate them
      if (!players[playerId] && sleepingPlayers[playerId]) {
        console.log('[server] REACTIVATING sleeping player via input:', playerId);
        const sleepingPlayer = sleepingPlayers[playerId];
        players[playerId] = sleepingPlayer.player;
        players[playerId].lastInputTime = Date.now();
        delete sleepingPlayers[playerId];
        console.log('[server] player reactivated via input without refresh!');
      }
      
      // If player is neither active nor sleeping, reject
      if (!players[playerId]) {
        console.warn('[server] rejecting message without handshake - player not found');
        // Send rejection message back to client to trigger reconnection
        try {
          socket.send(JSON.stringify({
            type: 'rejection',
            reason: 'rejecting message without handshake - player not found'
          }));
        } catch (error) {
          console.error('[server] error sending rejection message:', error);
        }
        return;
      }

      if (!['user_data', 'ship_selection', 'input'].includes(message.type)) return;
      const identity = verifyTwitchToken(message.authToken);
      const player = players[playerId];
      bindPlayerIdentity(player, identity);
      if (!player.body) {
        player.body = createPlayerBody();
        await loadGunConfigs(playerId, player.shipKey);
      }

      if (message.type === 'user_data' || message.type === 'ship_selection') {
        const username = await resolveTwitchName(identity, message.helixToken);
        player.twitchUsername = username;
        if (message.type === 'user_data') {
          player.keyPressed = typeof message.keyPressed === 'string' ? message.keyPressed.slice(0, 100) : '';
          player.keyActive = message.keyActive === true;
        } else {
          if (!validShip(message.shipKey)) throw new Error('Choose a valid ship.');
          player.shipKey = message.shipKey;
          await loadGunConfigs(playerId, player.shipKey);
          const saved = await savePlayerPreferences(identity.userId, username, identity.opaqueId, player.shipKey);
          if (!saved) throw new Error('Could not save your ship.');
        }
        return;
      }

      // Accept only sanitized inputs
      players[playerId].input = {
        up: !!message.up,
        down: !!message.down,
        left: !!message.left,
        right: !!message.right,
        rotateLeft: !!message.rotateLeft,
        rotateRight: !!message.rotateRight,
        space: !!message.space,
        shift: !!message.shift
      };
      
      // Update last input time
      players[playerId].lastInputTime = Date.now();
      
      // Handle shooting
      if (players[playerId].input.space) {
        console.log(`[server] 🔫 SPACEBAR HELD by ${players[playerId].twitchUsername || playerId}, gunConfigs: ${players[playerId].gunConfigs?.length || 0}, lastShotTime: ${Date.now() - players[playerId].lastShotTime}ms ago`);
        if (players[playerId].gunConfigs && players[playerId].gunConfigs.length > 0) {
          fireWeapons(playerId);
        } else {
          console.log(`[server] ❌ No gun configs loaded for player ${playerId}`);
        }
      } else {
        // Log when spacebar is released to detect input interruptions
        if (players[playerId].wasSpacePressed) {
          console.log(`[server] 🔫 SPACEBAR RELEASED by ${players[playerId].twitchUsername || playerId}`);
        }
      }
      
      // Track previous space state
      players[playerId].wasSpacePressed = players[playerId].input.space;
    } catch (error) {
      if (players[playerId]) players[playerId].input = {};
      if (socket.readyState === 1) socket.send(JSON.stringify({
        type: error instanceof AuthError ? 'auth_error' : 'error',
        reason: error instanceof AuthError ? error.message : 'Could not handle that game message.'
      }));
    }
  };
  socket.on('message', raw => {
    messageQueue = messageQueue.then(() => socket.readyState === 1 ? handleMessage(raw) : undefined);
  });

  socket.on('close', () => {
    console.log('Socket closed for', playerId);
    if (playerId && players[playerId]) {
      const player = players[playerId];
      
      // Don't remove from active players immediately - keep them in game world
      // Set a timeout to remove them after 2 minutes to handle lag/reconnection
      const timeoutId = setTimeout(() => {
        console.log('[server] removing player after timeout:', playerId);
        removePlayerBody(player.body);
        delete players[playerId];
        delete disconnectedPlayers[playerId];
      }, 60000 * 2); // 2 minutes timeout
      console.log('[server] player disconnected, starting 2min timeout:', playerId);

      disconnectedPlayers[playerId] = {
        player: player,
        timeoutId: timeoutId
      };
    }
  });
});

// Gun configuration loading function
async function loadGunConfigs(playerId, shipKey) {
  try {
    const ship = ships.find(ship => ship.subtexture === shipKey);

    if (ship && ship.guns) {
      players[playerId].gunConfigs = ship.guns;
      console.log(`[server] ✓ loaded ${ship.guns.length} gun configs for player ${playerId} (${shipKey})`);
    } else {
      players[playerId].gunConfigs = [];
      console.log(`[server] ✗ no gun configs found for player ${playerId} (${shipKey})`);
    }
  } catch (error) {
    console.warn(`[server] failed to load gun configs for player ${playerId}:`, error);
    players[playerId].gunConfigs = [];
  }
}

// Shooting handler function
function fireWeapons(playerId) {
  const player = players[playerId];
  const now = Date.now();
  
  // Initialize per-gun shot times if not exists
  if (!player.gunShotTimes) {
    player.gunShotTimes = {};
  }
  
  let shotsFired = 0;
  let shotsOnCooldown = 0;
  
  // Check if any gun can fire (each gun has its own fire rate)
  player.gunConfigs.forEach((gunConfig, gunIndex) => {
    const gunId = `gun_${gunIndex}`;
    const lastShotTime = player.gunShotTimes[gunId] || 0;
    const timeSinceLastShot = now - lastShotTime;
    
    console.log(`[fireWeapons] Gun ${gunIndex} cooldown: ${timeSinceLastShot}ms / ${gunConfig.fireRate}ms required (speed: ${gunConfig.projectileSpeed}, lifetime: ${gunConfig.projectileLifetime}ms)`);
    
    if (timeSinceLastShot >= gunConfig.fireRate) {
      const body = player.body;
      const gunAngle = body.angle + (gunConfig.rotation * Math.PI / 180);
      
      // Calculate gun position relative to ship
      const cos = Math.cos(body.angle);
      const sin = Math.sin(body.angle);
      const gunX = body.position.x + (gunConfig.x * cos - gunConfig.y * sin);
      const gunY = body.position.y + (gunConfig.x * sin + gunConfig.y * cos);
      
      // Get ship velocity for projectile inheritance
      const shipVelocity = { x: body.velocity.x, y: body.velocity.y };
      
      // Create projectile with ship velocity inheritance
      const projectile = createProjectile(playerId, gunX, gunY, gunAngle * 180 / Math.PI, gunConfig, shipVelocity);
      player.gunShotTimes[gunId] = now;
      shotsFired++;
      
      console.log(`[fireWeapons] ✅ Gun ${gunIndex} FIRED! Next shot in ${gunConfig.fireRate}ms`);
    } else {
      shotsOnCooldown++;
    }
  });
  
  if (shotsFired === 0 && shotsOnCooldown > 0) {
    console.log(`[fireWeapons] 🔒 All ${shotsOnCooldown} guns on cooldown`);
  }
}

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

// Check for inactive players every 30 seconds
setInterval(() => {
  const now = Date.now();
  const inactivityTimeout = 1 * 60 * 1000; // 1 minute in milliseconds (reduced for testing)
  
  Object.keys(players).forEach(playerId => {
    const player = players[playerId];
    const timeSinceLastInput = now - player.lastInputTime;
    
    if (timeSinceLastInput > inactivityTimeout) {
      console.log(`[server] INACTIVITY TIMEOUT: moving inactive player to sleeping state: ${playerId} (${player.twitchUsername || player.username}) - inactive for ${Math.round(timeSinceLastInput / 1000)}s`);
      console.log(`[server] SOLUTION: Player moved to sleeping state and can reconnect without refresh`);
      
      // Move player to sleeping state instead of completely removing
      sleepingPlayers[playerId] = {
        player: player,
        sleepTime: Date.now()
      };
      
      // Remove from active players but keep body for visual continuity
      // Don't remove the physics body - let it stay in the world
      delete players[playerId];
      
      // Also remove from disconnected players if they were there
      if (disconnectedPlayers[playerId]) {
        console.log(`[server] Also removing from disconnectedPlayers - player now in sleeping state`);
        clearTimeout(disconnectedPlayers[playerId].timeoutId);
        delete disconnectedPlayers[playerId];
      }
    }
  });
}, 30000); // Check every 30 seconds

// Clean up sleeping players after 30 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  const sleepingTimeout = 30 * 60 * 1000; // 30 minutes in milliseconds
  
  Object.keys(sleepingPlayers).forEach(playerId => {
    const sleepingPlayer = sleepingPlayers[playerId];
    const timeSleeping = now - sleepingPlayer.sleepTime;
    
    if (timeSleeping > sleepingTimeout) {
      console.log(`[server] removing sleeping player after 30min: ${playerId} (${sleepingPlayer.player.twitchUsername || sleepingPlayer.player.username})`);
      
      // Now actually remove the physics body and clean up completely
      removePlayerBody(sleepingPlayer.player.body);
      delete sleepingPlayers[playerId];
    }
  });
}, 5 * 60 * 1000); // Check every 5 minutes

app.use(cors());
app.use(express.json());
// app.use(express.static('public'));

app.use('/api/players', createPlayerApi({
  getPreferences: getPlayerPreferences,
  savePreferences: savePlayerPreferences,
  validShip
}));

const port = Number(process.env.PORT || 2087);
const host = process.env.HOST || '127.0.0.1';
server.listen(port, host, () => console.log(`Server running on ${certFile ? 'https' : 'http'}://${host}:${port}`));
