import { t } from 'elysia';
import { getSetting, setSetting } from '@repo/db';
import pkg from '../../../../package.json';

// Whether a newer release is published, plus the notes to show. Two sources split
// by version: the CHANGELOG.md of this build up to the running version, the
// repository's releases atom feed above it.
//
// The feed is github.com web content, not the REST API, so no token and no
// 60/hour limit (agent-skills/skill-format.ts reads github.com atom the same way).
// Its result is cached in app_setting for CACHE_TTL_MS and refreshed on read, so an
// instance makes one outbound request per interval whatever the number of tabs and
// whether or not the feed can be read. A failed check keeps the previous result and
// leaves the local history intact.

const UPDATES_CACHE_KEY = 'updates.latest';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;

// Fixed: an instance checks the project it is built from, so there is nothing to
// configure.
const FEED_URL = 'https://github.com/croffasia/itsaplan/releases.atom';

const CHANGELOG_PATH = `${import.meta.dir}/../../../../CHANGELOG.md`;

export interface Release {
  tag: string;
  version: string;
  // An ISO datetime from the feed, a "YYYY-MM-DD" date from the changelog.
  publishedAt: string;
  // The release page. Changelog entries carry no such link.
  url: string | null;
  notes: string;
  notesFormat: 'html' | 'markdown';
}

export interface UpdateStatus {
  currentVersion: string;
  // The newest published version, or null when no check has succeeded yet.
  latestVersion: string | null;
  updateAvailable: boolean;
  checkedAt: string | null;
  // Newest first.
  releases: Release[];
}

const ReleaseSchema = t.Object({
  tag: t.String(),
  version: t.String(),
  publishedAt: t.String(),
  url: t.Nullable(t.String()),
  notes: t.String(),
  notesFormat: t.UnionEnum(['html', 'markdown']),
});

export const UpdateStatusSchema = t.Object({
  currentVersion: t.String(),
  latestVersion: t.Nullable(t.String()),
  updateAvailable: t.Boolean(),
  checkedAt: t.Nullable(t.String()),
  releases: t.Array(ReleaseSchema),
});

interface UpdateCache {
  // When a check last ran, successful or not — the TTL is measured against this.
  attemptedAt: string;
  // Null while no check has succeeded.
  checkedAt: string | null;
  releases: Release[];
}

export function getAppVersion(): string {
  return pkg.version;
}

// Null for anything that is not a plain major.minor.patch, prereleases included:
// those are never offered as an update.
export function parseVersion(value: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

// 0 when equal or either side is unparseable.
export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return 0;
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
}

// '&amp;' last, so a double-escaped sequence does not decode twice.
function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&');
}

