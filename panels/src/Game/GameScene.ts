import Phaser, { Scene } from 'phaser';
import { createBackground } from './Background.ts';
import { type Controls, setControls } from './Controls.ts';
import { createShip, type Ship } from './Ship.ts';
import * as Socket from './Socket.ts';

export default class GameScene extends Scene {
  playerId: string = '';
  players: Record<string, Ship> = {};
  playerLabels: Record<string, Phaser.GameObjects.Text> = {};
  socket!: WebSocket;
  cursors!: Controls;
  
  // For smooth interpolation
  private serverSnapshots: Record<string, { x: number; y: number; rotation: number; timestamp: number }> = {};

  constructor() {
    super('Game');
    Socket.connect('ws://localhost:3001');
    this.socket = Socket.get();
  }

  preload() {
    this.load.image('sky', 'https://labs.phaser.io/assets/skies/space3.png');
    this.load.image('red', 'https://labs.phaser.io/assets/particles/red.png');
    this.load.atlasXML('spritesheet', 'spritesheets/spritesheet.png', 'spritesheets/spritesheet.xml');
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

          if (!this.players[id]) {
            data.color = {
              '#AC3939': '#FF8A00',
              '#BD3E3E': '#FFA811',
            };

            this.players[id] = createShip(this, data.key, data.x, data.y, data.color);

            // Create username label above the player
            this.playerLabels[id] = this.add.text(data.x, data.y - 20, data.username, {
              fontSize: '10px',
              color: '#ffffff',
              stroke: '#000000',
              strokeThickness: 1,
              align: 'center'
            }).setOrigin(0.5);
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
            this.playerLabels[id].x = this.players[id].x;
            this.playerLabels[id].y = this.players[id].y - 20;
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
  }
}
