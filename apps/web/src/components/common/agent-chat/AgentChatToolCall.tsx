'use client';

import { Wrench } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AiChatToolPart } from '@/lib/api';
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker';
import AgentChatToolBlock from './AgentChatToolBlock';
import AgentChatToolDisclosure from './AgentChatToolDisclosure';

// One tool call, opening to what it was given and what it answered.
export default function AgentChatToolCall({
  tool,
  label,
  withIcon = false,
}: {
  tool: AiChatToolPart;
  label: string;
  withIcon?: boolean;
}) {
  const t = useTranslations('common.agentChat');

  if (!tool.args && !tool.result) {
    return (
      <Marker className="min-h-8">
        {withIcon && (
          <MarkerIcon className="size-3.5">
            <Wrench className="size-3.5" />
          </MarkerIcon>
        )}
        <MarkerContent>{label}</MarkerContent>
      </Marker>
    );
  }

  return (
    <AgentChatToolDisclosure label={label} withIcon={withIcon}>
      <div className="flex flex-col gap-2 pt-1 pb-2">
        {tool.args && <AgentChatToolBlock label={t('toolInput')} text={tool.args} />}
        {tool.result && <AgentChatToolBlock label={t('toolOutput')} text={tool.result} />}
      </div>
    </AgentChatToolDisclosure>
  );
}
