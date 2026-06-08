import { isAllowedRegistrationUrl } from "./domain-whitelist";

let extraDomains: string[] = [];

export function isRegistrationUrlAllowed(url: string) {
  return isAllowedRegistrationUrl(url, extraDomains);
}

export async function refreshAllowedDomains(apiBase: string) {
  try {
    const res = await fetch(`${apiBase}/api/settings`, {
      headers: { "Cache-Control": "no-cache" },
    });
    if (!res.ok) return;

    const data = (await res.json()) as { allowedDomains?: string[] };
    if (Array.isArray(data.allowedDomains)) {
      extraDomains = data.allowedDomains;
    }
  } catch {
    // Keep the previous list if the web app is temporarily unreachable.
  }
}

export function startAllowedDomainsPolling(apiBase: string, intervalMs = 30_000) {
  void refreshAllowedDomains(apiBase);
  return setInterval(() => void refreshAllowedDomains(apiBase), intervalMs);
}
