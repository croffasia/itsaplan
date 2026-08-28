import { peoplePreamble, type Person } from './run-context';
import { parseMentionHandles } from '#shared/mentions';
import { PROJECT_DESCRIPTION_LIMIT } from '#modules/projects/model';
import type { AgentRunTrigger } from '../../model';

// Frames a triggered run into the text an agent receives: the framed user
// prompt (framePrompt) and the system-instruction blocks about the run mode
// (runModePreamble) and the people involved (peopleContext). The interactive test
// chat does not use this path — it frames its own prompt in the controller.

// The fields of a claimed run this module reads. The HTTP body in internal-routes.ts
// is structurally compatible.
export interface RunForPrompt {
  id: number;
  trigger: AgentRunTrigger;
  prompt: string;
  issueId: number | null;
  issueIdentifier: string | null;
  issueTitle: string | null;
  // The issue's assignee and, on a mention run, the author of the comment behind it:
  // the name they are called by and the handle they are tagged by. The handles are
  // optional so a worker still running the previous build can hand a run over.
  assigneeName: string | null;
  assigneeUsername?: string | null;
  requesterName: string | null;
  requesterUsername?: string | null;
  agentUserId: string;
  agentUsername?: string | null;
  // The comment the mention replies to and the ones above it, oldest first. Absent
  // for a top-level mention.
  threadContext?: string | null;
  // The comment that mentioned the agent, so it can answer in the same thread.
  sourceActivityId?: number | null;
}

// System-instruction block describing how this run was started, so the agent knows
// no human is present. Every triggered run is autonomous: nobody is waiting to answer
// a clarifying question, so the agent acts on reasonable assumptions instead of asking.
// Kept in the system prompt (not the framed user message) so it outweighs the task
// text and applies even when a schedule's task prompt is vague.
export function runModePreamble(trigger: RunForPrompt['trigger']): string {
  const lines = ['## Run mode'];
  if (trigger === 'schedule' || trigger === 'manual') {
    lines.push(
      'This run was started automatically on a schedule, not by a person. No human is',
      'watching it and no one will answer questions. Complete the task with your tools,',
      'making reasonable assumptions; never ask for clarification or wait for input.',
    );
  } else {
    lines.push(
      'You are running autonomously in response to activity on an issue. No human is',
      'waiting to answer you, so do not ask clarifying questions or wait for confirmation;',
      'make the most reasonable assumption and carry the work out with your tools.',
    );
  }
  return [...lines, '', ''].join('\n');
}

export function framePrompt(run: RunForPrompt): string {
  if (run.trigger === 'schedule' || run.trigger === 'manual') {
    return `Carry out the following task:\n\n${run.prompt}`;
  }
  const ref = run.issueIdentifier ?? `#${run.issueId}`;
  const titled = run.issueTitle ? `${ref} "${run.issueTitle}"` : ref;
  return run.trigger === 'delegation' ? frameDelegation(run, titled) : frameMention(run, titled);
}

function frameDelegation(run: RunForPrompt, titled: string): string {
  const lines = [
    `Issue ${titled} of your project has been delegated to you. Carry it out.`,
    'Read the issue for context, then do the work it needs with your tools. Add a',
    'question comment only when you genuinely cannot proceed without a human answer.',
  ];
  if (run.assigneeUsername) {
    lines.push(
      '',
      'Whenever you comment on this issue, tag the responsible assignee',
      `@${run.assigneeUsername} so they are notified.`,
    );
  } else {
    lines.push(
      '',
      'This issue has no assignee. Before you comment, call get_project and read',
      "the members' descriptions; tag the one member whose role best fits this work. If",
      'none clearly fits, tag a project owner. Tag exactly one person.',
    );
  }
  lines.push(
    '',
    'When you are done, add a comment to the issue with the add_comment tool',
    `(issueId ${run.issueId}) describing what you did, and set the issue's status with`,
    'the update_issue tool. Do not mention yourself.',
  );
  return lines.join('\n');
}

function frameMention(run: RunForPrompt, titled: string): string {
  // Answering with replyToId set keeps the agent's comment in the thread it was
  // asked in, instead of at the end of the issue.
  const args = run.sourceActivityId
    ? `issueId ${run.issueId}, replyToId ${run.sourceActivityId}`
    : `issueId ${run.issueId}`;
  // A run also starts when someone answers the agent's own comment without tagging
  // it, and telling it it was mentioned would not match what it reads.
  const mentionsAgent =
    !!run.agentUsername &&
    parseMentionHandles(run.prompt).includes(run.agentUsername.toLowerCase());
  const lead = mentionsAgent
    ? `You were mentioned in a comment on issue ${titled} of your project.`
    : `Someone answered your comment on issue ${titled} of your project.`;
  const lines = [
    lead,
    'Work out what the comment is asking for and do it with your tools, then reply by',
    `adding one comment to the issue with the add_comment tool (${args}) with the`,
    'result or answer. Keep it short.',
    'Do not mention yourself.',
  ];
  if (run.threadContext) {
    lines.push(
      '',
      'The comment is a reply. The comments above it in the thread, oldest first:',
      '',
      run.threadContext,
    );
  }
  lines.push('', 'The comment that mentioned you:', '', run.prompt);
  return lines.join('\n');
}

// A leading system-instruction block naming the project the agent works in. Grounds
// every run — the test chat, the issue-triggered runs, and the ones a runner executes
// — so the agent knows which project its tools act on and how issue keys are formed.
export function projectPreamble(project: {
  key: string;
  name: string;
  description: string;
}): string {
  const description = project.description.trim().slice(0, PROJECT_DESCRIPTION_LIMIT);
  return [
    '## Current project',
    `You are working in the project "${project.name}" (key ${project.key}). All your`,
    `work-item tools act on this project only, and its issues are addressed by keys`,
    `like ${project.key}-123.`,
    ...(description ? ['', description] : []),
    '',
    '',
  ].join('\n');
}

// Only the chat paths carry this: a chart is drawn where the answer is read in the
// app, while an autonomous run writes its answer into a comment, which draws none.
export function chartPreamble(): string {
  return [
    '## Charts',
    'When the person asks for a chart or a graph, build it with the create_chart tool',
    'instead of drawing one as text. Put the spec it answers with into your reply as a',
    'fenced block tagged chart, where the chart belongs in the text:',
    '',
    '```chart',
    '{"type":"bar","x":"week","series":[{"key":"created"}],"data":[{"week":"W10","created":8}]}',
    '```',
    '',
    'The block holds the spec and nothing else — the app draws it as the chart.',
    '',
    '',
  ].join('\n');
}

// Only the chat paths carry this: a file is attached to a chat message, so an
// autonomous run never meets the marker.
export function attachmentPreamble(): string {
  return [
    '## Attached files',
    'A [file: "name" (attachment id: …)] marker in the person\'s message means they attached',
    'that file. Read it with the read_chat_attachment tool.',
    '',
    '',
  ].join('\n');
}

export function peopleContext(run: RunForPrompt): string {
  const requester: Person | null = run.requesterName
    ? { name: run.requesterName, username: run.requesterUsername ?? null }
    : null;
  const assignee: Person | null = run.assigneeName
    ? { name: run.assigneeName, username: run.assigneeUsername ?? null }
    : null;
  const own = run.agentUsername?.toLowerCase();
  const mentioned = parseMentionHandles(run.prompt).filter((handle) => handle !== own);
  return peoplePreamble({ requester, assignee, mentioned });
}
