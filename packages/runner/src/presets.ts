import type { OutputFormat } from './config';

// A preset exists because several facts about a CLI have to agree: how its output is read,
// where the session it started is named, how an existing one is resumed, how the task and
// the system prompt reach it, and what it takes to run unattended. Wiring those into a
// shell command by hand can produce a combination that runs but silently never reports a
// session, or one that waits forever for an approval nobody is there to give.
//
// Anything else about the invocation — MCP servers, model, working directory — is the
// operator's, passed through `args` and the `--` tail.

export type PresetName = 'claude' | 'codex' | 'opencode' | 'antigravity' | 'copilot';

export interface Preset {
  bin: string;
  outputFormat: OutputFormat;
  // A CLI that takes the prompt as an argument gets it after everything else, which is why
  // `tail` exists.
  promptVia: 'stdin' | 'arg';
  // Only Claude Code has a flag for the run's context; the rest get it in front of the
  // task.
  systemPromptFlag?: string;
  // The arguments before the operator's own, given null for a fresh session.
  head: (sessionId: string | null) => string[];
  // The arguments after the operator's own: a stdin marker, or the flag the prompt follows.
  tail: string[];
}

export const PRESETS: Record<PresetName, Preset> = {
  // stream-json carries the tool calls into the chat, and `session_id` rides on every line
  // of it, including the first. --verbose is required for stream-json under --print, and
  // --permission-mode auto has a classifier review each action, since nobody is there to
  // answer a prompt.
  claude: {
    bin: 'claude',
    outputFormat: 'claude-stream-json',
    promptVia: 'stdin',
    systemPromptFlag: '--append-system-prompt',
    head: (sessionId) => [
      '-p',
      ...(sessionId ? ['--resume', sessionId] : []),
      '--output-format',
      'stream-json',
      '--include-partial-messages',
      '--verbose',
      '--permission-mode',
      'auto',
    ],
    tail: [],
  },

  // Resuming is a subcommand, and it accepts a narrower set of options than plain `exec` —
  // notably no --sandbox, --cd or --profile. An argument only `exec` takes would break
  // every message after the first, so the sandbox is set through `-c sandbox_mode=…`,
  // which both accept.
  codex: {
    bin: 'codex',
    outputFormat: 'codex-jsonl',
    promptVia: 'stdin',
    head: (sessionId) => [
      ...(sessionId ? ['exec', 'resume', sessionId] : ['exec']),
      '--json',
      '-c',
      'sandbox_mode="workspace-write"',
    ],
    tail: ['-'],
  },

  opencode: {
    bin: 'opencode',
    outputFormat: 'opencode-json',
    promptVia: 'arg',
    head: (sessionId) => [
      'run',
      '--format',
      'json',
      ...(sessionId ? ['--session', sessionId] : []),
    ],
    tail: [],
  },

  // --conversation resumes the conversation the stream names. --print-timeout is raised
  // well past its five-minute default, so the runner's own timeout is what ends a long
  // task.
  antigravity: {
    bin: 'agy',
    outputFormat: 'antigravity-stream-json',
    promptVia: 'arg',
    head: (sessionId) => [
      ...(sessionId ? ['--conversation', sessionId] : []),
      '--output-format',
      'stream-json',
      '--dangerously-skip-permissions',
      '--print-timeout',
      '24h',
    ],
    tail: ['-p'],
  },

  // --allow-all-tools is required for a run nobody is watching, and --no-ask-user turns
  // off the tool that would wait for an answer. The json output carries the tool calls,
  // and its closing `result` line names the session, which --session-id resumes. The
  // resume flag has to be this one: -r takes its value only as `-r=<id>`.
  copilot: {
    bin: 'copilot',
    outputFormat: 'copilot-json',
    promptVia: 'arg',
    head: (sessionId) => [
      '--allow-all-tools',
      '--no-ask-user',
      '--output-format',
      'json',
      ...(sessionId ? ['--session-id', sessionId] : []),
    ],
    tail: ['-p'],
  },
};

export const PRESET_NAMES = Object.keys(PRESETS) as PresetName[];

export function isPresetName(value: string): value is PresetName {
  return value in PRESETS;
}

// Without a flag for it, the run's context goes in front of the task. It is empty on a
// resumed session, which already holds it.
export function presetPrompt(preset: Preset, systemPrompt: string, prompt: string): string {
  if (preset.systemPromptFlag || !systemPrompt) return prompt;
  return `${systemPrompt}\n\n${prompt}`;
}

// The operator's own arguments sit between what the preset needs in front and what it
// needs last, so a prompt passed as an argument stays at the end, a stdin marker is not
// separated from its command, and a repeated flag overrides the preset's.
export function presetArgv(
  preset: Preset,
  sessionId: string | null,
  systemPrompt: string,
  extraArgs: string[],
  prompt: string,
): string[] {
  return [
    ...preset.head(sessionId),
    ...(preset.systemPromptFlag && systemPrompt ? [preset.systemPromptFlag, systemPrompt] : []),
    ...extraArgs,
    ...preset.tail,
    ...(preset.promptVia === 'arg' ? [presetPrompt(preset, systemPrompt, prompt)] : []),
  ];
}
