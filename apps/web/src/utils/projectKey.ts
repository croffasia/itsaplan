export const KEY_MAX_LENGTH = 10;

// Cyrillic → Latin transliteration so a Russian/Ukrainian name still yields a
// Latin key (keys appear in issue identifiers like "IAP-14"). Multi-letter
// mappings must be applied before the regex that keeps only [A-Z0-9].
const TRANSLIT: Record<string, string> = {
  А: 'A',
  Б: 'B',
  В: 'V',
  Г: 'G',
  Ґ: 'G',
  Д: 'D',
  Е: 'E',
  Ё: 'E',
  Є: 'E',
  Ж: 'ZH',
  З: 'Z',
  И: 'I',
  І: 'I',
  Ї: 'I',
  Й: 'Y',
  К: 'K',
  Л: 'L',
  М: 'M',
  Н: 'N',
  О: 'O',
  П: 'P',
  Р: 'R',
  С: 'S',
  Т: 'T',
  У: 'U',
  Ф: 'F',
  Х: 'KH',
  Ц: 'TS',
  Ч: 'CH',
  Ш: 'SH',
  Щ: 'SCH',
  Ъ: '',
  Ы: 'Y',
  Ь: '',
  Э: 'E',
  Ю: 'YU',
  Я: 'YA',
};

export function transliterate(input: string): string {
  return input.replace(/[а-яёіїєґ]/gi, (ch) => TRANSLIT[ch.toUpperCase()] ?? ch);
}

// Suggests a short project key from the name, in the style of Jira/Linear:
// several words become their initials (e.g. "Marketing Team" → "MT"), a single
// word becomes its first few letters (e.g. "Marketing" → "MARK"). Non-Latin
// scripts are transliterated, only letters and digits are kept, and the result
// is uppercased.
export function suggestKey(name: string): string {
  const words = transliterate(name)
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '';
  const raw = words.length === 1 ? words[0].slice(0, 4) : words.map((w) => w[0]).join('');
  return raw.slice(0, KEY_MAX_LENGTH);
}

// Normalizes what the user typed into the key field: transliterated, uppercase,
// letters and digits only, capped at the maximum length.
export function normalizeKey(input: string): string {
  return transliterate(input)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, KEY_MAX_LENGTH);
}
