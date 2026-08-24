// The time estimate is stored in minutes and written as hours and minutes: '2h',
// '30m', '1h 30m'. There is no day unit — a day only means something with a
// working-day length, which a project does not have.

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

// The minutes behind a typed duration, or null when it does not parse. Accepts the
// units in either order and a bare number as minutes ('90' is an hour and a half),
// so what formatMinutes prints reads back to the same value.
export function parseMinutes(input: string): number | null {
  const text = input.trim().toLowerCase();
  if (!text) return null;
  if (/^\d+$/.test(text)) return Number(text);
  const match = text.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?$/);
  if (!match || (!match[1] && !match[2])) return null;
  return Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
}

// The points estimate as typed, or null when it does not parse. Fractions are
// allowed (a half-point scale is one a team can choose); a negative is not.
export function parsePoints(input: string): number | null {
  const text = input.trim().replace(',', '.');
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? value : null;
}
