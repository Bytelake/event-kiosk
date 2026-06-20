const DEFAULT_MIN_CONTRAST = 4;

function parseHex(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return [15, 23, 42];
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(r: number, g: number, b: number): number {
  return (
    0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
  );
}

function contrastRatio(lum1: number, lum2: number): number {
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

function blendWithScrim(
  r: number,
  g: number,
  b: number,
  yRatio: number,
  scrimRgb: [number, number, number],
): [number, number, number] {
  const scrimOpacity = 0.12 + (0.55 - 0.12) * yRatio;
  const scrimR = 255 * (1 - yRatio) + scrimRgb[0] * yRatio;
  const scrimG = 255 * (1 - yRatio) + scrimRgb[1] * yRatio;
  const scrimB = 255 * (1 - yRatio) + scrimRgb[2] * yRatio;

  return [
    r * (1 - scrimOpacity) + scrimR * scrimOpacity,
    g * (1 - scrimOpacity) + scrimG * scrimOpacity,
    b * (1 - scrimOpacity) + scrimB * scrimOpacity,
  ];
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load background image"));
    img.src = url;
  });
}

/** Returns true when configured text colors would not read well over the scrimmed image. */
export async function shouldUseLightKioskText(
  imageUrl: string,
  options: {
    scrimHex: string;
    textHex: string;
    mutedTextHex: string;
    minContrast?: number;
  },
): Promise<boolean> {
  const minContrast = options.minContrast ?? DEFAULT_MIN_CONTRAST;
  const scrimRgb = parseHex(options.scrimHex);
  const textLum = relativeLuminance(...parseHex(options.textHex));
  const mutedLum = relativeLuminance(...parseHex(options.mutedTextHex));

  let img: HTMLImageElement;
  try {
    img = await loadImage(imageUrl);
  } catch {
    return false;
  }

  const canvas = document.createElement("canvas");
  const width = 120;
  const height = 80;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return false;

  const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
  const drawWidth = img.naturalWidth * scale;
  const drawHeight = img.naturalHeight * scale;
  const offsetX = (width - drawWidth) / 2;
  const offsetY = (height - drawHeight) / 2;
  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

  const { data } = ctx.getImageData(0, 0, width, height);
  let sampleCount = 0;
  let totalLum = 0;

  for (let y = Math.floor(height * 0.05); y < height * 0.42; y++) {
    for (let x = Math.floor(width * 0.2); x < width * 0.8; x++) {
      const i = (y * width + x) * 4;
      const yRatio = y / (height - 1);
      const [r, g, b] = blendWithScrim(data[i], data[i + 1], data[i + 2], yRatio, scrimRgb);
      totalLum += relativeLuminance(r, g, b);
      sampleCount++;
    }
  }

  if (sampleCount === 0) return false;

  const backgroundLum = totalLum / sampleCount;
  const textContrast = contrastRatio(textLum, backgroundLum);
  const mutedContrast = contrastRatio(mutedLum, backgroundLum);

  return textContrast < minContrast || mutedContrast < minContrast;
}
