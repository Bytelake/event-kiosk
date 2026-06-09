const DEFAULT_ALLOWED_DOMAINS = [
  "signupgenius.com",
  "www.signupgenius.com",
  "eventbrite.com",
  "www.eventbrite.com",
  "breezechms.com",
  "forms.gle",
  "docs.google.com",
];

export function isAllowedRegistrationUrl(urlString: string, extraDomains: string[] = []) {
  try {
    const url = new URL(urlString);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    const allowed = [...DEFAULT_ALLOWED_DOMAINS, ...extraDomains.map((d) => d.toLowerCase())];
    return allowed.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}
