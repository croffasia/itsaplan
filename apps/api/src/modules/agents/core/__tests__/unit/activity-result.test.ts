import { describe, expect, it } from 'bun:test';
import type { ActivityItem, ActivityPage } from '#modules/analytics/service';
import { compactProjectActivity } from '../../runtime/tools/activity-result';

const item: ActivityItem = {
  id: 7,
  issueId: 3,
  issueSequence: 2,
  issueTitle: 'Prepare launch',
  kind: 'activity',
  actorUserId: 'user-1',
  actorName: 'Owner',
  body: null,
  action: 'description',
  payload: {},
  createdAt: '2026-10-21T00:00:00.000Z',
};

describe('internal agent project activity previews', () => {
  it('bounds large text while preserving event metadata, order and pagination', () => {
    const long = 'x'.repeat(100_000);
    const page: ActivityPage = {
      items: [
        {
          ...item,
          body: long,
          payload: {
            subject: { value: long, id: 'field-1' },
            from: { value: long, id: 11, stateType: 'started' },
            to: { value: long, repo: 'owner/repo', number: 42, date: '2026-10-21' },
          },
        },
        { ...item, id: 6, action: 'status', payload: { to: { value: 'Done' } } },
      ],
      nextCursor: { id: 6, ts: '2026-10-20 23:59:59.123456+00' },
    };
    const original = structuredClone(page);
    const result = compactProjectActivity(page);

    expect(result).toMatchObject({
      items: [
        {
          ...item,
          body: long.slice(0, 1000),
          payload: {
            subject: { ...page.items[0]!.payload.subject, value: long.slice(0, 1000) },
            from: { ...page.items[0]!.payload.from, value: long.slice(0, 1000) },
            to: { ...page.items[0]!.payload.to, value: long.slice(0, 1000) },
          },
          truncatedFields: [
            { field: 'body', originalLength: 100_000 },
            { field: 'payload.subject.value', originalLength: 100_000 },
            { field: 'payload.from.value', originalLength: 100_000 },
            { field: 'payload.to.value', originalLength: 100_000 },
          ],
        },
        page.items[1],
      ],
      nextCursor: page.nextCursor,
    });
    expect(JSON.stringify(result).length).toBeLessThan(JSON.stringify(page).length / 50);
    expect(page).toEqual(original);
  });

  it('preserves null, absent, empty and exactly-at-limit values without truncation metadata', () => {
    const page: ActivityPage = {
      items: [
        { ...item, body: '', payload: { from: { value: null }, to: { value: 'x'.repeat(1000) } } },
        item,
      ],
      nextCursor: null,
    };
    expect(compactProjectActivity(page)).toEqual(page);
  });

  it('does not split a surrogate pair at the preview boundary', () => {
    const value = `${'x'.repeat(999)}😀tail`;
    const result = compactProjectActivity({
      items: [{ ...item, payload: { to: { value } } }],
      nextCursor: null,
    });
    expect(result.items[0]).toMatchObject({
      payload: { to: { value: 'x'.repeat(999) } },
      truncatedFields: [{ field: 'payload.to.value', originalLength: value.length }],
    });
  });

  it('preserves an empty page', () => {
    expect(compactProjectActivity({ items: [], nextCursor: null })).toEqual({
      items: [],
      nextCursor: null,
    });
  });
});
