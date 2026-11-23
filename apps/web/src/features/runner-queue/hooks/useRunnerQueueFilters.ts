import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { FilterSection } from '@/components/common/filters/FilterMenu';
import type { RunnerQueueScope, RunnerQueueState } from '@/lib/api/endpoints/runnerQueue';
import { useSession } from '@/lib/auth-client';
import {
  useRunInitiatorOptionsQuery,
  useRunProjectOptionsQuery,
} from '@/services/runnerQueue.service';

// The state value that filters nothing out.
const ALL = 'all';

// The run list's filters: by state, by initiator, the reader first, and, in a team's or a
// workspace's list, by project.
export function useRunnerQueueFilters(scope: RunnerQueueScope) {
  const t = useTranslations('issue.agentRuns');
  const self = useSession().data?.user;
  const [state, setState] = useState<RunnerQueueState>();
  const [initiatorIds, setInitiatorIds] = useState<string[]>([]);
  const [projectIds, setProjectIds] = useState<number[]>([]);
  const acrossProjects = scope.acrossProjects ?? false;
  const initiators = useRunInitiatorOptionsQuery(scope.api).data ?? [];
  const projects = useRunProjectOptionsQuery(scope.api, acrossProjects).data ?? [];
  const sections: FilterSection[] = [
    {
      key: 'state',
      label: t('facts.status'),
      options: [
        { value: ALL, label: t('filterAll') },
        { value: 'failed', label: t('filterFailed') },
        { value: 'active', label: t('activeSection') },
      ],
      selected: [state ?? ALL],
      defaultValue: ALL,
    },
    {
      key: 'initiators',
      label: t('facts.initiator'),
      options: [
        ...(self ? [{ value: self.id, label: t('me'), avatar: self }] : []),
        ...initiators
          .filter((person) => person.id !== self?.id)
          .map((person) => ({ value: person.id, label: person.name, avatar: person })),
      ],
      selected: initiatorIds,
    },
  ];
  if (projects.length > 1) {
    sections.push({
      key: 'projects',
      label: t('facts.project'),
      options: projects.map((project) => ({ value: String(project.id), label: project.name })),
      selected: projectIds.map(String),
    });
  }
  const onChange = (key: string, selected: string[]) => {
    if (key === 'state') {
      setState(selected[0] === ALL ? undefined : (selected[0] as RunnerQueueState));
    } else if (key === 'projects') {
      setProjectIds(selected.map(Number));
    } else {
      setInitiatorIds(selected);
    }
  };
  return { sections, onChange, state, initiatorIds, projectIds };
}
