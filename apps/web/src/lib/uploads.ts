import path from "path";

/** Uploaded images (served at /uploads/…). Matches Next standalone cwd (apps/web). */
export function getUploadsDir(): string {
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
