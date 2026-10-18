import { describe, it, expect } from 'bun:test';
import {
  mapTrelloAttachments,
  mapTrelloCard,
  mapTrelloComments,
  mapTrelloLabels,
  mapTrelloLists,
  mapTrelloMemberEmails,
  trelloIdTimestamp,
  trelloNextCursor,
  type TrelloCard,
} from '../../trello-mapping';
import cardFixture from './fixtures/trello-card.json';

const card = cardFixture as TrelloCard;
const emails = mapTrelloMemberEmails([
  { id: 'mem-1', email: 'me@example.com' },
  { id: 'mem-2', email: null },
]);

describe('mapTrelloCard', () => {
  const issue = mapTrelloCard(card, emails);

  it('maps the card fields, with the first member that has an email as assignee', () => {
    expect(issue).toMatchObject({
      sourceId: card.id,
      sequenceId: 17,
      title: 'Write onboarding guide',
      stateSourceId: 'list-doing',
      assigneeEmail: 'me@example.com',
      labelSourceIds: ['lab-1'],
      cycleSourceId: null,
      startDate: '2024-02-01',
      dueDate: '2024-02-10',
      createdAt: trelloIdTimestamp(card.id),
    });
  });

  it('writes the checklists in order, the links, and the card URL', () => {
    expect(issue.descriptionMarkdown).toBe(
      [
        'Draft the **guide**.',
        '## Draft\n\n- [x] Outline\n- [ ] Write body\n\n## Review\n\n- [ ] Proofread',
        '## Links\n\n- [Figma \\[v2\\]](https://figma.com/file/x)',
        'Imported from Trello: https://trello.com/c/AbC123',
      ].join('\n\n'),
    );
  });
});

describe('mapTrelloLists', () => {
  it('derives the category from the list name', () => {
    const names = ['Backlog', 'To Do', 'Doing', 'Code review', 'Done', "Won't do"];
    expect(
      mapTrelloLists(names.map((name, i) => ({ id: String(i), name, closed: false }))).map(
        (s) => s.category,
      ),
    ).toEqual(['backlog', 'unstarted', 'started', 'started', 'completed', 'canceled']);
  });
});

describe('mapTrelloLabels', () => {
  it('names an unnamed label by its colour and maps colour variants', () => {
    expect(
      mapTrelloLabels([
        { id: 'a', name: '', color: 'green' },
        { id: 'b', name: 'Bug', color: 'red_dark' },
        { id: 'c', name: 'Plain', color: null },
      ]),
    ).toEqual([
      { sourceId: 'a', name: 'green', color: '#4bce97' },
      { sourceId: 'b', name: 'Bug', color: '#f87168' },
      { sourceId: 'c', name: 'Plain' },
    ]);
  });
});

describe('mapTrelloComments', () => {
  it('sorts oldest first and resolves an email when Trello shows one', () => {
    const comments = mapTrelloComments(
      [
        {
          id: 'c2',
          idMemberCreator: 'mem-2',
          date: '2024-02-02T00:00:00.000Z',
          data: { text: 'two' },
          memberCreator: { fullName: 'Bo' },
        },
        {
          id: 'c1',
          idMemberCreator: 'mem-1',
          date: '2024-02-01T00:00:00.000Z',
          data: { text: 'one' },
          memberCreator: { username: 'me' },
        },
      ],
      emails,
    );
    expect(comments.map((c) => [c.sourceId, c.authorEmail, c.authorName, c.bodyMarkdown])).toEqual([
      ['c1', 'me@example.com', 'me', 'one'],
      ['c2', null, 'Bo', 'two'],
    ]);
  });
});

describe('mapTrelloAttachments', () => {
  it('keeps uploaded files only', () => {
    expect(mapTrelloAttachments(card.attachments!)).toEqual([
      { sourceId: 'att-1', filename: 'spec.pdf', contentType: 'application/pdf', sizeBytes: 4096 },
    ]);
  });
});

describe('trelloNextCursor', () => {
  it('pages before the oldest id of a full page and stops on a short one', () => {
    const page = [{ id: 'b0' }, { id: 'a0' }, { id: 'c0' }];
    expect(trelloNextCursor(page, 3)).toBe('a0');
    expect(trelloNextCursor(page, 4)).toBeNull();
  });
});
