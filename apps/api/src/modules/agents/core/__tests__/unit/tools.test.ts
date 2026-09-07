import { describe, it, expect } from 'bun:test';
import {
  normalizeToolKeys,
  AGENT_ACTIONS,
  ALWAYS_ON_ACTIONS,
  type ToolMeta,
} from '../../runtime/tools/catalog';

// normalizeToolKeys sanitizes the action keys stored on an internal agent: it keeps
// only keys that exist in the action registry, deduplicates them, and rejects
// anything that is not a string. It is pure, so this is a unit test.

describe('normalizeToolKeys', () => {
  it('keeps a registered key', () => {
    expect(normalizeToolKeys(['create_issue'])).toEqual(['create_issue']);
  });

  it('drops keys that are not in the registry', () => {
    expect(normalizeToolKeys(['create_issue', 'not_a_real_tool'])).toEqual(['create_issue']);
  });

  it('drops always-on read tool keys (not grantable actions)', () => {
    expect(normalizeToolKeys(['get_issue', 'create_issue'])).toEqual(['create_issue']);
  });

  it('deduplicates repeated keys', () => {
    expect(normalizeToolKeys(['add_comment', 'add_comment'])).toEqual(['add_comment']);
  });

  it('drops non-string entries', () => {
    expect(normalizeToolKeys(['add_comment', 1, null, {}] as unknown[])).toEqual(['add_comment']);
  });

  it('returns an empty list for a non-array input', () => {
    expect(normalizeToolKeys(undefined)).toEqual([]);
    expect(normalizeToolKeys(null)).toEqual([]);
    expect(normalizeToolKeys('create_issue')).toEqual([]);
  });

  it('accepts every key the registry advertises', () => {
    const all = AGENT_ACTIONS.map((t: ToolMeta) => t.key);
    expect(normalizeToolKeys(all)).toEqual(all);
  });

  it('puts every action in a known feature group (the config UI groups by it)', () => {
    const groups = new Set(['issues', 'initiatives', 'cycles', 'documents', 'notes', 'project']);
    for (const tool of [...AGENT_ACTIONS, ...ALWAYS_ON_ACTIONS]) {
      expect(groups.has(tool.group)).toBe(true);
    }
  });

  it('registers initiative actions and read tools', () => {
    expect(AGENT_ACTIONS.map((tool) => tool.key)).toEqual(
      expect.arrayContaining(['create_initiative', 'update_initiative', 'delete_initiative']),
    );
    expect(ALWAYS_ON_ACTIONS.map((tool) => tool.key)).toEqual(
      expect.arrayContaining(['list_initiatives', 'get_initiative']),
    );
  });

  it("keeps the issue discussion readable, so an agent can answer in a comment's thread", () => {
    const alwaysOn = new Set(ALWAYS_ON_ACTIONS.map((tool) => tool.key));
    expect(alwaysOn.has('list_issue_activity')).toBe(true);
    expect(normalizeToolKeys(['list_issue_activity'])).toEqual([]);
  });

  it('registers note board actions as grantable, including the reads', () => {
    const keys = [
      'list_note_boards',
      'get_note_board',
      'create_note_board',
      'update_note_board',
      'delete_note_board',
    ];
    expect(normalizeToolKeys(keys)).toEqual(keys);
    const alwaysOn = new Set(ALWAYS_ON_ACTIONS.map((tool) => tool.key));
    for (const key of keys) expect(alwaysOn.has(key)).toBe(false);
  });

  it('registers document actions as grantable, including the reads', () => {
    const keys = [
      'list_documents',
      'get_document',
      'create_document',
      'update_document',
      'delete_document',
    ];
    expect(normalizeToolKeys(keys)).toEqual(keys);
  });

  // Agent-management tools are exposed over MCP (for an external MCP client to manage
  // agents) but must never be reachable by an internal agent: they are not in the
  // catalog, so normalizeToolKeys drops them and they are not always-on. This locks
  // that invariant so a future catalog addition cannot silently grant them.
  it('never makes agent-management tools grantable to an internal agent', () => {
    const management = [
      'get_ai_agent',
      'list_ai_agents',
      'list_ai_agent_tools',
      'create_ai_agent',
      'update_ai_agent',
      'delete_ai_agent',
      'regenerate_ai_agent_key',
      'run_ai_agent',
    ];
    expect(normalizeToolKeys(management)).toEqual([]);
    const grantable = new Set([
      ...AGENT_ACTIONS.map((t) => t.key),
      ...ALWAYS_ON_ACTIONS.map((t) => t.key),
    ]);
    for (const key of management) expect(grantable.has(key)).toBe(false);
  });
});
