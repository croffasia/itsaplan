import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, Copy, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { linkPreviewDestination } from './linkPreviewDestination';
import styles from './LinkPreviewDialog.module.css';

export default function LinkPreviewActions({ url, onEdit }: { url: string; onEdit?: () => void }) {
  const t = useTranslations('common.editor');
  const origin = typeof window === 'undefined' ? undefined : window.location.origin;
  const openable = !!linkPreviewDestination(url, origin);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
    };
  }, []);

  async function copyLink() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard is unavailable');
      await navigator.clipboard.writeText(url);
      if (!mounted.current) return;
      clearTimeout(timer.current);
      setCopyState('copied');
      timer.current = setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      if (!mounted.current) return;
      clearTimeout(timer.current);
      setCopyState('failed');
    }
  }

  let copyMessage = '';
  if (copyState === 'copied') copyMessage = t('copiedLink');
  if (copyState === 'failed') copyMessage = t('copyLinkFailed');

  return (
    <div className="shrink-0 space-y-2">
      <div className={`grid gap-2 ${openable ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {openable && (
          <Button asChild className={styles.control}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              data-link-preview-primary=""
            >
              {t('openLink')}
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </a>
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          className={styles.control}
          data-link-preview-primary={openable ? undefined : ''}
          onClick={() => void copyLink()}
        >
          {copyState === 'copied' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copyState === 'copied' ? t('copiedLink') : t('copyLink')}
        </Button>
        {onEdit && (
          <Button
            type="button"
            variant="ghost"
            className={`${styles.control} col-span-full justify-start`}
            onClick={onEdit}
          >
            <Pencil aria-hidden="true" />
            {t('editLink')}
          </Button>
        )}
      </div>
      <p role="status" className={copyState === 'failed' ? 'text-sm' : 'sr-only'}>
        {copyMessage}
      </p>
    </div>
  );
}
