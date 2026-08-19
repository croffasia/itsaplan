// A comment body stores mentions as @[Display Name](user:<userId>). Capture groups:
// the display name, then the user id.
export const MENTION_RE = /@\[([^\]]*)\]\(user:([^)]+)\)/g;

// For read-only display, rewrite each token into a markdown link the editor renders as
// a chip: @[Name](user:id) -> [@Name](#mention-id). The "#mention-" href is inert (the
// editor has openOnClick off) and lets CSS target a[href^="#mention-"] to style the
// link as a mention pill. Composing/sending keeps the original token untouched.
export function mentionsToChips(body: string): string {
  return body.replace(
    MENTION_RE,
    (_token, name: string, id: string) => `[@${name}](#mention-${id})`,
  );
}
