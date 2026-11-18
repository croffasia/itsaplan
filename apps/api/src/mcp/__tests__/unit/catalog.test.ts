import { describe, it, expect } from 'bun:test';
import { app } from '#tests/helpers/app';
import { PRIMARY_TOOLS, catalogTools, toolSearch } from '../../catalog';
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

describe('toolSearch', () => {
  const search = toolSearch([
    tool('create_label', 'Create a label.'),
    tool('delete_label', 'Delete a label.'),
    tool('delete_label_group', 'Delete a group and its labels.'),
    tool('list_issues', 'List issues, filtered by label.'),
    tool('list_members', 'List the members of a project.'),
    tool('list_invites', 'List the invites of a team.'),
    tool('delete_invite', 'Revoke an invite that was not accepted.'),
  ]);
  const names = (query: string) => search(query).map((t) => t.name);

  it('answers an exact name with that tool alone', () => {
    expect(names('delete_label')).toEqual(['delete_label']);
    expect(names(' Delete_Label ')).toEqual(['delete_label']);
  });

  it('ranks a word in the name above the same word in a description', () => {
    const found = names('label');
    expect(found.slice(0, 2)).toEqual(['create_label', 'delete_label']);
    expect(found.at(-1)).toBe('list_issues');
  });

  it('ranks the tool holding every word of the query first', () => {
    expect(names('delete label')[0]).toBe('delete_label');
    expect(names('label group')[0]).toBe('delete_label_group');
  });

  it('finds a tool by a word only its description has', () => {
    expect(names('accepted')).toEqual(['delete_invite']);
  });

  it('reads a plural as its singular', () => {
    expect(names('labels')).toEqual(names('label'));
    expect(names('invites').sort()).toEqual(['delete_invite', 'list_invites']);
  });

  it('returns nothing when the query has no known word', () => {
    expect(names('webhook')).toEqual([]);
    expect(names('---')).toEqual([]);
  });

  it('ranks the route table', () => {
    const real = toolSearch(table);
    expect(real('unread notification count')[0].name).toBe('get_unread_notification_count');
    expect(real('delete label')[0].name).toBe('delete_label');
    expect(real('zzzz')).toEqual([]);
  });

  // Dozens of tools are named list_*, and few mention revoking.
  it('ranks a rare word above a common one', () => {
    const [first] = toolSearch(table)('list revoke');
    expect(`${first.name} ${first.description}`).toMatch(/revoke/i);
    expect(first.name).not.toMatch(/^list_/);
  });
});
