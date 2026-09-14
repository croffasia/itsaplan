'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import { aiAgentsPath } from '@/utils/paths';
import { useAgentFleetSummaryQuery, useAiAgentsQuery } from '@/services/aiAgents.service';
import { useIntegrationCatalogQuery } from '@/services/integrations.service';
import { Button } from '@/components/ui/button';
import SectionPageView from '@/components/common/page/SectionPageView';
import { EmptyState } from '@/components/common/page/EmptyState';
import AgentsFleetSummary from './components/AgentsFleetSummary';
import AgentsFilterBar from './components/AgentsFilterBar';
import AgentsRoster from './components/AgentsRoster';
import AgentsPageSkeleton from './components/AgentsPageSkeleton';
import { filterAgents, type AgentFilter } from './utils/agents';

export default function AgentsPage() {
  const { project } = useShell();
  const { can } = usePermissions();
  const projectKey = project?.project.key ?? null;
  const [timezone] = useState(() =>
    typeof window === 'undefined' ? 'UTC' : Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const agentsQuery = useAiAgentsQuery(projectKey);
  const summaryQuery = useAgentFleetSummaryQuery(projectKey, timezone);
  const catalog = useIntegrationCatalogQuery(projectKey).data ?? [];
  const [filter, setFilter] = useState<AgentFilter>('all');
  const [search, setSearch] = useState('');

  if (!project) return null;

  if (!can('ai_agents', 'read')) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
        You do not have access to AI agents in this project.
      </div>
    );
  }

  const agents = agentsQuery.data ?? [];
  const visibleAgents = filterAgents(agents, filter, search);
  const counts = {
    all: agents.length,
    internal: agents.filter((agent) => agent.kind === 'internal').length,
    external: agents.filter((agent) => agent.kind === 'external').length,
  };
  const providerLabel = (key: string) => catalog.find((entry) => entry.key === key)?.label ?? key;

  let content = <AgentsPageSkeleton />;

  if (agentsQuery.isError || summaryQuery.isError) {
    content = (
      <EmptyState
        title="Agents could not be loaded"
        description="Check the API connection and try again."
      >
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void agentsQuery.refetch();
            void summaryQuery.refetch();
          }}
        >
          Try again
        </Button>
      </EmptyState>
    );
  } else if (!agentsQuery.isLoading && !summaryQuery.isLoading && agents.length === 0) {
    content = (
      <EmptyState
        title="No agents yet"
        description="Create an internal assistant or connect an external agent to this project."
      >
        {can('ai_agents', 'edit') && (
          <Button asChild size="sm">
            <Link href={aiAgentsPath(project.project.key)}>Create an agent</Link>
          </Button>
        )}
      </EmptyState>
    );
  } else if (agentsQuery.data && summaryQuery.data) {
    content = (
      <div className="space-y-6">
        <AgentsFleetSummary summary={summaryQuery.data} />
        <AgentsFilterBar
          filter={filter}
          search={search}
          counts={counts}
          onFilterChange={setFilter}
          onSearchChange={setSearch}
        />
        <AgentsRoster
          agents={visibleAgents}
          projectKey={project.project.key}
          providerLabel={providerLabel}
        />
      </div>
    );
  }

  return (
    <SectionPageView
      title="Agents"
      description="Your project assistants, their capabilities, and current configuration."
      actions={
        can('ai_agents', 'edit') && (
          <Button asChild size="sm">
            <Link href={aiAgentsPath(project.project.key)}>
              <Plus />
              New agent
            </Link>
          </Button>
        )
      }
      wide
    >
      {content}
    </SectionPageView>
  );
}
