import { describe, it, expect } from 'bun:test';
import {
  mapTrelloCard,
  mapTrelloChecklists,
  mapTrelloComments,
  mapTrelloCustomFields,
  mapTrelloCustomFieldValues,
  mapTrelloLabels,
  mapTrelloStates,
  trelloCardShortLink,
  trelloCardsToImport,
  trelloCreatedAt,
  trelloListCategory,
  trelloUploads,
  type TrelloCard,
  type TrelloCustomFieldDef,
  type TrelloList,
  type TrelloScope,
} from '../../trello-mapping';

// 0x65000000 seconds since the epoch.
const CARD_ID = '65000000aaaaaaaaaaaaaaaa';

const LISTS: TrelloList[] = [
  { id: 'list-done', name: 'Done', closed: false, pos: 3 },
  { id: 'list-todo', name: 'To Do', closed: false, pos: 1 },
  { id: 'list-old', name: 'Old', closed: true, pos: 2 },
];

const SCOPE: TrelloScope = {
  boardId: 'board-1',
  archivedCards: 'archive',
  memberEmails: { 'member-ada': 'ada@example.test', 'member-bob': 'bob@example.test' },
};

const FIELD_DEFS: TrelloCustomFieldDef[] = [
  { id: 'f-text', name: 'Notes', type: 'text' },
  { id: 'f-num', name: 'Points', type: 'number' },
  { id: 'f-check', name: 'Approved', type: 'checkbox' },
  { id: 'f-date', name: 'Launch', type: 'date' },
  {
    id: 'f-list',
    name: 'Size',
    type: 'list',
    options: [
      { id: 'opt-l', value: { text: 'L' }, pos: 2 },
      { id: 'opt-s', value: { text: 'S' }, pos: 1 },
    ],
  },
];

function card(overrides: Partial<TrelloCard> = {}): TrelloCard {
  return {
    id: CARD_ID,
    idShort: 12,
    name: 'Ship the importer',
    desc: 'Body text.',
    closed: false,
    idList: 'list-todo',
    pos: 100,
    idLabels: ['label-1'],
    idMembers: [],
    start: null,
    due: null,
    dateLastActivity: '2026-02-03T04:05:06.000Z',
    shortUrl: 'https://trello.com/c/AbCd1234',
    attachments: [],
    checklists: [],
    customFieldItems: [],
    ...overrides,
  };
}

describe('trelloListCategory', () => {
  it.each([
    ['Done', 'completed'],
    ['Completed this week', 'completed'],
    ['Doing', 'started'],
    ['In Progress', 'started'],
    ['Code review', 'started'],
    ['Backlog', 'backlog'],
    ['Ideas', 'backlog'],
    ['To Do', 'unstarted'],
    ['Week 12', 'unstarted'],
  ])('maps "%s" to %s', (name, category) => {
    expect(trelloListCategory(name)).toBe(category as never);
  });
});

describe('mapTrelloStates', () => {
  it('keeps the open lists only, in board order', () => {
    expect(mapTrelloStates(LISTS)).toEqual([
      { sourceId: 'list-todo', name: 'To Do', category: 'unstarted' },
      { sourceId: 'list-done', name: 'Done', category: 'completed' },
    ]);
  });
});

describe('mapTrelloLabels', () => {
  it('stores Trello color names as hex and names a nameless label after its color', () => {
    expect(
      mapTrelloLabels([
        { id: 'l1', name: 'Bug', color: 'red' },
        { id: 'l2', name: '', color: 'green_dark' },
        { id: 'l3', name: '  ', color: null },
      ]),
    ).toEqual([
      { sourceId: 'l1', name: 'Bug', color: '#eb5a46' },
      { sourceId: 'l2', name: 'Green', color: '#61bd4f' },
      { sourceId: 'l3', name: 'Label', color: undefined },
    ]);
  });
});

describe('mapTrelloCustomFields', () => {
  it('maps each Trello type, a dropdown with its options in order, and drops unknown types', () => {
    expect(
      mapTrelloCustomFields([...FIELD_DEFS, { id: 'f-other', name: 'Other', type: 'rating' }]),
    ).toEqual([
      { sourceId: 'f-text', name: 'Notes', fieldType: 'text', options: [] },
      { sourceId: 'f-num', name: 'Points', fieldType: 'number', options: [] },
      { sourceId: 'f-check', name: 'Approved', fieldType: 'boolean', options: [] },
      { sourceId: 'f-date', name: 'Launch', fieldType: 'datetime', options: [] },
      { sourceId: 'f-list', name: 'Size', fieldType: 'select', options: ['S', 'L'] },
    ]);
  });
});

