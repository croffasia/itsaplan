import { type PendingAttachment } from '../../hooks/useNewIssueAttachments';
import { type Embeddable } from '../../utils/attachmentEmbed';
import NewIssueAttachmentChip from './NewIssueAttachmentChip';

// Files waiting to be uploaded once the issue is created. They preview from
// their local blob: URL, and inserting one embeds that URL into the open editor;
// the modal rewrites it to the stored URL after the upload. The strip sits in the
// footer next to the attach button, so the files cost the dialog no height.
export default function NewIssueAttachmentStrip({
  items,
  onInsert,
  onAnnotate,
  onRemove,
}: {
  items: PendingAttachment[];
  // Left out while no editor is open to insert into.
  onInsert?: (attachment: Embeddable) => void;
  onAnnotate: (id: number, file: File) => void;
  onRemove: (id: number) => void;
}) {
  if (items.length === 0) return null;

  return (
    <>
      <span className="h-6 w-px shrink-0 bg-border" />
      {/* The padding is the room each chip's overhanging remove button needs:
          scrolling this box would clip anything outside it. Vertically it is
          symmetric, so the chips stay on the footer's centre line. */}
      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto py-2 pr-2">
        {items.map((item) => (
          <NewIssueAttachmentChip
            key={item.id}
            item={item}
            onInsert={onInsert}
            onAnnotate={onAnnotate}
            onRemove={onRemove}
          />
        ))}
      </div>
    </>
  );
}
