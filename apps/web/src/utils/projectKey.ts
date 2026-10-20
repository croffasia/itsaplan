import { transliterate } from '@/utils/transliterate';

export const KEY_MAX_LENGTH = 10;

// Suggests a short project key from the name, in the style of Jira/Linear:
// several words become their initials (e.g. "Marketing Team" → "MT"), a single
// word becomes its first few letters (e.g. "Marketing" → "MARK"). Non-Latin
// scripts are transliterated, only letters and digits are kept, and the result
// is uppercased and starts with a letter.
export function suggestKey(name: string): string {
  const words = transliterate(name)
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '';
  const raw = words.length === 1 ? words[0].slice(0, 4) : words.map((w) => w[0]).join('');
  return raw.replace(/^\d+/, '').slice(0, KEY_MAX_LENGTH);
}

// Normalizes what the user typed into the key field: transliterated, uppercase,
// letters and digits only, starting with a letter, capped at the maximum length.
export function normalizeKey(input: string): string {
  return transliterate(input)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^\d+/, '')
    .slice(0, KEY_MAX_LENGTH);
}

// Whether a stored key matches what normalizeKey produces. A project created before
// that rule existed may carry a key that does not, and may then change it.
export function isValidKey(key: string): boolean {
  return normalizeKey(key) === key && key !== '';
}
