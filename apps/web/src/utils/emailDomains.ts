// The api's own rule for an allowed email domain, and its limit on how many there are.
const EMAIL_DOMAIN = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/;
const MAX_EMAIL_DOMAINS = 100;

export function parseEmailDomains(text: string): string[] {
  const domains = text
    .toLowerCase()
    .split(/[\s,;]+/)
    .map((domain) => domain.replace(/^@/, ''))
    .filter(Boolean);
  return [...new Set(domains)];
}

export function emailDomainsValid(domains: string[]): boolean {
  return (
    domains.length <= MAX_EMAIL_DOMAINS && domains.every((domain) => EMAIL_DOMAIN.test(domain))
  );
}
