// Plain-text matching for a "KEY-123"-style cross-reference (Plane's own issue
// identifier shape). Source-independent and dependency-free like canonical.ts and
// plane-adapter.ts's pure functions, so this is unit-tested directly, without a
// database: see import-worker.ts's Rewrite phase for how it resolves what these
// find into itsaplan's own issue ids.

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function crossReferencePattern(sourceProjectKey: string): RegExp {
  return new RegExp(`\\b${escapeRegExp(sourceProjectKey)}-(\\d+)\\b`, 'g');
}

export interface CrossReferenceMatch {
  reference: string; // The whole match, e.g. "ROOMS-524".
  sequenceId: string; // The captured number, e.g. "524".
}

// Every distinct mention of sourceProjectKey in text, first-seen order. Word
// boundaries on both ends mean "XROOMS-524" and "ROOMS-524X" do not match.
export function extractCrossReferences(
  text: string,
  sourceProjectKey: string,
): CrossReferenceMatch[] {
  const seen = new Map<string, CrossReferenceMatch>();
  for (const match of text.matchAll(crossReferencePattern(sourceProjectKey))) {
    if (!seen.has(match[0])) seen.set(match[0], { reference: match[0], sequenceId: match[1]! });
  }
  return [...seen.values()];
}

// Substitutes every mention with its resolved replacement; one with no entry in
// `replacements` (unresolved - outside the imported set) is left exactly as-is.
export function applyCrossReferenceReplacements(
  text: string,
  sourceProjectKey: string,
  replacements: Map<string, string>,
): string {
  if (replacements.size === 0) return text;
  return text.replace(crossReferencePattern(sourceProjectKey), (whole) => {
    return replacements.get(whole) ?? whole;
  });
}
