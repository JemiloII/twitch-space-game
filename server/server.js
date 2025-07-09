import crypto from 'node:crypto';
import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { WebSocketServer } from 'ws';
import { sign, verify } from './token.js';
import { createPlayerBody, removePlayerBody, updatePhysics, getPlayerSnapshot } from './physics.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const players = {}; // { socket.id: { body, input } }
const disconnectedPlayers = {}; // { playerId: { player, timeoutId } }

wss.on('connection', socket => {
  let playerId = undefined;

  socket.on('message', raw => {
    try {
      const message = JSON.parse(raw.toString());

      if (message.type === 'handshake') {
        let { id, token } = message;

        const isValid = typeof id === 'string' && typeof token === 'string' && verify(id, token);

        if (!isValid) {
          id = crypto.randomUUID();
          token = sign(id);
          console.log('[server] assigning new player ID:', id);
        } else {
          console.log('[server] verified player ID:', id);
        }

        // Only now assign playerId after validation/generation is complete
        playerId = id;

        // Check if player is in disconnected list (reconnecting)
        if (disconnectedPlayers[playerId]) {
          console.log('[server] player reconnecting:', playerId);
          // Cancel the removal timeout
          clearTimeout(disconnectedPlayers[playerId].timeoutId);
          // Restore the player to active players
          players[playerId] = disconnectedPlayers[playerId].player;
          delete disconnectedPlayers[playerId];
        } else if (!players[playerId]) {
          // Create a matter.js body for the player
          const body = createPlayerBody();
          
          players[playerId] = {
            body: body,
            username: playerId.substring(0, 6), // For now, use first 6 chars of ID
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

      // Ensure input is only accepted after successful handshake
      if (!playerId || !players[playerId]) {
        console.warn('[server] rejecting message without handshake');
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
    } catch (error) {
      console.error('[server] invalid message:', error);
    }
  });

  socket.on('close', () => {
    console.log('Socket closed for', playerId);
    if (playerId && players[playerId]) {
      console.log('[server] player disconnected, starting 60s timeout:', playerId);
      
      // Move player to disconnected list with a timeout
      const player = players[playerId];
      delete players[playerId];
      
      const timeoutId = setTimeout(() => {
        console.log('[server] removing player after timeout:', playerId);
        // Remove the matter.js body from the world
        removePlayerBody(player.body);
        delete disconnectedPlayers[playerId];
      }, 60000 * 5); // 60 seconds
      
      disconnectedPlayers[playerId] = {
        player: player,
        timeoutId: timeoutId
      };
    }
  });
});

setInterval(() => {
  // Update physics for all players
  updatePhysics(players);

  // Broadcast all player positions
  const snapshot = getPlayerSnapshot(players);

  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({
        type: 'snapshot',
        players: snapshot
      }));
    }
  });
}, 1000 / 60);


app.use(cors());
// app.use(express.static('public'));

server.listen(3000, '0.0.0.0', () => console.log('Server running on :3000'));
