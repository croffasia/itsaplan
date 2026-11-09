import type { ComponentProps } from 'react';
import MentionMenu from '@/components/common/inputs/MentionMenu';
import { Textarea } from '@/components/ui/textarea';
import { useMentionCandidates } from '@/hooks/useMentionCandidates';
import { useMentionMenu } from '@/hooks/useMentionMenu';

// The text box of a document comment, with the "@" menu of who a comment on the
// document reaches.
export default function DocumentCommentInput({
  projectKey,
  documentId,
  value,
  onValueChange,
  onKeyDown,
  ...props
}: Omit<ComponentProps<typeof Textarea>, 'value' | 'onChange' | 'ref'> & {
  projectKey: string;
  documentId: number;
  value: string;
  onValueChange: (value: string) => void;
}) {
  const candidates = useMentionCandidates({
    projectKey,
    on: 'document',
    documentId,
    place: 'comment',
  });
  const mention = useMentionMenu(value, onValueChange, candidates);
  return (
    <div className="relative">
      <Textarea
        {...props}
        ref={mention.ref}
        value={value}
        maxLength={10000}
        onChange={mention.onChange}
        onBlur={mention.close}
        onKeyDown={(event) => {
          if (!mention.onKeyDown(event)) onKeyDown?.(event);
        }}
      />
      <MentionMenu
        ref={mention.menuRef}
        items={mention.matches}
        onPick={mention.pick}
        className="absolute inset-x-0 top-full z-20 mt-1 w-auto"
      />
    </div>
  );
}
