import { GITHUB_REPO, getKioskVersion, isNewerVersion } from "@/lib/kiosk-version";

export interface ReleaseCheckResult {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
  publishedAt: string | null;
  checkedAt: string;
  error: string | null;
}

interface GitHubReleaseResponse {
  tag_name: string;
  html_url: string;
  published_at: string;
}

const CACHE_TTL_MS = 60 * 60 * 1000;

let cachedRelease: { expiresAt: number; result: ReleaseCheckResult } | null = null;

export async function checkLatestRelease(force = false): Promise<ReleaseCheckResult> {
  const now = Date.now();
  if (!force && cachedRelease && cachedRelease.expiresAt > now) {
    return cachedRelease.result;
  }

  const currentVersion = getKioskVersion();
  const checkedAt = new Date().toISOString();
  const base: ReleaseCheckResult = {
    currentVersion,
    latestVersion: null,
    updateAvailable: false,
    releaseUrl: null,
    publishedAt: null,
    checkedAt,
    error: null,
  };

  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": `event-kiosk/${currentVersion}`,
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      const result: ReleaseCheckResult = {
        ...base,
        error:
          response.status === 404
            ? "No published releases found on GitHub yet."
            : `GitHub API returned ${response.status}`,
      };
      cachedRelease = { expiresAt: now + 5 * 60 * 1000, result };
      return result;
    }

    const data = (await response.json()) as GitHubReleaseResponse;
    const latestVersion = data.tag_name.replace(/^v/i, "");
    const result: ReleaseCheckResult = {
      currentVersion,
      latestVersion,
      updateAvailable: isNewerVersion(latestVersion, currentVersion),
      releaseUrl: data.html_url,
      publishedAt: data.published_at,
      checkedAt,
      error: null,
    };

    cachedRelease = { expiresAt: now + CACHE_TTL_MS, result };
    return result;
  } catch {
    const result: ReleaseCheckResult = {
      ...base,
      error: "Could not reach GitHub to check for updates.",
    };
    cachedRelease = { expiresAt: now + 5 * 60 * 1000, result };
    return result;
  }
}
