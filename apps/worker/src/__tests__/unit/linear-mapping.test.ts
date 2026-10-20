import { describe, it, expect } from 'bun:test';
import {
  extractLinearUploads,
  linearCommentAuthor,
  linearIssueLinksToIdentifiers,
  linearNextCursor,
  linearPriority,
  linearStateCategory,
  linearUploadSourceId,
  linearUploadUrl,
  mapLinearComments,
  mapLinearCycles,
  mapLinearIssue,
  mapLinearLabels,
  mapLinearRelations,
  type LinearCommentNode,
  type LinearIssueNode,
  type LinearScope,
} from '../../linear-mapping';

const TEAM = 'team-ato';
const PROJECT_SCOPE: LinearScope = {
  teamId: TEAM,
  projectFilter: 'project',
  projectId: 'proj-tool',
};
const NO_PROJECT_SCOPE: LinearScope = { teamId: TEAM, projectFilter: 'none', projectId: null };
const UPLOAD = 'https://uploads.linear.app/org-1/file-1/blob-1';

function issueNode(overrides: Partial<LinearIssueNode> = {}): LinearIssueNode {
  return {
    id: 'issue-505',
    identifier: 'ATO-505',
    number: 505,
    title: 'Ship the importer',
    description: 'Body text.',
    priority: 2,
    dueDate: '2026-11-01',
    createdAt: '2025-01-02T03:04:05.000Z',
    updatedAt: '2025-02-03T04:05:06.000Z',
    state: { id: 'state-todo' },
    assignee: { email: 'atomist@atomlab.us' },
    cycle: { id: 'cycle-7' },
    parent: null,
    labels: { nodes: [{ id: 'label-bug' }, { id: 'label-api' }] },
    attachments: { nodes: [] },
    ...overrides,
  };
}

function commentNode(overrides: Partial<LinearCommentNode> = {}): LinearCommentNode {
  return {
    id: 'comment-1',
    body: 'Looks good.',
    createdAt: '2025-01-05T00:00:00.000Z',
    parent: null,
    user: { email: 'atomist@atomlab.us', name: 'Thomas' },
    botActor: null,
    externalUser: null,
    ...overrides,
  };
}

describe('linearStateCategory', () => {
  it.each([
    ['triage', 'backlog'],
    ['backlog', 'backlog'],
    ['unstarted', 'unstarted'],
    ['started', 'started'],
    ['completed', 'completed'],
    ['canceled', 'canceled'],
    ['duplicate', 'canceled'],
    ['something-new', 'backlog'],
  ])('maps the state type %s to %s', (type, category) => {
    expect(linearStateCategory(type)).toBe(category as ReturnType<typeof linearStateCategory>);
  });
});

describe('linearPriority', () => {
  it.each([
    [0, null],
    [1, 'urgent'],
    [2, 'high'],
    [3, 'medium'],
    [4, 'low'],
    [9, null],
  ])('maps priority %d to %p', (priority, value) => {
    expect(linearPriority(priority)).toBe(value);
  });
});

describe('mapLinearLabels', () => {
  it('names a grouped label Group/Name, keeps its color, and drops the group itself', () => {
    expect(
      mapLinearLabels([
        { id: 'g', name: 'kind', color: '#111111', isGroup: true, parent: null },
        { id: 'l1', name: 'bug', color: '#ff0000', isGroup: false, parent: { name: 'kind' } },
        { id: 'l2', name: 'Feature', color: '#00ff00', isGroup: false, parent: null },
      ]),
    ).toEqual([
      { sourceId: 'l1', name: 'kind/bug', color: '#ff0000' },
      { sourceId: 'l2', name: 'Feature', color: '#00ff00' },
    ]);
  });
});

describe('mapLinearCycles', () => {
  it('keeps the dates only and names an unnamed cycle by its number', () => {
    expect(
      mapLinearCycles([
        {
          id: 'c1',
          number: 3,
          name: null,
          startsAt: '2026-01-05T08:00:00.000Z',
          endsAt: '2026-01-19T08:00:00.000Z',
          description: null,
        },
        {
          id: 'c2',
          number: 4,
          name: 'Launch',
          startsAt: '2026-01-19T08:00:00.000Z',
          endsAt: '2026-02-02T08:00:00.000Z',
          description: 'Ship it',
        },
      ]),
    ).toEqual([
      {
        sourceId: 'c1',
        name: 'Cycle 3',
        startDate: '2026-01-05',
        endDate: '2026-01-19',
        goal: undefined,
      },
      {
        sourceId: 'c2',
        name: 'Launch',
        startDate: '2026-01-19',
        endDate: '2026-02-02',
        goal: 'Ship it',
      },
    ]);
  });
});

