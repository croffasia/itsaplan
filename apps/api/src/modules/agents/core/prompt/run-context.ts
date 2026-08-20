// The human context of an agent run, rendered into a system-instruction block so the
// agent knows who it is dealing with: who asked it, who the issue's responsible human
// is, and who else was mentioned. The block also tells the agent how to tag a person
// back in a comment. Callers gather the people from their own source (the chat session
// user, or the issue and comment behind a triggered run); this module only renders.

export interface Person {
  name: string;
  // The handle the agent addresses them by: @username. Null for a user who has
  // none, who is then named without one and cannot be tagged.
  username: string | null;
}

export interface RunPeople {
  // Who is asking: the chat user, or the author of the comment that mentioned the agent.
  requester?: Person | null;
  // The issue's assignee, the human responsible for it. Set on issue-triggered runs.
  assignee?: Person | null;
  // The handles of the other people the triggering text named (the agent itself
  // excluded), which may include handles nobody in the project answers to.
  mentioned?: string[];
}

// A person written so the model can both read the name and tag them, e.g. `Ada (@ada)`.
function ref(p: Person): string {
  return p.username ? `${p.name} (@${p.username})` : p.name;
}

// Builds the "## People" instruction block, or an empty string when no people are
// known. The tagging guidance is only added when there is someone to tag.
export function peoplePreamble(people: RunPeople): string {
  const lines: string[] = [];
  if (people.requester) lines.push(`- ${ref(people.requester)} is the person who asked you.`);
  if (people.assignee) {
    lines.push(`- The issue is assigned to ${ref(people.assignee)}, the human responsible for it.`);
  }
  const mentioned = people.mentioned ?? [];
  if (mentioned.length > 0) {
    lines.push(`- Also mentioned in the text: ${mentioned.map((h) => `@${h}`).join(', ')}.`);
  }
  if (lines.length === 0) return '';

  const guidance = ['To mention a person in a comment, write @username in the comment body.'];
  if (people.assignee?.username) {
    guidance.push(
      'Tag the responsible assignee when you comment so they are notified of what you did.',
    );
  }
  return ['## People', ...lines, '', ...guidance, '', ''].join('\n');
}
