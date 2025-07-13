import { Scene } from 'phaser';

/**
 * LoadSubtexture
 * @param scene
 * @param atlasKey
 * @param subKey
 * @param newKey
 * @constructor
 */
export function LoadSubtexture(
  scene: Scene,
  atlasKey: string,
  subKey: string,
  newKey?: string
): void {
  const sub = scene.textures.get(atlasKey).get(subKey);
  const { cutX, cutY, cutWidth, cutHeight } = sub;

  const canvasTexture = scene.textures.createCanvas(newKey ?? subKey, cutWidth, cutHeight)!;
  const ctx = canvasTexture.getContext();
  ctx.drawImage(
    sub.texture.getSourceImage() as any,
    cutX, cutY, cutWidth, cutHeight,
    0, 0, cutWidth, cutHeight
  );
  canvasTexture.refresh();
}