describe('linearIssueLinksToIdentifiers', () => {
  const url = 'https://linear.app/atomlab77/issue/ATO-589/egress-step-2-the-vyos-gateway';

  it('turns a bare Linear issue URL into its identifier', () => {
    expect(linearIssueLinksToIdentifiers(`Follow-up of ${url}.`)).toBe('Follow-up of ATO-589.');
  });

  it('turns an autolink into its identifier', () => {
    expect(linearIssueLinksToIdentifiers(`See <${url}>`)).toBe('See ATO-589');
  });

  it('keeps a link label that already names the issue, and appends the identifier otherwise', () => {
    expect(linearIssueLinksToIdentifiers(`[ATO-589](${url})`)).toBe('ATO-589');
    expect(linearIssueLinksToIdentifiers(`[ATO-589 the gateway](${url})`)).toBe(
      'ATO-589 the gateway',
    );
    expect(linearIssueLinksToIdentifiers(`[the gateway](${url}?comment=1)`)).toBe(
      'the gateway (ATO-589)',
    );
    expect(linearIssueLinksToIdentifiers(`[${url}](${url})`)).toBe('ATO-589');
  });

  it('leaves other links, uploads and plain identifiers alone', () => {
    const text = `ATO-1, https://linear.app/atomlab77/project/the-tool-123 and ![shot](${UPLOAD})`;
    expect(linearIssueLinksToIdentifiers(text)).toBe(text);
  });
});

describe('mapLinearIssue', () => {
  it('maps every field the import keeps', () => {
    expect(mapLinearIssue(issueNode(), PROJECT_SCOPE)).toEqual({
      sourceId: 'issue-505',
      sequenceId: 505,
      title: 'Ship the importer',
      descriptionMarkdown: 'Body text.\n\nImported from Linear: ATO-505',
      stateSourceId: 'state-todo',
      assigneeEmail: 'atomist@atomlab.us',
      labelSourceIds: ['label-bug', 'label-api'],
      cycleSourceId: 'cycle-7',
      parentSourceId: null,
      priority: 'high',
      startDate: null,
      dueDate: '2026-11-01',
      customFields: [],
      createdAt: '2025-01-02T03:04:05.000Z',
      updatedAt: '2025-02-03T04:05:06.000Z',
    });
  });

  it('imports an issue with no assignee, no cycle, no priority and no description', () => {
    const issue = mapLinearIssue(
      issueNode({ assignee: null, cycle: null, priority: 0, description: null }),
      PROJECT_SCOPE,
    );
    expect(issue).toMatchObject({
      assigneeEmail: null,
      cycleSourceId: null,
      priority: null,
      descriptionMarkdown: 'Imported from Linear: ATO-505',
    });
  });

  it('lists link attachments under Links and leaves uploaded files out of it', () => {
    const issue = mapLinearIssue(
      issueNode({
        attachments: {
          nodes: [
            { title: 'Fix [api] #12', url: 'https://github.com/acme/app/pull/12' },
            { title: 'diagram.png', url: UPLOAD },
            { title: '', url: 'https://example.com/spec' },
            { title: 'C:\\temp\\', url: 'https://example.com/dir' },
          ],
        },
      }),
      PROJECT_SCOPE,
    );
    expect(issue.descriptionMarkdown).toBe(
      [
        'Body text.',
        '## Links\n\n- [Fix \\[api\\] #12](https://github.com/acme/app/pull/12)\n- [https://example.com/spec](https://example.com/spec)\n- [C:\\\\temp\\\\](https://example.com/dir)',
        'Imported from Linear: ATO-505',
      ].join('\n\n'),
    );
  });

  it('names a parent outside this job, and keeps the parent id either way', () => {
    const outside = mapLinearIssue(
      issueNode({
        parent: {
          id: 'issue-12',
          identifier: 'ATO-12',
          team: { id: TEAM },
          project: { id: 'proj-other' },
        },
      }),
      PROJECT_SCOPE,
    );
    expect(outside.parentSourceId).toBe('issue-12');
    expect(outside.descriptionMarkdown).toBe(
      'Body text.\n\nParent in Linear: ATO-12\n\nImported from Linear: ATO-505',
    );

    const inside = mapLinearIssue(
      issueNode({
        parent: { id: 'issue-13', identifier: 'ATO-13', team: { id: TEAM }, project: null },
      }),
      NO_PROJECT_SCOPE,
    );
    expect(inside.parentSourceId).toBe('issue-13');
    expect(inside.descriptionMarkdown).toBe('Body text.\n\nImported from Linear: ATO-505');
  });

  it('rewrites Linear issue links in the description to bare identifiers', () => {
    const issue = mapLinearIssue(
      issueNode({ description: 'Blocked on https://linear.app/atomlab77/issue/ATO-506/db' }),
      PROJECT_SCOPE,
    );
    expect(issue.descriptionMarkdown).toBe('Blocked on ATO-506\n\nImported from Linear: ATO-505');
  });
});

