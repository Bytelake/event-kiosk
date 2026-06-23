/** Upload an image file via the admin API. Returns the public `/uploads/…` URL. */
export type UploadImageResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function uploadImageFile(file: File): Promise<UploadImageResult> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };

  if (!res.ok) {
    return { ok: false, error: data.error ?? `Upload failed (${res.status})` };
  }

  if (!data.url) {
    return { ok: false, error: "Upload failed: no URL returned" };
  }

  return { ok: true, url: data.url };
}
