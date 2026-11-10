import { transliterate } from '@/utils/transliterate';

// Mirrors the API's rule for a slug.
export const TEAM_SLUG_PATTERN = /^[a-z][a-z0-9-]{0,38}[a-z0-9]$/;

// Suggests a slug from the team's name: transliterated, lowercased, every run of other
// characters turned into one dash, cut to start with a letter and to 40 characters
// (e.g. "Команда Ops 2" -> "komanda-ops-2").
export function suggestTeamSlug(name: string): string {
  return transliterate(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^[^a-z]+/, '')
    .slice(0, 40)
    .replace(/-+$/, '');
}

// What the URL field stores. The hint shows the slug with a leading slash ("/acme"),
// so a slash typed or pasted there is not part of the slug.
export function normalizeTeamSlugInput(value: string): string {
  return value.toLowerCase().trim().replace(/^\/+/, '');
}

// A name to show when the user filled the URL and left the name empty
// ("minha-equipe" -> "Minha equipe").
export function nameFromTeamSlug(slug: string): string {
  const words = slug.replace(/-+/g, ' ').replace(/\s+/g, ' ').trim();
  if (words === '') return '';
  return words.charAt(0).toUpperCase() + words.slice(1);
}
