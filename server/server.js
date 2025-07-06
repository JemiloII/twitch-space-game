import crypto from 'node:crypto';
import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { WebSocketServer } from 'ws';
import { sign, verify } from './token.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const players = {}; // { socket.id: { x, y, rotation, velocity, input } }

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

        if (!players[playerId]) {
          players[playerId] = {
            x: 400,
            y: 300,
            rotation: 0,
            velocity: { x: 0, y: 0 },
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
  });
});

setInterval(() => {
  // tick movement logic for each player
  const dt = 1 / 60;
  for (const id in players) {
    const p = players[id];
    const speed = 200;
    const rotationSpeed = 3;

    if (p.input.left) p.rotation -= rotationSpeed * dt;
    if (p.input.right) p.rotation += rotationSpeed * dt;

    if (p.input.up) {
      p.velocity.x += Math.cos(p.rotation) * speed * dt;
      p.velocity.y += Math.sin(p.rotation) * speed * dt;
    } else {
      p.velocity.x *= 0.98;
      p.velocity.y *= 0.98;
    }

    p.x += p.velocity.x * dt;
    p.y += p.velocity.y * dt;
  }

  // broadcast all player positions
  const snapshot = {};
  for (const id in players) {
    const { x, y, rotation } = players[id];
    snapshot[id] = { x, y, rotation };
  }

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
app.use(express.static('public'));

server.listen(3000, () => console.log('Server running on :3000'));
