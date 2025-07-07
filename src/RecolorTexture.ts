import { Scene } from 'phaser';

/**
 * Recolors specific hex colors in a texture and adds the result as a new texture.
 *
 * @param scene        The Phaser scene
 * @param sourceKey    Texture key to load from
 * @param targetKey    New texture key to save as
 * @param replaceMap   Object mapping source hex to target hex (e.g. { '#ff0000': '#00ff00' })
 */
export function RecolorTexture(
  scene: Scene,
  sourceKey: string,
  targetKey: string,
  replaceMap: Record<string, string>
): void {
  const src = scene.textures.get(sourceKey).getSourceImage();
  const canvas = scene.textures.createCanvas(targetKey, src.width, src.height)!.getSourceImage() as HTMLCanvasElement;
  const context: CanvasRenderingContext2D = canvas.getContext('2d')!;

  context.drawImage(src as HTMLImageElement, 0, 0);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const hexToRgb = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return {
      r: (n >> 16) & 255,
      g: (n >> 8) & 255,
      b: n & 255
    };
  };

  const matchColor = (r: number, g: number, b: number, target: { r: number; g: number; b: number }) => {
    return r === target.r && g === target.g && b === target.b;
  };

  const replacePairs = Object.entries(replaceMap).map(([fromHex, toHex]) => {
    return { from: hexToRgb(fromHex), to: hexToRgb(toHex) };
  });

  for (let i = 0; i < data.length; i += 4) {
    for (const pair of replacePairs) {
      if (matchColor(data[i], data[i + 1], data[i + 2], pair.from)) {
        data[i] = pair.to.r;
        data[i + 1] = pair.to.g;
        data[i + 2] = pair.to.b;
        break;
      }
    }
  }

  context.putImageData(imageData, 0, 0);
  scene.textures.addCanvas(targetKey, canvas);
}
