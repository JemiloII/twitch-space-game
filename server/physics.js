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
    inertia: Infinity // Prevent rotation from collisions
  });
  
  Matter.World.add(engine.world, body);
  return body;
}

export function removePlayerBody(body) {
  Matter.World.remove(engine.world, body);
}

export function updatePhysics(players) {
  const dt = 1 / 60;
  
  for (const id in players) {
    const p = players[id];
    const body = p.body;

    // Handle rotation
    if (p.input.left) {
      Matter.Body.setAngle(body, body.angle - PHYSICS_CONFIG.rotationSpeed * dt);
    }
    if (p.input.right) {
      Matter.Body.setAngle(body, body.angle + PHYSICS_CONFIG.rotationSpeed * dt);
    }

    // Handle thrust
    if (p.input.up) {
      const force = {
        x: Math.cos(body.angle) * PHYSICS_CONFIG.speed * dt * PHYSICS_CONFIG.forceMultiplier,
        y: Math.sin(body.angle) * PHYSICS_CONFIG.speed * dt * PHYSICS_CONFIG.forceMultiplier
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
    const body = players[id].body;
    snapshot[id] = { 
      x: body.position.x, 
      y: body.position.y, 
      rotation: body.angle 
    };
  }
  return snapshot;
}

export { PHYSICS_CONFIG };
