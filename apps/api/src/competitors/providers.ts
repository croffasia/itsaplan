import { getTool } from '@repo/agent-tools';
import { HttpError } from '../shared/lib';
import { listCredentials, getCredentialSecret } from '../integrations/store';
import type { SnapshotInput } from './diff';

export const COMPETITOR_PLATFORMS = ['instagram', 'tiktok', 'facebook'] as const;
export type CompetitorPlatform = (typeof COMPETITOR_PLATFORMS)[number];

// Where a platform's reading comes from. Instagram has an official API that
// returns another public Business/Creator account, so it is read through the
// stored Instagram credential. The other two have no such API, so their public
// profile page is fetched through whichever scraping integration the project has
// a credential for.
const SCRAPE_INTEGRATIONS = ['firecrawl', 'jina'] as const;

export interface ProviderStatus {
  platform: CompetitorPlatform;
  available: boolean;
  via: string | null;
}

async function findCredential(
  projectId: number,
  integrationKeys: readonly string[],
): Promise<{ id: number; integrationKey: string } | null> {
  const credentials = await listCredentials(projectId);
  for (const key of integrationKeys) {
    const match = credentials.find((c) => c.integrationKey === key);
    if (match) return { id: match.id, integrationKey: key };
  }
  return null;
}

export async function providerStatuses(projectId: number): Promise<ProviderStatus[]> {
  const [instagram, scrape] = await Promise.all([
    findCredential(projectId, ['instagram']),
    findCredential(projectId, SCRAPE_INTEGRATIONS),
  ]);
  return [
    { platform: 'instagram', available: instagram != null, via: instagram?.integrationKey ?? null },
    { platform: 'tiktok', available: scrape != null, via: scrape?.integrationKey ?? null },
    { platform: 'facebook', available: scrape != null, via: scrape?.integrationKey ?? null },
  ];
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

// Instagram Business Discovery returns the profile plus recent media of a public
// Business/Creator account. Personal accounts are not readable, and the API says
// so — that message is surfaced as-is so the operator knows why.
async function readInstagram(projectId: number, handle: string): Promise<SnapshotInput> {
  const credential = await findCredential(projectId, ['instagram']);
  if (!credential) {
    throw new HttpError(503, 'No Instagram credential is configured for this project');
  }
  const secret = await getCredentialSecret(credential.id, projectId);
  if (!secret) throw new HttpError(503, 'The Instagram credential could not be read');

  const entry = getTool('instagram_business_discovery');
  if (!entry) throw new HttpError(500, 'The Instagram discovery tool is not registered');

  const result = (await entry.tool.execute(secret.config, {
    username: handle,
    profileFields:
      'username,name,biography,profile_picture_url,followers_count,follows_count,media_count',
    includeMedia: true,
    mediaLimit: 1,
  })) as Record<string, unknown>;

  // The tool returns the business_discovery payload; media sits under an edge.
  const profile = (result.business_discovery ?? result) as Record<string, unknown>;
  const mediaEdge = (profile.media ?? {}) as { data?: Record<string, unknown>[] };
  const latest = mediaEdge.data?.[0];
  const timestamp = str(latest?.timestamp);

  return {
    followers: num(profile.followers_count),
    following: num(profile.follows_count),
    posts: num(profile.media_count),
    displayName: str(profile.name),
    biography: str(profile.biography),
    avatarUrl: str(profile.profile_picture_url),
    latestPostId: str(latest?.id),
    latestPostUrl: str(latest?.permalink),
    latestPostAt: timestamp ? new Date(timestamp) : null,
    latestPostCaption: str(latest?.caption),
  };
}

const PROFILE_URL: Record<Exclude<CompetitorPlatform, 'instagram'>, (handle: string) => string> = {
  tiktok: (handle) => `https://www.tiktok.com/@${handle}`,
  facebook: (handle) => `https://www.facebook.com/${handle}`,
};

// Reads a follower count out of the text a scrape returns. Both platforms render
// it as a short form next to the word, e.g. "12.3K Followers" or "1,2 mln volgers".
function parseFollowers(text: string): number | null {
  const match = text.match(/([\d.,]+)\s*([KMkm])?\s*(?:followers|volgers|abonnees)/i);
  if (!match) return null;
  const raw = match[1].replace(/,/g, '');
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  const suffix = match[2]?.toLowerCase();
  if (suffix === 'k') return Math.round(value * 1_000);
  if (suffix === 'm') return Math.round(value * 1_000_000);
  return Math.round(value);
}

// TikTok and Facebook have no API for reading a rival's public profile, so the
// page is fetched through the project's scraping integration. What comes back is
// page text, so only what is stated on the page can be read: the follower count
// and the profile name. A post id is not reliably extractable, which is why a
// platform without an official API cannot raise "new post" on its own.
async function readByScrape(
  projectId: number,
  platform: Exclude<CompetitorPlatform, 'instagram'>,
  handle: string,
): Promise<SnapshotInput> {
  const credential = await findCredential(projectId, SCRAPE_INTEGRATIONS);
  if (!credential) {
    throw new HttpError(
      503,
      'No scraping credential is configured. Add a Firecrawl or Jina key under Integrations to watch TikTok and Facebook.',
    );
  }
  const secret = await getCredentialSecret(credential.id, projectId);
  if (!secret) throw new HttpError(503, 'The scraping credential could not be read');

  const toolKey = credential.integrationKey === 'firecrawl' ? 'firecrawl_scrape' : 'jina_reader';
  const entry = getTool(toolKey);
  if (!entry) throw new HttpError(500, `The ${credential.integrationKey} tool is not registered`);

  const url = PROFILE_URL[platform](handle);
  // Firecrawl drops headers and navigation by default, and the follower count sits
  // in the profile header, so the whole page is kept. Jina ignores the field.
  const result = (await entry.tool.execute(secret.config, {
    url,
    onlyMainContent: false,
  })) as Record<string, unknown>;
  const text = [result.markdown, result.content]
    .map((part) => (typeof part === 'string' ? part : ''))
    .join('\n')
    .slice(0, 20_000);

  if (text.trim().length === 0) {
    throw new HttpError(502, 'The scrape returned nothing for this profile');
  }
  return { followers: parseFollowers(text), displayName: str(result.title) };
}

export async function readProfile(
  projectId: number,
  platform: CompetitorPlatform,
  handle: string,
): Promise<SnapshotInput> {
  if (platform === 'instagram') return readInstagram(projectId, handle);
  return readByScrape(projectId, platform, handle);
}