describe('mapLinearComments', () => {
  it('orders comments oldest first and keeps reply threading and dates', () => {
    const comments = mapLinearComments([
      commentNode({ id: 'reply', createdAt: '2025-01-06T00:00:00.000Z', parent: { id: 'root' } }),
      commentNode({ id: 'root', createdAt: '2025-01-05T00:00:00.000Z' }),
    ]);
    expect(comments.map((c) => [c.sourceId, c.replyToSourceId, c.createdAt])).toEqual([
      ['root', null, '2025-01-05T00:00:00.000Z'],
      ['reply', 'root', '2025-01-06T00:00:00.000Z'],
    ]);
  });

  it('rewrites Linear issue links in a comment body', () => {
    const [comment] = mapLinearComments([
      commentNode({ body: 'Dup of https://linear.app/atomlab77/issue/ATO-7/x' }),
    ]);
    expect(comment!.bodyMarkdown).toBe('Dup of ATO-7');
  });
});

describe('linearCommentAuthor', () => {
  it('uses the user email and name', () => {
    expect(linearCommentAuthor(commentNode())).toEqual({
      authorEmail: 'atomist@atomlab.us',
      authorName: 'Thomas',
    });
  });

  it('keeps a bot comment with no email under the bot name', () => {
    expect(linearCommentAuthor(commentNode({ user: null, botActor: { name: 'GitHub' } }))).toEqual({
      authorEmail: null,
      authorName: 'GitHub',
    });
  });

  it('falls back to the external author, then to Linear', () => {
    expect(
      linearCommentAuthor(commentNode({ user: null, externalUser: { name: 'Jay (Slack)' } })),
    ).toEqual({ authorEmail: null, authorName: 'Jay (Slack)' });
    expect(linearCommentAuthor(commentNode({ user: null, botActor: { name: null } }))).toEqual({
      authorEmail: null,
      authorName: 'Linear',
    });
  });
});

describe('mapLinearRelations', () => {
  it('maps the relations this issue owns, keeps their direction, and drops similar', () => {
    expect(
      mapLinearRelations('issue-505', [
        { type: 'blocks', relatedIssue: { id: 'issue-506' } },
        { type: 'duplicate', relatedIssue: { id: 'issue-400' } },
        { type: 'related', relatedIssue: { id: 'issue-12' } },
        { type: 'similar', relatedIssue: { id: 'issue-13' } },
        { type: 'something-new', relatedIssue: { id: 'issue-14' } },
      ]),
    ).toEqual([
      { kind: 'blocks', sourceIssueSourceId: 'issue-505', targetIssueSourceId: 'issue-506' },
      { kind: 'duplicates', sourceIssueSourceId: 'issue-505', targetIssueSourceId: 'issue-400' },
      { kind: 'relates', sourceIssueSourceId: 'issue-505', targetIssueSourceId: 'issue-12' },
    ]);
  });
});

describe('linearNextCursor', () => {
  it('stops on hasNextPage false even when an end cursor is present', () => {
    expect(linearNextCursor({ hasNextPage: false, endCursor: 'abc' })).toBeNull();
    expect(linearNextCursor({ hasNextPage: true, endCursor: 'abc' })).toBe('abc');
  });
});

