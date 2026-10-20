import { HelpCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { API_URL } from '@/lib/api/core/client';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AgentRunnerCodeBlock } from './AgentRunnerCodeBlock';
import { AgentRunnerHelpStep } from './AgentRunnerHelpStep';

// How to build the endpoint an external agent's tasks are sent to. The snippets are
// Node, the runtime most functions (AWS Lambda, Azure Functions, Cloudflare Workers)
// are written in.

const VERIFY = `import { createHmac, timingSafeEqual } from 'node:crypto';

// header: the X-Itsaplan-Signature value; rawBody: the body exactly as it arrived.
function verify(secret, header, rawBody) {
  const { t, v1 } = Object.fromEntries(header.split(',').map((part) => part.split('=')));
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = createHmac('sha256', secret).update(\`\${t}.\${rawBody}\`).digest('hex');
  return v1?.length === expected.length && timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
}`;

const AGENT = `"agent": { "id": 12, "username": "cloud-bot" },
  "apiUrl": "${API_URL}"`;

const PAYLOADS = [
  {
    id: 'run',
    label: 'invocationHelpTabRun',
    code: `{
  "event": "agent.run",
  ${AGENT},
  "run": {
    "id": 345,
    "trigger": "status",
    "prompt": "The task, framed with what started it",
    "systemPrompt": "The project, the people, and the agent's instructions",
    "attempts": 1,
    "issueId": 678,
    "issueIdentifier": "MKT-42"
  }
}`,
  },
  {
    id: 'chat',
    label: 'invocationHelpTabChat',
    code: `{
  "event": "agent.chat",
  ${AGENT},
  "message": {
    "id": 901,
    "threadId": "chat:12:...",
    "prompt": "The person's message, after the earlier turns",
    "systemPrompt": "The projects, the person, and the agent's instructions",
    "attempts": 1,
    "sessionId": null
  }
}`,
  },
  {
    id: 'ping',
    label: 'invocationHelpTabPing',
    code: `{
  "event": "ping",
  ${AGENT}
}`,
  },
] as const;

const REPORT = `const api = (path, body = {}) =>
  fetch(\`${API_URL}\${path}\`, {
    method: 'POST',
    headers: { 'x-api-key': process.env.ITSAPLAN_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

// A task: a heartbeat at least every 5 minutes while you work, then the result.
await api(\`/agent-runs/\${payload.run.id}/heartbeat\`);
await api(\`/agent-runs/\${payload.run.id}/result\`, { status: 'success', output: 'Opened PR #12' });

// A chat message: the answer as it is written, then the end of it.
await api(\`/agent-chats/\${payload.message.id}/events\`, {
  events: [{ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'Done, PR #12 is open.' }],
});
await api(\`/agent-chats/\${payload.message.id}/result\`, { status: 'success' });`;

export function AgentInvocationHelpSheet() {
  const t = useTranslations('teams.agents');

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <HelpCircle className="size-4" />
          {t('invocationHelpOpen')}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="flex h-dvh flex-col">
        <SheetHeader>
          <SheetTitle>{t('invocationHelpTitle')}</SheetTitle>
        </SheetHeader>
        <div className="mx-auto w-full max-w-[720px] flex-1 space-y-6 overflow-y-auto px-4 pb-8">
          <AgentRunnerHelpStep n={1} title={t('invocationHelpVerify')}>
            <p className="text-xs text-muted-foreground">{t('invocationHelpVerifyHint')}</p>
            <AgentRunnerCodeBlock code={VERIFY} />
          </AgentRunnerHelpStep>

          <AgentRunnerHelpStep n={2} title={t('invocationHelpAccept')}>
            <p className="text-xs text-muted-foreground">{t('invocationHelpAcceptHint')}</p>
          </AgentRunnerHelpStep>

          <AgentRunnerHelpStep n={3} title={t('invocationHelpPayload')}>
            <p className="text-xs text-muted-foreground">{t('invocationHelpPayloadHint')}</p>
            <Tabs defaultValue="run">
              <TabsList variant="line">
                {PAYLOADS.map((p) => (
                  <TabsTrigger key={p.id} value={p.id}>
                    {t(p.label)}
                  </TabsTrigger>
                ))}
              </TabsList>
              {PAYLOADS.map((p) => (
                <TabsContent key={p.id} value={p.id} className="pt-3">
                  <AgentRunnerCodeBlock code={p.code} />
                </TabsContent>
              ))}
            </Tabs>
          </AgentRunnerHelpStep>

          <AgentRunnerHelpStep n={4} title={t('invocationHelpReport')}>
            <p className="text-xs text-muted-foreground">{t('invocationHelpReportHint')}</p>
            <AgentRunnerCodeBlock code={REPORT} />
          </AgentRunnerHelpStep>

          <AgentRunnerHelpStep n={5} title={t('invocationHelpTest')}>
            <p className="text-xs text-muted-foreground">{t('invocationHelpTestHint')}</p>
          </AgentRunnerHelpStep>
        </div>
      </SheetContent>
    </Sheet>
  );
}
