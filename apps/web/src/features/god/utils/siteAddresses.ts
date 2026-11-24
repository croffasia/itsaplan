// The sites typed into the embed list, split on commas, semicolons and spaces, once each.
export function parseSiteAddresses(text: string): string[] {
  return [...new Set(text.split(/[\s,;]+/).filter(Boolean))];
}

// A site address the api takes: http or https, a host, a port at most, nothing after.
export function isSiteAddress(text: string): boolean {
  try {
    const url = new URL(text);
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      /^[a-z0-9.-]+$/.test(url.hostname) &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
