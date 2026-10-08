import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BoardIssue } from '@/lib/api/endpoints/issues';
import type { CustomField } from '@/lib/api/endpoints/customFields';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import { applyFilters, EMPTY_FILTER_SET, type FilterSet } from '@/utils/filters';
import { buildGroups, sortIssues, type GroupLabels } from '@/utils/project';
import { withoutShownSubtasks } from '@/utils/subtasks';
import {
  columnSearchEntriesForGroup,
  prepareColumnSearchEntries,
  searchColumnEntries,
} from './columnSearch';

function issue(id: number, patch: Partial<BoardIssue> = {}): BoardIssue {
  return {
    id,
    projectId: 1,
    sequenceNumber: id,
    identifier: `SKH-${id}`,
    title: `Task ${id}`,
    description: '',
    typeId: null,
    initiative: null,
    cycle: null,
    assigneeUserId: null,
    delegateUserId: null,
    columnId: 1,
    parentId: null,
    priority: null,
    estimatePoints: null,
    estimateMinutes: null,
    loggedMinutes: 0,
    startDate: null,
    dueDate: null,
    position: id,
    createdAt: '2026-09-13T00:00:00Z',
    updatedAt: '2026-09-13T00:00:00Z',
    archivedAt: null,
    statusSince: '2026-09-13T00:00:00Z',
    shareToken: null,
    shareExtended: false,
    labelIds: [],
    fieldValues: [],
    links: [],
    subtaskCount: 0,
    ...patch,
  };
}

function field(id: number, fieldType: CustomField['fieldType'], name = 'Reference'): CustomField {
  return {
    id,
    fieldType,
    name,
    issueTypeId: null,
    memberScope: null,
    showInBody: false,
    position: id,
    options: [],
  };
}

function search(issues: BoardIssue[], query: string, fields: CustomField[] = []) {
  return searchColumnEntries(prepareColumnSearchEntries(issues, fields), query, 'SKH');
}

function board(issues: BoardIssue[]): ProjectDetail {
  return {
    issues,
    columns: [1, 2].map((id) => ({
      id,
      projectId: 1,
      name: 'Shared name',
      stateType: 'started',
      color: '#000',
      position: id,
      wipLimit: null,
      wipMode: 'soft',
      autoAssignUserId: null,
    })),
    assignees: [],
    issueTypes: [],
    customFields: [],
  } as unknown as ProjectDetail;
}

describe('column search completeness', () => {
  it('finds the only match in task 3,053 and returns every match beyond 500', () => {
    const issues = Array.from({ length: 3053 }, (_, index) => issue(index + 1));
    issues[3052].description = 'The only remote-checkpoint match';
    const entries = prepareColumnSearchEntries(issues, []);
    assert.deepEqual(
      searchColumnEntries(entries, 'remote-checkpoint', 'SKH').map((row) => row.issue.id),
      [3053],
    );
    assert.equal(searchColumnEntries(entries, 'Task', 'SKH').length, 3053);
    assert.equal(searchColumnEntries(entries, ' \n ', 'SKH').length, 3053);
  });

  it('deduplicates IDs, excludes archived tasks, and preserves the supplied order', () => {
    const first = issue(8);
    const issues = [first, issue(3, { archivedAt: '2026-09-13' }), issue(2), issue(8), issue(1)];
    const results = search(issues, 'task');
    assert.deepEqual(
      results.map((row) => row.issue.id),
      [8, 2, 1],
    );
    assert.equal(results[0].issue, first);
    assert.deepEqual(
      issues.map((row) => row.id),
      [8, 3, 2, 8, 1],
    );
  });
});

