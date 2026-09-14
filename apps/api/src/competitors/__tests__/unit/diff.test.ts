import { describe, expect, it } from 'bun:test';
import { QUIET_AFTER_DAYS, detectEvents, type SnapshotInput } from '../../diff';

const base: SnapshotInput = {
  followers: 1000,
  posts: 50,
  displayName: 'Rival Brand',
  biography: 'We do solar.',
  latestPostId: 'post-1',
  latestPostAt: new Date('2026-09-01T10:00:00Z'),
};

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

describe('detectEvents', () => {
  it('says nothing on the first reading', () => {
    expect(detectEvents('rival', null, base)).toEqual([]);
  });

  it('says nothing when nothing changed', () => {
    expect(detectEvents('rival', base, { ...base })).toEqual([]);
  });

  it('raises a new post when the latest post id changes', () => {
    const events = detectEvents('rival', base, {
      ...base,
      latestPostId: 'post-2',
      latestPostUrl: 'https://example.test/p/2',
      latestPostCaption: 'Our winter offer is live',
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: 'new_post',
      postUrl: 'https://example.test/p/2',
    });
    expect(events[0].summary).toContain('Our winter offer is live');
  });

  it('does not raise a post when one side has no post id', () => {
    expect(detectEvents('rival', { ...base, latestPostId: null }, base)).toEqual([]);
    expect(detectEvents('rival', base, { ...base, latestPostId: null })).toEqual([]);
  });

  it('ignores follower drift but reports a real move', () => {
    expect(detectEvents('rival', base, { ...base, followers: 1010 })).toEqual([]);

    const up = detectEvents('rival', base, { ...base, followers: 1400 });
    expect(up).toHaveLength(1);
    expect(up[0]).toMatchObject({ kind: 'followers_jump' });
    expect(up[0].detail).toMatchObject({ before: 1000, after: 1400, delta: 400 });

    const down = detectEvents('rival', base, { ...base, followers: 600 });
    expect(down[0]).toMatchObject({ kind: 'followers_drop' });
  });

  it('needs both a percentage and an absolute move on a small account', () => {
    const small = { ...base, followers: 100 };
    // 10 followers is 10% but under the absolute floor.
    expect(detectEvents('rival', small, { ...small, followers: 110 })).toEqual([]);
    expect(detectEvents('rival', small, { ...small, followers: 130 })).toHaveLength(1);
  });

  it('reports a name and bio change together', () => {
    const events = detectEvents('rival', base, {
      ...base,
      displayName: 'Rival Brand NL',
      biography: 'Now also heat pumps.',
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'profile_changed' });
    expect(events[0].summary).toContain('name and bio');
  });

  it('does not report a profile change when the provider returned nothing', () => {
    // A scrape that could not read the bio must not look like the bio was cleared.
    expect(detectEvents('rival', base, { ...base, biography: null })).toEqual([]);
  });

  it('reports going quiet once, on the check that crosses the line', () => {
    const justOver = daysAgo(QUIET_AFTER_DAYS + 1);
    const justUnder = daysAgo(QUIET_AFTER_DAYS - 1);

    const crossing = detectEvents(
      'rival',
      { ...base, latestPostAt: justUnder },
      { ...base, latestPostAt: justUnder },
    );
    expect(crossing).toEqual([]);

    const crossed = detectEvents(
      'rival',
      { ...base, latestPostAt: justUnder },
      { ...base, latestPostAt: justOver },
    );
    expect(crossed).toHaveLength(1);
    expect(crossed[0]).toMatchObject({ kind: 'went_quiet' });

    // Already quiet on the previous reading: not reported again.
    const stillQuiet = detectEvents(
      'rival',
      { ...base, latestPostAt: justOver },
      { ...base, latestPostAt: justOver },
    );
    expect(stillQuiet).toEqual([]);
  });

  it('reports several changes from one reading', () => {
    const events = detectEvents('rival', base, {
      ...base,
      latestPostId: 'post-9',
      followers: 2000,
      displayName: 'Renamed',
    });
    expect(events.map((event) => event.kind)).toEqual([
      'new_post',
      'followers_jump',
      'profile_changed',
    ]);
  });
});
