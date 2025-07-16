import { Scene, GameObjects } from 'phaser';

export interface ThrusterConfig {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export class ThrusterSystem {
  private scene: Scene;
  private thrusters: GameObjects.Sprite[] = [];
  private thrusterAnimation: string = '';
  private isAnimating: boolean = false;

  constructor(scene: Scene) {
    this.scene = scene;
    this.createThrusterAnimation();
  }

  private createThrusterAnimation() {
    if (!this.scene.anims.exists('thruster_fire')) {
      // Get all frame names from the thruster_fire atlas
      const frames = [
        '0001.png', '0007.png', '0013.png', '0019.png', '0025.png', '0031.png',
        '0037.png', '0043.png', '0049.png', '0055.png', '0061.png', '0067.png',
        '0073.png', '0079.png', '0085.png', '0091.png', '0097.png', '0104.png',
        '0115.png', '0123.png'
      ].map(frame => ({
        key: 'thruster_fire',
        frame: frame
      }));

      this.scene.anims.create({
        key: 'thruster_fire',
        frames: frames,
        frameRate: 30,
        repeat: -1
      });
    }
    this.thrusterAnimation = 'thruster_fire';
  }

  createThrusters(parentShip: GameObjects.Sprite, thrusterConfigs: ThrusterConfig[]): void {
    // Clear existing thrusters
    this.destroyThrusters();

    thrusterConfigs.forEach(config => {
      const thruster = this.scene.add.sprite(0, 0, 'thruster_fire', '0001.png');
      
      // Apply configuration
      thruster.setScale(config.scale);
      thruster.setRotation(config.rotation * Math.PI / 180);
      thruster.setVisible(false);
      
      // Position relative to parent ship
      thruster.x = parentShip.x + config.x;
      thruster.y = parentShip.y + config.y;
      
      this.thrusters.push(thruster);
    });
  }

  updateThrusterPositions(parentShip: GameObjects.Sprite, thrusterConfigs: ThrusterConfig[]): void {
    this.thrusters.forEach((thruster, index) => {
      if (index < thrusterConfigs.length) {
        const config = thrusterConfigs[index];
        
        // Calculate rotated position relative to ship
        const cos = Math.cos(parentShip.rotation);
        const sin = Math.sin(parentShip.rotation);
        
        const rotatedX = config.x * cos - config.y * sin;
        const rotatedY = config.x * sin + config.y * cos;
        
        thruster.x = parentShip.x + rotatedX;
        thruster.y = parentShip.y + rotatedY;
        
        thruster.setRotation(parentShip.rotation + (config.rotation * Math.PI / 180));
      }
    });
  }

  startThrusterAnimation(): void {
    if (!this.isAnimating) {
      this.isAnimating = true;
      this.thrusters.forEach(thruster => {
        thruster.setVisible(true);
        thruster.play(this.thrusterAnimation);
      });
    }
  }

  stopThrusterAnimation(): void {
    if (this.isAnimating) {
      this.isAnimating = false;
      this.thrusters.forEach(thruster => {
        thruster.setVisible(false);
        thruster.stop();
      });
    }
  }

  destroyThrusters(): void {
    this.thrusters.forEach(thruster => thruster.destroy());
    this.thrusters = [];
    this.isAnimating = false;
  }

  getThrusterCount(): number {
    return this.thrusters.length;
  }
}