import Phaser, { Scene } from 'phaser';
import { createBackground } from './Background.ts';
import { type Controls, setControls } from './Controls.ts';
import { createShip, type Ship, updateShipThrusters, destroyShipThrusters } from './Ship.ts';
import * as Socket from './Socket.ts';

export default class GameScene extends Scene {
  playerId: string = '';
  players: Record<string, Ship> = {};
  playerLabels: Record<string, Phaser.GameObjects.Text> = {};
  playerShipKeys: Record<string, string> = {}; // Track current ship key for each player
  playerThrusterStates: Record<string, boolean> = {}; // Track thruster states for each player
  socket!: WebSocket;
  cursors!: Controls;
  
  // For smooth interpolation
  private serverSnapshots: Record<string, { x: number; y: number; rotation: number; timestamp: number }> = {};

  // Calculate label offset based on thruster flame position
  private calculateLabelOffset(ship: Ship): number {
    // If thruster configs are available, calculate based on thruster flame position
    if (ship.thrusterConfigs && ship.thrusterConfigs.length > 0) {
      // Find the lowest thruster flame position (furthest from ship center)
      let lowestThrusterY = 0;
      
      ship.thrusterConfigs.forEach(config => {
        // Calculate the actual thruster position relative to ship
        const thrusterBottomY = config.y;
        
        // Estimate flame extension based on thruster scale
        // The thruster flame sprite extends approximately 64 pixels in original size
        // We scale this by the thruster's scale factor
        const flameExtension = 64 * config.scale;
        
        // Find the lowest point of all thruster flames
        const thrusterFlameBottomY = thrusterBottomY - flameExtension;
        if (thrusterFlameBottomY < lowestThrusterY) {
          lowestThrusterY = thrusterFlameBottomY;
        }
      });
      
      // Position label above the lowest thruster flame with padding
      return lowestThrusterY - 20; // 20px padding above flame
    }
    
    // Fallback: position above ship if thrusters not loaded yet
    const shipHeight = ship.displayHeight;
    return -(shipHeight / 2) - 15;
  }

  constructor() {
    super('Game');
    Socket.connect();
    this.socket = Socket.get();
  }

  preload() {
    this.load.image('sky', 'https://labs.phaser.io/assets/skies/space3.png');
    this.load.image('red', 'https://labs.phaser.io/assets/particles/red.png');
    this.load.atlasXML('spritesheet', 'spritesheets/spritesheet.png', 'spritesheets/spritesheet.xml');
    this.load.atlas('thruster_fire', 'spritesheets/thruster_fire.png', 'spritesheets/thruster_fire.json');
  }

  create() {
    createBackground(this);
    this.cursors = setControls(this);

    Socket.listen(message => {
      if (message.type === 'connected') {
        this.playerId = message.id;
        localStorage.setItem('playerId', message.id);
        localStorage.setItem('playerToken', message.token);
        return;
      }

      if (message.type === 'snapshot') {
        const now = Date.now();
        
        for (const id in message.players) {
          const data = message.players[id];

          // Check if this is a new player or if the ship key has changed
          const isNewPlayer = !this.players[id];
          const shipKeyChanged = !isNewPlayer && this.playerShipKeys[id] !== data.key;

          if (isNewPlayer || shipKeyChanged) {
            // If ship key changed, destroy the old ship
            if (shipKeyChanged) {
              destroyShipThrusters(this.players[id]);
              this.players[id].destroy();
            }

            data.color = {
              '#AC3939': '#FF8A00',
              '#BD3E3E': '#FFA811',
            };

            this.players[id] = createShip(this, data.key, data.x, data.y, data.color);
            this.playerShipKeys[id] = data.key; // Track the current ship key

            // Create or update username label above the player
            if (isNewPlayer) {
              const labelOffset = this.calculateLabelOffset(this.players[id]);
              this.playerLabels[id] = this.add.text(data.x, data.y + labelOffset, data.username, {
                fontSize: '10px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 1,
                align: 'center'
              }).setOrigin(0.5);
            }
          }

          // Store server snapshot for interpolation
          this.serverSnapshots[id] = {
            x: data.x,
            y: data.y,
            rotation: data.rotation + Phaser.Math.DegToRad(-90),
            timestamp: now
          };

          // Directly set server position (server is authoritative)
          const player = this.players[id];
          const snapshot = this.serverSnapshots[id];
          
          player.x = snapshot.x;
          player.y = snapshot.y;
          player.rotation = snapshot.rotation;

          // Update username label position
          if (this.playerLabels[id]) {
            const labelOffset = this.calculateLabelOffset(this.players[id]);
            this.playerLabels[id].x = this.players[id].x;
            this.playerLabels[id].y = this.players[id].y + labelOffset;
          }

          // Update thruster positions and animations
          const isThrusting = data.input?.up || false;
          this.playerThrusterStates[id] = isThrusting;
          updateShipThrusters(this.players[id], isThrusting);
        }

        // Clean up disconnected players
        for (const id in this.players) {
          if (!message.players[id]) {
            destroyShipThrusters(this.players[id]);
            this.players[id].destroy();
            delete this.players[id];
            delete this.playerShipKeys[id];
            delete this.playerThrusterStates[id];
            if (this.playerLabels[id]) {
              this.playerLabels[id].destroy();
              delete this.playerLabels[id];
            }
            delete this.serverSnapshots[id];
          }
        }
      }
    });
  }

  update() {
    const { up, down, left, right, rotateLeft, rotateRight, space, shift } = this.cursors;

    // Only send input to server - no client-side physics
    Socket.send({
      up: up.isDown,
      down: down.isDown,
      left: left.isDown,
      right: right.isDown,
      rotateLeft: rotateLeft.isDown,
      rotateRight: rotateRight.isDown,
      space: space?.isDown ?? false,
      shift: shift?.isDown ?? false
    });

    // Update thruster animations for all players
    for (const playerId in this.players) {
      const player = this.players[playerId];
      
      // For local player, check the cursor state directly
      if (playerId === this.playerId) {
        const isThrusting = up.isDown;
        this.playerThrusterStates[playerId] = isThrusting;
        updateShipThrusters(player, isThrusting);
      } else {
        // For other players, use the stored thruster state from server snapshots
        const isThrusting = this.playerThrusterStates[playerId] || false;
        updateShipThrusters(player, isThrusting);
      }
    }
  }
}
