import pkg from '../../../../../package.json';

// Whether a newer release is published, plus the notes to show. The repository's
// releases atom feed is the source of the history; the CHANGELOG.md of this build
// covers the releases older than the feed's window and stands alone when the feed
// cannot be read.
//
// The feed is github.com web content, not the REST API, so no token and no
// 60/hour limit (modules/agents/skills/skill-format.ts reads github.com atom the
// same way).
// The result is not stored on the server: every read fetches the feed, and the
// browser holds it behind a stale time (web services/updates.service.ts).
// A failed check leaves the local history intact.

const FETCH_TIMEOUT_MS = 10_000;

// Fixed: an instance checks the project it is built from, so there is nothing to
// configure.
const FEED_URL = 'https://github.com/croffasia/itsaplan/releases.atom';

const CHANGELOG_PATH = `${import.meta.dir}/../../../../../CHANGELOG.md`;

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
  // The newest published version, or null when the feed could not be read.
  latestVersion: string | null;
  updateAvailable: boolean;
  // When the feed was read, null when it could not be.
  checkedAt: string | null;
  // Newest first.
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

async function readFeed(): Promise<Release[]> {
  const res = await fetch(FEED_URL, {
    headers: { 'User-Agent': 'itsaplan' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`feed returned ${res.status}`);
  return parseReleasesAtom(await res.text());
}

// Null when the feed cannot be read, so the caller answers from the local history
// alone instead of reporting a check that did not happen.
async function publishedReleases(): Promise<Release[] | null> {
  // The suite must not depend on github.com being reachable, and the same
  // NODE_ENV already gates the db reset helper.
  if (process.env.NODE_ENV === 'test') return null;
  try {
    return await readFeed();
  } catch (err) {
    console.error('[updates] check failed:', err);
    return null;
  }
}

// Newest first, a feed entry preferred over the changelog section of the same version.
export function mergeHistory(published: Release[], local: Release[]): Release[] {
  const fromFeed = new Set(published.map((r) => r.version));
  return [...published, ...local.filter((r) => !fromFeed.has(r.version))].sort((a, b) =>
    compareVersions(b.version, a.version),
  );
}

export async function getUpdateStatus(): Promise<UpdateStatus> {
  const feed = await publishedReleases();
  const published = feed ?? [];
  const currentVersion = getAppVersion();
  return {
    currentVersion,
    latestVersion: published[0]?.version ?? null,
    updateAvailable: published.some((r) => compareVersions(r.version, currentVersion) > 0),
    checkedAt: feed ? new Date().toISOString() : null,
    releases: mergeHistory(published, await localHistory()),
  };
}
