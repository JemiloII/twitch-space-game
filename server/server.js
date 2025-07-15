import crypto from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';
import cors from 'cors';
import express from 'express';
import { WebSocketServer } from 'ws';
import { sign, verify } from './token.js';
import { createPlayerBody, removePlayerBody, updatePhysics, getPlayerSnapshot } from './physics.js';
import { initDatabase, getPlayerPreferences, savePlayerPreferences } from './database.js';

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
  let playerId = undefined;

  socket.on('message', async raw => {
    try {
      const message = JSON.parse(raw.toString());
      if (message.type === 'handshake') {
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
          const body = createPlayerBody();
          
          players[playerId] = {
            body: body,
            // For now, use the first 6 chars of ID as username
            username: playerId.substring(0, 6),
            twitchUsername: null,
            twitchUserId: null,
            twitchOpaqueId: null,
            shipKey: null,
            keyPressed: null,
            keyActive: false,
            lastInputTime: Date.now(),
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
        console.log('sending response', response);
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
        return;
      }

      // Handle user data messages (keystroke data)
      if (message.type === 'user_data') {
        const { username, userId, opaqueId, keyPressed, keyActive } = message;
        
        // Filter out invalid users (no Twitch username or names starting with "Anon_")
        if (!username || username.startsWith('Anon_')) {
          console.log(`[server] filtering out anonymous user: ${username || 'no username'}`);
          return;
        }
        
        // Update player with Twitch data
        players[playerId].twitchUsername = username;
        players[playerId].twitchUserId = userId;
        players[playerId].twitchOpaqueId = opaqueId;
        players[playerId].keyPressed = keyPressed;
        players[playerId].keyActive = keyActive;
        
        console.log(`[server] updated user data for ${username}:`, {
          userId,
          opaqueId,
          keyPressed,
          keyActive
        });
        
        return;
      }

      // Handle ship selection messages (separate from keystroke data)
      if (message.type === 'ship_selection') {
        const { username, userId, opaqueId, shipKey } = message;
        
        // Filter out invalid users (no Twitch username or names starting with "Anon_")
        if (!username || username.startsWith('Anon_')) {
          console.log(`[server] filtering out anonymous user: ${username || 'no username'}`);
          return;
        }
        
        // Update player ship selection
        players[playerId].twitchUsername = username;
        players[playerId].twitchUserId = userId;
        players[playerId].twitchOpaqueId = opaqueId;
        players[playerId].shipKey = shipKey;
        
        console.log(`[server] updated ship selection for ${username}:`, {
          userId,
          opaqueId,
          shipKey
        });
        
        // Save preferences to database
        try {
          await savePlayerPreferences(userId, username, opaqueId, shipKey);
          console.log(`[server] saved preferences to database for ${username}`);
        } catch (error) {
          console.error(`[server] error saving preferences for ${username}:`, error);
        }
        
        return;
      }

      if (
        typeof message !== 'object' ||
        message.type === 'handshake' ||
        message.type === 'connected'
      ) {
        console.warn('[server] rejecting invalid or unexpected message');
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
    } catch (error) {
      console.error('[server] invalid message:', error);
    }
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

setInterval(() => {
  updatePhysics(players);
  const snapshot = getPlayerSnapshot(players);

  wss.clients.forEach(client => {
    if (client.readyState !== 1) return;

    client.send(JSON.stringify({
      type: 'snapshot',
      players: snapshot
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

// API endpoint to get player data
app.get('/api/players', async (req, res) => {
  try {
    const { twitchUserId, twitchOpaqueId } = req.query;
    
    if (!twitchUserId && !twitchOpaqueId) {
      return res.status(400).json({ error: 'Either twitchUserId or twitchOpaqueId is required' });
    }
    
    const playerData = await getPlayerPreferences(twitchUserId, twitchOpaqueId);
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
    
    const success = await savePlayerPreferences(twitchUserId, twitchUsername, twitchOpaqueId, selectedShip, shipColors);
    
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
