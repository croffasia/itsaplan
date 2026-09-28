import { describe, expect, it } from 'bun:test';
import {
  discoverTools,
  invocationArguments,
  listCatalog,
  type ToolDescriptor,
} from '../../catalog';

function descriptor(name: string, description = name, readOnly = true): ToolDescriptor {
  return {
    name,
    description,
    inputSchema: { type: 'object', properties: { projectKey: { type: 'string' } }, required: [] },
    annotations: { readOnlyHint: readOnly, destructiveHint: !readOnly },
  };
}

const tools = [
  descriptor('search_workspace', 'Find tasks and boards across the workspace.'),
  descriptor('list_projects', 'List projects.'),
  descriptor('get_project', 'Read one project.'),
  descriptor('get_issue', 'Read one issue.'),
  descriptor('get_issue_by_number', 'Read an issue by identifier.'),
  descriptor('list_issues', 'List issues in a project.'),
  descriptor('get_document', 'Read a document.'),
  descriptor('list_teams', 'List teams.'),
  descriptor('create_issue', 'Create an issue.', false),
  descriptor('update_issue', 'Update an issue.', false),
  descriptor('get_note_board', 'Read a note board.'),
  descriptor('list_documents', 'List documents.'),
  ...Array.from({ length: 80 }, (_, index) =>
    descriptor(`list_resources_${String(index).padStart(3, '0')}`),
  ),
];

describe('MCP tool catalog', () => {
  it('keeps the default catalog small while retaining task discovery and execution', () => {
    const compact = listCatalog(tools, 'compact');
    const names = compact.tools.map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'search_workspace',
        'list_projects',
        'get_issue',
        'get_document',
        'discover_tools',
        'call_read_tool',
        'call_tool',
      ]),
    );
    expect(names).not.toContain('create_issue');
    expect(names.length).toBeLessThanOrEqual(12);
    expect(JSON.stringify(compact).length).toBeLessThan(JSON.stringify(tools).length / 3);
  });

  it('lists every tool in the full catalog', () => {
    expect(listCatalog(tools, 'full').tools.map((tool) => tool.name)).toEqual([
      ...tools.map((tool) => tool.name),
      'discover_tools',
      'call_read_tool',
      'call_tool',
    ]);
  });

  it('lists an image tool in every catalog and has it called by name', () => {
    const image = { ...descriptor('view_issue_images'), images: true };
    expect(listCatalog([...tools, image], 'compact').tools).toContainEqual(image);
    const found = discoverTools([image], { query: 'view_issue_images' });
    if ('error' in found) throw new Error(found.error);
    expect(found.tools[0].invokeWith).toBe('view_issue_images');
  });

  it('marks the read executor read-only and the general executor as potentially destructive', () => {
    const catalog = listCatalog([], 'compact');
    expect(catalog.tools.find((tool) => tool.name === 'call_read_tool')?.annotations).toMatchObject(
      {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    );
    expect(catalog.tools.find((tool) => tool.name === 'call_tool')?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    });
  });
});

