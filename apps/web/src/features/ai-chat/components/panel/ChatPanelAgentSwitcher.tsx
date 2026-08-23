'use client';

import { Bot, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AiAgent } from '@/lib/api';
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { InputGroupButton } from '@/components/ui/input-group';
import { AiChatAgentMenu } from '../shared/AiChatAgentMenu';

// The agent of the session, next to its composer. It takes no selection while a reply
// is running: that answer belongs to the agent that is producing it.
export function ChatPanelAgentSwitcher({
  agents,
  selected,
  providerLabel,
  disabled,
  onSelect,
}: {
  agents: AiAgent[];
  selected: AiAgent;
  providerLabel: (key: string) => string;
  disabled: boolean;
  onSelect: (agentId: number) => void;
}) {
  const t = useTranslations('aiChat');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <InputGroupButton
          type="button"
          variant="ghost"
          size="xs"
          className="max-w-44 rounded-md text-muted-foreground hover:text-foreground"
          title={t('agents')}
        >
          <Bot className="shrink-0" />
          <span className="truncate">{selected.name}</span>
          <ChevronDown className="shrink-0 opacity-60" />
        </InputGroupButton>
      </DropdownMenuTrigger>
      <AiChatAgentMenu
        agents={agents}
        selectedId={selected.id}
        providerLabel={providerLabel}
        onSelect={onSelect}
      />
    </DropdownMenu>
  );
}
