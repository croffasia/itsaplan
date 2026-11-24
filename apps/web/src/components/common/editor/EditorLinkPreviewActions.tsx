import { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { copyText } from '@/utils/clipboard';

export default function EditorLinkPreviewActions({
  url,
  onEdit,
}: {
  url: string;
  onEdit?: () => void;
}) {
  const t = useTranslations('common.editor');
  const tShare = useTranslations('common.share');
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    if (!(await copyText(url))) {
      toast.error(tShare('copyFailed'));
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="-mx-1 -mb-1 flex flex-wrap gap-1 pt-0.5">
      <Button asChild variant="ghost" size="sm" className="h-7 px-2.5 text-[13px]">
        <a href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
          <ExternalLink />
          {t('open')}
        </a>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2.5 text-[13px]"
        onClick={() => void copy()}
      >
        {copied ? <Check /> : <Copy />}
        {copied ? t('copiedLink') : t('copyLink')}
      </Button>
      {onEdit && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2.5 text-[13px]"
          onClick={onEdit}
        >
          <Pencil />
          {t('editLink')}
        </Button>
      )}
    </div>
  );
}
