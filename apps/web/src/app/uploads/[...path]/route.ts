import { createHash } from "crypto";
import { readFile, stat, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import {
  optimizeUploadedImage,
  shouldLazyOptimizeUpload,
} from "@/lib/image-optimize";
import { contentTypeForUpload, getUploadsDir } from "@/lib/uploads";

export const dynamic = "force-dynamic";

function etagFor(size: number, mtimeMs: number): string {
  return `"${createHash("md5").update(`${size}:${mtimeMs}`).digest("hex")}"`;
}

function extFromFilename(filename: string): ".jpg" | ".png" | ".gif" | ".webp" | null {
  switch (path.extname(filename).toLowerCase()) {
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

async function maybeOptimizeUpload(
  filePath: string,
  buffer: Buffer,
  fileSize: number,
): Promise<Buffer> {
  if (!shouldLazyOptimizeUpload(fileSize)) {
    return buffer;
  }

  const ext = extFromFilename(filePath);
  if (!ext) {
    return buffer;
  }

  try {
    const optimized = await optimizeUploadedImage(buffer, ext, { preserveExt: ext });
    if (optimized.buffer.length < buffer.length) {
      void writeFile(filePath, optimized.buffer).catch((error) => {
        console.error("[uploads] Failed to persist optimized image:", error);
      });
      return optimized.buffer;
    }
  } catch (error) {
    console.error("[uploads] Lazy optimization failed:", error);
  }

  return buffer;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: pathSegments } = await params;
  const segments = pathSegments ?? [];
  const filename = path.basename(segments.join("/"));
  if (!filename || filename !== segments.join("/")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const uploadsDir = path.resolve(getUploadsDir());
  const filePath = path.resolve(uploadsDir, filename);
  if (!filePath.startsWith(`${uploadsDir}${path.sep}`) && filePath !== uploadsDir) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const fileStat = await stat(filePath);
    const etag = etagFor(fileStat.size, fileStat.mtimeMs);
    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304 });
    }

    const rawBuffer = await readFile(filePath);
    const buffer = await maybeOptimizeUpload(filePath, rawBuffer, fileStat.size);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentTypeForUpload(filename),
        "Cache-Control": "public, max-age=31536000, immutable",
        ETag: etag,
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
