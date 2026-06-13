/** Upload an image file via the admin API. Returns the public `/uploads/…` URL. */
export async function uploadImageFile(file: File): Promise<string | null> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body });
  if (!res.ok) return null;

  const data = (await res.json()) as { url?: string };
  return data.url ?? null;
}
