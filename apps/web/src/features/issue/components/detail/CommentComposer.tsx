import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, User } from 'lucide-react';
import { type Assignee } from '@/lib/api';
import Avatar from '@/components/common/Avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCreateComment } from '../../services/comments.service';

// The new-comment box: a plain markdown textarea with an @-mention menu. Typing "@"
// opens a menu of the project's members and agents; picking one inserts a mention
// token @[Name](user:<id>) into the body. The token is what the backend parses to
// notify a member or trigger an agent (see the feed's chip rendering for how it
// displays). Posts as the current session user on the button or Cmd/Ctrl+Enter.

// The active "@query" being typed: the text after the "@" and the body index of the
// "@" itself, so a pick can replace the whole "@query" span.
interface MentionQuery {
  query: string;
  anchor: number;
}

export default function CommentComposer({
  issueId,
  assignees,
  authorName,
  authorImage,
}: {
  issueId: number;
  assignees: Assignee[];
  authorName: string;
  authorImage?: string | null;
}) {
  const createComment = useCreateComment();
  const [body, setBody] = useState('');
  const [menu, setMenu] = useState<MentionQuery | null>(null);
  const [active, setActive] = useState(0);
  const [pendingCaret, setPendingCaret] = useState<number | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const posting = createComment.isPending;
  const cmdKey = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform) ? '⌘' : 'Ctrl';

  // Members and both agent kinds can be mentioned. An internal agent runs in the
  // built-in runtime; an external agent is reached over its operator's webhook, which
  // receives the comment carrying the mention token.
  const matches = useMemo(() => {
    if (!menu) return [];
    const q = menu.query.toLowerCase();
    return assignees.filter((a) => a.name.toLowerCase().includes(q)).slice(0, 8);
  }, [assignees, menu]);

  // Restore the caret after a mention is inserted (the body change is async, so the
  // caret has to be set once the new value has rendered).
  useEffect(() => {
    if (pendingCaret == null) return;
    const ta = taRef.current;
    if (ta) {
      ta.focus();
      ta.setSelectionRange(pendingCaret, pendingCaret);
    }
    setPendingCaret(null);
  }, [pendingCaret]);

  // Opens the mention menu when the text right before the caret is an "@query"
  // (an @ at a word boundary followed by non-space, non-@ characters).
  function onChange(value: string, caret: number) {
    setBody(value);
    const before = value.slice(0, caret);
    const m = before.match(/(?:^|\s)@([^\s@]*)$/);
    if (m) {
      setMenu({ query: m[1], anchor: caret - m[1].length - 1 });
      setActive(0);
    } else {
      setMenu(null);
    }
  }

  function selectMention(a: Assignee) {
    if (!menu) return;
    const token = `@[${a.name}](user:${a.userId})`;
    const caret = taRef.current?.selectionStart ?? body.length;
    const next = `${body.slice(0, menu.anchor)}${token} ${body.slice(caret)}`;
    setBody(next);
    setMenu(null);
    setPendingCaret(menu.anchor + token.length + 1);
  }

  async function post() {
    if (!body.trim()) return;
    await createComment.mutateAsync({ issueId, input: { body: body.trim() } });
    setBody('');
    setMenu(null);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (menu && matches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((i) => (i + 1) % matches.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => (i - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectMention(matches[Math.min(active, matches.length - 1)]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMenu(null);
        return;
      }
    }
    // Cmd/Ctrl+Enter submits, matching the rest of the planner.
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void post();
  }

  return (
    <div className="mb-5">
      <div className="flex gap-3">
        <Avatar
          name={authorName}
          image={authorImage}
          className="mt-0.5 size-7 text-[11px]"
          title={`Comment as ${authorName}`}
        />
        <div className="relative min-w-0 flex-1">
          <div className="overflow-hidden rounded-lg border bg-muted/20 shadow-xs transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30">
            <Textarea
              ref={taRef}
              value={body}
              onChange={(e) =>
                onChange(e.target.value, e.target.selectionStart ?? e.target.value.length)
              }
              onBlur={() => setMenu(null)}
              placeholder="Write a comment… use @ to mention"
              className="min-h-[64px] resize-none rounded-none border-0 bg-transparent px-3 py-2.5 shadow-none focus-visible:ring-0"
              onKeyDown={onKeyDown}
            />
            <div className="flex items-center justify-between gap-2 border-t px-2.5 py-2">
              <span className="text-[11px] text-muted-foreground/70">
                <kbd className="rounded bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium">
                  {cmdKey} ↵
                </kbd>
                <span className="ml-1.5">to send</span>
              </span>
              <Button size="sm" disabled={!body.trim() || posting} onClick={() => void post()}>
                {posting ? 'Posting…' : 'Comment'}
              </Button>
            </div>
          </div>

          {menu && matches.length > 0 && (
            <ul className="absolute top-full right-0 left-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
              {matches.map((a, i) => (
                <li key={a.userId}>
                  <button
                    type="button"
                    // Keep the textarea focused so the caret survives the click.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectMention(a);
                    }}
                    onMouseEnter={() => setActive(i)}
                    className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm ${
                      i === active ? 'bg-accent text-accent-foreground' : ''
                    }`}
                  >
                    {a.kind === 'agent' ? (
                      <Bot className="size-4 shrink-0" />
                    ) : (
                      <User className="size-4 shrink-0" />
                    )}
                    <span className="flex-1 truncate">{a.name}</span>
                    {a.kind === 'agent' && (
                      <span className="text-[10px] text-muted-foreground uppercase">agent</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
