import { existsSync } from "fs";
import path from "path";

/** Uploaded images (served at /uploads/…). */
export function getUploadsDir(): string {
  if (process.env.UPLOADS_DIR) {
    return process.env.UPLOADS_DIR;
  }

  // Next.js standalone Pi package: cwd is .../web, static tree is apps/web/public.
  const standalonePublic = path.join(process.cwd(), "apps", "web", "public", "uploads");
  if (existsSync(path.dirname(standalonePublic))) {
    return standalonePublic;
  }

  return path.join(process.cwd(), "public", "uploads");
}

export function uploadPublicUrl(filename: string): string {
  return `/uploads/${filename}`;
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