describe('column search board scope', () => {
  it('intersects saved and temporary filters while finding a nested subtask in its own status', () => {
    const task = (id: number, patch: Partial<BoardIssue> = {}) =>
      issue(id, {
        title: 'Parent context',
        priority: 'high',
        assigneeUserId: 'reader',
        ...patch,
      });
    const nested = task(3, { parentId: 2, description: 'The nested skill-checkpoint' });
    const issues = [
      task(1),
      task(2, { parentId: 1 }),
      nested,
      task(4, { parentId: 1, columnId: 2, description: 'skill-checkpoint in another status' }),
      task(5, { parentId: 1, assigneeUserId: 'other', description: 'skill-checkpoint' }),
      task(6, { priority: 'low', description: 'skill-checkpoint' }),
      task(7, { description: 'skill-checkpoint', archivedAt: '2026-09-13' }),
      nested,
    ];
    const project = board(issues);
    const saved: FilterSet = {
      conditions: [{ id: 'priority', field: 'priority', op: 'is', values: ['high'] }],
    };
    const temporary: FilterSet = {
      conditions: [{ id: 'assignee', field: 'assignee', op: 'is', values: ['reader'] }],
    };
    const filtered = applyFilters(applyFilters(issues, saved, project), temporary, project);
    assert.equal(
      withoutShownSubtasks(filtered).some((task) => task.id === nested.id),
      false,
    );

    const entries = prepareColumnSearchEntries(filtered, project.customFields);
    const scoped = columnSearchEntriesForGroup(entries, 'status', 'c1');
    const results = searchColumnEntries(scoped, 'skill-checkpoint', 'SKH');
    assert.deepEqual(
      results.map((row) => row.issue.id),
      [3],
    );
    assert.equal(results[0].issue.parentId, 2);
    assert.deepEqual(
      searchColumnEntries(scoped, '', 'SKH').map((row) => row.issue.id),
      [1, 2, 3],
    );
    assert.deepEqual(
      searchColumnEntries(
        columnSearchEntriesForGroup(entries, 'status', 'c2'),
        'skill-checkpoint',
        'SKH',
      ).map((row) => row.issue.id),
      [4],
    );
    assert.equal(issues.length, 8);
    assert.equal(saved.conditions.length, 1);
    assert.equal(temporary.conditions.length, 1);
  });

  it('uses stable group identities and keeps the selected board sort as the query changes', () => {
    const tasks = [
      issue(8, { title: 'Review SKH-8 references', assigneeUserId: 'reader' }),
      issue(10, { title: 'Review SKH-8 references', assigneeUserId: 'other' }),
      issue(2, { title: 'Review SKH-8 references', assigneeUserId: 'reader' }),
      issue(9, { title: 'Review SKH-8 references', columnId: 2, assigneeUserId: 'reader' }),
      issue(8, { title: 'Review SKH-8 references', assigneeUserId: 'reader' }),
    ];
    const project = board(tasks);
    const labels: GroupLabels = {
      noAssignee: 'No assignee',
      noDelegate: 'No delegate',
      noPriority: 'No priority',
      noType: 'No type',
      noInitiative: 'No initiative',
      noCycle: 'No cycle',
      noMember: 'No value',
      priority: (value) => value,
    };
    const groups = buildGroups(project, 'status', labels, EMPTY_FILTER_SET);
    assert.equal(groups[0].name, groups[1].name);
    const ordered = sortIssues(
      applyFilters(tasks, EMPTY_FILTER_SET, project),
      { field: 'identifier', dir: 'desc' },
      project,
    );
    const entries = prepareColumnSearchEntries(ordered, []);
    const scoped = columnSearchEntriesForGroup(entries, 'status', groups[0].key);
    for (const query of ['', 'review', 'SKH-8']) {
      assert.deepEqual(
        searchColumnEntries(scoped, query, 'SKH').map((row) => row.issue.id),
        [10, 8, 2],
      );
    }
    assert.deepEqual(
      columnSearchEntriesForGroup(entries, 'status', groups[1].key).map((entry) => entry.issue.id),
      [9],
    );
    assert.deepEqual(columnSearchEntriesForGroup(entries, 'status', 'Shared name'), []);
    assert.deepEqual(columnSearchEntriesForGroup(entries, 'assignee', groups[0].key), []);
    assert.deepEqual(
      columnSearchEntriesForGroup(entries, 'assignee', 'areader').map((entry) => entry.issue.id),
      [9, 8, 2],
    );
    assert.deepEqual(
      tasks.map((task) => task.id),
      [8, 10, 2, 9, 8],
    );
  });
});

