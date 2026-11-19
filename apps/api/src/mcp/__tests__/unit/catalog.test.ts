import { describe, it, expect } from 'bun:test';
import { app } from '#tests/helpers/app';
import {
  ALIASES,
  PRIMARY_TOOLS,
  RESOURCES,
  callCatalogTool,
  catalogTools,
  toolSearch,
} from '../../catalog';
import { routeTools, type McpInputSchema, type McpRouteTool } from '../../generate';
import { DISCOVER_QUERIES } from './discover-queries';

// The real route table, read from the assembled app: no session and no query.
const table = routeTools(app);

function tool(name: string, description = '', properties: string[] = []): McpRouteTool {
  const inputSchema: McpInputSchema = {
    type: 'object',
    properties: Object.fromEntries(properties.map((property) => [property, {}])),
    required: [],
  };
  return { name, description, inputSchema, pathParams: [] } as unknown as McpRouteTool;
}

async function discover(table: McpRouteTool[], query: string) {
  const result = await callCatalogTool(
    'discover',
    { query },
    {
      table,
      inputSchemaOf: (t) => t.inputSchema,
      call: () => Promise.reject(new Error('discover runs no tool')),
    },
  );
  return JSON.parse((result.content[0] as { text: string }).text);
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

  it('tells the vocabulary of the tools in the description of discover', () => {
    const { description } = catalogTools().find((t) => t.name === 'discover')!;
    expect(description).toContain('are in English');
    expect(description).toContain(RESOURCES.join(', '));
  });

  it('names only resources the route table has tools for', async () => {
    const { resources } = await discover(table, 'zzzz');
    expect(Object.keys(resources)).toEqual(RESOURCES);
    expect(RESOURCES.filter((resource) => resources[resource] === 0)).toEqual([]);
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
  const names = (query: string) => search(query).tools.map((t) => t.name);

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
    expect(search('webhook')).toEqual({ tools: [], unmatched: ['webhook'] });
    expect(search('---')).toEqual({ tools: [], unmatched: [] });
  });

  it('names the words no tool has, in any script', () => {
    expect(search('delete label')).toMatchObject({ unmatched: [] });
    expect(search('Delete my LABEL, please')).toMatchObject({ unmatched: ['my', 'please'] });
    expect(search('라벨 삭제')).toEqual({ tools: [], unmatched: ['라벨', '삭제'] });
    const mixed = search('label 삭제');
    expect(mixed.tools[0].name).toBe('create_label');
    expect(mixed.unmatched).toEqual(['삭제']);
  });

  it('ranks the route table', () => {
    const real = toolSearch(table);
    expect(real('unread notification count').tools[0].name).toBe('get_unread_notification_count');
    expect(real('delete label').tools[0].name).toBe('delete_label');
    expect(real('zzzz')).toEqual({ tools: [], unmatched: ['zzzz'] });
  });

  // Dozens of tools are named list_*, and few mention revoking.
  it('ranks a rare word above a common one', () => {
    const [first] = toolSearch(table)('list revoke').tools;
    expect(`${first.name} ${first.description}`).toMatch(/revoke/i);
    expect(first.name).not.toMatch(/^list_/);
  });
});

