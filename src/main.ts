import { AUTO, Game, Types, Scale } from 'phaser';
import GameScene from './scenes/GameScene';

const config: Types.Core.GameConfig = {
    parent: 'app',
    type: AUTO,
    width: 800,
    height: 450,
    scale: {
        mode: Scale.ScaleModes.FIT,
        autoCenter: Scale.CENTER_BOTH,
    },
    physics: {
        default: 'matter',
        matter: {
            gravity: { x: 0, y: 0 },
            debug: false
        }
    },
    scene: [
        GameScene,
    ]
};

export default new Game(config);