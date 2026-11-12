'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { proEdition } from '@/cloud';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ONBOARDING_SLIDES as slides } from '../utils/slides';
import OnboardingFooter from './OnboardingFooter';
import OnboardingSlide from './OnboardingSlide';

// The slides sit side by side in a strip that scrolls and snaps, so a swipe moves them as
// well as the buttons do. Unless closable, it has no close button and ignores Escape and
// clicks outside: it ends only with the button on the last slide.
export default function OnboardingDialog({
  closable,
  onClose,
}: {
  closable: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('onboarding');
  const tCommon = useTranslations('common');
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const onScroll = () => {
    const track = trackRef.current;
    if (track) setIndex(Math.round(Math.abs(track.scrollLeft) / track.clientWidth));
  };

  const go = (next: number) => {
    const track = trackRef.current;
    if (!track) return;
    // In a right-to-left layout the strip scrolls to negative offsets.
    const sign = getComputedStyle(track).direction === 'rtl' ? -1 : 1;
    track.scrollTo({ left: sign * next * track.clientWidth });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && closable && onClose()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="gap-0 overflow-hidden p-0 sm:max-w-[640px]"
      >
        <DialogTitle className="sr-only">{t('label')}</DialogTitle>
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="flex min-w-0 snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto motion-safe:scroll-smooth"
        >
          {slides.map((slide, i) => (
            <OnboardingSlide key={slide.id} slide={slide} inert={i !== index} />
          ))}
        </div>
        <OnboardingFooter
          count={slides.length}
          index={index}
          proLink={!proEdition && Boolean(slides[index]?.proLink)}
          onGo={go}
          onDone={onClose}
        />
        {closable && (
          <DialogClose className="absolute end-3 top-3 inline-flex size-8 items-center justify-center rounded-lg bg-background/70 text-foreground backdrop-blur-sm transition-colors hover:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden">
            <X className="size-4" />
            <span className="sr-only">{tCommon('close')}</span>
          </DialogClose>
        )}
      </DialogContent>
    </Dialog>
  );
}
