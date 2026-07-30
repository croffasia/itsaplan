import { X } from 'lucide-react';
import { type PendingAttachment } from '../../hooks/useNewIssueAttachments';
import { isImage, isVideo, type Embeddable } from '../../utils/attachmentEmbed';
import { formatSize } from '../../utils/fileSize';
import IssueAttachmentThumb from '../IssueAttachmentThumb';
import {
  Attachment as AttachmentCard,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from '@/components/ui/attachment';

// Files waiting to be uploaded once the issue is created. They preview from
// their local blob: URL, and Insert embeds that URL into the description; the
// modal rewrites it to the stored URL after the upload.
export default function NewIssueAttachmentList({
  items,
  onInsert,
  onRemove,
}: {
  items: PendingAttachment[];
  onInsert: (attachment: Embeddable) => void;
  onRemove: (id: number) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="mt-3 flex flex-col gap-2">
      {items.map((item) => (
        <AttachmentCard key={item.id} className="w-full">
          <AttachmentMedia variant={isImage(item) || isVideo(item) ? 'image' : 'icon'}>
            <IssueAttachmentThumb attachment={item} />
          </AttachmentMedia>

          <AttachmentContent>
            <AttachmentTitle>{item.filename}</AttachmentTitle>
            <AttachmentDescription>{formatSize(item.file.size)}</AttachmentDescription>
          </AttachmentContent>

          <AttachmentActions>
            <AttachmentAction
              size="sm"
              onClick={() => onInsert(item)}
              title="Insert into description"
            >
              Insert
            </AttachmentAction>
            <AttachmentAction
              className="hover:text-destructive"
              onClick={() => onRemove(item.id)}
              aria-label={`Remove ${item.filename}`}
              title="Remove"
            >
              <X />
            </AttachmentAction>
          </AttachmentActions>
        </AttachmentCard>
      ))}
    </div>
  );
}
