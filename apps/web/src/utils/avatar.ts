// Deterministic avatar helpers: the same name always yields the same initials
// and background color, used by the Avatar component and anywhere a person is
// shown.

// Two-letter avatar initials for an assignee. Names use the first letter of
// their first two words ("Jane Doe" → "JD"); a single token (or an email) uses
// its first two letters, with the email domain dropped first ("jane@x.io" → "JA").
export function initials(name: string): string {
  const base = name.split('@')[0].trim();
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

// Deterministic avatar background from a seed (the initials): the same letters
// always map to the same hue. Fixed saturation/lightness keep white text
// readable on the swatch in both themes.
export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue} 52% 45%)`;
}
