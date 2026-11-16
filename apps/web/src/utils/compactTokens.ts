// Written the same way in every language: the localised compact form spells the
// thousands out ("42,1 тыс.") and takes more room than the row has.
export function compactTokens(tokens: number): string {
  return tokens < 1000 ? String(tokens) : `${(tokens / 1000).toFixed(1)}k`;
}
