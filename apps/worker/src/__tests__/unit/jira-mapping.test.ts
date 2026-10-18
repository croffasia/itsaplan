import { describe, it, expect } from 'bun:test';
import {
  adfToMarkdown,
  jiraPriority,
  jiraTimestamp,
  mapJiraComments,
  mapJiraIssue,
  mapJiraLinks,
  mapJiraSprints,
  mapJiraStatuses,
  type JiraIssue,
} from '../../jira-mapping';
import issueFixture from './fixtures/jira-issue.json';
import statusesFixture from './fixtures/jira-statuses.json';

const issue = issueFixture as unknown as JiraIssue;
const SCOPE = { projectKey: 'OPS', sprintField: 'customfield_10020' };

describe('adfToMarkdown', () => {
  it('converts headings, lists, marks, cards, mentions, code and tasks, and drops media', () => {
    expect(adfToMarkdown(issue.fields.description)).toBe(
      [
        '## Steps',
        '1. Open `/login`\n2. **Submit**',
        'See https://acme.atlassian.net/browse/OPS-7 and [docs](https://example.com/docs), cc @Dana',
        '```js\nlogin()\n```',
        '- [x] repro\n- [ ] fix',
      ].join('\n\n'),
    );
  });

  it('renders a table as a pipe table and escapes pipes in cells', () => {
    const cell = (text: string) => ({
      type: 'tableCell',
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    });
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            { type: 'tableRow', content: [cell('a'), cell('b')] },
            { type: 'tableRow', content: [cell('x|y'), cell('z')] },
          ],
        },
      ],
    };
    expect(adfToMarkdown(doc)).toBe('| a | b |\n| --- | --- |\n| x\\|y | z |');
  });

  it('is empty for a missing document', () => {
    expect(adfToMarkdown(null)).toBe('');
  });
});

describe('mapJiraIssue', () => {
  const mapped = mapJiraIssue(issue, SCOPE);

  it('maps the fields and keeps the latest dated sprint', () => {
    expect(mapped).toMatchObject({
      sourceId: '10042',
      sequenceId: 12,
      title: 'Login fails on Safari',
      stateSourceId: '3',
      assigneeEmail: 'dana@example.com',
      labelSourceIds: ['frontend', 'safari'],
      cycleSourceId: '4',
      parentSourceId: '10001',
      priority: 'urgent',
      dueDate: '2024-03-01',
      createdAt: '2024-01-05T10:00:00.000+01:00',
    });
  });

  it('turns issue URLs into bare keys and ends with the Jira key', () => {
    expect(mapped.descriptionMarkdown).toContain('See OPS-7 and');
    expect(mapped.descriptionMarkdown.endsWith('Imported from Jira: OPS-12')).toBe(true);
    expect(mapped.descriptionMarkdown).not.toContain('Parent in Jira');
  });

  it('names a parent from another project in the description', () => {
    const other = { ...issue, fields: { ...issue.fields, parent: { id: '9', key: 'EPIC-3' } } };
    expect(mapJiraIssue(other, SCOPE).descriptionMarkdown).toContain('Parent in Jira: EPIC-3');
  });
});

describe('mapJiraStatuses', () => {
  it('keeps a shared status once and maps categories, with name overrides', () => {
    expect(mapJiraStatuses(statusesFixture)).toEqual([
      { sourceId: '1', name: 'To Do', category: 'unstarted' },
      { sourceId: '3', name: 'In Progress', category: 'started' },
      { sourceId: '10000', name: 'Done', category: 'completed' },
      { sourceId: '10001', name: 'Backlog', category: 'backlog' },
      { sourceId: '10002', name: "Won't Do", category: 'canceled' },
    ]);
  });
});

describe('mapJiraSprints', () => {
  it('skips undated sprints and makes names distinct', () => {
    const cycles = mapJiraSprints([
      { id: 1, name: 'Sprint', startDate: '2024-01-01T00:00:00Z', endDate: '2024-01-14T00:00:00Z' },
      {
        id: 2,
        name: 'Sprint',
        startDate: '2024-01-15T00:00:00Z',
        completeDate: '2024-01-28T00:00:00Z',
      },
      { id: 3, name: 'Future' },
    ]);
    expect(cycles.map((c) => [c.sourceId, c.name, c.endDate])).toEqual([
      ['1', 'Sprint', '2024-01-14'],
      ['2', 'Sprint (2)', '2024-01-28'],
    ]);
  });
});

describe('mapJiraLinks', () => {
  it('reads outward links of known kinds only', () => {
    expect(mapJiraLinks('10042', issue.fields.issuelinks!)).toEqual([
      { kind: 'blocks', sourceIssueSourceId: '10042', targetIssueSourceId: '10050' },
      { kind: 'duplicates', sourceIssueSourceId: '10042', targetIssueSourceId: '10052' },
    ]);
  });
});

describe('mapJiraComments', () => {
  it('sorts oldest first and falls back to the display name without an email', () => {
    const body = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }],
    };
    const comments = mapJiraComments([
      { id: '2', author: { displayName: 'Lee' }, body, created: '2024-01-02T00:00:00.000+0000' },
      {
        id: '1',
        author: { emailAddress: 'a@x.com', displayName: 'Ann' },
        body,
        created: '2024-01-01T00:00:00.000+0000',
      },
    ]);
    expect(comments.map((c) => [c.sourceId, c.authorEmail, c.authorName, c.bodyMarkdown])).toEqual([
      ['1', 'a@x.com', 'Ann', 'hi'],
      ['2', null, 'Lee', 'hi'],
    ]);
  });
});

describe('small helpers', () => {
  it('maps priorities and timestamps', () => {
    expect(jiraPriority('Lowest')).toBe('low');
    expect(jiraPriority('P0')).toBeNull();
    expect(jiraTimestamp('2024-01-05T10:00:00.000-0530')).toBe('2024-01-05T10:00:00.000-05:30');
  });
});
