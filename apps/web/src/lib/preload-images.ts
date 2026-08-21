import { isSafeDisplayUrl } from "@/lib/media-url";

const preloaded = new Set<string>();

/** Warm the browser cache for kiosk image URLs (backgrounds, cards, logos). */
export function preloadImageUrls(urls: Iterable<string | null | undefined>): void {
  if (typeof window === "undefined") {
    return;
  }

  for (const url of urls) {
    if (!url || !isSafeDisplayUrl(url) || preloaded.has(url)) {
      continue;
    }

    preloaded.add(url);
    const img = new Image();
    img.decoding = "async";
    img.src = url;
  }
}
