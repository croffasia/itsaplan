import { useState } from 'react';
import { Wrench } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useToolSources } from '@/cloud';
import type { IntegrationMeta } from '@/lib/api/endpoints/integrations';
import { useConfiguredToolOptionsQuery } from '@/services/customTools.service';
import { useTeamQuery } from '@/services/teams.service';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { useAgentToolViews } from '../../hooks/useAgentToolViews';
import { ToolConfigDialog } from '../agent-tools/ToolConfigDialog';
import { AgentEmptyNotice } from './AgentEmptyNotice';
import { AgentLoadFailed } from './AgentLoadFailed';
import { AgentPickList } from './AgentPickList';
import { AgentPickerFooter } from './AgentPickerFooter';
import { AgentToolAddActions } from './AgentToolAddActions';
import { AgentToolIcon } from './AgentToolIcon';

// The Tools section of the agent editor: the team's configured tools the agent may call, in
// its runs or, for an external agent, over MCP. A tool added to the team from here is turned
// on for the agent at once.
export function AgentToolsPanel({
  teamId,
  catalog,
  selected,
  onToggle,
}: {
  teamId: number;
  catalog: IntegrationMeta[];
  selected: number[];
  onToggle: (ids: number[], on: boolean) => void;
}) {
  const t = useTranslations('teams.agents');
  const tTools = useTranslations('teams.tools');
  const team = useTeamQuery(teamId).data;
  const library = useConfiguredToolOptionsQuery(teamId);
  const sources = useToolSources();
  const views = useAgentToolViews(library.data ?? [], catalog, sources);
  const [adding, setAdding] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const editor = sources.find((one) => one.kind === 'source' && one.key === creating);
  const canAdd = team?.permissions.agent_tools.create ?? false;

  const addButtons = (className: string, close?: () => void) => (
    <AgentToolAddActions
      sources={sources}
      className={className}
      onAdd={() => {
        close?.();
        setAdding(true);
      }}
      onCreate={(source) => {
        close?.();
        setCreating(source);
      }}
    />
  );

  let body;
  if (library.isPending) {
    body = <ListSkeleton rows={3} rowClassName="h-8" />;
  } else if (library.isError) {
    body = <AgentLoadFailed title={t('toolsLoadFailed')} onRetry={() => void library.refetch()} />;
  } else if (views.length === 0) {
    body = (
      <AgentEmptyNotice
        icon={Wrench}
        title={tTools('empty')}
        hint={t(canAdd ? 'toolsEmptyHint' : 'toolsEmptyAsk')}
      >
        {canAdd && addButtons('-ms-3 flex flex-wrap gap-1')}
      </AgentEmptyNotice>
    );
  } else {
    body = (
      <AgentPickList
        items={views.map((view) => ({
          id: view.tool.id,
          name: view.name,
          group: view.group,
          note: view.group,
          icon: (className) => <AgentToolIcon view={view} className={className} />,
          description: view.tool.description,
          search: view.search,
          warning: view.warning,
        }))}
        selected={selected}
        onToggle={onToggle}
        heading={t('turnedOn')}
        chooseLabel={t('chooseTools')}
        noneText={t('noToolsOn')}
        searchPlaceholder={t('searchTools')}
        removeLabel={(name) => t('turnOff', { name })}
        footer={(close) =>
          canAdd && (
            <AgentPickerFooter>
              {addButtons('flex flex-col [&>button]:w-full [&>button]:justify-start', close)}
            </AgentPickerFooter>
          )
        }
      />
    );
  }

  return (
    <>
      {body}
      {/* The dialogs are portaled out of the agent form in the page but not in React, so a
          form inside one would submit the agent form too. */}
      <div className="contents" onSubmit={(e) => e.stopPropagation()}>
        {adding && team && (
          <ToolConfigDialog
            teamId={teamId}
            teamName={team.name}
            canAddCredential={team.permissions.integrations.create}
            catalog={catalog}
            onAdded={(tools) =>
              onToggle(
                tools.map((tool) => tool.id),
                true,
              )
            }
            onClose={() => setAdding(false)}
          />
        )}
        {editor?.kind === 'source' && (
          <editor.Editor
            teamId={teamId}
            tool={null}
            onCreated={(toolId) => onToggle([toolId], true)}
            onClose={() => setCreating(null)}
          />
        )}
      </div>
    </>
  );
}
