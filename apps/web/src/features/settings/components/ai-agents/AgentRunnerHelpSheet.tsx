import { HelpCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { API_URL } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AgentRunnerCodeBlock } from './AgentRunnerCodeBlock';
import { AgentRunnerHelpStep } from './AgentRunnerHelpStep';

// How to get a runner going, in a sheet that slides up from the bottom of the agent
// editor. It is a walkthrough rather than a field, so it stays out of the form until
// asked for.
//
// One tab per coding agent, each holding the files to copy as they stand: the MCP
// server this instance exposes, the runner config, and the line that starts it. The
// only difference between the tabs is the command being started. YOUR_KEY rather
// than <key>: next-intl parses angle brackets in a message as rich-text tags, and
// step 1 quotes the placeholder.

// The MCP server for a client that takes a JSON config file. The key comes from the
// environment the runner sets, so it is not duplicated in a second file.
const MCP_JSON = `{
  "mcpServers": {
    "itsaplan": {
      "type": "http",
      "url": "${API_URL}/mcp",
      "headers": { "Authorization": "Bearer \${ITSAPLAN_API_KEY}" }
    }
  }
}`;

// Codex takes its MCP servers from config.toml only; bearer_token_env_var reads the
// key from the environment the runner already sets.
const CODEX_TOML = `[mcp_servers.itsaplan]
url = "${API_URL}/mcp"
bearer_token_env_var = "ITSAPLAN_API_KEY"`;

// Copilot CLI reads a project's servers from .mcp.json; its headers take no variable
// interpolation, so the key is written in as it stands.
const COPILOT_MCP = `{
  "mcpServers": {
    "itsaplan": {
      "type": "http",
      "url": "${API_URL}/mcp",
      "headers": { "Authorization": "Bearer YOUR_KEY" },
      "tools": ["*"]
    }
  }
}`;

// opencode interpolates {env:VAR} in its config, so the key stays out of the file.
// The model is pinned here: without it a run falls back to the last model used
// interactively, which is not a thing a runner can rely on.
const OPENCODE_JSON = `{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-5",
  "mcp": {
    "itsaplan": {
      "type": "remote",
      "url": "${API_URL}/mcp",
      "enabled": true,
      "headers": { "Authorization": "Bearer {env:ITSAPLAN_API_KEY}" }
    }
  }
}`;

// Gemini CLI reads its MCP servers from .gemini/settings.json, expands $VARS in it,
// and takes the task on stdin; trust skips the confirmation prompt for this server,
// which a headless run has no way to answer.
const GEMINI_SETTINGS = `{
  "mcpServers": {
    "itsaplan": {
      "httpUrl": "${API_URL}/mcp",
      "headers": { "Authorization": "Bearer $ITSAPLAN_API_KEY" },
      "trust": true
    }
  }
}`;

const AGENTS = [
  {
    id: 'claude',
    label: 'Claude Code',
    // --mcp-config adds this instance's server to whatever the machine already has;
    // the operator's own servers, skills and memory stay in the run. A headless run
    // has nobody to answer a permission prompt, so it goes to auto mode, where a
    // classifier reviews each action instead — including the MCP tool calls, which
    // therefore need no allow list of their own.
    command:
      'claude -p --mcp-config ./mcp.json ' +
      '--append-system-prompt "$ITSAPLAN_SYSTEM_PROMPT" ' +
      '--permission-mode auto --output-format text',
    files: [{ name: 'mcp.json', code: MCP_JSON }],
  },
  {
    id: 'codex',
    label: 'Codex',
    // Codex has no system-prompt flag, so the run's system prompt is prepended to
    // the task; "-" is codex's own marker for "read the prompt from stdin".
    command:
      'printf \'%s\\n\\n%s\' "$ITSAPLAN_SYSTEM_PROMPT" "$(cat)" | ' +
      'codex exec --sandbox workspace-write --skip-git-repo-check -',
    files: [{ name: '~/.codex/config.toml', code: CODEX_TOML }],
  },
  {
    id: 'gemini',
    label: 'Gemini CLI',
    // Same as Codex: no system-prompt flag, so it goes in front of the task. Gemini
    // reads a piped prompt on stdin.
    command:
      'printf \'%s\\n\\n%s\' "$ITSAPLAN_SYSTEM_PROMPT" "$(cat)" | gemini --approval-mode yolo',
    files: [{ name: '.gemini/settings.json', code: GEMINI_SETTINGS }],
  },
  {
    id: 'copilot',
    label: 'Copilot CLI',
    // No system-prompt flag and no stdin prompt: both go in as one -p argument.
    command:
      'copilot -p "$(printf \'%s\\n\\n%s\' "$ITSAPLAN_SYSTEM_PROMPT" "$(cat)")" ' +
      '--allow-all-tools --no-ask-user',
    files: [{ name: '.mcp.json', code: COPILOT_MCP }],
  },
  {
    id: 'opencode',
    label: 'Opencode',
    // opencode run takes the prompt as an argument only, never on stdin.
    command: 'opencode run "$(printf \'%s\\n\\n%s\' "$ITSAPLAN_SYSTEM_PROMPT" "$(cat)")"',
    files: [{ name: 'opencode.json', code: OPENCODE_JSON }],
  },
  {
    id: 'custom',
    label: '',
    command: './run-agent.sh',
    files: [],
  },
] as const;

