import { AUTO, Game, type Types, Scale } from 'phaser';
import GameScene from './GameScene';

const config: Types.Core.GameConfig = {
    parent: 'game',
    type: AUTO,
    width: 800,
    height: 450,
    backgroundColor: '#7CFC00',
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