describe('toolSearch aliases', () => {
  const search = toolSearch([
    tool('create_document', 'Create a document.'),
    tool('duplicate_document', 'Duplicate a document with its content.'),
    tool('copy_project', 'Copy a project without its issues.'),
    tool('update_issue', 'Update an issue.', ['issueId', 'dueDate', 'assigneeUserId']),
    tool('delete_issue', 'Delete an issue.', ['issueId']),
    tool('update_column', 'Update a column of the board.', ['columnId', 'name']),
    tool('list_cycles', 'List the cycles of a project.'),
    tool('finish_cycle', 'Finish the active cycle.'),
  ]);
  const names = (query: string) => search(query).tools.map((t) => t.name);

  it('finds a resource by an everyday word for it', () => {
    expect(names('create wiki page')[0]).toBe('create_document');
    expect(names('ticket').sort()).toEqual(['copy_project', 'delete_issue', 'update_issue']);
    expect(names('sprints').sort()).toEqual(['finish_cycle', 'list_cycles']);
    expect(search('wiki').unmatched).toEqual([]);
  });

  it('finds an action by an everyday word for it', () => {
    expect(names('edit ticket')[0]).toBe('update_issue');
    expect(names('remove ticket')[0]).toBe('delete_issue');
    expect(names('close sprint')[0]).toBe('finish_cycle');
    expect(names('rename status')[0]).toBe('update_column');
  });

  it("ranks a tool that has the query's own word above one that has its alias", () => {
    expect(names('copy')).toEqual(['copy_project', 'duplicate_document']);
    expect(names('copy wiki page')[0]).toBe('duplicate_document');
  });

  it('finds a tool by the name of an input property', () => {
    expect(names('due date')).toEqual(['update_issue']);
    expect(names('assignee')).toEqual(['update_issue']);
  });

  it('ranks a word of a name above the same word in an input property', () => {
    expect(names('issue name')[0]).not.toBe('update_column');
    expect(names('column')[0]).toBe('update_column');
  });

  it('reads a camelCase name in a description by its words', () => {
    const found = toolSearch([
      tool('add_note', 'Add a note. Pass replyToId to answer a note.'),
      tool('delete_note', 'Remove a note and its replies.'),
    ])('reply').tools.map((t) => t.name);
    expect(found.sort()).toEqual(['add_note', 'delete_note']);
  });

  // The id in the path is often the only property a reader has. Without it, "sprint
  // details" (details matches no tool) ranks get_cycle below every tool that changes a
  // cycle, as their descriptions say "cycle" more often.
  it('finds a reader by the resource its path parameter names', () => {
    const real = toolSearch(table);
    const top = (query: string) =>
      real(query)
        .tools.slice(0, 5)
        .map((t) => t.name);
    expect(top('sprint details')).toContain('get_cycle');
    expect(top('ticket details')).toContain('get_issue');
    expect(top('agent details')).toContain('get_ai_agent');
    expect(real('project').tools.length).toBeLessThan(table.length / 2);
  });

  it('does not lead a word for a credential to the tool that regenerates one', () => {
    const top = toolSearch(table)('show my api token')
      .tools.slice(0, 3)
      .map((t) => t.name);
    expect(top).not.toContain('regenerate_ai_agent_key');
    expect(top).toContain('list_integration_credentials');
  });

  it('leads every alias to a word the route table has', () => {
    const real = toolSearch(table);
    const dead = Object.values(ALIASES)
      .flat()
      .filter((word) => real(word).tools.length === 0);
    expect(dead).toEqual([]);
  });
});

describe('discover', () => {
  // The floor is 9 in 10. Without the aliases and the input property names the search
  // finds 35 of the 56.
  it('finds the tool for an everyday request within the default number of results', () => {
    const search = toolSearch(table);
    const missed = DISCOVER_QUERIES.filter(
      ([query, name]) =>
        !search(query)
          .tools.slice(0, 5)
          .some((t) => t.name === name),
    );
    expect(missed.length).toBeLessThanOrEqual(DISCOVER_QUERIES.length * 0.1);
  });

  it('adds nothing to a result whose every word matched', async () => {
    const data = await discover(table, 'delete label');
    expect(Object.keys(data)).toEqual(['total', 'tools']);
    expect(data.tools[0].name).toBe('delete_label');
  });

  it('answers a query that found nothing with the words to search by', async () => {
    const data = await discover(table, 'zzzz 티켓');
    expect(data).toMatchObject({ total: 0, tools: [], unmatched: ['zzzz', '티켓'] });
    expect(data.resources.issue).toBeGreaterThan(data.resources.watcher);
  });

  it('names the unmatched words beside the matches of the others', async () => {
    const data = await discover(table, 'delete label zzzz');
    expect(data.tools[0].name).toBe('delete_label');
    expect(data.unmatched).toEqual(['zzzz']);
    expect(Object.keys(data.resources)).toEqual(RESOURCES);
  });
});
