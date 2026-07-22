'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Bot, RotateCw } from 'lucide-react';
import type { AiAgent } from '@/lib/api';
import type { ChatMessage, ChatStatus } from '@/hooks/useAgentChat';
import { AgentChatTranscript } from './AgentChatTranscript';
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

// The running transcript and the composer for one agent conversation. The
// conversation state lives above this panel (in the agent chat host), so it is
// presentational: it renders what it is given and reports sends. The agent's
// replies stream in and render as markdown; the user's own turns render as plain
// text.
export function AgentChatPanel({
  agent,
  messages,
  status,
  activeTool,
  onSend,
  onReset,
  hasEarlierMessages,
  isLoadingEarlier,
  onLoadEarlier,
}: {
  agent: AiAgent;
  messages: ChatMessage[];
  status: ChatStatus;
  activeTool: string | null;
  onSend: (prompt: string) => void;
  onReset?: () => void;
  hasEarlierMessages?: boolean;
  isLoadingEarlier?: boolean;
  onLoadEarlier?: () => void;
}) {
  const [input, setInput] = useState('');
  const isStreaming = status === 'streaming';

  // The textarea is disabled while a reply streams, which drops focus. Restore it
  // once streaming ends so the user can keep typing without clicking back in.
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wasStreaming = useRef(false);
  useEffect(() => {
    if (wasStreaming.current && !isStreaming) textareaRef.current?.focus();
    wasStreaming.current = isStreaming;
  }, [isStreaming]);

  function submit() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    onSend(text);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <MessageScrollerProvider>
        <div className="min-h-0 flex-1 overflow-hidden">
          {messages.length === 0 ? (
            <Empty className="h-full">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Bot />
                </EmptyMedia>
                <EmptyTitle>Chat with {agent.name}</EmptyTitle>
                <EmptyDescription>
                  Send a message to test how this agent replies and which tools it uses.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <AgentChatTranscript
              messages={messages}
              isStreaming={isStreaming}
              activeTool={activeTool}
              hasEarlierMessages={hasEarlierMessages}
              isLoadingEarlier={isLoadingEarlier}
              onLoadEarlier={onLoadEarlier}
            />
          )}
        </div>

        <div className="p-4 pt-2">
          <form
            className="mx-auto w-full max-w-3xl"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <InputGroup className="rounded-xl">
              <InputGroupTextarea
                ref={textareaRef}
                className="max-h-40 min-h-10 py-2.5"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder={`Message ${agent.name}…`}
                disabled={isStreaming}
                rows={1}
              />
              <InputGroupAddon align="block-end">
                {onReset && (
                  <InputGroupButton
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-lg text-muted-foreground hover:text-foreground"
                    title="Reset conversation"
                    disabled={isStreaming || messages.length === 0}
                    onClick={onReset}
                  >
                    <RotateCw />
                    <span className="sr-only">Reset conversation</span>
                  </InputGroupButton>
                )}
                <InputGroupButton
                  type="submit"
                  variant="default"
                  size="icon-sm"
                  className="ml-auto rounded-lg"
                  disabled={!input.trim() || isStreaming}
                >
                  <ArrowUp />
                  <span className="sr-only">Send</span>
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </form>
        </div>
      </MessageScrollerProvider>
    </div>
  );
}
