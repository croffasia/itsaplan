import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import type { AgentTool, AiAgent } from '@/lib/api/endpoints/agents';
import type { AgentSkill } from '@/lib/api/endpoints/agentSkills';
import type { ConfiguredTool } from '@/lib/api/endpoints/agentTools';
import teams from '../../../../../messages/en/teams.json';
import common from '../../../../../messages/en/common.json';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AgentSectionProvider } from '../../context/agentSection';

// The sheet also opens for the test chat. It offers saving only to a viewer who may
// change the agent: a role that edits agents, on an agent whose projects they all share.
const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'Node',
  'NodeFilter',
  'DocumentFragment',
  'Element',
  'HTMLElement',
  'HTMLButtonElement',
  'HTMLFormElement',
  'ResizeObserver',
  'SVGElement',
  'ShadowRoot',
  'Event',
  'CustomEvent',
  'MouseEvent',
  'KeyboardEvent',
  'MutationObserver',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'IS_REACT_ACT_ENVIRONMENT',
  'fetch',
] as const;

let dom: JSDOM;
let root: Root;
let originals: Map<string, PropertyDescriptor | undefined>;

const agent = (canManage: boolean): AiAgent => ({
  id: 4,
  teamId: 1,
  projects: [{ id: 1, key: 'MKT', ref: 'MKT', name: 'Marketing' }],
  userId: 'bot',
  name: 'Bot',
  username: 'bot',
  kind: 'internal',
  modelCredentialId: null,
  model: null,
  instructions: null,
  tools: [],
  temperature: null,
  reasoningEffort: null,
  maxSteps: null,
  runTimeoutSec: null,
  memoryEnabled: false,
  memoryLastMessages: null,
  triggerOnMention: false,
  triggerOnAssign: false,
  fieldTriggers: [],
  delegationDelaySec: 0,
  ownerUserId: null,
  ownerName: null,
  runnerScope: 'team',
  lastSeenAt: null,
  invocationUrl: null,
  createdAt: new Date(0).toISOString(),
  apiKeyStart: null,
  modelProvider: null,
  actionCount: 0,
  skillCount: 0,
  toolCount: 0,
  canManage,
  chatEnabled: true,
});

async function render(row: AiAgent, edit = true) {
  const { AgentSheetForm } = await import('./AgentSheetForm');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" messages={{ teams, common }} timeZone="UTC">
          <AgentSectionProvider
            teamId={1}
            permissions={{ read: true, create: true, edit, delete: true }}
          >
            <AgentSheetForm agent={row} onCreated={() => {}} />
          </AgentSectionProvider>
        </NextIntlClientProvider>
      </QueryClientProvider>,
    ),
  );
}

const saveButton = () =>
  [...document.querySelectorAll('button[type="submit"]')].find((b) =>
    b.textContent?.includes(teams.agents.save),
  );

beforeEach(async () => {
  originals = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://example.test/',
    pretendToBeVisual: true,
  });
  Object.assign(dom.window, {
    __ITSAPLAN_ENV__: { apiUrl: 'http://api.test', privacyUrl: '', termsUrl: '' },
  });
  for (const name of replacedGlobals) {
    if (name in dom.window) {
      Object.defineProperty(globalThis, name, {
        configurable: true,
        value: dom.window[name as keyof typeof dom.window],
      });
    }
  }
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
    configurable: true,
    value: true,
  });
  // The agent form's switches measure themselves; jsdom has no ResizeObserver.
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: async () => Response.json({ error: 'Access denied' }, { status: 403 }),
  });
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.querySelector('#root')!);
});