// Regular expressions rather than an XML dependency: the feed is a fixed shape.
// Newest first.
export function parseReleasesAtom(xml: string): Release[] {
  const releases: Release[] = [];
  for (const [, entry] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const link = /href="([^"]*\/releases\/tag\/([^"]+))"/.exec(entry);
    if (!link) continue;
    const tag = decodeURIComponent(link[2]);
    const version = tag.replace(/^v/, '');
    if (!parseVersion(version)) continue;
    const updated = /<updated>([^<]+)<\/updated>/.exec(entry);
    const content = /<content[^>]*>([\s\S]*?)<\/content>/.exec(entry);
    releases.push({
      tag,
      version,
      publishedAt: updated?.[1] ?? '',
      url: decodeEntities(link[1]),
      notes: content ? decodeEntities(content[1]).trim() : '',
      notesFormat: 'html',
    });
  }
  return releases.sort((a, b) => compareVersions(b.version, a.version));
}

// release-please writes both heading forms: "## [0.2.0](compare-link) (2026-07-23)"
// and, for the first release, "## 0.1.0 (2026-07-22)".
export function parseChangelog(markdown: string): Release[] {
  const heading = /^## \[?(\d+\.\d+\.\d+)\]?(?:\([^)]*\))?\s*\((\d{4}-\d{2}-\d{2})\)$/gm;
  const found = [...markdown.matchAll(heading)];
  return found.map((match, i) => {
    const start = match.index + match[0].length;
    const end = i + 1 < found.length ? found[i + 1].index : markdown.length;
    return {
      tag: `v${match[1]}`,
      version: match[1],
      publishedAt: match[2],
      url: null,
      notes: markdown.slice(start, end).trim(),
      notesFormat: 'markdown' as const,
    };
  });
}

let changelog: Release[] | null = null;

// The file ships with the build and never changes at runtime, so it is read once.
async function localHistory(): Promise<Release[]> {
  if (changelog) return changelog;
  try {
    changelog = parseChangelog(await Bun.file(CHANGELOG_PATH).text());
  } catch (err) {
    console.error('[updates] changelog unreadable:', err);
    changelog = [];
  }
  return changelog;
}

// One refresh at a time: concurrent readers of an expired cache share the request.
let inFlight: Promise<UpdateCache | null> | null = null;

async function readFeed(): Promise<Release[]> {
  const res = await fetch(FEED_URL, {
    headers: { 'User-Agent': 'itsaplan' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`feed returned ${res.status}`);
  return parseReleasesAtom(await res.text());
}

// A failed attempt is stored too, so an unreachable feed costs one connection per
// interval rather than one per read.
async function check(previous: UpdateCache | null): Promise<UpdateCache | null> {
  // The suite must not depend on github.com being reachable, and the same
  // NODE_ENV already gates the db reset helper.
  if (process.env.NODE_ENV === 'test') return null;
  const attemptedAt = new Date().toISOString();
  let cache: UpdateCache = {
    attemptedAt,
    checkedAt: previous?.checkedAt ?? null,
    releases: previous?.releases ?? [],
  };
  try {
    cache = { attemptedAt, checkedAt: attemptedAt, releases: await readFeed() };
  } catch (err) {
    console.error('[updates] check failed:', err);
  }
  try {
    await setSetting(UPDATES_CACHE_KEY, cache);
  } catch (err) {
    console.error('[updates] cache write failed:', err);
  }
  return cache;
}

function refresh(previous: UpdateCache | null): Promise<UpdateCache | null> {
  inFlight ??= check(previous).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

// Every field UpdateStatusSchema requires: a row that would fail response validation
// is re-checked instead of served as a 500.
function usableRelease(r: Release): boolean {
  return (
    typeof r.tag === 'string' &&
    typeof r.version === 'string' &&
    typeof r.publishedAt === 'string' &&
    (r.url === null || typeof r.url === 'string') &&
    typeof r.notes === 'string' &&
    (r.notesFormat === 'html' || r.notesFormat === 'markdown')
  );
}

function usable(cache: UpdateCache | null): cache is UpdateCache {
  if (!cache || typeof cache.attemptedAt !== 'string') return false;
  if (cache.checkedAt !== null && typeof cache.checkedAt !== 'string') return false;
  if (!Array.isArray(cache.releases)) return false;
  return cache.releases.every(usableRelease);
}

// Refreshes an expired cache, or always when `force` is set ("check now").
export async function getUpdateStatus(force = false): Promise<UpdateStatus> {
  const stored = await getSetting<UpdateCache>(UPDATES_CACHE_KEY);
  const cached = usable(stored) ? stored : null;
  // Negated so an unreadable timestamp counts as expired instead of fresh forever,
  // which is what comparing NaN would do.
  const expired = !cached || !(Date.now() - Date.parse(cached.attemptedAt) < CACHE_TTL_MS);
  const cache = force || expired ? ((await refresh(cached)) ?? cached) : cached;

  const currentVersion = getAppVersion();
  const published = cache?.releases ?? [];
  const latestVersion = published[0]?.version ?? null;
  const newer = published.filter((r) => compareVersions(r.version, currentVersion) > 0);
  return {
    currentVersion,
    latestVersion,
    updateAvailable: newer.length > 0,
    checkedAt: cache?.checkedAt ?? null,
    releases: [...newer, ...(await localHistory())],
  };
}