describe('extractLinearUploads', () => {
  it('finds uploads in images, file links and bare URLs, first mention wins', () => {
    const uploads = extractLinearUploads(
      'issue-505',
      [
        `Before ![image.png](${UPLOAD}) and [report.pdf](https://uploads.linear.app/org-1/file-2/blob-2)`,
        null,
        `Again ${UPLOAD} and https://uploads.linear.app/org-1/file-3/blob-3`,
      ],
      [{ title: 'spec.docx', url: 'https://uploads.linear.app/org-1/file-4/blob-4' }],
    );
    expect(uploads).toEqual([
      {
        sourceId: `issue-505 ${UPLOAD}`,
        filename: 'image.png',
        contentType: 'image/png',
        sizeBytes: 0,
      },
      {
        sourceId: 'issue-505 https://uploads.linear.app/org-1/file-2/blob-2',
        filename: 'report.pdf',
        contentType: 'application/pdf',
        sizeBytes: 0,
      },
      {
        sourceId: 'issue-505 https://uploads.linear.app/org-1/file-3/blob-3',
        filename: 'blob-3',
        contentType: 'application/octet-stream',
        sizeBytes: 0,
      },
      {
        sourceId: 'issue-505 https://uploads.linear.app/org-1/file-4/blob-4',
        filename: 'spec.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: 0,
      },
    ]);
  });

  it('gives each of several files with the same name its own name', () => {
    const uploads = extractLinearUploads(
      'issue-505',
      [
        '![image.png](https://uploads.linear.app/o/a/1) ![image.png](https://uploads.linear.app/o/a/2)',
        '![Image.png](https://uploads.linear.app/o/a/3) [notes](https://uploads.linear.app/o/a/4) [notes](https://uploads.linear.app/o/a/5)',
      ],
      [],
    );
    expect(uploads.map((u) => u.filename)).toEqual([
      'image.png',
      'image (2).png',
      'Image (3).png',
      'notes',
      'notes (2)',
    ]);
  });

  it('ignores links to anything but uploads.linear.app', () => {
    expect(
      extractLinearUploads(
        'issue-505',
        ['![x](https://example.com/a.png)'],
        [{ title: 'PR', url: 'https://github.com/acme/app/pull/1' }],
      ),
    ).toEqual([]);
  });
});

describe('linearUploadUrl', () => {
  it('recovers the upload URL from its source id', () => {
    expect(linearUploadUrl('issue-505', linearUploadSourceId('issue-505', UPLOAD))).toBe(UPLOAD);
  });

  it('refuses a source id of another issue or another host', () => {
    expect(() => linearUploadUrl('issue-506', `issue-505 ${UPLOAD}`)).toThrow(
      'is not a Linear upload of issue issue-506',
    );
    expect(() => linearUploadUrl('issue-505', 'issue-505 https://evil.example/x')).toThrow(
      'is not a Linear upload of issue issue-505',
    );
  });
});

describe('fix round 1', () => {
  it('strips sentence punctuation from a bare upload URL but not from a link destination', () => {
    const uploads = extractLinearUploads(
      'issue-505',
      [
        'see https://uploads.linear.app/o/f/b. And (https://uploads.linear.app/o/f/c), then https://uploads.linear.app/o/f/d?!',
        '[x](https://uploads.linear.app/o/f/e.)',
      ],
      [],
    );
    expect(uploads.map((u) => u.sourceId)).toEqual([
      'issue-505 https://uploads.linear.app/o/f/b',
      'issue-505 https://uploads.linear.app/o/f/c',
      'issue-505 https://uploads.linear.app/o/f/d',
      'issue-505 https://uploads.linear.app/o/f/e.',
    ]);
  });

  it('never generates a filename that another file already has', () => {
    const uploads = extractLinearUploads(
      'issue-505',
      [
        '![image.png](https://uploads.linear.app/o/a/1) ![image.png](https://uploads.linear.app/o/a/2) ![image (2).png](https://uploads.linear.app/o/a/3)',
      ],
      [],
    );
    const names = uploads.map((u) => u.filename);
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(3);
    expect(names[0]).toBe('image.png');
  });

  it('gives cycles with a repeated name distinct names', () => {
    const base = { startsAt: '2026-01-05T08:00:00.000Z', endsAt: '2026-01-19T08:00:00.000Z' };
    const names = mapLinearCycles([
      { id: 'a', number: 1, name: 'Sprint', description: null, ...base },
      { id: 'b', number: 2, name: 'sprint', description: null, ...base },
      { id: 'c', number: 3, name: null, description: null, ...base },
      { id: 'd', number: 4, name: 'Cycle 3', description: null, ...base },
    ]).map((c) => c.name);
    expect(names[0]).toBe('Sprint');
    expect(names[1]).toBe('sprint (Cycle 2)');
    expect(names[2]).toBe('Cycle 3');
    expect(names[3]).toBe('Cycle 3 (Cycle 4)');
  });

  it('refuses a next page that has no cursor', () => {
    expect(() => linearNextCursor({ hasNextPage: true, endCursor: null })).toThrow('no end cursor');
    expect(linearNextCursor({ hasNextPage: false, endCursor: null })).toBeNull();
  });
});
