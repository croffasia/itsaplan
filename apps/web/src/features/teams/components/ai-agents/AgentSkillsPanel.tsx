import { useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSkillOptionsQuery } from '@/services/agentSkills.service';
import { useTeamQuery } from '@/services/teams.service';
import { Button } from '@/components/ui/button';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { SkillCreateDialog } from '../agent-skills/SkillCreateDialog';
import { AgentEmptyNotice } from './AgentEmptyNotice';
import { AgentLoadFailed } from './AgentLoadFailed';
import { AgentPickList } from './AgentPickList';
import { AgentPickerFooter } from './AgentPickerFooter';

// The Skills section of an internal agent's editor: the team's skills the agent may load. A
// skill created from here is turned on for the agent at once.
export function AgentSkillsPanel({
  teamId,
  selected,
  onToggle,
}: {
  teamId: number;
  selected: number[];
  onToggle: (ids: number[], on: boolean) => void;
}) {
  const t = useTranslations('teams.agents');
  const tSkills = useTranslations('teams.skills');
  const team = useTeamQuery(teamId).data;
  const library = useSkillOptionsQuery(teamId);
  const skills = library.data ?? [];
  const [creating, setCreating] = useState(false);
  const canAdd = team?.permissions.agent_skills.create ?? false;

  const createButton = (className: string, close?: () => void) => (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className={className}
      onClick={() => {
        close?.();
        setCreating(true);
      }}
    >
      <Plus className="size-3.5" />
      {tSkills('create')}
    </Button>
  );

  let body;
  if (library.isPending) {
    body = <ListSkeleton rows={3} rowClassName="h-8" />;
  } else if (library.isError) {
    body = <AgentLoadFailed title={t('skillsLoadFailed')} onRetry={() => void library.refetch()} />;
  } else if (skills.length === 0) {
    body = (
      <AgentEmptyNotice
        icon={Sparkles}
        title={t('noSkills')}
        hint={t(canAdd ? 'skillsEmptyHint' : 'skillsEmptyAsk')}
      >
        {canAdd && createButton('-ms-3 h-8 gap-1.5')}
      </AgentEmptyNotice>
    );
  } else {
    body = (
      <AgentPickList
        items={skills.map((skill) => ({
          id: skill.id,
          name: skill.name,
          description: skill.description,
        }))}
        selected={selected}
        onToggle={onToggle}
        heading={t('turnedOn')}
        chooseLabel={t('chooseSkills')}
        noneText={t('noSkillsOn')}
        searchPlaceholder={t('searchSkills')}
        removeLabel={(name) => t('turnOff', { name })}
        footer={(close) =>
          canAdd && (
            <AgentPickerFooter>
              {createButton('h-8 w-full justify-start gap-1.5', close)}
            </AgentPickerFooter>
          )
        }
      />
    );
  }

  return (
    <>
      {body}
      {creating && team && (
        <SkillCreateDialog
          teamId={teamId}
          teamName={team.name}
          onCreated={(created) =>
            onToggle(
              created.map((skill) => skill.id),
              true,
            )
          }
          onClose={() => setCreating(false)}
        />
      )}
    </>
  );
}
