import { mkdir, readdir, unlink, writeFile } from "fs/promises";
import path from "path";

/** Uploaded images (served at /uploads/… via app/uploads/[...path]/route.ts). */
export function getUploadsDir(): string {
  if (process.env.UPLOADS_DIR) {
    return process.env.UPLOADS_DIR;
  }

  return path.join(process.cwd(), "public", "uploads");
}

export function uploadPublicUrl(filename: string): string {
  return `/uploads/${filename}`;
}

/** Parse a managed `/uploads/…` URL into its filename, or null if external/invalid. */
export function filenameFromUploadUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  const prefix = "/uploads/";
  if (!url.startsWith(prefix)) return null;

  const filename = url.slice(prefix.length);
  if (!filename || filename.includes("..") || filename.includes("/")) return null;

  return filename;
}

export async function writeUploadedImage(buffer: Buffer, ext: string): Promise<string> {
  const uploadsDir = getUploadsDir();
  await mkdir(uploadsDir, { recursive: true });

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  await writeFile(path.join(uploadsDir, filename), buffer);
  return filename;
}

export async function deleteUploadByFilename(filename: string): Promise<void> {
  const filePath = path.join(getUploadsDir(), filename);
  try {
    await unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

export async function listUploadFilenames(): Promise<string[]> {
  const uploadsDir = getUploadsDir();
  try {
    const entries = await readdir(uploadsDir, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export function contentTypeForUpload(filename: string): string {
  switch (path.extname(filename).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}
