import { useState } from 'react';
import type { Attachment } from '@/lib/api/endpoints/attachments';
import Modal from '@/components/common/overlay/Modal';
import { cn } from '@/lib/utils';
import AttachmentPreview from './AttachmentPreview';
import { attachmentPreviewKind } from './attachmentPreviewKind';

// Looks at an attachment without inserting it anywhere.
export default function AttachmentViewer({
  attachment,
  onClose,
}: {
  attachment: Attachment;
  onClose: () => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const kind = attachmentPreviewKind(attachment);
  if (!kind) return null;

  return (
    <Modal
      title={attachment.filename}
      onClose={onClose}
      wide="xl"
      fullscreen={fullscreen}
      onToggleFullscreen={() => setFullscreen((v) => !v)}
    >
      <div className={cn('flex min-h-0 items-center justify-center', fullscreen && 'flex-1 pb-4')}>
        <AttachmentPreview attachment={attachment} kind={kind} fullscreen={fullscreen} />
      </div>
    </Modal>
  );
}
