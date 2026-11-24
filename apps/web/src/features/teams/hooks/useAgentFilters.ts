import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AiAgent } from '@/lib/api/endpoints/agents';
import type { FilterOption, FilterSection } from '@/components/common/filters/FilterMenu';

type AgentFilter = Omit<FilterSection, 'selected'> & {
  matches: (agent: AiAgent, value: string) => boolean;
};

// The search and the filter over a team's agents. The list is loaded whole, so both run
// here rather than on the server. An agent is listed when it matches the search and, in
// every section in use, at least one ticked value. A ticked value that no agent offers
// any more (its project left every agent) stops counting.
export function useAgentFilters(
  agents: AiAgent[],
  providerLabel: (key: string) => string,
  defaultIds: number[],
) {
  const t = useTranslations('teams.agents');
  const [search, setSearch] = useState('');
  const [ticked, setTicked] = useState<Record<string, string[]>>({});

  const projects = new Map<string, FilterOption & { count: number }>();
  for (const agent of agents) {
    for (const project of agent.projects) {
      const option = projects.get(String(project.id)) ?? {
        value: String(project.id),
        label: project.key,
        detail: project.name,
        count: 0,
      };
      option.count += 1;
      projects.set(option.value, option);
    }
  }
  const providers = [
    ...new Set(agents.flatMap((agent) => (agent.modelProvider ? [agent.modelProvider] : []))),
  ];

  const filters: AgentFilter[] = [
    {
      key: 'kind',
      label: t('kind'),
      options: [
        { value: 'internal', label: t('kindLabel.internal') },
        { value: 'external', label: t('kindLabel.external') },
      ],
      matches: (agent, value) => agent.kind === value,
    },
    {
      key: 'project',
      label: t('projects'),
      options: [...projects.values()].sort((a, b) => a.label.localeCompare(b.label)),
      matches: (agent, value) => agent.projects.some((p) => String(p.id) === value),
    },
    {
      key: 'trigger',
      label: t('columns.triggers'),
      options: [
        { value: 'mention', label: t('triggerMention') },
        { value: 'delegation', label: t('triggerDelegation') },
        { value: 'field', label: t('triggerField') },
      ],
      matches: (agent, value) => {
        switch (value) {
          case 'mention':
            return agent.triggerOnMention;
          case 'delegation':
            return agent.triggerOnAssign;
          default:
            return agent.fieldTriggers.length > 0;
        }
      },
    },
    {
      key: 'provider',
      label: t('provider'),
      options: providers.map((key) => ({ value: key, label: providerLabel(key) })),
      matches: (agent, value) => agent.modelProvider === value,
    },
    {
      key: 'newProjects',
      label: t('projectDefaultsColumn'),
      options: [
        { value: 'on', label: t('joinsNewProjects') },
        { value: 'off', label: t('skipsNewProjects') },
      ],
      matches: (agent, value) => defaultIds.includes(agent.id) === (value === 'on'),
    },
  ];

  const sections = filters.map((filter) => ({
    ...filter,
    selected: (ticked[filter.key] ?? []).filter((v) => filter.options.some((o) => o.value === v)),
  }));
  const q = search.trim().toLowerCase();
  const filtered = agents.filter(
    (agent) =>
      (!q ||
        [agent.name, agent.username, agent.model ?? ''].some((s) => s.toLowerCase().includes(q))) &&
      sections.every(
        (section) =>
          section.selected.length === 0 ||
          section.selected.some((value) => section.matches(agent, value)),
      ),
  );

  return {
    search,
    setSearch,
    sections,
    setFilter: (key: string, selected: string[]) =>
      setTicked((prev) => ({ ...prev, [key]: selected })),
    filtered,
    // The project ids ticked, which the rows show first.
    projectIds: sections.find((section) => section.key === 'project')?.selected ?? [],
  };
}
