import { transliterate } from '@/utils/projectKey';

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
