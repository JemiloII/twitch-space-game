import Matter from 'matter-js';

// Create matter.js engine
const engine = Matter.Engine.create();
engine.world.gravity.x = 0;
engine.world.gravity.y = 0;

const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 450;

// Physics configuration
const PHYSICS_CONFIG = {
  speed: 40,
  rotationSpeed: 5,
  forceMultiplier: 0.0005,
  frictionAir: 0.025
};

export function createPlayerBody(x = 400, y = 300) {
  const body = Matter.Bodies.circle(x, y, 10, {
    frictionAir: PHYSICS_CONFIG.frictionAir,
    inertia: Infinity
  });
  
  Matter.World.add(engine.world, body);
  return body;
}

export function removePlayerBody(body) {
  Matter.World.remove(engine.world, body);
}

export function updatePhysics(players) {
  const tickRate = 1 / 60;
  
  for (const id in players) {
    const player = players[id];
    const body = player.body;

    // Handle rotation (support both A/D and Q/E)
    if (player.input.left || player.input.rotateLeft) {
      Matter.Body.setAngle(body, body.angle - PHYSICS_CONFIG.rotationSpeed * tickRate);
    }
    if (player.input.right || player.input.rotateRight) {
      Matter.Body.setAngle(body, body.angle + PHYSICS_CONFIG.rotationSpeed * tickRate);
    }

    // Handle thrust
    if (player.input.up) {
      const force = {
        x: Math.cos(body.angle) * PHYSICS_CONFIG.speed * tickRate * PHYSICS_CONFIG.forceMultiplier,
        y: Math.sin(body.angle) * PHYSICS_CONFIG.speed * tickRate * PHYSICS_CONFIG.forceMultiplier
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
}

export function getPlayerSnapshot(players) {
  const snapshot = {};
  for (const id in players) {
    const player = players[id];
    const body = player.body;
    
    // Only include players with valid Twitch usernames
    if (player.twitchUsername && !player.twitchUsername.startsWith('Anon_')) {
      snapshot[id] = {
        x: body.position.x,
        y: body.position.y,
        rotation: body.angle,
        username: player.twitchUsername,
        twitchUserId: player.twitchUserId,
        twitchOpaqueId: player.twitchOpaqueId,
        key: player.shipKey,
        keyPressed: player.keyPressed,
        keyActive: player.keyActive
      };
    }
  }
  return snapshot;
}

export { PHYSICS_CONFIG };
