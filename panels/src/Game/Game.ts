import { AUTO, Game, type Types, Scale } from 'phaser';
import GameScene from './GameScene';

const config: Types.Core.GameConfig = {
    parent: 'game',
    type: AUTO,
    width: 800,
    height: 450,
    backgroundColor: '#050912',
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

const game = new Game(config);
if (import.meta.hot) import.meta.hot.dispose(() => game.destroy(true));
export default game;
