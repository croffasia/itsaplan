import Link from 'next/link';
import { Bot, Cpu } from 'lucide-react';
import type { AiAgent } from '@/lib/api';
import { aiAgentsPath } from '@/utils/paths';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function AiChatExternalConversation({
  projectKey,
  agent,
}: {
  projectKey: string;
  agent: AiAgent;
}) {
  const main = agent.name.toLowerCase() === 'bob' || agent.username === 'bob-agent';

  return (
    <div className="flex h-full min-h-[38rem] flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex items-center gap-3 border-b px-5 py-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Bot className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{agent.name}</span>
            {main && <Badge variant="secondary">Main assistant</Badge>}
          </div>
          <p className="truncate text-xs text-muted-foreground">@{agent.username} · External</p>
        </div>
        <Badge variant="outline" className="gap-1.5 text-emerald-600 dark:text-emerald-400">
          <span className="size-1.5 rounded-full bg-emerald-500" /> API ready
        </Badge>
      </div>

      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <div className="max-w-md">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl border bg-muted/40">
            <Cpu className="size-5 text-muted-foreground" />
          </span>
          <h2 className="mt-4 text-lg font-semibold">Configure a dashboard chat model</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {agent.name}&apos;s external API connection remains active. Select an LLM credential and
            model to add secure, streamed dashboard conversations with project-scoped tools.
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link href={aiAgentsPath(projectKey)}>Configure chat model</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
