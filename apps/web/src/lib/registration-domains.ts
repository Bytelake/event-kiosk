export const DEFAULT_REGISTRATION_DOMAINS = [
  "signupgenius.com",
  "www.signupgenius.com",
  "eventbrite.com",
  "www.eventbrite.com",
  "breezechms.com",
  "forms.gle",
  "docs.google.com",
];

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
    ...extraDomains.map((d) => d.toLowerCase()),
  ];
  return allowed.some((domain) => host === domain || host.endsWith(`.${domain}`));
}
