import Link from 'next/link';
import {
  ArrowRight,
  AtSign,
  BookOpen,
  Bot,
  MessageSquare,
  Sparkles,
  Wrench,
  Zap,
} from 'lucide-react';
import type { AiAgent } from '@/lib/api';
import { aiAgentsPath, aiChatPath } from '@/utils/paths';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { isMainAssistant } from '../utils/agents';

function agentModelDescription(agent: AiAgent, providerLabel: (key: string) => string): string {
  if (agent.model) {
    return agent.modelProvider
      ? `${agent.model} · ${providerLabel(agent.modelProvider)}`
      : agent.model;
  }
  if (agent.kind === 'external' && agent.apiKeyStart) return 'API connected agent';
  return agent.kind === 'external' ? 'API key setup required' : 'Model setup required';
}

export default function AgentCard({
  agent,
  projectKey,
  providerLabel,
}: {
  agent: AiAgent;
  projectKey: string;
  providerLabel: (key: string) => string;
}) {
  const main = isMainAssistant(agent);
  const ready = agent.kind === 'internal' ? agent.model != null : agent.apiKeyStart != null;
  const model = agentModelDescription(agent, providerLabel);

  return (
    <article className="group flex min-h-64 flex-col rounded-xl border bg-card p-5 shadow-sm transition-[border-color,box-shadow] hover:border-foreground/20 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
            <Bot className="size-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">{agent.name}</h2>
              {main && <Badge className="bg-primary/10 text-primary">Main assistant</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">@{agent.username}</p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase">
          <span
            className={
              ready ? 'size-2 rounded-full bg-emerald-500' : 'size-2 rounded-full bg-amber-500'
            }
          />
          {ready ? 'Ready' : 'Setup'}
        </span>
      </div>

      <p className="mt-5 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
        {agent.instructions?.trim() ||
          (main
            ? 'Main project assistant for conversations, delegated work, and connected tools.'
            : 'Project agent available for configured tasks and workflows.')}
      </p>

      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="size-3.5" />
        <span className="truncate">{model}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
          <Zap className="size-3" /> {agent.actionCount} actions
        </span>
        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
          <Wrench className="size-3" /> {agent.toolCount} tools
        </span>
        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
          <BookOpen className="size-3" /> {agent.skillCount} skills
        </span>
        {agent.triggerOnMention && (
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
            <AtSign className="size-3" /> Mention
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between border-t pt-4">
        <Badge variant="outline" className="capitalize">
          {agent.kind}
        </Badge>
        <Button asChild variant="ghost" size="sm" className="text-primary hover:text-primary">
          <Link
            href={agent.kind === 'internal' ? aiChatPath(projectKey) : aiAgentsPath(projectKey)}
          >
            {agent.kind === 'internal' ? <MessageSquare /> : null}
            {agent.kind === 'internal' ? 'Open chat' : 'Manage'}
            <ArrowRight />
          </Link>
        </Button>
      </div>
    </article>
  );
}
