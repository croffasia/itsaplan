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
// runner knows how to invoke each of these CLIs, so the config only names one; a tab
// differs from the next in where that CLI reads its MCP server from. Where the key
// itself has to be written out, the placeholder is `the-agent-key` rather than
// `$ITSAPLAN_API_KEY`, which on the same screen means the variable the runner sets.

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

// Copilot CLI reads the same .mcp.json as Claude Code, but its headers take no
// variable interpolation, so the key is written in as it stands. It picks the file up on
// its own only in a directory the operator has trusted interactively, which is why the
// config below names it.
const COPILOT_MCP = `{
  "mcpServers": {
    "itsaplan": {
      "type": "http",
      "url": "${API_URL}/mcp",
      "headers": { "Authorization": "Bearer the-agent-key" },
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

// Antigravity CLI reads its MCP servers from one file per machine — no project file. A
// remote server is named by serverUrl, and its headers take no variable interpolation, so
// the key is written in as it stands.
const ANTIGRAVITY_MCP = `{
  "mcpServers": {
    "itsaplan": {
      "serverUrl": "${API_URL}/mcp",
      "headers": { "Authorization": "Bearer the-agent-key" }
    }
  }
}`;

const AGENTS = [
  {
    id: 'claude',
    label: 'Claude Code',
    // Claude Code picks up .mcp.json from the directory it runs in, which is `cwd`,
    // so the runner config needs nothing for it. The instance's server lands on top
    // of what the machine already has, so the operator's own servers, skills and
    // memory stay in the run.
    agent: 'claude',
    files: [{ name: '.mcp.json', code: MCP_JSON }],
  },
  {
    id: 'codex',
    label: 'Codex',
    // Codex reads its servers from ~/.codex/config.toml only — no project file — so
    // this one is written once per machine. --skip-git-repo-check is what lets the
    // working directory be something other than a git repository.
    agent: 'codex',
    args: ['--skip-git-repo-check'],
    files: [{ name: '~/.codex/config.toml', code: CODEX_TOML }],
  },
  {
    id: 'antigravity',
    label: 'Antigravity CLI',
    // The binary is `agy`. It has to be signed in once interactively: a headless run
    // uses the credentials that session cached.
    agent: 'antigravity',
    files: [{ name: '~/.gemini/config/mcp_config.json', code: ANTIGRAVITY_MCP }],
  },
  {
    id: 'copilot',
    label: 'Copilot CLI',
    agent: 'copilot',
    args: ['--additional-mcp-config', '@.mcp.json'],
    files: [{ name: '.mcp.json', code: COPILOT_MCP }],
  },
  {
    id: 'opencode',
    label: 'Opencode',
    agent: 'opencode',
    files: [{ name: 'opencode.json', code: OPENCODE_JSON }],
  },
  // A command of its own turns the preset off: the runner then knows nothing about
  // what it runs, keeps no session for it, and hands it the task on stdin.
  {
    id: 'custom',
    label: '',
    command: './run-agent.sh',
    files: [],
  },
] as const;

// Only what the runner cannot work out on its own. `cwd` is where the agent's files
// and the MCP config above are read from; concurrency, poll interval and timeout keep
// their defaults.
function configFile(preset: {
  agent?: string;
  args?: readonly string[];
  command?: string;
}): string {
  return JSON.stringify(
    {
      url: API_URL,
      apiKey: 'the-agent-key',
      ...(preset.agent ? { agent: preset.agent } : { command: preset.command }),
      cwd: '/path/to/working-dir',
      ...(preset.args ? { args: preset.args } : {}),
    },
    null,
    2,
  );
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
      {/* Full height with the scroll inside: the tabs hold snippets of different
          lengths, and a sheet that resized to each of them would jump under the
          pointer. */}
      <SheetContent side="bottom" className="flex h-dvh flex-col">
        <SheetHeader>
          <SheetTitle>{t('runnerHelpTitle')}</SheetTitle>
        </SheetHeader>
        <div className="mx-auto w-full max-w-[720px] flex-1 space-y-6 overflow-y-auto px-4 pb-8">
          <AgentRunnerHelpStep n={1} title={t('runnerHelpKey')}>
            <p className="text-xs text-muted-foreground">{t('runnerHelpKeyHint')}</p>
          </AgentRunnerHelpStep>

          <AgentRunnerHelpStep n={2} title={t('runnerHelpMcp')}>
            <p className="text-xs text-muted-foreground">{t('runnerHelpMcpHint')}</p>
          </AgentRunnerHelpStep>

          <AgentRunnerHelpStep n={3} title={t('runnerHelpTool')}>
            <p className="text-xs text-muted-foreground">{t('runnerHelpToolHint')}</p>
          </AgentRunnerHelpStep>

          <AgentRunnerHelpStep n={4} title={t('runnerHelpRun')}>
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
                    <AgentRunnerCodeBlock code={configFile(a)} />
                  </div>
                  <AgentRunnerCodeBlock code={RUN_COMMAND} />
                </TabsContent>
              ))}
            </Tabs>
          </AgentRunnerHelpStep>

          <AgentRunnerHelpStep n={5} title={t('runnerHelpCheck')}>
            <p className="text-xs text-muted-foreground">{t('runnerHelpCheckHint')}</p>
          </AgentRunnerHelpStep>
        </div>
      </SheetContent>
    </Sheet>
  );
}
