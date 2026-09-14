import Phaser, { Scene } from 'phaser';
import { createBackground } from './Background.ts';
import { type Controls, setControls } from './Controls.ts';
import { createShip, type Ship, updateShipThrusters, destroyShipThrusters } from './Ship.ts';
import { ProjectileSystem } from './Projectile.ts';
import * as Socket from './Socket.ts';
import { PracticeWorld, type PracticeShipDefinition } from './PracticeWorld';

export default class GameScene extends Scene {
  playerId: string = '';
  players: Record<string, Ship> = {};
  playerLabels: Record<string, Phaser.GameObjects.Text> = {};
  playerShipKeys: Record<string, string> = {}; // Track current ship key for each player
  playerThrusterStates: Record<string, boolean> = {}; // Track thruster states for each player
  socket!: WebSocket;
  cursors!: Controls;
  private projectileSystem!: ProjectileSystem;
  private practiceWorld?: PracticeWorld;
  private liveSnapshot: any;
  private liveConnected = false;

  // For smooth interpolation
  private serverSnapshots: Record<string, { x: number; y: number; rotation: number; timestamp: number }> = {};

  // Calculate label offset based on thruster flame position
  private calculateLabelOffset(ship: Ship): number {
    // If thruster configs are available, calculate based on thruster flame position
    if (ship.thrusterConfigs && ship.thrusterConfigs.length > 0) {
      // Find the lowest thruster flame position (furthest from ship center)
      let lowestThrusterY = 0;

      ship.thrusterConfigs.forEach(config => {
        // Calculate the actual thruster position relative to ship, scaled by ship scale
        const scaledThrusterBottomY = config.y * ship.scaleY;

        // Estimate flame extension based on thruster scale
        // The thruster flame sprite extends approximately 64 pixels in original size
        // We scale this by the thruster's scale factor
        const flameExtension = 64 * config.scale;

        // Find the lowest point of all thruster flames
        const thrusterFlameBottomY = scaledThrusterBottomY - flameExtension;
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
    this.load.json('ships', 'json/ships.json');
    this.load.image('sky', 'https://labs.phaser.io/assets/skies/space3.png');
    this.load.atlasXML('spritesheet', 'spritesheets/spritesheet.png', 'spritesheets/spritesheet.xml');
    this.load.atlas('thruster_fire', 'spritesheets/thruster_fire.png', 'spritesheets/thruster_fire.json');
  }

  create() {
    createBackground(this);
    this.cursors = setControls(this);

    // Initialize projectile system
    this.projectileSystem = new ProjectileSystem(this);

    const stopListening = Socket.listen(message => {
      if (message.type === 'connected') this.liveConnected = true;
      if (message.type === 'connection_state') this.liveConnected = false;
      if (this.practiceWorld && message.type !== 'snapshot') return;
      const status = document.getElementById('game-status');
      if (message.type === 'connection_state') {
        if (status) status.textContent = 'Connection lost. Reconnecting…';
        return;
      }
      if (message.type === 'auth_error' || message.type === 'error') {
        if (status) status.textContent = message.reason;
        return;
      }
      if (message.type === 'connected') {
        if (status) status.textContent = 'Connected. Waiting for Twitch players to join.';
        this.playerId = message.id;
        localStorage.setItem('playerId', message.id);
        localStorage.setItem('playerToken', message.token);
        return;
      }

      if (message.type === 'snapshot') {
        this.liveSnapshot = message;
        if (!this.practiceWorld) this.applySnapshot(message);
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      stopListening();
      this.projectileSystem.destroyProjectiles();
    });
    this.configurePractice();
  }

  private applySnapshot(message: any) {
    const status = this.practiceWorld ? null : document.getElementById('game-status');

    const now = Date.now();

    // Update projectiles
    if (message.projectiles) {
      this.projectileSystem.updateProjectiles(message.projectiles);
    }

    // Render either the live world or the browser's practice world.
    const playersData = message.players || {};
    const count = Object.keys(playersData).length;
    if (status) status.textContent = !this.liveConnected
      ? 'Connection lost. Reconnecting…'
      : count
      ? `${count} ${count === 1 ? 'pilot' : 'pilots'} flying • Live Twitch game`
      : 'Connected. Waiting for Twitch players to join.';
    for (const id in playersData) {
      const data = playersData[id];

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
      if (!playersData[id]) {
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

  private configurePractice() {
    const toggle = document.getElementById('practice-toggle') as HTMLButtonElement;
    const select = document.getElementById('practice-ship') as HTMLSelectElement;
    const reset = document.getElementById('practice-reset') as HTMLButtonElement;
    const tools = document.getElementById('practice-tools')!;
    const controls = document.getElementById('game-controls')!;
    const definitions = this.cache.json.get('ships') as PracticeShipDefinition[];
    select.replaceChildren(...definitions.map((ship, index) => {
      const option = document.createElement('option');
      option.value = ship.subtexture;
      option.textContent = 'Ship ' + (index + 1);
      return option;
    }));
    this.game.canvas.tabIndex = 0;
    this.game.canvas.setAttribute('aria-label', 'Space game. Use W to fly, A and D to turn, and Space to fire.');
    this.input.keyboard!.disableGlobalCapture();
    const releaseKeys = () => this.input.keyboard?.resetKeys();
    const start = () => {
      const definition = definitions.find(ship => ship.subtexture === select.value) || definitions[0];
      this.practiceWorld = new PracticeWorld(definition);
      tools.hidden = false;
      controls.hidden = false;
      controls.textContent = 'W: thrust · A/D or Q/E: turn · Space: fire' + (definition.guns?.length ? '' : ' · This ship has no guns');
      toggle.textContent = 'Watch live game';
      document.getElementById('game-status')!.textContent = 'Practice • Your own flight, no Twitch login needed';
      releaseKeys();
      this.applySnapshot(this.practiceWorld.snapshot());
      this.scale.refresh();
      this.game.canvas.focus();
    };
    const toggleMode = () => {
      if (!this.practiceWorld) { start(); return; }
      this.practiceWorld = undefined;
      tools.hidden = true;
      controls.hidden = true;
      toggle.textContent = 'Play practice';
      releaseKeys();
      this.applySnapshot(this.liveSnapshot || { players: {}, projectiles: {} });
      this.scale.refresh();
    };
    toggle.disabled = false;
    toggle.addEventListener('click', toggleMode);
    select.addEventListener('change', start);
    reset.addEventListener('click', start);
    window.addEventListener('blur', releaseKeys);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      toggle.removeEventListener('click', toggleMode);
      select.removeEventListener('change', start);
      reset.removeEventListener('click', start);
      window.removeEventListener('blur', releaseKeys);
    });
  }

  update(_time: number, delta: number) {
    if (this.practiceWorld) {
      if (document.activeElement !== this.game.canvas) this.input.keyboard?.resetKeys();
      const { up, left, right, rotateLeft, rotateRight, space } = this.cursors;
      // Keep quick taps that begin and end between frames.
      const pressed = (key: Phaser.Input.Keyboard.Key) => key.isDown || Phaser.Input.Keyboard.JustUp(key);
      const input = {
        up: pressed(up), left: pressed(left), right: pressed(right),
        rotateLeft: pressed(rotateLeft), rotateRight: pressed(rotateRight), space: pressed(space)
      };
      this.practiceWorld.update(delta, input);
      this.applySnapshot(this.practiceWorld.snapshot());
    }
    for (const id in this.players) updateShipThrusters(this.players[id], this.playerThrusterStates[id] || false);
  }
}
