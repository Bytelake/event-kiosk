import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { optimizeUploadedImage } from "@/lib/image-optimize";
import { detectImageFormat, MAX_UPLOAD_BYTES } from "@/lib/upload-validation";
import { uploadPublicUrl, writeUploadedImage } from "@/lib/uploads";

export async function POST(request: NextRequest) {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (buffer.length > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }

  const format = detectImageFormat(buffer);
  if (!format) {
    return NextResponse.json(
      { error: "File must be a JPEG, PNG, GIF, or WebP image" },
      { status: 400 },
    );
  }

  try {
    const optimized = await optimizeUploadedImage(buffer, format.ext);
    const filename = await writeUploadedImage(optimized.buffer, optimized.ext);
    return NextResponse.json({ url: uploadPublicUrl(filename) });
  } catch (error) {
    console.error("[upload]", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
