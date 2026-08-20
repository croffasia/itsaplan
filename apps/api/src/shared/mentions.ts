import { db, projectMember, user, aiAgent } from '@repo/db';
import { and, eq, inArray, sql } from 'drizzle-orm';

// Mentions in a comment, an issue description or a markdown custom field. A mention
// is written inline as @handle: a member's username, or an agent's project-scoped
// username. Resolving one gives the user ids the notification and agent-run fan-out
// work with.

// A handle holds letters, digits and . _ -, and never ends on . or -, so a mention
// that closes a sentence keeps the punctuation out of the handle. The lookbehind
// keeps an email address (name@example.com) and a doubled @ from reading as one.
const MENTION_RE = /(?<![\w@.-])@([a-zA-Z0-9_](?:[a-zA-Z0-9._-]*[a-zA-Z0-9_])?)/g;

// Markup an @ belongs to rather than addressing anyone: a fenced block, an inline
// span of code, a link or an image, and a bare URL. The editor skips the same
// markup when it renders the chips, so what reads as a mention is what notifies.
const NOT_A_MENTION_RE =
  /```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`]*`|!?\[[^\]]*\]\([^)]*\)|<[^>\s]+>|\bhttps?:\/\/\S+/g;

// The distinct handles mentioned in the text, lowercased, in first-seen order.
// Usernames are issued case-insensitively, so the comparison is too.
export function parseMentionHandles(text: string): string[] {
  const handles = new Set<string>();
  for (const match of text.replace(NOT_A_MENTION_RE, ' ').matchAll(MENTION_RE))
    handles.add(match[1].toLowerCase());
  return [...handles];
}

// The handles an edit added to a text. Editing a description must only reach the
// people the edit newly named, not everyone the text already mentioned.
export function addedMentionHandles(before: string, after: string): string[] {
  const had = new Set(parseMentionHandles(before));
  return parseMentionHandles(after).filter((handle) => !had.has(handle));
}

// Who the handles reach, kept apart because the two are used for different things:
// a member is notified, an agent is given a run.
export interface MentionedUsers {
  memberIds: string[];
  agentUserIds: string[];
}

// The user ids behind the given handles: the project's members addressed by their
// username, and its agents by theirs. A handle nobody in the project answers to is
// dropped. A member and an agent cannot share a handle — the two are kept apart at
// the point either is named.
export async function resolveMentionHandles(
  projectId: number,
  handles: string[],
): Promise<MentionedUsers> {
  if (handles.length === 0) return { memberIds: [], agentUserIds: [] };
  const [memberRows, agentRows] = await Promise.all([
    db
      .select({ userId: projectMember.userId })
      .from(projectMember)
      .innerJoin(user, eq(user.id, projectMember.userId))
      .where(
        and(eq(projectMember.projectId, projectId), inArray(sql`lower(${user.username})`, handles)),
      ),
    db
      .select({ userId: aiAgent.userId })
      .from(aiAgent)
      .where(
        and(eq(aiAgent.projectId, projectId), inArray(sql`lower(${aiAgent.username})`, handles)),
      ),
  ]);
  return {
    memberIds: memberRows.map((row) => row.userId),
    agentUserIds: agentRows.map((row) => row.userId),
  };
}
