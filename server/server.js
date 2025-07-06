import crypto from 'node:crypto';
import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { WebSocketServer } from 'ws';
import { sign, verify } from './token.js';
import Matter from 'matter-js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Create matter.js engine
const engine = Matter.Engine.create();
engine.world.gravity.x = 0;
engine.world.gravity.y = 0;

const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 450;

const players = {}; // { socket.id: { body, input } }

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
          // Create a matter.js body for the player
          const body = Matter.Bodies.circle(400, 300, 10, {
            frictionAir: 0.02,
            inertia: Infinity // Prevent rotation from collisions
          });
          
          Matter.World.add(engine.world, body);
          
          players[playerId] = {
            body: body,
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
      // Remove the matter.js body from the world
      Matter.World.remove(engine.world, players[playerId].body);
      delete players[playerId];
    }
  });
});

setInterval(() => {
  // tick movement logic for each player
  const dt = 1 / 60;
  for (const id in players) {
    const p = players[id];
    const body = p.body;
    const speed = 200;
    const rotationSpeed = 3;

    // Handle rotation
    if (p.input.left) {
      Matter.Body.setAngle(body, body.angle - rotationSpeed * dt);
    }
    if (p.input.right) {
      Matter.Body.setAngle(body, body.angle + rotationSpeed * dt);
    }

    // Handle thrust
    if (p.input.up) {
      const force = {
        x: Math.cos(body.angle) * speed * dt * 0.005,
        y: Math.sin(body.angle) * speed * dt * 0.005
      };
      Matter.Body.applyForce(body, body.position, force);
    }

    // World wrapping
    if (body.position.x < 0) {
      Matter.Body.setPosition(body, { x: WORLD_WIDTH, y: body.position.y });
    } else if (body.position.x > WORLD_WIDTH) {
      Matter.Body.setPosition(body, { x: 0, y: body.position.y });
    }
    
    if (body.position.y < 0) {
      Matter.Body.setPosition(body, { x: body.position.x, y: WORLD_HEIGHT });
    } else if (body.position.y > WORLD_HEIGHT) {
      Matter.Body.setPosition(body, { x: body.position.x, y: 0 });
    }
  }

  // Update physics engine
  Matter.Engine.update(engine, 1000 / 60);

  // broadcast all player positions
  const snapshot = {};
  for (const id in players) {
    const body = players[id].body;
    snapshot[id] = {
      x: body.position.x,
      y: body.position.y,
      rotation: body.angle
    };
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
