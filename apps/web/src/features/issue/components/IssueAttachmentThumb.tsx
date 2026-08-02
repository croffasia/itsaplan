import Image from 'next/image';
import { FileIcon } from 'lucide-react';
import { isImage, isVideo, type Embeddable } from '../utils/attachmentEmbed';

// An attachment card's leading thumbnail: images and videos preview themselves,
// every other type falls back to a generic file glyph.
export default function IssueAttachmentThumb({
  attachment,
  sizes = '40px',
}: {
  attachment: Embeddable;
  // The rendered width, for the image optimizer. The default is the w-10 (40px)
  // thumbnail every card uses; a larger preview passes its own.
  sizes?: string;
}) {
  if (isImage(attachment))
    return (
      <Image
        src={attachment.url}
        alt={attachment.filename}
        fill
        sizes={sizes}
        // A file picked in the new issue modal is previewed from a local blob:
        // URL, which the image optimizer cannot fetch.
        unoptimized={attachment.url.startsWith('blob:')}
        draggable={false}
        className="object-cover"
      />
    );
  if (isVideo(attachment))
    return (
      <video src={attachment.url} className="size-full object-cover" muted draggable={false} />
    );
  return <FileIcon className="text-muted-foreground" />;
}
