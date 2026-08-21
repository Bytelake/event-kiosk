const UNSAFE_URL_CHARS = /[\s<>\\"']/;
const UPLOADS_PREFIX = "/uploads/";

function isManagedUploadUrl(url: string): boolean {
  if (!url.startsWith(UPLOADS_PREFIX)) return false;
  const filename = url.slice(UPLOADS_PREFIX.length);
  return Boolean(filename) && !filename.includes("..") && !filename.includes("/");
}

function isHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

/** URLs that are safe to persist (uploads or https). */
export function isSafeStoredMediaUrl(url: string): boolean {
  if (!url || UNSAFE_URL_CHARS.test(url) || url.includes("..")) return false;
  if (isManagedUploadUrl(url)) return true;
  return isHttpsUrl(url);
}

/** URLs that are safe to render in img src / CSS url(). */
export function isSafeDisplayUrl(url: string): boolean {
  if (!url || UNSAFE_URL_CHARS.test(url)) return false;
  if (url.startsWith("blob:")) return true;
  return isSafeStoredMediaUrl(url);
}

/** CSS `url("…")` value, or undefined when the URL must not be painted. */
export function cssImageUrl(url: string | null | undefined): string | undefined {
  if (!url || !isSafeDisplayUrl(url)) return undefined;
  return `url(${JSON.stringify(url)})`;
}