describe('column search literal and identifier matching', () => {
  it('trims only outer query whitespace and treats punctuation literally', () => {
    const issues = [
      issue(1, { title: '100% owner/repo_name [review] C:\\workspace\\project two  spaces' }),
      issue(2, { title: 'two spaces and ordinary words' }),
    ];
    for (const query of [
      ' 100% ',
      'repo_name',
      '[review]',
      'owner/repo',
      'C:\\workspace',
      'two  spaces',
    ]) {
      assert.deepEqual(
        search(issues, query).map((row) => row.issue.id),
        [1],
        query,
      );
    }
    assert.equal(search(issues, '.*').length, 0);
    assert.equal(search(issues, '_ordinary').length, 0);
    assert.deepEqual(
      search(issues, 'two spaces').map((row) => row.issue.id),
      [2],
    );
  });

  it('matches canonical Unicode in either direction and highlights original code units', () => {
    const decomposed = 'Cafe\u0301';
    const issues = [
      issue(1, { title: `A ${decomposed} review` }),
      issue(2, { title: 'A CAFÉ review' }),
    ];
    for (const query of ['café', 'cafe\u0301']) {
      const results = search(issues, query);
      assert.equal(results.length, 2);
      assert.deepEqual(results[0].titleRanges, [{ start: 2, end: 7 }]);
      assert.equal(results[0].title.slice(2, 7), decomposed);
      assert.deepEqual(results[1].titleRanges, [{ start: 2, end: 6 }]);
    }
    assert.equal(search(issues, 'cafe').length, 0);
    const dotted = search([issue(1, { title: 'İstanbul' })], 'i')[0];
    assert.deepEqual(dotted.titleRanges, [{ start: 0, end: 1 }]);
  });

  it('matches Arabic literally without transliteration', () => {
    const issues = [issue(1, { title: 'مراجعة روابط المهارات' })];
    const result = search(issues, 'روابط المهارات')[0];
    assert.equal(
      result.title.slice(result.titleRanges[0].start, result.titleRanges[0].end),
      'روابط المهارات',
    );
    assert.equal(search(issues, 'skills').length, 0);
  });

  it('uses exact issue numbers without matching a different project prefix or a longer identifier', () => {
    const issues = [
      issue(42, { title: 'First' }),
      issue(420, { title: 'Second' }),
      issue(7, { title: 'See OTHER-42 reference' }),
    ];
    for (const query of ['42', '0042', 'skh-42', 'SKH-0042']) {
      const results = search(issues, query);
      assert.equal(results[0].issue.id, 42);
      assert.equal(
        results.some((row) => row.issue.id === 420),
        false,
      );
      assert.equal(results[0].identifierRanges[0].end, 6);
    }
    assert.deepEqual(
      search(issues, 'OTHER-42').map((row) => row.issue.id),
      [7],
    );
    assert.deepEqual(search(issues, 'ELSE-42'), []);
    assert.equal(search(issues, 'SKH-').length, 3);
  });
});

