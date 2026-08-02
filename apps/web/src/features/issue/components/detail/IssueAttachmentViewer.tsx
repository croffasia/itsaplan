import { useState } from 'react';
import { type Attachment } from '@/lib/api';
import { isImage } from '../../utils/attachmentEmbed';
import Modal from '@/components/common/overlay/Modal';
import { cn } from '@/lib/utils';

// Looks at an attachment without inserting it anywhere: the image at its own
// size, a video with its controls.
export default function IssueAttachmentViewer({
  attachment,
  onClose,
}: {
  attachment: Attachment;
  onClose: () => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const size = fullscreen ? 'max-h-full' : 'max-h-[70vh]';

  return (
    <Modal
      title={attachment.filename}
      onClose={onClose}
      wide="xl"
      fullscreen={fullscreen}
      onToggleFullscreen={() => setFullscreen((v) => !v)}
    >
      <div className={cn('flex min-h-0 items-center justify-center', fullscreen && 'flex-1 pb-4')}>
        {isImage(attachment) ? (
          // Not next/image: the bytes behind the URL can be replaced, and the
          // optimizer would keep serving the version it cached.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={attachment.url}
            alt={attachment.filename}
            className={cn('max-w-full rounded-md', size)}
          />
        ) : (
          <video src={attachment.url} controls className={cn('max-w-full rounded-md', size)} />
        )}
      </div>
    </Modal>
  );
}
