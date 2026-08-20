import type { Metadata, Sharp } from "sharp";

/** Max width for kiosk display images (4K displays are 3840px wide). */
export const MAX_UPLOAD_IMAGE_WIDTH = 4000;

/** Re-optimize existing uploads when they exceed this size on disk. */
export const LAZY_OPTIMIZE_BYTES = 512 * 1024;

export type OptimizedImageExt = ".jpg" | ".png" | ".gif" | ".webp";

type OptimizeOptions = {
  /** Keep the output extension (for in-place migration of existing uploads). */
  preserveExt?: OptimizedImageExt;
};

type SharpFactory = typeof import("sharp");

let sharpFactoryPromise: Promise<SharpFactory> | null = null;

async function loadSharp(): Promise<SharpFactory> {
  if (!sharpFactoryPromise) {
    sharpFactoryPromise = import("sharp").then((mod) => {
      const factory = ("default" in mod ? mod.default : mod) as SharpFactory;
      return factory;
    });
  }
  return sharpFactoryPromise;
}

function extFromFilename(filename: string): OptimizedImageExt | null {
  switch (filename.toLowerCase().slice(filename.lastIndexOf("."))) {
    case ".jpg":
    case ".jpeg":
      return ".jpg";
    case ".png":
      return ".png";
    case ".gif":
      return ".gif";
    case ".webp":
      return ".webp";
    default:
      return null;
  }
}

/** Max decoded pixels (width * height * frames) accepted by sharp. */
const MAX_INPUT_PIXELS = MAX_UPLOAD_IMAGE_WIDTH * MAX_UPLOAD_IMAGE_WIDTH;

function sharpOptions(animated = false) {
  return { animated, limitInputPixels: MAX_INPUT_PIXELS };
}

function resizeIfNeeded(
  pipeline: Sharp,
  width: number | undefined,
): Sharp {
  if ((width ?? 0) <= MAX_UPLOAD_IMAGE_WIDTH) {
    return pipeline;
  }

  return pipeline.resize({
    width: MAX_UPLOAD_IMAGE_WIDTH,
    withoutEnlargement: true,
  });
}

async function encodeAnimatedGif(
  sharp: SharpFactory,
  input: Buffer,
  width: number | undefined,
): Promise<Buffer> {
  let pipeline = sharp(input, sharpOptions(true)).rotate();
  pipeline = resizeIfNeeded(pipeline, width);
  return pipeline.gif().toBuffer();
}

async function encodeAsExt(
  sharp: SharpFactory,
  input: Buffer,
  ext: OptimizedImageExt,
  width: number | undefined,
  hasAlpha: boolean,
): Promise<Buffer> {
  let pipeline = sharp(input, sharpOptions()).rotate();
  pipeline = resizeIfNeeded(pipeline, width);

  switch (ext) {
    case ".gif":
      return pipeline.gif().toBuffer();
    case ".jpg":
      return pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    case ".png":
      return pipeline.png({ compressionLevel: 9, palette: !hasAlpha }).toBuffer();
    case ".webp":
      return pipeline.webp({ quality: hasAlpha ? 90 : 85, effort: 4 }).toBuffer();
  }
}

function pickOutputExt(
  sourceExt: OptimizedImageExt,
  metadata: Metadata,
  preserveExt: OptimizedImageExt | undefined,
): OptimizedImageExt {
  if (preserveExt) {
    return preserveExt;
  }

  const isAnimatedGif = sourceExt === ".gif" && (metadata.pages ?? 1) > 1;
  if (isAnimatedGif) {
    return ".gif";
  }

  return ".webp";
}

/** Resize and compress an uploaded image for kiosk display. */
export async function optimizeUploadedImage(
  input: Buffer,
  sourceExt: OptimizedImageExt,
  options: OptimizeOptions = {},
): Promise<{ buffer: Buffer; ext: OptimizedImageExt }> {
  const sharp = await loadSharp();
  const metadata = await sharp(input, sharpOptions(sourceExt === ".gif")).metadata();
  const outputExt = pickOutputExt(sourceExt, metadata, options.preserveExt);

  if (outputExt === ".gif" && (metadata.pages ?? 1) > 1) {
    const buffer = await encodeAnimatedGif(sharp, input, metadata.width);
    return { buffer, ext: ".gif" };
  }

  const buffer = await encodeAsExt(
    sharp,
    input,
    outputExt,
    metadata.width,
    metadata.hasAlpha ?? false,
  );

  return { buffer, ext: outputExt };
}

export function shouldLazyOptimizeUpload(fileSizeBytes: number): boolean {
  return fileSizeBytes > LAZY_OPTIMIZE_BYTES;
}

/** Optimize an on-disk upload in place, preserving its filename extension. */
export async function optimizeUploadFileInPlace(filePath: string): Promise<boolean> {
  const ext = extFromFilename(filePath);
  if (!ext) {
    return false;
  }

  const { readFile, writeFile } = await import("fs/promises");
  const input = await readFile(filePath);
  const optimized = await optimizeUploadedImage(input, ext, { preserveExt: ext });

  if (optimized.buffer.length >= input.length) {
    return false;
  }

  await writeFile(filePath, optimized.buffer);
  return true;
}
