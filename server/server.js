import crypto from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';
import cors from 'cors';
import express from 'express';
import { WebSocketServer } from 'ws';
import { sign, verify } from './token.js';
import { createPlayerBody, removePlayerBody, updatePhysics, getPlayerSnapshot } from './physics.js';

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
        }

        playerId = id;
        if (disconnectedPlayers[playerId]) {
          console.log('[server] player reconnecting:', playerId);
          clearTimeout(disconnectedPlayers[playerId].timeoutId);
          players[playerId] = disconnectedPlayers[playerId].player;
          delete disconnectedPlayers[playerId];
        } else if (!players[playerId]) {
          const body = createPlayerBody();
          
          players[playerId] = {
            body: body,
            // For now, use the first 6 chars of ID as username
            username: playerId.substring(0, 6),
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
      const player = players[playerId];
      delete players[playerId];
      
      const timeoutId = setTimeout(() => {
        console.log('[server] removing player after timeout:', playerId);
        removePlayerBody(player.body);
        delete disconnectedPlayers[playerId];
      }, 60000 * 5);
      console.log('[server] player disconnected, starting 60s timeout:', playerId);

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

app.use(cors());
// app.use(express.static('public'));

server.listen(2087, '0.0.0.0', () => console.log('Server running on https://game.shibiko.ai:2087'));
