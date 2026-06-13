import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { isAuthenticated } from "@/lib/auth";
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

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image" }, { status: 400 });
  }

  const ext = path.extname(file.name) || ".jpg";
  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = await writeUploadedImage(buffer, ext);

  return NextResponse.json({ url: uploadPublicUrl(filename) });
}