describe('mapTrelloCustomFieldValues', () => {
  it('reads each value from its own Trello property and names a dropdown value by its text', () => {
    expect(
      mapTrelloCustomFieldValues(
        [
          { idCustomField: 'f-text', value: { text: 'hello' } },
          { idCustomField: 'f-num', value: { number: '3.5' } },
          { idCustomField: 'f-check', value: { checked: 'true' } },
          { idCustomField: 'f-date', value: { date: '2026-03-01T10:00:00.000Z' } },
          { idCustomField: 'f-list', idValue: 'opt-l' },
          { idCustomField: 'f-unknown', value: { text: 'lost' } },
          { idCustomField: 'f-num', value: { number: 'n/a' } },
        ],
        FIELD_DEFS,
      ),
    ).toEqual([
      { fieldSourceId: 'f-text', value: 'hello' },
      { fieldSourceId: 'f-num', value: 3.5 },
      { fieldSourceId: 'f-check', value: true },
      { fieldSourceId: 'f-date', value: '2026-03-01T10:00:00.000Z' },
      { fieldSourceId: 'f-list', value: 'L' },
    ]);
  });
});

describe('trelloCreatedAt', () => {
  it('reads the creation time from the id', () => {
    expect(trelloCreatedAt(CARD_ID)).toBe(new Date(0x65000000 * 1000).toISOString());
  });
});

describe('mapTrelloCard', () => {
  it('maps every field the import keeps', () => {
    const issue = mapTrelloCard(
      card({
        idMembers: ['member-unmatched', 'member-bob', 'member-ada'],
        start: '2026-02-01T09:00:00.000Z',
        due: '2026-02-10T17:00:00.000Z',
        customFieldItems: [{ idCustomField: 'f-text', value: { text: 'hello' } }],
      }),
      SCOPE,
      LISTS,
      FIELD_DEFS,
    );
    expect(issue).toEqual({
      sourceId: CARD_ID,
      sequenceId: 12,
      title: 'Ship the importer',
      descriptionMarkdown: 'Body text.\n\nImported from Trello: https://trello.com/c/AbCd1234',
      stateSourceId: 'list-todo',
      assigneeEmail: 'bob@example.test',
      watcherEmails: ['ada@example.test'],
      labelSourceIds: ['label-1'],
      cycleSourceId: null,
      parentSourceId: null,
      priority: null,
      startDate: '2026-02-01',
      dueDate: '2026-02-10',
      customFields: [{ fieldSourceId: 'f-text', value: 'hello' }],
      createdAt: trelloCreatedAt(CARD_ID),
      updatedAt: '2026-02-03T04:05:06.000Z',
      archivedAt: null,
    });
  });

  it('archives a card that is archived itself or sits in an archived list', () => {
    expect(mapTrelloCard(card({ closed: true }), SCOPE, LISTS, []).archivedAt).toBe(
      '2026-02-03T04:05:06.000Z',
    );
    expect(mapTrelloCard(card({ idList: 'list-old' }), SCOPE, LISTS, []).archivedAt).toBe(
      '2026-02-03T04:05:06.000Z',
    );
  });

  it('assigns nobody when no member was matched', () => {
    const issue = mapTrelloCard(
      card({ idMembers: ['member-ada'] }),
      { ...SCOPE, memberEmails: {} },
      LISTS,
      [],
    );
    expect(issue.assigneeEmail).toBeNull();
    expect(issue.watcherEmails).toEqual([]);
  });

  it('lists link attachments under Links and leaves uploaded files out of it', () => {
    const issue = mapTrelloCard(
      card({
        desc: '',
        attachments: [
          {
            id: 'a1',
            name: 'Spec [v2]',
            url: 'https://docs.example.test/spec',
            isUpload: false,
            bytes: null,
            mimeType: null,
          },
          {
            id: 'a2',
            name: 'shot.png',
            url: 'https://trello.com/1/cards/c/attachments/a2/download/shot.png',
            isUpload: true,
            bytes: 10,
            mimeType: 'image/png',
          },
        ],
      }),
      SCOPE,
      LISTS,
      [],
    );
    expect(issue.descriptionMarkdown).toBe(
      '## Links\n\n- [Spec \\[v2\\]](https://docs.example.test/spec)\n\n' +
        'Imported from Trello: https://trello.com/c/AbCd1234',
    );
  });
});

