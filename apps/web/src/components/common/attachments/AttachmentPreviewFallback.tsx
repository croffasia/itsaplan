import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Attachment } from '@/lib/api/endpoints/attachments';
import { Button } from '@/components/ui/button';

export default function AttachmentPreviewFallback({
  attachment,
  message,
}: {
  attachment: Attachment;
  message: string;
}) {
  const t = useTranslations('common.attachmentPreview');
  return (
    <div className="flex w-full flex-col items-center gap-3 p-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" asChild>
        <a href={`${attachment.url}?download=1`} download={attachment.filename}>
          <Download />
          {t('download')}
        </a>
      </Button>
    </div>
  );
}