function configFile(command: string): string {
  return `{
  "url": "${API_URL}",
  "apiKey": "YOUR_KEY",
  "command": ${JSON.stringify(command)},
  "cwd": "/path/to/working-dir",
  "concurrency": 1,
  "pollIntervalMs": 3000,
  "timeoutMs": 1800000
}`;
}

export const RUN_COMMAND = 'npx -y @itsaplan/runner';

export function AgentRunnerHelpSheet() {
  const t = useTranslations('settings.agents');

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <HelpCircle className="size-4" />
          {t('runnerHelpOpen')}
        </Button>
      </SheetTrigger>
      {/* Fixed height with the scroll inside: the tabs hold snippets of different
          lengths, and a sheet that resized to each of them would jump under the
          pointer. */}
      <SheetContent side="bottom" className="flex h-[90vh] flex-col">
        <SheetHeader>
          <SheetTitle>{t('runnerHelpTitle')}</SheetTitle>
        </SheetHeader>
        <div className="mx-auto w-full max-w-[720px] flex-1 space-y-6 overflow-y-auto px-4 pb-8">
          <AgentRunnerHelpStep n={1} title={t('runnerHelpKey')}>
            <p className="text-xs text-muted-foreground">{t('runnerHelpKeyHint')}</p>
          </AgentRunnerHelpStep>

          <AgentRunnerHelpStep n={2} title={t('runnerHelpTool')}>
            <p className="text-xs text-muted-foreground">{t('runnerHelpToolHint')}</p>
          </AgentRunnerHelpStep>

          <AgentRunnerHelpStep n={3} title={t('runnerHelpRun')}>
            <Tabs defaultValue="claude">
              <TabsList variant="line">
                {AGENTS.map((a) => (
                  <TabsTrigger key={a.id} value={a.id}>
                    {a.id === 'custom' ? t('runnerHelpTabCustom') : a.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {AGENTS.map((a) => (
                <TabsContent key={a.id} value={a.id} className="space-y-3 pt-3">
                  {a.files.map((f) => (
                    <div key={f.name} className="space-y-1.5">
                      <p className="font-mono text-xs text-muted-foreground">{f.name}</p>
                      <AgentRunnerCodeBlock code={f.code} />
                    </div>
                  ))}
                  <div className="space-y-1.5">
                    <p className="font-mono text-xs text-muted-foreground">itsaplan-runner.json</p>
                    <AgentRunnerCodeBlock code={configFile(a.command)} />
                  </div>
                  <AgentRunnerCodeBlock code={RUN_COMMAND} />
                </TabsContent>
              ))}
            </Tabs>
          </AgentRunnerHelpStep>

          <AgentRunnerHelpStep n={4} title={t('runnerHelpCheck')}>
            <p className="text-xs text-muted-foreground">{t('runnerHelpCheckHint')}</p>
          </AgentRunnerHelpStep>
        </div>
      </SheetContent>
    </Sheet>
  );
}
