'use client';

import { useTranslations } from 'next-intl';
import { ArrowUpRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { SHOWCASE_URL } from '@/utils/app';
import OnboardingShowcaseArt from './art/OnboardingShowcaseArt';

export default function OnboardingShowcaseDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations('onboarding.showcase');
  const tCommon = useTranslations('common');

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:max-w-[640px]">
        <div
          dir="ltr"
          className="@container relative aspect-[600/280] w-full bg-[#E8EDFB] dark:bg-[#1C2236]"
        >
          <OnboardingShowcaseArt />
        </div>
        <div className="flex flex-col gap-2 px-7 pt-5 pb-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span className="size-2 rounded-full bg-[#5B6EE1]" />
            itsaplan.dev
          </div>
          <DialogTitle className="text-xl font-semibold tracking-tight">{t('title')}</DialogTitle>
          <DialogDescription>{t('body')}</DialogDescription>
        </div>
        <div className="flex items-center justify-end gap-2 border-t px-5 py-3.5">
          <Button variant="ghost" onClick={onClose}>
            {t('dismiss')}
          </Button>
          <Button asChild>
            <a href={SHOWCASE_URL} target="_blank" rel="noreferrer">
              {t('open')}
              <ArrowUpRight className="opacity-70" />
            </a>
          </Button>
        </div>
        <DialogClose className="absolute end-3 top-3 inline-flex size-8 items-center justify-center rounded-lg bg-background/70 text-foreground backdrop-blur-sm transition-colors hover:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden">
          <X className="size-4" />
          <span className="sr-only">{tCommon('close')}</span>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
