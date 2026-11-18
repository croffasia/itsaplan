import { describe, it, expect } from 'bun:test';
import { app } from '#tests/helpers/app';
import { PRIMARY_TOOLS, catalogTools, matchTools } from '../../catalog';
import { routeTools, type McpRouteTool } from '../../generate';

// The real route table, read from the assembled app: no session and no query.
const table = routeTools(app);

function tool(name: string, description = ''): McpRouteTool {
  return { name, description } as McpRouteTool;
}

describe('catalog tools/list', () => {
  it('lists every primary tool under a name the route table has', () => {
    const names = new Set(table.map((t) => t.name));
    expect(PRIMARY_TOOLS.filter((name) => !names.has(name))).toEqual([]);
  });

  it('gives no route tool the name of a catalog tool', () => {
    const names = new Set(table.map((t) => t.name));
    expect(catalogTools().filter((t) => names.has(t.name))).toEqual([]);
  });

  // The mode exists to keep tools/list short: the whole table is about 600,000
  // characters. A primary tool added without thought shows up here.
  it('stays under 20,000 characters', () => {
    const listed = [
      ...catalogTools(),
      ...table
        .filter((t) => PRIMARY_TOOLS.includes(t.name))
        .map(({ name, description, inputSchema, annotations }) => ({
          name,
          description,
          inputSchema,
          annotations,
        })),
    ];
    expect(JSON.stringify({ tools: listed }).length).toBeLessThan(20_000);
  });
});

describe('matchTools', () => {
  const tools = [
    tool('create_label', 'Create a label.'),
    tool('delete_label', 'Delete a label.'),
    tool('delete_label_group', 'Delete a group and its labels.'),
    tool('list_issues', 'List issues, filtered by label.'),
  ];

  it('answers an exact name with that tool alone', () => {
    expect(matchTools(tools, 'delete_label').map((t) => t.name)).toEqual(['delete_label']);
    expect(matchTools(tools, ' Delete_Label ').map((t) => t.name)).toEqual(['delete_label']);
  });

  it('ranks a word of the name above part of it, and that above the description', () => {
    expect(matchTools(tools, 'label').map((t) => t.name)).toEqual([
      'create_label',
      'delete_label',
      'delete_label_group',
      'list_issues',
    ]);
    expect(matchTools(tools, 'issue').map((t) => t.name)).toEqual(['list_issues']);
  });

  it('adds up the words of the query', () => {
    expect(matchTools(tools, 'delete label')[0].name).toBe('delete_label');
    expect(matchTools(tools, 'delete label')).toHaveLength(4);
  });

  it('returns nothing when no word matches', () => {
    expect(matchTools(tools, 'webhook')).toEqual([]);
    expect(matchTools(tools, '---')).toEqual([]);
  });
});
