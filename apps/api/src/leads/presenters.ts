export interface PublicEvidence {
  type: string;
  url: string;
}

function httpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const normalized = value.trim();
    const url = new URL(normalized);
    return url.protocol === 'http:' || url.protocol === 'https:' ? normalized : null;
  } catch {
    return null;
  }
}

export function firstPartyWebsite(url: string | null, websiteType: string | null): string | null {
  return websiteType === 'first_party' ? httpUrl(url) : null;
}

export function publicEvidence(value: unknown): PublicEvidence[] {
  if (!Array.isArray(value)) return [];
  const evidence = value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const source = item as Record<string, unknown>;
    const url = httpUrl(source.source_url ?? source.url);
    if (!url) return [];
    const type = source.evidence_type ?? source.type ?? source.kind ?? 'evidence';
    return [{ type: typeof type === 'string' ? type : 'evidence', url }];
  });
  return evidence.filter(
    (item, index) => evidence.findIndex((candidate) => candidate.url === item.url) === index,
  );
}

export function textItems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === 'string' && item.trim()) return [item.trim()];
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const text = row.finding ?? row.opportunity ?? row.description ?? row.text ?? row.title;
    return typeof text === 'string' && text.trim() ? [text.trim()] : [];
  });
}
