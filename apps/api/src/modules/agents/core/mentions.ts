// Mentions in a comment body. A mention is stored inline in the body as
// @[Display Name](user:<userId>), so the referenced user id is stable regardless of
// later handle or name changes. parseMentions extracts the referenced user ids;
// renderMentionsPlain rewrites the tokens to @Display Name for prompts and plain
// text views. Both are pure — no DB access — so they are unit-testable.

// Display names may contain anything except a closing bracket; the user id runs up
// to the closing paren. Global + multiline so every mention in the body is matched.
const MENTION_RE = /@\[([^\]]*)\]\(user:([^)]+)\)/g;

// The distinct user ids mentioned in the body, in first-seen order.
export function parseMentions(body: string): string[] {
  const ids = new Set<string>();
  for (const match of body.matchAll(MENTION_RE)) {
    const id = match[2]?.trim();
    if (id) ids.add(id);
  }
  return [...ids];
}

// The distinct users mentioned in the body, with the display name carried in the token,
// in first-seen order. Used to give an agent the names and ids of the people a comment
// referenced without a database lookup.
export function parseMentionedUsers(body: string): { name: string; userId: string }[] {
  const out: { name: string; userId: string }[] = [];
  const seen = new Set<string>();
  for (const match of body.matchAll(MENTION_RE)) {
    const userId = match[2]?.trim();
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    out.push({ name: match[1]?.trim() || 'user', userId });
  }
  return out;
}

// Replaces each mention token with @Display Name, so a model or a plain-text reader
// sees readable text instead of the id-carrying token.
export function renderMentionsPlain(body: string): string {
  return body.replace(MENTION_RE, (_token, name: string) => `@${name.trim() || 'user'}`);
}