describe('column search readable content', () => {
  it('extracts Markdown prose, code, link destinations, and HTML text without editor syntax', () => {
    const description =
      '# Heading\n\n**Visible** [repository](https://github.com/org/repo_name)\n\n`inline_code()`\n\n```ts\nconst path = "C:\\work\\[entry]";\n```\n\n<p data-editor-marker="editorpayload">HTML <strong>content</strong> <a href="https://example.test/guide">guide</a> &amp; details</p>';
    const issues = [issue(1, { description })];
    for (const query of [
      'Visible',
      'github.com/org/repo_name',
      'inline_code()',
      'C:\\work\\[entry]',
      'HTML content',
      'example.test/guide',
      '& details',
    ]) {
      assert.equal(search(issues, query).length, 1, query);
    }
    for (const query of [
      '**Visible**',
      '```ts',
      'data-editor-marker',
      'editorpayload',
      '<strong>',
    ]) {
      assert.equal(search(issues, query).length, 0, query);
    }
  });

  it('excludes embedded image bytes and data/blob URLs from matching and excerpts', () => {
    const description =
      'Review ![architecture](data:image/png;base64,MARKDOWNBYTES) and <img src="data:image/png;base64,HTMLBYTES" alt="diagram">.\n\n[inline](data:text/plain,LINKBYTES) [download](blob:https://example.test/BLOBBYTES)\n\n`data:image/png;base64,CODEBYTES`\n\n<script>HIDDENSCRIPT</script><style>HIDDENSTYLE</style>\n\nVisible checkpoint';
    const entries = prepareColumnSearchEntries([issue(1, { description })], []);
    for (const query of [
      'MARKDOWNBYTES',
      'HTMLBYTES',
      'LINKBYTES',
      'BLOBBYTES',
      'CODEBYTES',
      'data:',
      'blob:',
      'HIDDENSCRIPT',
      'HIDDENSTYLE',
    ]) {
      assert.equal(searchColumnEntries(entries, query, 'SKH').length, 0, query);
      assert.equal(entries[0].content[0].value.text.includes(query), false, query);
    }
    const result = searchColumnEntries(entries, 'checkpoint', 'SKH')[0];
    assert.equal(result.excerpt?.source, 'description');
    assert.doesNotMatch(result.excerpt!.text, /BYTES|data:|blob:/);
  });

  it('matches text values and selected option labels with the actual field name', () => {
    const fields = [
      field(1, 'text', 'Repository'),
      field(2, 'select', 'Stage'),
      field(3, 'multi_select', 'Audience'),
      field(4, 'markdown', 'Notes'),
      field(5, 'url', 'Docs'),
      field(6, 'date', 'Date'),
      field(7, 'number', 'Estimate'),
    ];
    fields[1].options = [{ id: 20, value: 'Awaiting review', color: '#000', position: 0 }];
    fields[2].options = [
      { id: 30, value: 'Arabic readers', color: '#000', position: 0 },
      { id: 31, value: 'Operators', color: '#000', position: 1 },
      { id: 32, value: 'Unselected', color: '#000', position: 2 },
    ];
    const task = issue(1, {
      fieldValues: [
        { fieldId: 1, value: 'owner/repo_name', valueEnd: null, optionIds: [] },
        { fieldId: 2, value: null, valueEnd: null, optionIds: [20] },
        { fieldId: 3, value: null, valueEnd: null, optionIds: [30, 31, 999] },
        { fieldId: 4, value: '**Readable notes**', valueEnd: null, optionIds: [] },
        { fieldId: 5, value: 'https://docs.example.test/setup', valueEnd: null, optionIds: [] },
        { fieldId: 6, value: '2099-12-31', valueEnd: null, optionIds: [] },
        { fieldId: 7, value: 98765, valueEnd: null, optionIds: [] },
        { fieldId: 99, value: 'Missing field definition', valueEnd: null, optionIds: [] },
      ],
    });
    for (const [query, name] of [
      ['repo_name', 'Repository'],
      ['awaiting', 'Stage'],
      ['Arabic readers', 'Audience'],
      ['Operators', 'Audience'],
      ['Readable notes', 'Notes'],
      ['docs.example.test/setup', 'Docs'],
    ]) {
      const excerpt = search([task], query, fields)[0].excerpt;
      assert.equal(excerpt?.source, 'customField');
      assert.equal(excerpt?.fieldName, name);
      assert.ok(excerpt!.ranges.length > 0);
    }
    for (const query of [
      'Unselected',
      '2099-12-31',
      '98765',
      'Missing field definition',
      '**Readable notes**',
    ]) {
      assert.equal(search([task], query, fields).length, 0, query);
    }
  });

  it('returns a short excerpt around the match only when title and identifier do not explain it', () => {
    const description = `${'Unrelated context. '.repeat(25)}Read the Cafe\u0301 deployment notes. ${'More context. '.repeat(25)}`;
    const result = search([issue(1, { description })], 'café')[0];
    const excerpt = result.excerpt!;
    assert.equal(excerpt.source, 'description');
    assert.ok(excerpt.text.length <= 162);
    assert.ok(excerpt.text.startsWith('…') && excerpt.text.endsWith('…'));
    assert.equal(excerpt.text.slice(excerpt.ranges[0].start, excerpt.ranges[0].end), 'Cafe\u0301');
    assert.equal(
      search([issue(1, { title: 'Café deployment', description })], 'café')[0].excerpt,
      null,
    );
    assert.equal(search([issue(1, { description })], 'SKH-1')[0].excerpt, null);
    assert.equal(search([issue(1, { description })], '  ')[0].excerpt, null);
  });
});
