import { peoplePreamble, type Person } from './run-context';
import { renderMentionsPlain, parseMentionedUsers } from '../mentions';

// Frames a triggered internal run into the text an agent receives: the framed user
// prompt (framePrompt) and the system-instruction blocks about the run mode
// (runModePreamble) and the people involved (peopleContext). The interactive test
// chat does not use this path — it frames its own prompt in routes.ts.

// The fields of a claimed run this module reads. The HTTP body in internal-routes.ts
// is structurally compatible.
export interface RunForPrompt {
  id: number;
  trigger: 'mention' | 'delegation' | 'schedule' | 'manual';
  prompt: string;
  issueId: number | null;
  issueIdentifier: string | null;
  issueTitle: string | null;
  assigneeUserId: string | null;
  assigneeName: string | null;
  requesterUserId: string | null;
  requesterName: string | null;
  agentUserId: string;
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
  if (run.assigneeUserId) {
    lines.push(
      '',
      'Whenever you comment on this issue, tag the responsible assignee',
      `@[${run.assigneeName ?? 'the assignee'}](user:${run.assigneeUserId}) so they are notified.`,
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
  return [
    `You were mentioned in a comment on issue ${titled} of your project.`,
    'Work out what the comment is asking for and do it with your tools, then reply by',
    `adding one comment to the issue with the add_comment tool (issueId ${run.issueId})`,
    'with the result or answer. Keep it short.',
    'Do not mention yourself.',
    '',
    'The comment that mentioned you:',
    '',
    renderMentionsPlain(run.prompt),
  ].join('\n');
}

export function peopleContext(run: RunForPrompt): string {
  const requester: Person | null =
    run.requesterUserId && run.requesterName
      ? { name: run.requesterName, userId: run.requesterUserId }
      : null;
  const assignee: Person | null =
    run.assigneeUserId && run.assigneeName
      ? { name: run.assigneeName, userId: run.assigneeUserId }
      : null;
  const mentioned = parseMentionedUsers(run.prompt).filter((p) => p.userId !== run.agentUserId);
  return peoplePreamble({ requester, assignee, mentioned });
}
