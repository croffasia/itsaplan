'use client';

import { useRef, useState, type ReactNode } from 'react';
import { ArrowUp, Bot, Paperclip, RotateCw, Square, X } from 'lucide-react';
import { uploadChatAttachment, type ChatAttachment } from '@/lib/api';
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

const MAX_ATTACHMENTS = 10;

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
  composerEnd,
  hasEarlierMessages,
  isLoadingEarlier,
  onLoadEarlier,
  projectKey,
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
  // Rendered at the end of that row, before the stop and send buttons.
  composerEnd?: ReactNode;
  hasEarlierMessages?: boolean;
  isLoadingEarlier?: boolean;
  onLoadEarlier?: () => void;
  // Given, the composer offers attaching a file for the agent to work with (to
  // import issues from, or to read).
  projectKey?: string;
}) {
  const t = useTranslations('common.agentChat');
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // An external agent answers on its runner, so with none polling the message would sit
  // in the queue with nothing to take it. The composer says so instead of accepting it.
  // A message typed while the agent is answering is not refused — it waits its turn.
  const runnerOffline = agent.kind === 'external' && !isRunnerOnline(agent);
  const canSend = input.trim().length > 0 && !runnerOffline;

  function submit() {
    const text = input.trim();
    if (!canSend) return;
    setInput('');
    // The attached files ride along as text the agent reads; each id is what its
    // read_chat_attachment tool takes. The transcript renders a marker as the
    // file name with a download link (see lib/markdown.ts).
    const marker = attachments
      .map((a) => `[file: "${a.filename}" (attachment id: ${a.id})]`)
      .join('\n');
    setAttachments([]);
    onSend(marker ? `${text}\n\n${marker}` : text);
  }

  // The upload route takes one file per request, so a multi-file pick is sent as
  // one request each and a file that fails does not lose the ones that succeeded.
  async function attach(files: FileList | null) {
    const picked = Array.from(files ?? []);
    if (picked.length === 0 || uploading) return;
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (attachments.length + picked.length > MAX_ATTACHMENTS) {
      setUploadError(t('tooManyAttachments', { max: MAX_ATTACHMENTS }));
      return;
    }
    setUploading(true);
    setUploadError(null);
    const results = await Promise.allSettled(
      picked.map((file) => uploadChatAttachment(projectKey!, file)),
    );
    const uploaded: ChatAttachment[] = [];
    const failed: string[] = [];
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        uploaded.push(result.value);
      } else {
        const reason = result.reason;
        failed.push(
          `${picked[i].name}: ${reason instanceof Error ? reason.message : t('uploadFailed')}`,
        );
      }
    });
    setAttachments((current) => [...current, ...uploaded]);
    setUploadError(failed.length > 0 ? failed.join('; ') : null);
    setUploading(false);
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
            {(attachments.length > 0 || uploadError) && (
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                {attachments.map((a) => (
                  <span
                    key={a.id}
                    className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
                    dir="auto"
                  >
                    {a.filename}
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      title={t('removeAttachment')}
                      onClick={() =>
                        setAttachments((current) => current.filter((x) => x.id !== a.id))
                      }
                    >
                      <X className="size-3" />
                      <span className="sr-only">{t('removeAttachment')}</span>
                    </button>
                  </span>
                ))}
                {uploadError && (
                  <span className="w-full text-xs text-destructive">{uploadError}</span>
                )}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv,.docx,.pdf,.md,.txt"
              multiple
              className="hidden"
              onChange={(e) => void attach(e.target.files)}
            />
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
                // `input` — this group holds a textarea. A control of the row that
                // opens a popover keeps this row as its React parent while rendering
                // into a portal, so its clicks arrive here too: refocusing on those
                // would pull the focus out of the popover and close it.
                onClick={(e) => {
                  if (!e.currentTarget.contains(e.target as Node)) return;
                  if ((e.target as HTMLElement).closest('button')) return;
                  e.currentTarget.parentElement?.querySelector('textarea')?.focus();
                }}
              >
                {composerStart}
                {projectKey && (
                  <InputGroupButton
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="rounded-md text-muted-foreground hover:text-foreground"
                    title={t('attachFile')}
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip />
                    <span className="sr-only">{t('attachFile')}</span>
                  </InputGroupButton>
                )}
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
                  {composerEnd}
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
