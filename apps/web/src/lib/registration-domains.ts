export const DEFAULT_REGISTRATION_DOMAINS = [
  "signupgenius.com",
  "www.signupgenius.com",
  "eventbrite.com",
  "www.eventbrite.com",
  "breezechms.com",
  "forms.gle",
  "docs.google.com",
];

const BLOCKED_REGISTRATION_DOMAINS = new Set([
  "com",
  "org",
  "net",
  "edu",
  "gov",
  "io",
  "co",
  "uk",
  "us",
  "info",
  "biz",
  "app",
  "dev",
  "co.uk",
  "ac.uk",
  "com.au",
  "co.nz",
  "com.br",
  "co.jp",
  "or.jp",
]);

/** Parse admin input into a hostname, or null if it is empty/invalid. */
export function normalizeAllowedDomain(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  let host = trimmed;
  try {
    if (trimmed.includes("://")) {
      host = new URL(trimmed).hostname.toLowerCase();
    } else {
      host = trimmed.split("/")[0] ?? trimmed;
      if (host.includes(":") && !host.startsWith("[")) {
        host = host.split(":")[0] ?? host;
      }
    }
  } catch {
    return null;
  }

  host = host.replace(/\.$/, "");
  if (!host || host.length > 253 || host.includes("..")) return null;
  if (!/^[a-z0-9.-]+$/.test(host)) return null;
  if (host.startsWith("-") || host.endsWith("-") || host.startsWith(".") || host.endsWith(".")) {
    return null;
  }
  if (!host.includes(".")) return null;
  if (BLOCKED_REGISTRATION_DOMAINS.has(host)) return null;

  return host;
}

export function normalizeRegistrationUrl(urlString: string): string {
  const trimmed = urlString.trim();
  if (!trimmed) return "";

  if (/^https:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (/^http:\/\//i.test(trimmed)) {
    return `https://${trimmed.slice(7)}`;
  }
  return `https://${trimmed}`;
}

export function extractRegistrationHostname(urlString: string): string | null {
  const normalized = normalizeRegistrationUrl(urlString);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    if (url.protocol !== "https:") return null;
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isRegistrationDomainAllowed(
  urlString: string,
  extraDomains: string[] = [],
): boolean {
  const normalized = normalizeRegistrationUrl(urlString);
  const host = extractRegistrationHostname(normalized);
  if (!host) return false;

  const allowed = [
    ...DEFAULT_REGISTRATION_DOMAINS,
    ...extraDomains
      .map((domain) => domain.toLowerCase())
      .filter((domain) => normalizeAllowedDomain(domain) === domain),
  ];
  return allowed.some((domain) => host === domain || host.endsWith(`.${domain}`));
}
