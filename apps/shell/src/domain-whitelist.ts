const DEFAULT_ALLOWED_DOMAINS = [
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

function isUsableRegistrationDomain(domain: string): boolean {
  const host = domain.trim().toLowerCase();
  if (!host || host.length > 253 || !host.includes(".")) return false;
  if (!/^[a-z0-9.-]+$/.test(host)) return false;
  if (BLOCKED_REGISTRATION_DOMAINS.has(host)) return false;
  return true;
}

export function isAllowedRegistrationUrl(urlString: string, extraDomains: string[] = []) {
  try {
    const url = new URL(urlString);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    const allowed = [
      ...DEFAULT_ALLOWED_DOMAINS,
      ...extraDomains.map((d) => d.toLowerCase()).filter(isUsableRegistrationDomain),
    ];
    return allowed.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}
