import { isAllowedRegistrationUrl } from "./domain-whitelist";

let extraDomains: string[] = [];
let enforcementEnabled = true;

function isHttpsUrl(url: string) {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

export function isRegistrationUrlAllowed(url: string) {
  if (!enforcementEnabled) {
    return isHttpsUrl(url);
  }
  return isAllowedRegistrationUrl(url, extraDomains);
}

export async function refreshAllowedDomains(apiBase: string) {
  try {
    const res = await fetch(`${apiBase}/api/settings`, {
      headers: { "Cache-Control": "no-cache" },
    });
    if (!res.ok) return;

    const data = (await res.json()) as {
      allowedDomains?: string[];
      registrationDomainEnforcement?: boolean;
    };
    if (Array.isArray(data.allowedDomains)) {
      extraDomains = data.allowedDomains.filter(
        (domain): domain is string => typeof domain === "string",
      );
    }
    if (typeof data.registrationDomainEnforcement === "boolean") {
      enforcementEnabled = data.registrationDomainEnforcement;
    }
  } catch {
    // Keep the previous list if the web app is temporarily unreachable.
  }
}

export function startAllowedDomainsPolling(apiBase: string, intervalMs = 30_000) {
  void refreshAllowedDomains(apiBase);
  return setInterval(() => void refreshAllowedDomains(apiBase), intervalMs);
}