describe('MCP tool search', () => {
  it.each(['constructor', 'toString', 'hasOwnProperty'])(
    'handles an unknown search term %s',
    (query) => {
      expect(discoverTools([], { query })).toEqual({ tools: [], total: 0, nextOffset: null });
      expect(discoverTools([descriptor('list_projects')], { query })).toEqual({
        tools: [],
        total: 0,
        nextOffset: null,
      });
    },
  );

  it('finds the project directory before reports or dashboards for board discovery', () => {
    const result = discoverTools(
      [
        ...tools,
        descriptor('get_project_activity'),
        descriptor('get_project_breakdown'),
        descriptor('get_project_pulse'),
        descriptor('list_dashboards', 'List dashboards.'),
      ],
      { query: 'find boards', limit: 3 },
    );
    if (result.error !== undefined) throw new Error(result.error);
    expect(result.tools[0].name).toBe('list_projects');
    expect(result.tools.map((tool) => tool.name)).not.toContain('list_dashboards');
  });

  it.each([
    ['create tasks', 'create_issue'],
    ['edit task', 'update_issue'],
    ['find boards', 'list_projects'],
    ['read docs', 'get_document'],
  ])('resolves agent language "%s" to %s', (query, name) => {
    const result = discoverTools(tools, { query });
    expect(result).toHaveProperty('tools');
    if ('error' in result) throw new Error(result.error);
    expect(result.tools.map((tool) => tool.name)).toContain(name);
  });

  it('ranks an exact tool name first and preserves its schema and executor choice', () => {
    const result = discoverTools(tools, { query: '  CREATE_ISSUE  ' });
    if ('error' in result) throw new Error(result.error);
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0]).toMatchObject({
      ...tools.find((tool) => tool.name === 'create_issue'),
      invokeWith: 'call_tool',
    });
    const read = discoverTools(tools, { query: 'get_document', limit: 1 });
    if ('error' in read) throw new Error(read.error);
    expect(read.tools[0].invokeWith).toBe('call_read_tool');
  });

  it('limits results and gives a stable continuation offset', () => {
    const first = discoverTools(tools, { query: 'resources', limit: 10 });
    if ('error' in first) throw new Error(first.error);
    expect(first).toMatchObject({ total: 80, nextOffset: 10 });
    expect(first.tools).toHaveLength(10);
    const next = discoverTools([...tools].reverse(), {
      query: 'resources',
      limit: 10,
      offset: first.nextOffset,
    });
    if ('error' in next) throw new Error(next.error);
    expect(next.tools[0].name).toBe('list_resources_010');
    expect(
      next.tools.some((tool) => first.tools.some((previous) => previous.name === tool.name)),
    ).toBe(false);
    const last = discoverTools(tools, { query: 'resources', limit: 10, offset: 80 });
    expect(last).toMatchObject({ tools: [], total: 80, nextOffset: null });
    const defaults = discoverTools(tools, { query: 'resources' });
    if ('error' in defaults) throw new Error(defaults.error);
    expect(defaults.tools).toHaveLength(5);
  });

  it('returns an empty result for unrelated words', () => {
    expect(discoverTools(tools, { query: 'zebracorn' })).toEqual({
      tools: [],
      total: 0,
      nextOffset: null,
    });
  });

  it('accepts query and paging boundaries', () => {
    for (const args of [
      { query: 'a' },
      { query: 'a'.repeat(200) },
      { query: 'issue', limit: 1, offset: 0 },
      { query: 'issue', limit: 10, offset: 10000 },
    ]) {
      expect(discoverTools(tools, args)).not.toHaveProperty('error');
    }
  });

  it('refuses blank queries, excessive pages, fractions, and unknown arguments', () => {
    for (const args of [
      {},
      { query: '' },
      { query: '   ' },
      { query: 'a'.repeat(201) },
      { query: 'issue', limit: 0 },
      { query: 'issue', limit: 11 },
      { query: 'issue', limit: 1.5 },
      { query: 'issue', offset: -1 },
      { query: 'issue', offset: 0.5 },
      { query: 'issue', offset: 10001 },
      { query: 'issue', offset: '1' },
      { query: 'issue', unknown: true },
    ]) {
      expect(discoverTools(tools, args)).toHaveProperty('error');
    }
  });

  it('requires an exact invocation name and an object of arguments', () => {
    expect(invocationArguments.safeParse({ name: 'list_projects', arguments: {} }).success).toBe(
      true,
    );
    for (const args of [
      {},
      { name: 'list_projects' },
      { name: '', arguments: {} },
      { name: ' ', arguments: {} },
      { name: 'a'.repeat(201), arguments: {} },
      { name: 'list_projects', arguments: null },
      { name: 'list_projects', arguments: [] },
      { name: 'list_projects', arguments: '{}' },
      { name: 'list_projects', arguments: {}, unknown: true },
    ]) {
      expect(invocationArguments.safeParse(args).success).toBe(false);
    }
  });
});
