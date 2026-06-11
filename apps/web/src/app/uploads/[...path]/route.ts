import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { contentTypeForUpload, getUploadsDir } from "@/lib/uploads";

export async function GET(
  _request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const segments = params.path ?? [];
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
    const buffer = await readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentTypeForUpload(filename),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
