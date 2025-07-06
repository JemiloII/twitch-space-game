import Phaser, { Scene } from 'phaser';
import { createBackground } from '../background';
import { Controls, setControls } from '../controls';
import { createShip, Ship } from '../ship';
import * as Socket from '../net/socket';

export default class GameScene extends Scene {
  playerId: string = '';
  players: Record<string, Ship> = {};
  socket!: WebSocket;
  cursors!: Controls;

  constructor() {
    super('Game');
    Socket.connect('ws://localhost:3000');
    this.socket = Socket.get();
  }

  preload() {
    this.load.image('ship', 'ships/spaceShips_001.png');
    this.load.image('sky', 'https://labs.phaser.io/assets/skies/space3.png');
    this.load.image('red', 'https://labs.phaser.io/assets/particles/red.png');
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
        for (const id in message.players) {
          const data = message.players[id];

          if (!this.players[id]) {
            console.log('Creating ship...');
            this.players[id] = createShip(this, data.x, data.y);
            this.add.particles('red', {
              speed: 100,
              scale: { start: 1, end: 0 },
              blendMode: 'ADD',
              follow: this.players[id]
            });
            console.log(`[GameScene] created sprite for id: ${id}`);
          }

          this.players[id].x = data.x;
          this.players[id].y = data.y;
          this.players[id].rotation = data.rotation + Phaser.Math.DegToRad(-90);
        }
      }
    });
  }

  update() {
    const { up, down, left, right, rotateLeft, rotateRight, space, shift } = this.cursors;

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
