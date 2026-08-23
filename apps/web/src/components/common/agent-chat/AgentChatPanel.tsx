'use client';

import { useState, type ReactNode } from 'react';
import { ArrowUp, Bot, RotateCw, Square } from 'lucide-react';
import type { AiAgent } from '@/lib/api';
import type { ChatMessage, ChatStatus, PendingMessage } from '@/hooks/useAgentChat';
import { AgentChatTranscript } from './AgentChatTranscript';
import { AgentRunnerStatus } from './AgentRunnerStatus';
import { isRunnerOnline } from './runnerOnline';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { MessageScrollerProvider } from '@/components/ui/message-scroller';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group';
import { useTranslations } from 'next-intl';

// The running transcript and the composer for one agent conversation. The
// conversation state lives above this panel (in the agent chat host), so it is
// presentational: it renders what it is given and reports sends.
//
// The stop control appears next to the send button while a reply is running rather than
// in its place: a message typed meanwhile is still queued for the next turn.
export function AgentChatPanel({
  agent,
  messages,
  status,
  activeTool,
  pending,
  onSend,
  onStop,
  onRemovePending,
  onReset,
  composerStart,
  hasEarlierMessages,
  isLoadingEarlier,
  onLoadEarlier,
}: {
  agent: AiAgent;
  messages: ChatMessage[];
  status: ChatStatus;
  activeTool: string | null;
  pending: PendingMessage[];
  onSend: (prompt: string) => void;
  onStop: () => void;
  onRemovePending: (id: string) => void;
  onReset?: () => void;
  // Rendered at the start of the composer's button row, before the panel's own
  // buttons.
  composerStart?: ReactNode;
  hasEarlierMessages?: boolean;
  isLoadingEarlier?: boolean;
  onLoadEarlier?: () => void;
}) {
  const t = useTranslations('common.agentChat');
  const [input, setInput] = useState('');
  // An external agent answers on its runner, so with none polling the message would sit
  // in the queue with nothing to take it. The composer says so instead of accepting it.
  // A message typed while the agent is answering is not refused — it waits its turn.
  const runnerOffline = agent.kind === 'external' && !isRunnerOnline(agent);
  const canSend = input.trim().length > 0 && !runnerOffline;

  function submit() {
    const text = input.trim();
    if (!canSend) return;
    setInput('');
    onSend(text);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <MessageScrollerProvider>
        <div className="min-h-0 flex-1 overflow-hidden">
          {messages.length === 0 && pending.length === 0 ? (
            <Empty className="h-full">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Bot />
                </EmptyMedia>
                <EmptyTitle>{t('title', { agent: agent.name })}</EmptyTitle>
                <EmptyDescription>{t('emptyHint')}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <AgentChatTranscript
              messages={messages}
              status={status}
              activeTool={activeTool}
              pending={pending}
              onRemovePending={onRemovePending}
              hasEarlierMessages={hasEarlierMessages}
              isLoadingEarlier={isLoadingEarlier}
              onLoadEarlier={onLoadEarlier}
            />
          )}
        </div>

        <div className="chat-composer px-3 pt-2 pb-3">
          {runnerOffline && (
            <div className="mx-auto mb-2 flex w-full max-w-3xl flex-wrap items-center gap-x-2 gap-y-0.5">
              <AgentRunnerStatus agent={agent} />
              <span className="text-xs text-muted-foreground">{t('runnerOfflineHint')}</span>
            </div>
          )}
          <form
            className="mx-auto w-full max-w-3xl"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <InputGroup className="rounded-2xl border-transparent bg-muted has-[[data-slot=input-group-control]:focus-visible]:border-transparent has-[[data-slot=input-group-control]:focus-visible]:ring-0 dark:bg-muted/50">
              <InputGroupTextarea
                // `auto` once there is something to read, so a message keeps the
                // script it was typed in. An empty box has nothing to read from.
                dir={input ? 'auto' : undefined}
                className="max-h-[calc(5lh+1.25rem)] min-h-9 px-3.5 py-2.5"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  if (e.metaKey || e.ctrlKey) {
                    e.preventDefault();
                    // Written into the field rather than appended to the state, so the
                    // break lands where the caret is and the browser keeps its undo.
                    const field = e.currentTarget;
                    field.setRangeText('\n', field.selectionStart, field.selectionEnd, 'end');
                    setInput(field.value);
                    return;
                  }
                  if (e.shiftKey) return;
                  e.preventDefault();
                  submit();
                }}
                placeholder={
                  runnerOffline
                    ? t('runnerOffline')
                    : t('messagePlaceholder', { agent: agent.name })
                }
                disabled={runnerOffline}
                rows={1}
              />
              <InputGroupAddon
                align="block-end"
                className="gap-1 px-2.5 pb-2"
                // The row carries a text cursor, and its own handler focuses an
                // `input` — this group holds a textarea.
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('button')) return;
                  e.currentTarget.parentElement?.querySelector('textarea')?.focus();
                }}
              >
                {composerStart}
                {onReset && (
                  <InputGroupButton
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="rounded-md text-muted-foreground hover:text-foreground"
                    title={t('reset')}
                    disabled={status !== 'ready' || messages.length === 0}
                    onClick={onReset}
                  >
                    <RotateCw />
                    <span className="sr-only">{t('reset')}</span>
                  </InputGroupButton>
                )}
                <div className="ms-auto flex items-center gap-1">
                  {status !== 'ready' && (
                    <InputGroupButton
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="rounded-full"
                      title={t('stop')}
                      onClick={onStop}
                    >
                      <Square className="fill-current" />
                      <span className="sr-only">{t('stop')}</span>
                    </InputGroupButton>
                  )}
                  <InputGroupButton
                    type="submit"
                    // Solid only once the message can go, so the button reads as the
                    // state of the composer and not as an always-armed action.
                    variant={canSend ? 'default' : 'secondary'}
                    size="icon-sm"
                    className="rounded-full"
                    title={t('sendHint')}
                    disabled={!canSend}
                  >
                    <ArrowUp />
                    <span className="sr-only">{t('send')}</span>
                  </InputGroupButton>
                </div>
              </InputGroupAddon>
            </InputGroup>
          </form>
        </div>
      </MessageScrollerProvider>
    </div>
  );
}