describe('trelloCardsToImport', () => {
  const cards = [
    card({ id: 'done-1', idList: 'list-done', pos: 1 }),
    card({ id: 'todo-2', idList: 'list-todo', pos: 2 }),
    card({ id: 'old-1', idList: 'list-old', pos: 1 }),
    card({ id: 'todo-1', idList: 'list-todo', pos: 1 }),
    card({ id: 'todo-archived', idList: 'list-todo', pos: 3, closed: true }),
  ];

  it('puts the cards in board order and keeps archived ones when they are imported', () => {
    expect(trelloCardsToImport(cards, LISTS, 'archive').map((c) => c.id)).toEqual([
      'todo-1',
      'todo-2',
      'todo-archived',
      'old-1',
      'done-1',
    ]);
  });

  it('leaves out archived cards and the cards of archived lists when they are skipped', () => {
    expect(trelloCardsToImport(cards, LISTS, 'skip').map((c) => c.id)).toEqual([
      'todo-1',
      'todo-2',
      'done-1',
    ]);
  });
});

describe('mapTrelloChecklists', () => {
  it('keeps the order of checklists and items, and which items are done', () => {
    expect(
      mapTrelloChecklists([
        {
          id: 'cl-2',
          name: 'Release',
          pos: 2,
          checkItems: [{ id: 'i1', name: 'Tag', state: 'incomplete', pos: 1 }],
        },
        {
          id: 'cl-1',
          name: 'Checklist',
          pos: 1,
          checkItems: [
            { id: 'i3', name: 'Second', state: 'incomplete', pos: 2 },
            { id: 'i2', name: 'First', state: 'complete', pos: 1 },
          ],
        },
      ]),
    ).toEqual([
      {
        sourceId: 'cl-1',
        title: 'Checklist',
        items: [
          { content: 'First', done: true },
          { content: 'Second', done: false },
        ],
      },
      { sourceId: 'cl-2', title: 'Release', items: [{ content: 'Tag', done: false }] },
    ]);
  });
});

describe('mapTrelloComments', () => {
  it('sorts oldest first and gives a matched author their project email', () => {
    const comments = mapTrelloComments(
      [
        {
          id: 'c2',
          date: '2026-02-02T00:00:00.000Z',
          idMemberCreator: 'member-unmatched',
          data: { text: 'Second' },
          memberCreator: { fullName: '', username: 'carol' },
        },
        {
          id: 'c1',
          date: '2026-02-01T00:00:00.000Z',
          idMemberCreator: 'member-ada',
          data: { text: 'First' },
          memberCreator: { fullName: 'Ada Lovelace', username: 'ada' },
        },
      ],
      SCOPE.memberEmails,
    );
    expect(comments).toEqual([
      {
        sourceId: 'c1',
        authorEmail: 'ada@example.test',
        authorName: 'Ada Lovelace',
        bodyMarkdown: 'First',
        createdAt: '2026-02-01T00:00:00.000Z',
        replyToSourceId: null,
      },
      {
        sourceId: 'c2',
        authorEmail: null,
        authorName: 'carol',
        bodyMarkdown: 'Second',
        createdAt: '2026-02-02T00:00:00.000Z',
        replyToSourceId: null,
      },
    ]);
  });
});

describe('trelloUploads', () => {
  it('lists uploaded files only, with distinct names and a type from the name when Trello has none', () => {
    const upload = (id: string, name: string, mimeType: string | null) => ({
      id,
      name,
      url: `https://trello.com/1/cards/c/attachments/${id}/download/${name}`,
      isUpload: true,
      bytes: 2048,
      mimeType,
    });
    expect(
      trelloUploads(
        card({
          attachments: [
            upload('a1', 'image.png', 'image/png'),
            upload('a2', 'image.png', ''),
            { ...upload('a3', 'link', null), isUpload: false },
          ],
        }),
      ),
    ).toEqual([
      { sourceId: 'a1', filename: 'image.png', contentType: 'image/png', sizeBytes: 2048 },
      { sourceId: 'a2', filename: 'image (2).png', contentType: 'image/png', sizeBytes: 2048 },
    ]);
  });
});

describe('trelloCardShortLink', () => {
  it.each([
    ['https://trello.com/c/AbCd1234', 'AbCd1234'],
    ['https://trello.com/c/AbCd1234/12-some-title', 'AbCd1234'],
    ['https://trello.com/c/AbCd1234?filter=x', 'AbCd1234'],
    ['https://trello.com/b/AbCd1234/board', null],
    ['https://trello.com.evil.test/c/AbCd1234', null],
    ['http://trello.com/c/AbCd1234', null],
  ])('reads %s as %s', (url, shortLink) => {
    expect(trelloCardShortLink(url)).toBe(shortLink);
  });
});
