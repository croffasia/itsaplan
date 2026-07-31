import { describe, it, expect } from 'bun:test';
import {
  parseVersion,
  compareVersions,
  parseReleasesAtom,
  parseChangelog,
  mergeHistory,
  type Release,
} from '../../updates';

// Version handling, the two note sources — the atom feed and the changelog of the
// build — and how they merge. No network or DB: the fetch itself reads the live feed.

describe('parseVersion', () => {
  it('reads a tag with and without the leading v', () => {
    expect(parseVersion('v1.2.3')).toEqual([1, 2, 3]);
    expect(parseVersion('1.2.3')).toEqual([1, 2, 3]);
  });

  it('rejects a prerelease', () => {
    expect(parseVersion('1.2.3-rc.1')).toBeNull();
    expect(parseVersion('v2.0.0-beta')).toBeNull();
  });

  it('rejects anything that is not major.minor.patch', () => {
    for (const value of ['1.2', 'nightly', '', 'v1.2.3.4']) {
      expect(parseVersion(value)).toBeNull();
    }
  });
});

describe('compareVersions', () => {
  it('orders by major, then minor, then patch', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toBeLessThan(0);
    expect(compareVersions('1.3.0', '1.2.9')).toBeGreaterThan(0);
    expect(compareVersions('1.2.10', '1.2.9')).toBeGreaterThan(0);
  });

  it('treats equal versions as equal, whatever the leading v', () => {
    expect(compareVersions('v0.2.0', '0.2.0')).toBe(0);
  });

  it('reports no difference when a value is unparseable, so no update is offered', () => {
    expect(compareVersions('1.2.3-rc.1', '1.0.0')).toBe(0);
    expect(compareVersions('nightly', '1.0.0')).toBe(0);
  });
});

function feed(entries: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">\n<title>Release notes from itsaplan</title>\n${entries}\n</feed>`;
}

function entry(tag: string, updated: string, content: string): string {
  return `  <entry>
    <id>tag:github.com,2008:Repository/1/${tag}</id>
    <updated>${updated}</updated>
    <link rel="alternate" type="text/html" href="https://github.com/croffasia/itsaplan/releases/tag/${tag}"/>
    <title>${tag}</title>
    <content type="html">${content}</content>
    <author><name>croffasia</name></author>
  </entry>`;
}

describe('parseReleasesAtom', () => {
  it('reads the tag, version, date, url and notes of every entry', () => {
    const xml = feed(entry('v0.2.0', '2026-07-23T10:42:42Z', '&lt;p&gt;Notes&lt;/p&gt;'));
    expect(parseReleasesAtom(xml)).toEqual([
      {
        tag: 'v0.2.0',
        version: '0.2.0',
        publishedAt: '2026-07-23T10:42:42Z',
        url: 'https://github.com/croffasia/itsaplan/releases/tag/v0.2.0',
        notes: '<p>Notes</p>',
        notesFormat: 'html',
      },
    ]);
  });

  it('sorts newest version first, whatever the feed order', () => {
    const xml = feed(
      [
        entry('v0.1.0', '2026-07-22T00:00:00Z', ''),
        entry('v0.10.0', '2026-08-01T00:00:00Z', ''),
        entry('v0.2.0', '2026-07-23T00:00:00Z', ''),
      ].join('\n'),
    );
    expect(parseReleasesAtom(xml).map((r) => r.version)).toEqual(['0.10.0', '0.2.0', '0.1.0']);
  });

  it('skips prereleases so they are never offered as an update', () => {
    const xml = feed(
      [
        entry('v0.3.0-rc.1', '2026-08-02T00:00:00Z', ''),
        entry('v0.2.0', '2026-07-23T00:00:00Z', ''),
      ].join('\n'),
    );
    expect(parseReleasesAtom(xml).map((r) => r.version)).toEqual(['0.2.0']);
  });

  it('resolves one level of escaping, leaving the entities the HTML itself carries', () => {
    const content =
      '&lt;a href=&quot;https://example.com/a?b=1&amp;amp;c=2&quot;&gt;What&#39;s new&lt;/a&gt;';
    const xml = feed(entry('v0.2.0', '2026-07-23T00:00:00Z', content));
    expect(parseReleasesAtom(xml)[0].notes).toBe(
      '<a href="https://example.com/a?b=1&amp;c=2">What\'s new</a>',
    );
  });

  it('returns an empty list for a feed with no releases', () => {
    expect(parseReleasesAtom(feed(''))).toEqual([]);
  });
});

describe('parseChangelog', () => {
  const changelog = `# Changelog

## [0.2.0](https://github.com/croffasia/itsaplan/compare/v0.1.0...v0.2.0) (2026-07-23)


### Features

* **notes:** add sticky-note boards ([#18](https://example.com/18))

## 0.1.0 (2026-07-22)


### Features

* initial commit
`;

  it('reads both heading forms release-please writes', () => {
    expect(parseChangelog(changelog).map((r) => [r.tag, r.version, r.publishedAt])).toEqual([
      ['v0.2.0', '0.2.0', '2026-07-23'],
      ['v0.1.0', '0.1.0', '2026-07-22'],
    ]);
  });

  it('takes the section body as markdown, up to the next release', () => {
    const [latest] = parseChangelog(changelog);
    expect(latest.notesFormat).toBe('markdown');
    expect(latest.url).toBeNull();
    expect(latest.notes).toBe(
      '### Features\n\n* **notes:** add sticky-note boards ([#18](https://example.com/18))',
    );
  });

  it('returns an empty list when the file holds no releases', () => {
    expect(parseChangelog('# Changelog\n\nNothing released yet.\n')).toEqual([]);
  });
});

describe('mergeHistory', () => {
  function release(version: string, notesFormat: Release['notesFormat']): Release {
    return {
      tag: `v${version}`,
      version,
      publishedAt: '2026-07-23T00:00:00Z',
      url: notesFormat === 'html' ? `https://example.com/releases/tag/v${version}` : null,
      notes: `notes of ${version}`,
      notesFormat,
    };
  }

  it('takes the feed entry over the changelog section of the same version', () => {
    const merged = mergeHistory([release('0.2.0', 'html')], [release('0.2.0', 'markdown')]);
    expect(merged).toEqual([release('0.2.0', 'html')]);
  });

  it('keeps the changelog releases the feed window does not reach, newest first', () => {
    const merged = mergeHistory(
      [release('0.3.0', 'html'), release('0.2.0', 'html')],
      [release('0.2.0', 'markdown'), release('0.1.0', 'markdown')],
    );
    expect(merged.map((r) => [r.version, r.notesFormat])).toEqual([
      ['0.3.0', 'html'],
      ['0.2.0', 'html'],
      ['0.1.0', 'markdown'],
    ]);
  });

  it('falls back to the changelog alone when the feed could not be read', () => {
    const local = [release('0.2.0', 'markdown'), release('0.1.0', 'markdown')];
    expect(mergeHistory([], local)).toEqual(local);
  });
});