afterEach(async () => {
  await act(async () => root.unmount());
  // The instructions editor tears down after the unmount; let it run while the page exists.
  await new Promise((resolve) => setTimeout(resolve, 0));
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('AgentSheetForm', () => {
  it('offers saving an agent the viewer may change', async () => {
    await render(agent(true));

    assert.ok(saveButton());
  });

  it('offers no saving on an agent the viewer may not manage', async () => {
    await render(agent(false));

    assert.equal(saveButton(), undefined);
  });

  it('offers no saving to a role that does not edit agents', async () => {
    await render(agent(true), false);

    assert.equal(saveButton(), undefined);
  });

  // An external agent calls the tools enabled on it over MCP, so its form lists them too.
  it('lists the tools of an external agent', async () => {
    serve({ '/agent-tools/options': [], '/tool-configs': [] });

    await render({ ...agent(true), kind: 'external' });
    await waitForText(teams.agents.toolsHint);

    assert.ok(document.body.textContent?.includes(teams.agents.toolsHint));
  });

  it('lists only the tools turned on for the agent', async () => {
    const issue = configuredTool(1, 'GitHub Comment Issue');
    serve({
      '/agent-tools/options': [issue, configuredTool(2, 'GitHub Create Issue')],
      '/tool-configs': [issue],
    });

    await render(agent(true));
    await openSection(teams.agents.toolsHint);
    await waitForText(teams.agents.turnedOn);

    const text = document.body.textContent ?? '';
    assert.ok(text.includes('GitHub Comment Issue'));
    assert.ok(!text.includes('GitHub Create Issue'));
  });

  it('offers adding a tool when the team has none', async () => {
    serve({ '/agent-tools/options': [], '/tool-configs': [] });

    await render(agent(true));
    await openSection(teams.agents.toolsHint);
    await waitForText(teams.tools.empty);

    assert.ok(document.body.textContent?.includes(teams.agents.addFromCatalog));
  });

  it('lists only the skills turned on for the agent', async () => {
    const triage = skill(1, 'Triage');
    serve({ '/agent-skills/options': [triage, skill(2, 'Release notes')], '/4/skills': [triage] });

    await render(agent(true));
    await openSection(teams.agents.skillsHint);
    await waitForText(teams.agents.turnedOn);

    const text = document.body.textContent ?? '';
    assert.ok(text.includes('Triage'));
    assert.ok(!text.includes('Release notes'));
  });

  it('keeps the action groups folded until one is opened', async () => {
    serve({
      '/ai-agents/tools': [
        action('create_issue', 'Create issues', false),
        action('search_issues', 'Search issues', true),
      ],
    });

    await render(agent(true));
    await openSection(teams.agents.actionsHint);
    await waitForText(teams.agents.summaryReadOnly);

    assert.ok(!document.body.textContent?.includes('Create issues'));
    await openSection(teams.agents.summaryReadOnly);
    await waitForText('Create issues');
    assert.ok(document.body.textContent?.includes('Create issues'));
  });

  it('lists only the projects the agent works in', async () => {
    serve({
      '/projects/options': [
        { id: 1, key: 'MKT', ref: 'MKT', name: 'Marketing', mcpEnabled: false },
        { id: 2, key: 'OPS', ref: 'OPS', name: 'Operations', mcpEnabled: false },
      ],
    });

    await render(agent(true));
    await openSection(teams.agents.projectsHint);
    await waitForText(teams.agents.worksIn);

    const text = document.body.textContent ?? '';
    assert.ok(text.includes('Marketing'));
    assert.ok(!text.includes('Operations'));
  });
});

function configuredTool(id: number, label: string): ConfiguredTool {
  return {
    id,
    teamId: 1,
    toolKey: `github_${id}`,
    credentialId: 3,
    integrationKey: 'github',
    credentialLabel: 'Itsaplan',
    label,
    description: null,
    source: null,
    supported: true,
    createdAt: new Date(0).toISOString(),
  };
}

function action(key: string, label: string, always: boolean): AgentTool {
  return { key, group: 'issues', label, description: label, always };
}

function skill(id: number, name: string): AgentSkill {
  return {
    id,
    teamId: 1,
    name,
    description: '',
    source: 'inline',
    sourceUrl: null,
    files: [],
    createdAt: new Date(0).toISOString(),
  };
}

// The team, and each route whose path ends with a key of `routes`; every other route refuses.
function serve(routes: Record<string, unknown>) {
  const all = { read: true, create: true, edit: true, delete: true };
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: async (input: RequestInfo | URL) => {
      const path = new URL(input instanceof Request ? input.url : String(input)).pathname;
      if (path.endsWith('/teams/1')) {
        return Response.json({
          id: 1,
          name: 'Team',
          permissions: { ai_agents: all, agent_skills: all, agent_tools: all, integrations: all },
        });
      }
      const route = Object.keys(routes).find((suffix) => path.endsWith(suffix));
      if (route) return Response.json(routes[route]);
      return Response.json({ error: 'Access denied' }, { status: 403 });
    },
  });
}

// The form's sections and its action groups start closed; each opens from the button that
// holds `text`: a section's hint, a group's summary.
async function openSection(text: string) {
  await waitForText(text);
  const header = [...document.querySelectorAll('button')].find((b) =>
    b.textContent?.includes(text),
  );
  await act(async () => header?.click());
}

async function waitForText(text: string) {
  for (let i = 0; i < 20 && !document.body.textContent?.includes(text); i++) {
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
  }
}
