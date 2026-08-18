'use client';

import { useTranslations } from 'next-intl';
import type { AiChatToolPart } from '@/lib/api';
import AgentChatToolCall from './AgentChatToolCall';
import AgentChatToolDisclosure from './AgentChatToolDisclosure';

// The tools the agent called in one stretch of its answer. Several are folded behind a
// single row so they do not push the answer itself out of view.
export default function AgentChatToolCalls({ tools }: { tools: AiChatToolPart[] }) {
  const t = useTranslations('common.agentChat');

  if (tools.length === 1) {
    const only = tools[0]!;
    return (
      <AgentChatToolCall tool={only} label={t('usedTool', { tool: only.toolName })} withIcon />
    );
  }

  return (
    <AgentChatToolDisclosure label={t('usedTools', { count: tools.length })} withIcon>
      <ul className="flex flex-col">
        {tools.map((tool, index) => (
          <li key={tool.toolCallId || index}>
            <AgentChatToolCall tool={tool} label={tool.toolName} />
          </li>
        ))}
      </ul>
    </AgentChatToolDisclosure>
  );
}
