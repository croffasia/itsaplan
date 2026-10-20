import { transliterate as toLatin } from 'transliteration';

// Russian and Ukrainian go by this table, the way passports write them (Х → KH, Ц → TS),
// which the library does not. The keys are upper case; the callers set the case.
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

// Every other script goes through the library ("北京" → "Bei Jing"). It marks some letters
// with an apostrophe (Kazakh Қ → K'), which would split a slug inside a word, so
// apostrophes are dropped.
export function transliterate(input: string): string {
  const cyrillic = input.replace(/[а-яёіїєґ]/gi, (ch) => TRANSLIT[ch.toUpperCase()] ?? ch);
  return toLatin(cyrillic).replace(/['`ʼ’]/g, '');
}
