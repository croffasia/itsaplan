// The human context of an agent run, rendered into a system-instruction block so the
// agent knows who it is dealing with: who asked it, who the issue's responsible human
// is, and who else was mentioned. The block also tells the agent how to tag a person
// back in a comment. Callers gather the people from their own source (the chat session
// user, or the issue and comment behind a triggered run); this module only renders.

export interface Person {
  name: string;
  userId: string;
}

export interface RunPeople {
  // Who is asking: the chat user, or the author of the comment that mentioned the agent.
  requester?: Person | null;
  // The issue's assignee, the human responsible for it. Set on issue-triggered runs.
  assignee?: Person | null;
  // Other users referenced by @mention in the triggering comment (the agent itself
  // excluded).
  mentioned?: Person[];
}

// A person written so the model can both read the name and construct a mention token
// from the id, e.g. `Ada (user:abc123)`.
function ref(p: Person): string {
  return `${p.name} (user:${p.userId})`;
}

// Builds the "## People" instruction block, or an empty string when no people are
// known. The tagging guidance is only added when there is someone to tag.
export function peoplePreamble(people: RunPeople): string {
  const lines: string[] = [];
  if (people.requester) lines.push(`- ${ref(people.requester)} is the person who asked you.`);
  if (people.assignee) {
    lines.push(`- The issue is assigned to ${ref(people.assignee)}, the human responsible for it.`);
  }
  const mentioned = (people.mentioned ?? []).filter(Boolean);
  if (mentioned.length > 0) {
    lines.push(`- Also mentioned in the text: ${mentioned.map(ref).join(', ')}.`);
  }
  if (lines.length === 0) return '';

  const guidance = [
    'To mention a person in a comment, write @[Name](user:<userId>) in the comment body.',
  ];
  if (people.assignee) {
    guidance.push(
      'Tag the responsible assignee when you comment so they are notified of what you did.',
    );
  }
  return ['## People', ...lines, '', ...guidance, '', ''].join('\n');
}
